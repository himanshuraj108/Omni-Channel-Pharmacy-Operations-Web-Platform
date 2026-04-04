import React, { useState, useEffect, useCallback } from 'react'
import { UserPlus, Search, Shield, ShieldOff, Edit2, Key, UserCheck, UserX, Loader2, X, Check } from 'lucide-react'
import { usersApi } from '../lib/api'

const ROLE_BADGE: Record<string, string> = {
  HEAD_ADMIN: 'badge-danger', BRANCH_MANAGER: 'badge-info', COUNTER_STAFF: 'badge-success',
}
const ROLE_LABEL: Record<string, string> = {
  HEAD_ADMIN: 'Head Admin', BRANCH_MANAGER: 'Branch Mgr', COUNTER_STAFF: 'Counter Staff',
}

function CreateUserModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ username: '', email: '', full_name: '', phone: '', employee_id: '', password: '', role_id: '1', branch_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.create({ ...form, role_id: parseInt(form.role_id), branch_id: form.branch_id ? parseInt(form.branch_id) : null })
      onSave()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <span className="card-title">Create New User</span>
          <button onClick={onClose} className="btn btn-icon btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-danger" style={{ fontSize: '0.85rem', padding: '10px 14px' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" required value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Username *</label><input className="form-input" required value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" required value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Employee ID *</label><input className="form-input" required value={form.employee_id} onChange={e => setForm(p => ({...p, employee_id: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Password *</label><input className="form-input" type="password" required value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Role *</label>
              <select className="form-input" value={form.role_id} onChange={e => setForm(p => ({...p, role_id: e.target.value}))}>
                <option value="1">Head Admin</option>
                <option value="2">Branch Manager</option>
                <option value="3">Counter Staff</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Branch ID</label><input className="form-input" type="number" placeholder="Leave blank for HO" value={form.branch_id} onChange={e => setForm(p => ({...p, branch_id: e.target.value}))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditUserModal({ user, onClose, onSave }: { user: any; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    email: user.email || '',
    phone: user.phone || '',
    role_id: String(user.role_id || '2'),
    branch_id: String(user.branch_id || ''),
    is_active: user.is_active,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.update(user.id, {
        ...form,
        role_id: parseInt(form.role_id),
        branch_id: form.branch_id ? parseInt(form.branch_id) : null,
      })
      onSave()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <span className="card-title">Edit User — {user.username}</span>
          <button onClick={onClose} className="btn btn-icon btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-danger" style={{ fontSize: '0.85rem', padding: '10px 14px' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Branch ID</label><input className="form-input" type="number" placeholder="Leave blank for HO" value={form.branch_id} onChange={e => setForm(p => ({...p, branch_id: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Role</label>
              <select className="form-input" value={form.role_id} onChange={e => setForm(p => ({...p, role_id: e.target.value}))}>
                <option value="1">Head Admin</option>
                <option value="2">Branch Manager</option>
                <option value="3">Counter Staff</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-input" value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({...p, is_active: e.target.value === 'true'}))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Users() {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<any | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: 1, per_page: 50 }
      if (search) params.search = search
      const res = await usersApi.list(params)
      setUsers(res.data?.items || [])
      setTotal(res.data?.total || 0)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await usersApi.update(userId, { is_active: !currentStatus })
      fetchUsers()
    } catch (err) { console.error(err) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200 }}>
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSave={fetchUsers} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSave={fetchUsers} />}

      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>User Management</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            {loading ? 'Loading...' : `${total} team members in the system`}
          </p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowCreate(true)}>
          <UserPlus size={14} /> Add User
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="search-box" style={{ width: 280 }}>
          <Search size={14} style={{ color: 'var(--c-text-muted)' }} />
          <input id="users-search" type="text" placeholder="Search by name or username…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card animate-fade-in">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--c-brand-400)' }} />
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--c-text-muted)' }}>
            <UserPlus size={48} strokeWidth={1} style={{ margin: '0 auto 16px' }} />
            <h3>No Users Found</h3>
            <p>Create your first team member to get started</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}><UserPlus size={13} /> Create User</button>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th>Username</th><th>Role</th><th>Branch</th>
                  <th>Status</th><th>Last Login</th><th>MFA</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-brand-500), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, color: '#fff' }}>
                          {u.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.full_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{u.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="font-mono text-xs">{u.username}</span></td>
                    <td><span className={`badge ${ROLE_BADGE[u.role_name] || 'badge-muted'}`}>{ROLE_LABEL[u.role_name] || u.role_name}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)' }}>{u.branch_name || 'Head Office'}</td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-muted'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {u.is_active ? <UserCheck size={11} /> : <UserX size={11} />}
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                    </td>
                    <td>
                      <span className={`badge ${u.mfa_enabled ? 'badge-success' : 'badge-muted'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {u.mfa_enabled ? <Shield size={11} /> : <ShieldOff size={11} />}
                        {u.mfa_enabled ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-icon btn-ghost btn-sm" title="Edit user" onClick={() => setEditUser(u)}><Edit2 size={13} /></button>
                        <button className="btn btn-icon btn-ghost btn-sm" title="Reset MFA"><Key size={13} /></button>
                        <button
                          className="btn btn-icon btn-ghost btn-sm"
                          style={{ color: u.is_active ? 'var(--c-danger)' : 'var(--c-success)' }}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleStatus(u.id, u.is_active)}
                        >
                          {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
