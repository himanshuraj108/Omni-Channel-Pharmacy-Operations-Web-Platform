import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'
import type { AuthUser } from '../store'
import toast from 'react-hot-toast'

// ── Demo accounts (no backend needed) ────────────────────────────────────────
const DEMO_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  admin: {
    password: 'Admin@1234',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      full_name: 'Rohit Sharma',
      email: 'admin@pharmaops.in',
      role: 'HEAD_ADMIN',
      permissions: ['admin:all'],
      branch_id: null,
      branch_name: null,
      mfa_enabled: false,
    },
  },
  manager: {
    password: 'Manager@1',
    user: {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'manager',
      full_name: 'Anita Patel',
      email: 'bm.mum001@pharmaops.in',
      role: 'BRANCH_MANAGER',
      permissions: ['inventory:read','inventory:update','billing:create','billing:read','reports:read','ai:access','audit:read','replenishment:create','replenishment:read','users:read','prescriptions:create','prescriptions:read'],
      branch_id: 1,
      branch_name: 'MUM001 — Andheri West',
      mfa_enabled: false,
    },
  },
  staff: {
    password: 'Staff@123',
    user: {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'staff',
      full_name: 'Kiran Mehta',
      email: 'staff.mum001a@pharmaops.in',
      role: 'COUNTER_STAFF',
      permissions: ['products:read','inventory:read','billing:create','billing:read','prescriptions:create','prescriptions:read'],
      branch_id: 1,
      branch_name: 'MUM001 — Andheri West',
      mfa_enabled: false,
    },
  },
}

function demoLogin(username: string, password: string) {
  const account = DEMO_ACCOUNTS[username.toLowerCase()]
  if (account && account.password === password) return account.user
  return null
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ username: '', password: '', mfa_code: '' })
  const [loading, setLoading] = useState(false)
  const [requiresMfa, setRequiresMfa] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulate network latency for realistic UX
    await new Promise((r) => setTimeout(r, 600))

    const demoUser = demoLogin(form.username, form.password)
    if (demoUser) {
      const fakeToken = `demo.${btoa(JSON.stringify({ sub: demoUser.id, role: demoUser.role }))}.signature`
      setAuth(demoUser, fakeToken, `refresh_${fakeToken}`)
      toast.success(`Welcome back, ${demoUser.full_name}! 👋`, { duration: 3000 })
      setLoading(false)
      navigate('/dashboard')
      return
    }

    // Fallback: real API call when backend is available
    try {
      const { default: axios } = await import('axios')
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost/api/v1'
      const { data } = await axios.post(`${API_BASE}/auth/login`, {
        username: form.username,
        password: form.password,
        mfa_code: form.mfa_code || undefined,
      })
      if (data.requires_mfa) {
        setRequiresMfa(true)
        toast('Enter your MFA code to continue', { icon: '🔐' })
        setLoading(false)
        return
      }
      setAuth(data.user, data.access_token, data.refresh_token)
      toast.success(`Welcome back, ${data.user.full_name}!`)
      navigate('/dashboard')
    } catch {
      toast.error('Invalid credentials. Try the demo accounts below.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', padding: '24px', position: 'relative', overflow: 'hidden' }}>

      {/* Background glow orbs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,147,105,0.08) 0%, transparent 70%)', top: -200, left: -200, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', bottom: -100, right: -100, pointerEvents: 'none' }} />

      <div className="animate-scale-in" style={{ width: '100%', maxWidth: 420, zIndex: 1 }}>

        {/* Logo & Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--r-lg)', background: 'linear-gradient(135deg, var(--c-brand-500), var(--c-brand-700))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: 'var(--shadow-glow)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M13 14H19M16 11V17" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M10 22C10 19.8 12.7 18 16 18S22 19.8 22 22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 6, letterSpacing: '-0.03em' }}>PharmaCentral</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Omni-Channel Operations Platform</p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ background: 'var(--c-surface-1)', border: '1px solid var(--c-border-2)' }}>
          <div className="card-body">
            <h2 style={{ fontSize: '1.1rem', marginBottom: 24 }}>Sign in to your account</h2>

            {requiresMfa && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '0.875rem' }}>🔐 Enter the 6-digit code from your authenticator app.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!requiresMfa && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="username">Username</label>
                    <input
                      id="username"
                      className="form-input"
                      type="text"
                      placeholder="Enter your username"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <input
                      id="password"
                      className="form-input"
                      type="password"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </>
              )}

              {requiresMfa && (
                <div className="form-group">
                  <label className="form-label" htmlFor="mfa">MFA Code</label>
                  <input
                    id="mfa"
                    className="form-input"
                    type="text"
                    placeholder="000000"
                    value={form.mfa_code}
                    onChange={(e) => setForm({ ...form, mfa_code: e.target.value })}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    autoFocus
                    style={{ letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', fontSize: '1.25rem', textAlign: 'center' }}
                  />
                </div>
              )}

              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading}
                style={{ marginTop: 8 }}
              >
                {loading ? (
                  <><span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} /> Signing in...</>
                ) : requiresMfa ? 'Verify MFA' : 'Sign In'}
              </button>

              {requiresMfa && (
                <button type="button" className="btn btn-ghost w-full" onClick={() => setRequiresMfa(false)}>
                  ← Back to login
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Demo credentials */}
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(45,147,105,0.06)', border: '1px solid rgba(45,147,105,0.15)', borderRadius: 'var(--r-md)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Demo Credentials</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { role: 'Head Admin', u: 'admin', p: 'Admin@1234' },
              { role: 'Branch Manager', u: 'manager', p: 'Manager@1' },
              { role: 'Counter Staff', u: 'staff', p: 'Staff@123' },
            ].map(({ role, u, p }) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setForm({ username: u, password: p, mfa_code: '' })
                  setRequiresMfa(false)
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0', display: 'flex', gap: 8 }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--c-brand-400)', fontWeight: 600 }}>{role}:</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--c-text-secondary)' }}>{u} / {p}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.7rem', marginTop: 24 }}>
          © 2024 PharmaCentral. All rights reserved. v1.0.0
        </p>
      </div>
    </div>
  )
}
