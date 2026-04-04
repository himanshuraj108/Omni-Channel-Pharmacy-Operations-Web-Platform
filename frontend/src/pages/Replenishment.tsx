import React, { useState, useEffect } from 'react'
import { Plus, CheckCircle, X, Eye, Loader2 } from 'lucide-react'
import { inventoryApi } from '../lib/api'
import { useAuthStore } from '../store'

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'badge-warning', APPROVED: 'badge-info',
  IN_TRANSIT: 'badge-brand', COMPLETED: 'badge-success', REJECTED: 'badge-danger',
}

interface Transfer {
  id: string
  transfer_ref: string
  product_id: string
  product_name: string
  from_branch_id: number
  to_branch_id: number
  quantity: number
  estimated_value: number
  status: string
  requested_by: string
  created_at: string
}

export default function Replenishment() {
  const { user } = useAuthStore()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New Transfer Form State
  const [showModal, setShowModal] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formData, setFormData] = useState({
    from_branch: 1,
    to_branch: 2,
    product_id: '',
    quantity: 1,
  })
  const [products, setProducts] = useState<any[]>([])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await inventoryApi.listTransfers()
      setTransfers(res.data.items)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load transfers')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const res = await inventoryApi.listProducts({ per_page: 200 })
      setProducts(res.data.items)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await inventoryApi.updateTransferStatus(id, { status: newStatus, approved_by: user?.id })
      loadData()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update status')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitLoading(true)
    try {
      await inventoryApi.createTransfer({
        from_branch_id: Number(formData.from_branch),
        to_branch_id: Number(formData.to_branch),
        product_id: formData.product_id,
        quantity: Number(formData.quantity),
        requested_by: user?.id
      })
      setShowModal(false)
      loadData()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create request')
    } finally {
      setSubmitLoading(false)
    }
  }

  const pendingCount = transfers.filter(t => t.status === 'PENDING').length
  const inTransitCount = transfers.filter(t => t.status === 'IN_TRANSIT' || t.status === 'APPROVED').length
  const completedCount = transfers.filter(t => t.status === 'COMPLETED').length
  const transitValue = transfers
     .filter(t => t.status === 'IN_TRANSIT' || t.status === 'APPROVED')
     .reduce((acc, t) => acc + t.estimated_value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400 }}>
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ width: 450 }}>
            <h3>New Transfer Request</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 15 }}>
              <div className="form-group">
                <label>Product</label>
                <select 
                  required 
                  className="input-field"
                  value={formData.product_id}
                  onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                  onFocus={() => { if (products.length === 0) loadProducts() }}
                >
                  <option value="">Select Product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} [{p.sku}]</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>From Branch ID</label>
                  <input type="number" required className="input-field" value={formData.from_branch} onChange={e => setFormData({ ...formData, from_branch: Number(e.target.value) })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>To Branch ID</label>
                  <input type="number" required className="input-field" value={formData.to_branch} onChange={e => setFormData({ ...formData, to_branch: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-group">
                <label>Transfer Quantity</label>
                <input type="number" min="1" required className="input-field" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                  {submitLoading ? <Loader2 size={16} className="animate-spin" /> : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Replenishment Planning</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Inter-branch stock transfers and purchase order management</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Transfer Request
        </button>
      </div>

      <div className="grid-4 animate-fade-in">
        {[
          { label: 'Pending Approval', value: pendingCount,   color: 'var(--c-warning)'    },
          { label: 'Active / In Transit', value: inTransitCount,   color: 'var(--c-info)'       },
          { label: 'Completed',        value: completedCount,   color: 'var(--c-success)'    },
          { label: 'Value in Transit', value: `₹${transitValue.toLocaleString('en-IN')}`, color: 'var(--c-brand-500)' },
        ].map((s) => (
          <div key={s.label} className="card card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card animate-fade-in">
        <div className="card-header">
          <span className="card-title">Transfer Requests</span>
          <span className="badge badge-warning animate-pulse">{pendingCount} Awaiting Approval</span>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          {loading ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }}/> Loading transfers...</div>
          ) : error ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-danger)' }}>{error}</div>
          ) : transfers.length === 0 ? (
             <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>No transfers found.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Ref #</th><th>Product</th><th>From</th><th>To</th><th>Qty</th><th>Value</th><th>Status</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td><span className="font-mono text-xs" style={{ color: 'var(--c-brand-400)' }}>{t.transfer_ref}</span></td>
                    <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.product_name}</td>
                    <td><span className="badge badge-muted">BR-{t.from_branch_id}</span></td>
                    <td><span className="badge badge-brand">BR-{t.to_branch_id}</span></td>
                    <td style={{ fontWeight: 700 }}>{t.quantity}</td>
                    <td>₹{t.estimated_value.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${STATUS_STYLE[t.status] || 'badge-muted'}`}>{t.status.replace('_', ' ')}</span></td>
                    <td style={{ color: 'var(--c-text-muted)', fontSize: '0.8rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {t.status === 'PENDING' && (
                          <>
                            <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={() => handleUpdateStatus(t.id, 'APPROVED')}
                            >
                              <CheckCircle size={12} /> Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleUpdateStatus(t.id, 'REJECTED')}><X size={12} /></button>
                          </>
                        )}
                        {t.status === 'APPROVED' && (
                           <button className="btn btn-brand btn-sm" onClick={() => handleUpdateStatus(t.id, 'IN_TRANSIT')}>Ship</button>
                        )}
                        {t.status === 'IN_TRANSIT' && (
                           <button className="btn btn-success btn-sm" onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}>Receive</button>
                        )}
                      </div>
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
