"""
Auth Service - Route Handlers
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db
from app.models import User, UserSession, AuditLog, Role, Branch
from app.schemas import (
    LoginRequest, LoginResponse, RefreshTokenRequest, TokenResponse,
    ChangePasswordRequest, MFASetupResponse, MFAVerifyRequest,
    CreateUserRequest, UpdateUserRequest, UserResponse, PaginatedUsersResponse,
    UserInfo,
)
from app.security import PasswordManager, JWTManager, MFAManager, RateLimiter
from app.dependencies import get_current_user, require_permission
from app.config import settings
import math

auth_router = APIRouter()
users_router = APIRouter()


# ─── Helper ───────────────────────────────────────────────────────────────────

async def _log_audit(db: AsyncSession, user_id, username, action, details, ip, ua, success=True):
    log = AuditLog(
        user_id=user_id, username=username, action=action,
        details=details, ip_address=ip, user_agent=ua, success=success
    )
    db.add(log)
    await db.commit()


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@auth_router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host
    ua = request.headers.get("user-agent", "")[:500]

    # Fetch user
    result = await db.execute(select(User).where(User.username == body.username.lower()))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        await _log_audit(db, None, body.username, "LOGIN_FAILED", {"reason": "user_not_found"}, ip, ua, False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Lockout check
    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining = (user.locked_until - datetime.utcnow()).seconds // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked. Try again in {remaining} minutes."
        )

    # Password verification
    if not PasswordManager.verify_password(body.password, user.password_hash):
        user.failed_login_attempts += 1
        if RateLimiter.should_lock(user.failed_login_attempts):
            user.locked_until = RateLimiter.get_lockout_until()
        await db.commit()
        await _log_audit(db, user.id, user.username, "LOGIN_FAILED", {"reason": "wrong_password"}, ip, ua, False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # MFA check
    if user.mfa_enabled:
        if not body.mfa_code:
            return LoginResponse(
                access_token="", refresh_token="",
                expires_in=0, user=None, requires_mfa=True
            )
        if not MFAManager.verify_totp(user.mfa_secret, body.mfa_code):
            await _log_audit(db, user.id, user.username, "LOGIN_FAILED", {"reason": "mfa_invalid"}, ip, ua, False)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    # Reset failed attempts
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.utcnow()

    # Build token payload
    await db.refresh(user, ["role", "branch"])
    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.name,
        "branch_id": user.branch_id,
        "permissions": user.role.permissions,
    }
    access_token = JWTManager.create_access_token(token_data)
    refresh_token = JWTManager.create_refresh_token({"sub": str(user.id)})

    # Store session
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=JWTManager.hash_refresh_token(refresh_token),
        ip_address=ip, user_agent=ua,
        expires_at=datetime.utcnow() + __import__("datetime").timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    await _log_audit(db, user.id, user.username, "LOGIN_SUCCESS", {"ip": ip}, ip, ua)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInfo(
            id=user.id, username=user.username, full_name=user.full_name,
            email=user.email, role=user.role.name,
            permissions=user.role.permissions or [],
            branch_id=user.branch_id,
            branch_name=user.branch.name if user.branch else None,
            mfa_enabled=user.mfa_enabled,
        ),
        requires_mfa=False,
    )


@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = JWTManager.decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    token_hash = JWTManager.hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
            UserSession.is_active == True,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found or expired")

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one()
    await db.refresh(user, ["role"])

    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.name,
        "branch_id": user.branch_id,
        "permissions": user.role.permissions,
    }
    new_access = JWTManager.create_access_token(token_data)

    return TokenResponse(access_token=new_access, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@auth_router.post("/logout")
async def logout(
    request: Request,
    body: RefreshTokenRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_hash = JWTManager.hash_refresh_token(body.refresh_token)
    await db.execute(
        update(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
            UserSession.user_id == current_user["sub"],
        ).values(is_active=False)
    )
    await db.commit()
    return {"message": "Logged out successfully"}


@auth_router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalar_one()
    secret = MFAManager.generate_secret()
    user.mfa_secret = secret
    await db.commit()
    uri = MFAManager.get_totp_uri(secret, user.username)
    return MFASetupResponse(
        secret=secret,
        totp_uri=uri,
        qr_code_url=f"https://api.qrserver.com/v1/create-qr-code/?data={uri}&size=200x200"
    )


@auth_router.post("/mfa/verify")
async def verify_mfa(
    body: MFAVerifyRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalar_one()
    if not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA not set up. Call /mfa/setup first.")
    if not MFAManager.verify_totp(user.mfa_secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    user.mfa_enabled = True
    await db.commit()
    return {"message": "MFA enabled successfully"}


@auth_router.get("/audit")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    current_user=Depends(require_permission("users:read")), # Head Admin/Branch Manager
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog)
    if search:
        from sqlalchemy import or_
        q = q.where(
            or_(AuditLog.action.ilike(f"%{search}%"), AuditLog.username.ilike(f"%{search}%"))
        )
    
    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_result.scalar()

    q = q.order_by(AuditLog.performed_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    logs = result.scalars().all()

    return {
        "items": [{
            "id": log.id,
            "action": log.action,
            "user": log.username or str(log.user_id),
            "resource": log.resource or "auth",
            "details": log.details,
            "timestamp": log.performed_at.isoformat() if log.performed_at else None,
            "success": log.success,
            "ip": log.ip_address,
        } for log in logs],
        "total": total,
        "page": page,
        "per_page": per_page
    }

# ─── User Management Routes ───────────────────────────────────────────────────

@users_router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    current_user=Depends(require_permission("users:create")),
    db: AsyncSession = Depends(get_db),
):
    valid, msg = PasswordManager.validate_strength(body.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    role_result = await db.execute(select(Role).where(Role.id == body.role_id))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role_id")

    user = User(
        username=body.username.lower(),
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        employee_id=body.employee_id,
        role_id=body.role_id,
        branch_id=body.branch_id,
        password_hash=PasswordManager.hash_password(body.password),
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user, ["role", "branch"])

    return UserResponse(
        id=user.id, username=user.username, email=user.email,
        full_name=user.full_name, phone=user.phone,
        employee_id=user.employee_id, role_id=user.role_id,
        role_name=user.role.name, branch_id=user.branch_id,
        branch_name=user.branch.name if user.branch else None,
        is_active=user.is_active, mfa_enabled=user.mfa_enabled,
        last_login=user.last_login, created_at=user.created_at,
    )


@users_router.get("", response_model=PaginatedUsersResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    role_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user=Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if role_id:
        query = query.where(User.role_id == role_id)
    if branch_id:
        query = query.where(User.branch_id == branch_id)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if search:
        from sqlalchemy import or_
        query = query.where(
            or_(User.username.ilike(f"%{search}%"), User.full_name.ilike(f"%{search}%"))
        )

    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for u in users:
        await db.refresh(u, ["role", "branch"])
        items.append(UserResponse(
            id=u.id, username=u.username, email=u.email,
            full_name=u.full_name, phone=u.phone, employee_id=u.employee_id,
            role_id=u.role_id, role_name=u.role.name,
            branch_id=u.branch_id, branch_name=u.branch.name if u.branch else None,
            is_active=u.is_active, mfa_enabled=u.mfa_enabled,
            last_login=u.last_login, created_at=u.created_at,
        ))

    return PaginatedUsersResponse(
        items=items, total=total, page=page, per_page=per_page,
        pages=math.ceil(total / per_page)
    )
