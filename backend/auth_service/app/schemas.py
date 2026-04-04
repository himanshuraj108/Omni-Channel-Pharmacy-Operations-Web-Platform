"""
Auth Service - Pydantic Schemas (Request/Response models)
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, validator
import re


class LoginRequest(BaseModel):
    username: str
    password: str
    mfa_code: Optional[str] = None

    class Config:
        str_strip_whitespace = True


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: "UserInfo"
    requires_mfa: bool = False


class UserInfo(BaseModel):
    id: UUID
    username: str
    full_name: str
    email: str
    role: str
    permissions: List[str]
    branch_id: Optional[int]
    branch_name: Optional[str]
    mfa_enabled: bool

    class Config:
        from_attributes = True


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        if "new_password" in values and v != values["new_password"]:
            raise ValueError("Passwords do not match")
        return v


class MFASetupResponse(BaseModel):
    secret: str
    totp_uri: str
    qr_code_url: str


class MFAVerifyRequest(BaseModel):
    code: str


class CreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    role_id: int
    branch_id: Optional[int] = None
    password: str

    @validator("username")
    def username_alphanumeric(cls, v):
        if not re.match(r"^[a-zA-Z0-9_]{3,50}$", v):
            raise ValueError("Username must be 3-50 alphanumeric characters or underscores")
        return v.lower()


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    branch_id: Optional[int] = None


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    full_name: str
    phone: Optional[str]
    employee_id: Optional[str]
    role_id: int
    role_name: str
    branch_id: Optional[int]
    branch_name: Optional[str]
    is_active: bool
    mfa_enabled: bool
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedUsersResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    per_page: int
    pages: int


LoginResponse.model_rebuild()
