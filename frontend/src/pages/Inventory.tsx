import React, { useState, useEffect, useCallback } from 'react'
import {
  Package, AlertTriangle, Clock, DollarSign, Search,
  Eye, Edit2, Plus, Filter, Layers, BookOpen, Loader2, X, Check, Save,
} from 'lucide-react'
import { inventoryApi } from '../lib/api'
import { useAuthStore, useUIStore } from '../store'

const RISK_STYLE: Record<string, { cls: string; dot: string }> = {
  CRITICAL: { cls: 'badge risk-critical', dot: '#ef4444' },
  WARNING:  { cls: 'badge risk-warning',  dot: '#f59e0b' },
  WATCH:    { cls: 'badge risk-watch',    dot: '#3b82f6' },
  SAFE:     { cls: 'badge risk-safe',     dot: '#22c55e' },
  EXPIRED:  { cls: 'badge badge-danger',  dot: '#ef4444' },
}

function RiskBadge({ risk }: { risk: string }) {
  const s = RISK_STYLE[risk] || { cls: 'badge badge-muted', dot: '#64748b' }
  return (
    <span className={s.cls} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {risk}
    </span>
  )
}

function ScheduleBadge({ schedule }: { schedule: string }) {
  return <span className={`badge ${schedule === 'OTC' ? 'badge-success' : 'badge-warning'}`}>Sch. {schedule}</span>
}

// ─── Add Product Modal ────────────────────────────────────────────────────────
function AddProductModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', generic_name: '', manufacturer: '', sku: '', mrp: '', gst_rate: '12', schedule: 'OTC', unit: 'Strip', low_stock_threshold: '10', reorder_quantity: '50' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await inventoryApi.createProduct({ ...form, mrp: parseFloat(form.mrp), gst_rate: parseFloat(form.gst_rate), low_stock_threshold: parseInt(form.low_stock_threshold), reorder_quantity: parseInt(form.reorder_quantity) })
      onSave()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <span className="card-title">Add New Product</span>
          <button onClick={onClose} className="btn btn-icon btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Product Name *</label><input className="form-input" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Generic Name</label><input className="form-input" value={form.generic_name} onChange={e => setForm(p => ({...p, generic_name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Manufacturer</label><input className="form-input" value={form.manufacturer} onChange={e => setForm(p => ({...p, manufacturer: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">SKU (auto if blank)</label><input className="form-input" value={form.sku} onChange={e => setForm(p => ({...p, sku: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">MRP (₹) *</label><input className="form-input" type="number" step="0.01" required value={form.mrp} onChange={e => setForm(p => ({...p, mrp: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">GST Rate (%)</label><input className="form-input" type="number" value={form.gst_rate} onChange={e => setForm(p => ({...p, gst_rate: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Schedule</label>
              <select className="form-input" value={form.schedule} onChange={e => setForm(p => ({...p, schedule: e.target.value}))}>
                {['OTC','H','H1','X','G'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Unit</label>
              <select className="form-input" value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))}>
                {['Strip','Bottle','Vial','Tube','Sachet','Ampoule'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Low Stock Threshold</label><input className="form-input" type="number" value={form.low_stock_threshold} onChange={e => setForm(p => ({...p, low_stock_threshold: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Reorder Quantity</label><input className="form-input" type="number" value={form.reorder_quantity} onChange={e => setForm(p => ({...p, reorder_quantity: e.target.value}))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Batch Modal ──────────────────────────────────────────────────────────
function AddBatchModal({ products, branchId, userId, onClose, onSave }: { products: any[]; branchId: number; userId: string; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ product_id: '', batch_no: '', expiry_date: '', manufacture_date: '', quantity_received: '', purchase_price: '', location_code: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await inventoryApi.createBatch({ ...form, quantity_received: parseInt(form.quantity_received), purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined, branch_id: branchId, created_by: userId })
      onSave()
      onClose()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <span className="card-title">Add Batch / Receive Stock</span>
          <button onClick={onClose} className="btn btn-icon btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">Product *</label>
            <select className="form-input" required value={form.product_id} onChange={e => setForm(p => ({...p, product_id: e.target.value}))}>
              <option value="">Select product...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Batch No *</label><input className="form-input" required value={form.batch_no} onChange={e => setForm(p => ({...p, batch_no: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Quantity *</label><input className="form-input" type="number" required value={form.quantity_received} onChange={e => setForm(p => ({...p, quantity_received: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Expiry Date *</label><input className="form-input" type="date" required value={form.expiry_date} onChange={e => setForm(p => ({...p, expiry_date: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Mfg Date</label><input className="form-input" type="date" value={form.manufacture_date} onChange={e => setForm(p => ({...p, manufacture_date: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Purchase Price (₹)</label><input className="form-input" type="number" step="0.01" value={form.purchase_price} onChange={e => setForm(p => ({...p, purchase_price: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Shelf Location</label><input className="form-input" placeholder="e.g. A-12" value={form.location_code} onChange={e => setForm(p => ({...p, location_code: e.target.value}))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Add Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Product Modal ───────────────────────────────────────────────────────
function EditProductModal({ product, onClose, onSave }: { product: any; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: product.name || '',
    generic_name: product.generic_name || '',
    manufacturer: product.manufacturer || '',
    mrp: String(product.mrp || ''),
    gst_rate: String(product.gst_rate || '12'),
    schedule: product.schedule || 'OTC',
    unit: product.unit || 'Strip',
    low_stock_threshold: String(product.threshold ?? product.low_stock_threshold ?? '10'),
    reorder_quantity: String(product.reorder_quantity || '50'),
    is_active: product.is_active !== false,
    description: product.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const productId = product.product_id || product.id
      await inventoryApi.updateProduct(productId, {
        ...form,
        mrp: parseFloat(form.mrp),
        gst_rate: parseFloat(form.gst_rate),
        low_stock_threshold: parseInt(form.low_stock_threshold),
        reorder_quantity: parseInt(form.reorder_quantity),
      })
      setSuccess(true)
      setTimeout(() => { onSave(); onClose() }, 800)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update product. Check your inputs.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="card-header">
          <span className="card-title">Edit Product — {product.sku}</span>
          <button onClick={onClose} className="btn btn-icon btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-danger" style={{ fontSize: '0.85rem', padding: '10px 14px' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ fontSize: '0.85rem', padding: '10px 14px' }}>✅ Product updated successfully!</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Product Name *</label><input className="form-input" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Generic Name</label><input className="form-input" value={form.generic_name} onChange={e => setForm(p => ({...p, generic_name: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Manufacturer</label><input className="form-input" value={form.manufacturer} onChange={e => setForm(p => ({...p, manufacturer: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">MRP (₹) *</label><input className="form-input" type="number" step="0.01" required value={form.mrp} onChange={e => setForm(p => ({...p, mrp: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">GST Rate (%)</label><input className="form-input" type="number" value={form.gst_rate} onChange={e => setForm(p => ({...p, gst_rate: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Schedule</label>
              <select className="form-input" value={form.schedule} onChange={e => setForm(p => ({...p, schedule: e.target.value}))}>
                {['OTC','H','H1','X','G'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Unit</label>
              <select className="form-input" value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))}>
                {['Strip','Bottle','Vial','Tube','Sachet','Ampoule'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Low Stock Threshold</label><input className="form-input" type="number" value={form.low_stock_threshold} onChange={e => setForm(p => ({...p, low_stock_threshold: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Reorder Quantity</label><input className="form-input" type="number" value={form.reorder_quantity} onChange={e => setForm(p => ({...p, reorder_quantity: e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-input" value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({...p, is_active: e.target.value === 'true'}))}>
                <option value="true">Active</option>
                <option value="false">Discontinued</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || success} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Inventory() {
  const { user } = useAuthStore()
  const { activeBranchId } = useUIStore()
  const branchId = activeBranchId ?? user?.branch_id ?? 1

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [tab, setTab] = useState<'products' | 'batches' | 'ledger'>('products')
  const [products, setProducts] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddBatch, setShowAddBatch] = useState(false)
  const [editProduct, setEditProduct] = useState<any | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'products') {
        const params: any = {}
        if (search) params.search = search
        if (filter === 'LOW_STOCK') {
          const [stockRes, allProductsRes] = await Promise.all([
            inventoryApi.getLowStock(branchId),
            inventoryApi.getBranchStock(branchId, {}),
          ])
          const lowIds = new Set((stockRes.data || []).map((i: any) => i.product_id))
          const stockItems = (allProductsRes.data?.items || []).filter((i: any) => lowIds.has(i.product_id))
          setProducts(stockItems)
          setSummary(allProductsRes.data?.summary)
        } else if (filter === 'EXPIRY_RISK') {
          const res = await inventoryApi.getExpiryRisk(branchId)
          // De-dup by product
          const seen = new Set()
          const uniq = (res.data || []).filter((i: any) => { if (seen.has(i.product_id)) return false; seen.add(i.product_id); return true })
          setProducts(uniq.map((i: any) => ({ product_id: i.product_id, name: i.product_name, sku: i.product_sku, stock: i.quantity_available, threshold: 0, mrp: 0, expiry_risk: i.expiry_risk, schedule: '' })))
          setSummary(null)
        } else {
          const res = await inventoryApi.getBranchStock(branchId, params)
          setProducts(res.data?.items || [])
          setSummary(res.data?.summary)
        }
      } else if (tab === 'batches') {
        const res = await inventoryApi.listBatches({ branch_id: branchId })
        setBatches(res.data?.items || [])
      } else {
        const res = await inventoryApi.getStockLedger(branchId)
        setLedger(res.data?.items || [])
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [tab, search, filter, branchId])

  // Also fetch all products for the batch modal
  const [allProducts, setAllProducts] = useState<any[]>([])
  useEffect(() => {
    inventoryApi.listProducts({ per_page: 200 }).then(r => setAllProducts(r.data?.items || [])).catch(() => {})
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const t = setTimeout(() => fetchData(), 300)
    return () => clearTimeout(t)
  }, [search])

  const displayItems = products

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600 }}>

      {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} onSave={fetchData} />}
      {showAddBatch && <AddBatchModal products={allProducts} branchId={branchId} userId={user?.id || ''} onClose={() => setShowAddBatch(false)} onSave={fetchData} />}
      {editProduct && <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} onSave={fetchData} />}

      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Inventory Management</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Real-time stock from database · Branch {branchId}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="add-batch-btn" className="btn btn-secondary btn-sm" onClick={() => setShowAddBatch(true)}><Plus size={13} /> Add Batch</button>
          <button id="add-product-btn" className="btn btn-primary btn-sm" onClick={() => setShowAddProduct(true)}><Plus size={13} /> Add Product</button>
        </div>
      </div>

      <div className="grid-4 animate-fade-in">
        {[
          { label: 'Total SKUs',      value: summary ? String(summary.total_sku) : '—',  Icon: Package,       color: 'var(--c-brand-500)' },
          { label: 'Low Stock',       value: summary ? String(summary.low_stock) : '—',  Icon: AlertTriangle, color: 'var(--c-warning)' },
          { label: 'Expiry Critical', value: summary ? String(summary.expiry_critical) : '—', Icon: Clock,   color: 'var(--c-danger)' },
          { label: 'Stock Value',     value: summary ? `₹${(summary.stock_value / 100000).toFixed(1)}L` : '—', Icon: DollarSign, color: 'var(--c-info)' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ '--accent-color': s.color } as any}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: '1.75rem' }}>{loading ? <Loader2 size={20} className="animate-spin" /> : s.value}</div>
            <div className="stat-icon"><s.Icon size={36} strokeWidth={1.2} /></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)' }}>
        {([
          { key: 'products', Icon: Package,   label: 'Stock / Products' },
          { key: 'batches',  Icon: Layers,    label: 'Batches' },
          { key: 'ledger',   Icon: BookOpen,  label: 'Stock Ledger' },
        ] as const).map(({ key, Icon, label }) => (
          <button key={key} id={`tab-${key}`} onClick={() => setTab(key as any)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === key ? '2px solid var(--c-brand-400)' : '2px solid transparent',
            color: tab === key ? 'var(--c-brand-400)' : 'var(--c-text-muted)',
            fontWeight: tab === key ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem',
            transition: 'all var(--t-fast)',
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="search-box" style={{ width: 280 }}>
              <Search size={14} style={{ color: 'var(--c-text-muted)' }} />
              <input id="inventory-search" type="text" placeholder="Search by name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {[
              { key: 'ALL',         label: 'All Stock',    Icon: Filter },
              { key: 'LOW_STOCK',   label: 'Low Stock',    Icon: AlertTriangle },
              { key: 'EXPIRY_RISK', label: 'Expiry Risk',  Icon: Clock },
            ].map(({ key, label, Icon }) => (
              <button key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(key)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon size={12} />{label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>{displayItems.length} results</span>
          </div>

          <div className="card animate-fade-in">
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--c-brand-400)' }} />
              </div>
            ) : displayItems.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--c-text-muted)' }}>
                <Package size={48} strokeWidth={1} style={{ margin: '0 auto 16px' }} />
                <h3>No products found</h3>
                <p style={{ marginTop: 8 }}>Add products and receive stock batches to see inventory here</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setShowAddProduct(true)}><Plus size={13} /> Add First Product</button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th><th>Product Name</th><th>Schedule</th><th>MRP</th>
                      <th>Stock Qty</th><th>Threshold</th><th>Expiry Risk</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((p) => (
                      <tr key={p.product_id || p.id}>
                        <td><span className="font-mono text-xs" style={{ color: 'var(--c-brand-400)' }}>{p.sku}</span></td>
                        <td><div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div></td>
                        <td><ScheduleBadge schedule={p.schedule || 'OTC'} /></td>
                        <td style={{ fontWeight: 600 }}>₹{Number(p.mrp || 0).toFixed(2)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: (p.stock <= p.threshold && p.threshold > 0) ? 'var(--c-danger)' : 'var(--c-text-primary)' }}>{p.stock}</span>
                            <div className="progress-bar" style={{ width: 60 }}>
                              <div className="progress-fill" style={{ width: `${Math.min(100, p.threshold > 0 ? (p.stock / (p.threshold * 3)) * 100 : 100)}%`, background: (p.stock <= p.threshold && p.threshold > 0) ? 'var(--c-danger)' : 'var(--c-brand-500)' }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--c-text-muted)', fontSize: '0.8rem' }}>{p.threshold}</td>
                        <td><RiskBadge risk={p.expiry_risk || 'SAFE'} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-icon btn-ghost btn-sm" title="View details"><Eye size={13} /></button>
                            <button className="btn btn-icon btn-ghost btn-sm" title="Edit product" onClick={() => setEditProduct(p)} style={{ color: 'var(--c-brand-400)' }}><Edit2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'batches' && (
        <div className="card animate-fade-in">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><Loader2 size={32} className="animate-spin" style={{ color: 'var(--c-brand-400)' }} /></div>
          ) : batches.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--c-text-muted)' }}>
              <Layers size={48} strokeWidth={1} style={{ margin: '0 auto 16px' }} />
              <h3>No Batches Found</h3>
              <p>Add a batch to record received stock</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setShowAddBatch(true)}><Plus size={13} /> Add Batch</button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Product</th><th>Batch No</th><th>Qty Available</th><th>Expiry</th><th>Risk</th><th>Location</th></tr></thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id}>
                      <td><div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{b.product_name}</div><div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{b.product_sku}</div></td>
                      <td><span className="font-mono text-xs" style={{ color: 'var(--c-brand-400)' }}>{b.batch_no}</span></td>
                      <td style={{ fontWeight: 700 }}>{b.quantity_available}</td>
                      <td style={{ fontSize: '0.8rem' }}>{b.expiry_date}</td>
                      <td><RiskBadge risk={b.expiry_risk} /></td>
                      <td style={{ color: 'var(--c-text-muted)', fontSize: '0.8rem' }}>{b.location_code || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="card animate-fade-in">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><Loader2 size={32} className="animate-spin" style={{ color: 'var(--c-brand-400)' }} /></div>
          ) : ledger.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--c-text-muted)' }}>
              <BookOpen size={48} strokeWidth={1} style={{ margin: '0 auto 16px' }} />
              <h3>No Stock Movements Yet</h3>
              <p>Every purchase, sale, and transfer will appear here automatically</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Before</th><th>After</th><th>Notes</th></tr></thead>
                <tbody>
                  {ledger.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>{new Date(e.performed_at).toLocaleString('en-IN')}</td>
                      <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.product_name}</td>
                      <td><span className={`badge ${e.quantity_change > 0 ? 'badge-success' : 'badge-warning'}`}>{e.transaction_type}</span></td>
                      <td style={{ fontWeight: 700, color: e.quantity_change > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>{e.quantity_change > 0 ? '+' : ''}{e.quantity_change}</td>
                      <td style={{ color: 'var(--c-text-muted)' }}>{e.quantity_before}</td>
                      <td style={{ fontWeight: 600 }}>{e.quantity_after}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>{e.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
