import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, Plus, Trash2, CreditCard, Smartphone,
  Banknote, Printer, ShoppingCart, AlertCircle, CheckCircle, Loader2, X,
} from 'lucide-react'
import { inventoryApi, billingApi } from '../lib/api'
import { useAuthStore, useUIStore } from '../store'

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote    size={14} />,
  UPI:  <Smartphone  size={14} />,
  CARD: <CreditCard  size={14} />,
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: type === 'success' ? 'var(--c-success)' : 'var(--c-danger)', color: '#fff', padding: '12px 20px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', fontWeight: 600 }}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, marginLeft: 8 }}><X size={14} /></button>
    </div>
  )
}

export default function Billing() {
  const { user } = useAuthStore()
  const { activeBranchId } = useUIStore()
  const branchId = activeBranchId ?? user?.branch_id ?? 1

  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [prescriptionId, setPrescriptionId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [panelTab, setPanelTab] = useState<'pos' | 'history'>('pos')
  const [catalog, setCatalog] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [todayTotal, setTodayTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Search product catalog (real stock for this branch)
  const fetchCatalog = useCallback(async () => {
    if (!search && catalog.length > 0) return
    setSearchLoading(true)
    try {
      const res = await inventoryApi.getBranchStock(branchId, search ? { search } : {})
      setCatalog(res.data?.items || [])
    } catch (err) { console.error(err) }
    finally { setSearchLoading(false) }
  }, [search, branchId])

  // Fetch orders for history
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await billingApi.listOrders({ branch_id: branchId, per_page: 50 })
      setOrders(res.data?.items || [])
      setTodayTotal(res.data?.today_total || 0)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => {
    fetchCatalog()
  }, [search])

  useEffect(() => {
    if (panelTab === 'history') fetchOrders()
    else fetchCatalog()
  }, [panelTab])

  const addToCart = (product: any) =>
    setCart((prev) => {
      const ex = prev.find((i) => i.product_id === product.product_id)
      if (ex) {
        if (ex.qty >= product.stock) return prev // Don't exceed stock
        return prev.map((i) => i.product_id === product.product_id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { ...product, qty: 1, batch_id: null, batch_no: '' }]
    })

  const updateQty = (product_id: string, delta: number) =>
    setCart((prev) => prev.map((i) => i.product_id === product_id ? { ...i, qty: Math.max(1, i.qty + delta) } : i).filter((i) => i.qty > 0))

  const removeItem = (product_id: string) => setCart((prev) => prev.filter((i) => i.product_id !== product_id))

  const subtotal    = cart.reduce((s, i) => s + i.mrp * i.qty, 0)
  const discountAmt = (subtotal * discount) / 100
  const gstTotal    = cart.reduce((s, i) => s + (i.mrp * i.qty * (i.gst_rate || 0) / 100) / (1 + (i.gst_rate || 0) / 100), 0)
  const grandTotal  = subtotal - discountAmt
  const hasRxRequired = cart.some((i) => i.schedule && i.schedule !== 'OTC')

  const checkout = async () => {
    if (hasRxRequired && !prescriptionId) return
    setChecking(true)
    try {
      const items = cart.map(i => ({
        product_id: i.product_id,
        batch_id: i.batch_id,
        product_name: i.name,
        product_sku: i.sku,
        batch_no: i.batch_no,
        quantity: i.qty,
        mrp: i.mrp,
        gst_rate: i.gst_rate || 0,
        gst_amount: (i.mrp * i.qty * (i.gst_rate || 0) / 100) / (1 + (i.gst_rate || 0) / 100),
        schedule: i.schedule || 'OTC',
      }))
      await billingApi.createOrder({
        branch_id: branchId,
        branch_code: `BRN${String(branchId).padStart(3, '0')}`,
        prescription_id: prescriptionId || undefined,
        items,
        discount_pct: discount,
        payment_mode: paymentMode,
        created_by: user?.id,
      })
      setCart([])
      setPrescriptionId('')
      setDiscount(0)
      setToast({ msg: 'Sale completed successfully!', type: 'success' })
      fetchCatalog()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.detail || 'Checkout failed', type: 'error' })
    } finally {
      setChecking(false)
    }
  }

  const filteredCatalog = catalog.filter(p => p.stock > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1600 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Billing & POS</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Create GST-compliant invoices · Live stock from database</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['pos', 'history'] as const).map((t) => (
            <button key={t} className={`btn btn-sm ${panelTab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPanelTab(t)}>
              {t === 'pos' ? 'POS Terminal' : 'Bill History'}
            </button>
          ))}
        </div>
      </div>

      {panelTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {hasRxRequired && (
              <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--c-warning)' }} />
                <div>
                  <strong style={{ color: 'var(--c-warning)', fontSize: '0.85rem' }}>Prescription Required</strong>
                  <p style={{ fontSize: '0.8rem', margin: 0, marginTop: 2 }}>Schedule H/X drugs in cart. Enter prescription ID before checkout.</p>
                </div>
              </div>
            )}
            <div className="card">
              <div className="card-header"><span className="card-title">Product Search — Live Stock</span></div>
              <div style={{ padding: '12px 20px 4px' }}>
                <div className="search-box">
                  <Search size={14} style={{ color: 'var(--c-text-muted)' }} />
                  <input id="billing-search" type="text" placeholder="Search by product name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
                </div>
              </div>
              {searchLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--c-brand-400)' }} /></div>
              ) : filteredCatalog.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>
                  {search ? 'No products matching your search' : 'No stock available. Add batches in Inventory.'}
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr><th>Product</th><th>Schedule</th><th>MRP</th><th>GST%</th><th>Stock</th><th></th></tr>
                    </thead>
                    <tbody>
                      {filteredCatalog.map((p) => (
                        <tr key={p.product_id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{p.sku}</div>
                          </td>
                          <td><span className={`badge ${p.schedule === 'OTC' ? 'badge-success' : 'badge-warning'}`}>Sch. {p.schedule || 'OTC'}</span></td>
                          <td style={{ fontWeight: 700 }}>₹{Number(p.mrp || 0).toFixed(2)}</td>
                          <td style={{ color: 'var(--c-text-secondary)' }}>{p.gst_rate || 0}%</td>
                          <td style={{ color: p.stock < 20 ? 'var(--c-danger)' : 'var(--c-success)', fontWeight: 600 }}>{p.stock}</td>
                          <td>
                            <button id={`add-${p.product_id}`} className="btn btn-primary btn-sm" onClick={() => addToCart(p)} disabled={p.stock === 0}>
                              <Plus size={12} /> Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Current Bill</span>
                {cart.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setCart([])} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--c-danger)', fontSize: '0.75rem' }}>
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {cart.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>
                    <ShoppingCart size={32} strokeWidth={1} style={{ margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: '0.875rem' }}>Add products to start billing</p>
                  </div>
                ) : cart.map((item) => (
                  <div key={item.product_id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>₹{item.mrp} × {item.qty}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => updateQty(item.product_id, -1)} className="btn btn-icon btn-ghost btn-sm">−</button>
                      <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.product_id, 1)} className="btn btn-icon btn-ghost btn-sm" disabled={item.qty >= item.stock}>+</button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: 60, textAlign: 'right' }}>₹{(item.mrp * item.qty).toFixed(2)}</div>
                    <button onClick={() => removeItem(item.product_id)} className="btn btn-icon btn-ghost btn-sm" style={{ color: 'var(--c-danger)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {cart.length > 0 && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {hasRxRequired && (
                    <div className="form-group">
                      <label className="form-label">Prescription ID *</label>
                      <input id="prescription-id-input" className="form-input" placeholder="Enter or scan prescription ID" value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)} style={{ fontSize: '0.8rem' }} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Discount (%)</label>
                    <input type="number" className="form-input" min={0} max={30} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} style={{ fontSize: '0.8rem' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-text-secondary)' }}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                    {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-success)' }}><span>Discount ({discount}%)</span><span>−₹{discountAmt.toFixed(2)}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-text-secondary)' }}><span>GST (incl.)</span><span>₹{gstTotal.toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', paddingTop: 8, borderTop: '1px solid var(--c-border)' }}>
                      <span>GRAND TOTAL</span><span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['CASH', 'UPI', 'CARD'] as const).map((mode) => (
                      <button key={mode} className={`btn btn-sm ${paymentMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onClick={() => setPaymentMode(mode)}>
                        {PAYMENT_ICONS[mode]} {mode}
                      </button>
                    ))}
                  </div>
                  <button id="checkout-btn" className="btn btn-primary w-full" disabled={(hasRxRequired && !prescriptionId) || checking}
                    onClick={checkout}
                    style={{ fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {checking ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {checking ? 'Processing...' : `Complete Sale · ₹${grandTotal.toFixed(2)}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {panelTab === 'history' && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <span className="card-title">Bill History</span>
            <span className="badge badge-brand">Today: ₹{todayTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><Loader2 size={32} className="animate-spin" style={{ color: 'var(--c-brand-400)' }} /></div>
          ) : orders.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--c-text-muted)' }}>
              <ShoppingCart size={48} strokeWidth={1} style={{ margin: '0 auto 16px' }} />
              <h3>No Orders Yet</h3>
              <p>Complete your first sale using the POS Terminal</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr><th>Bill No.</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Time</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><span className="font-mono text-xs" style={{ color: 'var(--c-brand-400)' }}>{o.order_no}</span></td>
                      <td>{o.customer_name || 'Walk-in'}</td>
                      <td style={{ color: 'var(--c-text-secondary)' }}>{o.items_count} items</td>
                      <td style={{ fontWeight: 700 }}>₹{Number(o.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td>
                        <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {PAYMENT_ICONS[o.payment_mode]} {o.payment_mode}
                        </span>
                      </td>
                      <td style={{ color: 'var(--c-text-muted)', fontSize: '0.8rem' }}>{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td><span className={`badge ${o.status === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`}>{o.status}</span></td>
                      <td><button className="btn btn-icon btn-ghost btn-sm" title="Print bill"><Printer size={13} /></button></td>
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
