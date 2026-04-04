import React from 'react'
import { Shield, ShieldOff, Key, Lock } from 'lucide-react'
import { useAuthStore } from '../store'

export default function Settings() {
  const { user } = useAuthStore()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
      <div className="animate-fade-in">
        <h1 style={{ marginBottom: 4 }}>Settings</h1>
        <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Account security, notifications, and platform preferences</p>
      </div>

      {/* Profile */}
      <div className="card animate-fade-in">
        <div className="card-header"><span className="card-title">Profile</span></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-brand-500), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
              {user?.full_name?.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user?.full_name}</div>
              <div style={{ color: 'var(--c-text-secondary)', fontSize: '0.875rem' }}>{user?.email}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--c-brand-400)', marginTop: 2 }}>{user?.role} · {user?.branch_name || 'Head Office'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card animate-fade-in">
        <div className="card-header"><span className="card-title">Security</span></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--c-border)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Multi-Factor Authentication</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)' }}>TOTP via Google Authenticator or Authy</div>
            </div>
            <span className={`badge ${user?.mfa_enabled ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {user?.mfa_enabled ? <Shield size={11} /> : <ShieldOff size={11} />}
              {user?.mfa_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={13} /> Change Password
          </button>
          {!user?.mfa_enabled && (
            <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={13} /> Enable MFA
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="card animate-fade-in">
        <div className="card-header"><span className="card-title">Notifications</span></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Low Stock Alerts', 'Expiry Risk Warnings', 'Anomaly Detection Alerts', 'Daily Summary Reports', 'Replenishment Approvals'].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
              <span style={{ fontSize: '0.875rem' }}>{n}</span>
              <div style={{ width: 44, height: 24, background: 'var(--c-brand-500)', borderRadius: 'var(--r-full)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: 'flex-end' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System info */}
      <div className="card animate-fade-in">
        <div className="card-header"><span className="card-title">System Information</span></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '0.8rem' }}>
            {[
              ['Platform Version', 'PharmaCentral v1.0.0'],
              ['Environment',      'Production'],
              ['API Gateway',      'Nginx + FastAPI'],
              ['Database',         'PostgreSQL 16'],
              ['Auth',             'JWT RS256 + TOTP MFA'],
              ['AI Models',        'Prophet + LightGBM'],
              ['LLM Provider',     'Groq (llama-3.3-70b)'],
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <span style={{ color: 'var(--c-text-muted)' }}>{k}</span>
                <span className="font-mono" style={{ color: 'var(--c-brand-400)' }}>{v}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
