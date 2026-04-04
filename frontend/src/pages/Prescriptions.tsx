import React, { useState, useEffect, useCallback } from 'react'
import { Search, FileText, Eye, CheckCircle, Clock, Receipt, Plus, Loader2, X, Check } from 'lucide-react'
import { billingApi } from '../lib/api'
import { useUIStore, useAuthStore } from '../store'

function CreateRxModal({ branchId, userId, onClose, onSave }: { branchId: number; userId: string; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ patient_name: '', patient_age: '', patient_gender: 'M', patient_phone: '', doctor_name: '', doctor_reg_no: '', hospital_clinic: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await billingApi.createPrescription({ ...form, patient_age: form.patient_age ? parseInt(form.patient_age) : undefined, branch_id: branchId, created_by: userId })
      onSave()
      onClose()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header"><span className="card-title">New Prescription</span><button onClick={onClose} className="btn btn-icon btn-ghost btn-sm"><X size={16} /></button></div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Patient Name *</label><input className="form-input" required value={form.patient_name} onChange={e => setForm(p => ({...p, patient_name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Age / Gender</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type="number" placeholder="Age" value={form.patient_age} onChange={e => setForm(p => ({...p, patient_age: e.target.value}))} style={{ flex: 1 }} />
                <select className="form-input" value={form.patient_gender} onChange={e => setForm(p => ({...p, patient_gender: e.target.value}))} style={{ width: 70 }}>
                  <option value="M">M</option><option value="F">F</option><option value="O">O</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Patient Phone</label><input className="form-input" value={form.patient_phone} onChange={e => setForm(p => ({...p, patient_phone: e.target.value}))} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><hr style={{ borderColor: 'var(--c-border)', margin: '4px 0' }} /></div>
            <div className="form-group"><label className="form-label">Doctor Name *</label><input className="form-input" required value={form.doctor_name} onChange={e => setForm(p => ({...p, doctor_name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Reg. Number</label><input className="form-input" value={form.doctor_reg_no} onChange={e => setForm(p => ({...p, doctor_reg_no: e.target.value}))} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Hospital / Clinic</label><input className="form-input" value={form.hospital_clinic} onChange={e => setForm(p => ({...p, hospital_clinic: e.target.value}))} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Notes (Drugs prescribed)</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Prescriptions() {
  const { user } = useAuthStore()
  const { activeBranchId } = useUIStore()
  const branchId = activeBranchId ?? user?.branch_id ?? 1

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<boolean | null>(null)
  const [prescriptions, setRxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { branch_id: branchId, per_page: 50 }
      if (filter !== null) params.is_verified = filter
      const res = await billingApi.listPrescriptions(params)
      setRxs(res.data?.items || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [branchId, filter])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = prescriptions.filter(rx =>
    !search ||
    (rx.patient_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (rx.doctor_name || '').toLowerCase().includes(search.toLowerCase()) ||
    rx.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400 }}>
      {showCreate && <CreateRxModal branchId={branchId} userId={user?.id || ''} onClose={() => setShowCreate(false)} onSave={fetchData} />}

      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Prescription Management</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Upload, verify, and link prescriptions · Live from database</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Prescription
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="search-box" style={{ width: 280 }}>
          <Search size={14} style={{ color: 'var(--c-text-muted)' }} />
          <input type="text" placeholder="Search patient, doctor, or RX ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className={`btn btn-sm ${filter === null ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilter(null)}>All</button>
        <button className={`btn btn-sm ${filter === false ? 'btn-warning' : 'btn-ghost'}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => setFilter(false)}>
          <Clock size={12} /> Pending Verification
        </button>
        <button className={`btn btn-sm ${filter === true ? 'btn-success' : 'btn-ghost'}`} style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => setFilter(true)}>
          <CheckCircle size={12} /> Verified
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><Loader2 size={32} className="animate-spin text-brand" /></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>
            <FileText size={48} strokeWidth={1} style={{ margin: '0 auto 16px' }} />
            <h3>No Prescriptions Found</h3>
            <p>Upload a new prescription to start linking them to sales orders.</p>
          </div>
        ) : filtered.map((rx) => (
          <div key={rx.id} className="card animate-fade-in" style={{ padding: 0 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              <div style={{ width: 80, background: 'var(--c-surface-2)', borderRadius: 'var(--r-lg) 0 0 var(--r-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--c-text-muted)' }}>
                <FileText size={28} strokeWidth={1.2} />
              </div>
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span className="font-mono text-xs" style={{ color: 'var(--c-brand-400)', fontWeight: 700 }}>{rx.id}</span>
                    <span className={`badge ${rx.is_verified ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {rx.is_verified ? <CheckCircle size={11} /> : <Clock size={11} />}
                      {rx.is_verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>
                    {rx.patient_name}{rx.patient_age ? `, ${rx.patient_age}y` : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)' }}>
                    {rx.doctor_name} · Reg: {rx.doctor_reg_no || '—'} · Date: {new Date(rx.created_at).toLocaleDateString()}
                  </div>
                  {rx.notes && (
                    <div style={{ fontSize: '0.8rem', marginTop: 6, fontStyle: 'italic', color: 'var(--c-text-muted)' }}>
                      Note: {rx.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={12} /> View</button>
                  {!rx.is_verified && <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Verify</button>}
                  <a href="/billing" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Receipt size={12} /> Create Bill</a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
