import React, { useState } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuthStore, useUIStore } from './store'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Billing from './pages/Billing'
import Prescriptions from './pages/Prescriptions'
import Reports from './pages/Reports'
import AIConsole from './pages/AIConsole'
import Users from './pages/Users'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'
import Replenishment from './pages/Replenishment'

function ProtectedLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, clearAuth } = useAuthStore()

  const handleLogout = async () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--c-bg)' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        currentPath={location.pathname}
        onNavigate={navigate}
      />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: 57, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-surface-0)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Notification bell */}
            <button className="btn btn-icon btn-ghost" style={{ position: 'relative' }} id="notifications-btn">
              <Bell size={16} />
              <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'var(--c-danger)', borderRadius: '50%', border: '2px solid var(--c-surface-0)' }} />
            </button>

            {/* User avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid var(--c-border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-brand-500),var(--c-brand-700))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user?.full_name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--c-text-muted)' }}>{user?.branch_name || 'Head Office'}</span>
              </div>
            </div>

            <button id="logout-btn" onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Routes>
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/inventory"      element={<Inventory />} />
            <Route path="/billing"        element={<Billing />} />
            <Route path="/prescriptions"  element={<Prescriptions />} />
            <Route path="/replenishment"  element={<Replenishment />} />
            <Route path="/reports"        element={<Reports />} />
            <Route path="/ai"             element={<AIConsole />} />
            <Route path="/users"          element={<Users />} />
            <Route path="/audit"          element={<AuditLog />} />
            <Route path="/settings"       element={<Settings />} />
            <Route path="*"               element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <RequireAuth>
          <ProtectedLayout />
        </RequireAuth>
      } />
    </Routes>
  )
}
