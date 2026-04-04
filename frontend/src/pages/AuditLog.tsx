import React, { useState, useEffect } from 'react'
import { Search, Lock, Download, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { authApi } from '../lib/api'

const ACTION_COLOR: Record<string, string> = {
  LOGIN_SUCCESS: 'var(--c-success)', LOGIN_FAILED: 'var(--c-danger)',
  ORDER_CREATED: 'var(--c-brand-400)', MFA_VERIFY_FAILED: 'var(--c-danger)',
  BATCH_CREATED: 'var(--c-info)', USER_DEACTIVATED: 'var(--c-warning)',
  ANOMALY_DETECTED: 'var(--c-danger)',
}

interface AuditLogEntry {
  id: number
  action: string
  user: string
  resource: string
  details: any
  timestamp: string
  success: boolean
  ip: string
}

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const res = await authApi.getAuditLogs({ per_page: 100 })
      setLogs(res.data.items)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  const filtered = logs.filter((l) =>
    !search || l.action.toLowerCase().includes(search.toLowerCase()) || l.user.includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400 }}>
      <div className="animate-fade-in">
        <h1 style={{ marginBottom: 4 }}>Audit Log</h1>
        <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Immutable transaction history for compliance and security monitoring. 7-year retention.</p>
      </div>

      <div className="alert alert-info animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Lock size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--c-info)' }} />
        <div style={{ fontSize: '0.8rem' }}>
          <strong style={{ color: 'var(--c-info)' }}>Compliance Notice:</strong> This log is append-only and tamper-evident. All records are retained for 7 years per regulatory requirements.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="search-box" style={{ width: 280 }}>
          <Search size={14} style={{ color: 'var(--c-text-muted)' }} />
          <input
            id="audit-search"
            type="text"
            placeholder="Filter by action or user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}>
          <option>All Actions</option>
          <option>Auth Events</option>
        </select>
        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => loadLogs()}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="card animate-fade-in">
        <div className="table-wrapper" style={{ border: 'none' }}>
          {loading ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }}/> Loading logs...</div>
          ) : error ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-danger)' }}>{error}</div>
          ) : logs.length === 0 ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>No audit logs found.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Time</th><th>Action</th><th>User</th><th>Resource</th><th>Details</th><th>IP</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td><span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--c-text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</span></td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: ACTION_COLOR[log.action] || 'var(--c-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td><span className="font-mono text-xs" style={{ color: 'var(--c-brand-400)' }}>{log.user}</span></td>
                    <td><span className="badge badge-muted">{log.resource}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', maxWidth: 300 }}>
                      <span 
                        title={JSON.stringify(log.details)}
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                      >
                        {JSON.stringify(log.details)}
                      </span>
                    </td>
                    <td><span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--c-text-muted)' }}>{log.ip}</span></td>
                    <td>
                      <span className={`badge ${log.success ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {log.success ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        {log.success ? 'OK' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
