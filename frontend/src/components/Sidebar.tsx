import React from 'react'
import {
  LayoutDashboard, Package, Receipt, Pill, RefreshCw,
  BarChart3, Bot, Users, ShieldCheck, Settings,
  ChevronLeft, ChevronRight, MapPin, CheckCircle2,
} from 'lucide-react'
import { useAuthStore } from '../store'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  currentPath: string
  onNavigate: (path: string) => void
}

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', Icon: LayoutDashboard, label: 'Dashboard', perm: null },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/inventory',     Icon: Package,    label: 'Inventory',       perm: 'inventory:read' },
      { path: '/billing',       Icon: Receipt,    label: 'Billing & POS',   perm: 'billing:read' },
      { path: '/prescriptions', Icon: Pill,       label: 'Prescriptions',   perm: 'billing:read' },
      { path: '/replenishment', Icon: RefreshCw,  label: 'Replenishment',   perm: 'replenishment:read' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { path: '/reports', Icon: BarChart3, label: 'BI Reports',   perm: 'reports:read' },
      { path: '/ai',      Icon: Bot,       label: 'AI Console',   perm: 'ai:access' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/users',    Icon: Users,       label: 'Users',      perm: 'users:read' },
      { path: '/audit',    Icon: ShieldCheck, label: 'Audit Log',  perm: 'audit:read' },
      { path: '/settings', Icon: Settings,    label: 'Settings',   perm: null },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle, currentPath, onNavigate }: SidebarProps) {
  const { user, hasPermission } = useAuthStore()

  const roleColor = {
    HEAD_ADMIN:     'var(--c-brand-400)',
    BRANCH_MANAGER: 'var(--c-info)',
    COUNTER_STAFF:  'var(--c-warning)',
  }[user?.role || 'COUNTER_STAFF']

  const roleLabel = {
    HEAD_ADMIN:     'Head Admin',
    BRANCH_MANAGER: 'Branch Manager',
    COUNTER_STAFF:  'Counter Staff',
  }[user?.role || 'COUNTER_STAFF']

  return (
    <aside style={{
      width: collapsed ? 60 : 240,
      minHeight: '100vh',
      background: 'var(--c-surface-0)',
      borderRight: '1px solid var(--c-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width var(--t-slow)',
      position: 'relative',
      flexShrink: 0,
      zIndex: 10,
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--c-border)', minHeight: 65 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--c-brand-500), var(--c-brand-700))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-glow)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L21 7.5V16.5L12 21L3 16.5V7.5L12 3Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M10 11H14M12 9V13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>PharmaCentral</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--c-text-muted)', marginTop: 1 }}>Operations v1.0</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="btn btn-icon btn-ghost"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 2 }}>{user?.full_name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '0.7rem', color: roleColor, fontWeight: 600 }}>{roleLabel}</span>
            </div>
            {user?.branch_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--c-text-muted)', marginTop: 4 }}>
                <MapPin size={10} />
                <span>{user.branch_name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.perm || hasPermission(item.perm)
          )
          if (!visibleItems.length) return null
          return (
            <div key={group.label} style={{ marginBottom: 8 }}>
              {!collapsed && (
                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text-muted)', padding: '8px 8px 4px' }}>
                  {group.label}
                </div>
              )}
              {visibleItems.map((item) => {
                const isActive = currentPath.startsWith(item.path)
                return (
                  <button
                    key={item.path}
                    id={`nav-${item.path.replace('/', '')}`}
                    onClick={() => onNavigate(item.path)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: collapsed ? '10px 0' : '9px 10px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: isActive ? 'rgba(45,147,105,0.15)' : 'transparent',
                      border: isActive ? '1px solid rgba(45,147,105,0.3)' : '1px solid transparent',
                      borderRadius: 'var(--r-sm)', cursor: 'pointer',
                      color: isActive ? 'var(--c-brand-400)' : 'var(--c-text-secondary)',
                      fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
                      transition: 'all var(--t-fast)', marginBottom: 2,
                    }}
                    onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--c-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-primary)' } }}
                    onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-secondary)' } }}
                  >
                    <item.Icon size={16} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && isActive && <CheckCircle2 size={8} style={{ marginLeft: 'auto', color: 'var(--c-brand-400)', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Online status */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--c-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-success)', display: 'block', boxShadow: '0 0 6px var(--c-success)' }} />
            All systems operational
          </div>
        </div>
      )}
    </aside>
  )
}
