import React, { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Building2, Package, Clock, Bot, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { reportsApi } from '../lib/api'
import { useAuthStore, useUIStore } from '../store'

const tt = { contentStyle: { background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 8, fontSize: '0.8rem' } }
type ReportTab = 'sales' | 'branches' | 'stock' | 'expiry'

export default function Reports() {
  const { user } = useAuthStore()
  const { activeBranchId } = useUIStore()
  const branchId = activeBranchId ?? user?.branch_id ?? 1
  const isAdmin = user?.role === 'HEAD_ADMIN'

  const [activeReport, setActiveReport] = useState<ReportTab>('sales')
  const [period, setPeriod] = useState('30') // days

  // Data
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<any>(null)
  const [branches, setBranches] = useState<any>(null)
  const [stockAgeing, setStockAgeing] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const fromDate = new Date(Date.now() - parseInt(period) * 86400000).toISOString().split('T')[0]
      const toDate = new Date().toISOString().split('T')[0]

      if (activeReport === 'sales') {
        const res = await reportsApi.getSalesSummary({ from_date: fromDate, to_date: toDate, branch_id: isAdmin ? undefined : branchId })
        setSales(res.data)
      } else if (activeReport === 'branches') {
        const res = await reportsApi.getBranchPerformance({ from_date: fromDate, to_date: toDate })
        setBranches(res.data)
      } else if (activeReport === 'stock') {
        const res = await reportsApi.getStockAgeing(branchId)
        setStockAgeing(res.data?.ageing_buckets || [])
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [activeReport, period, branchId, isAdmin])

  useEffect(() => { fetchData() }, [fetchData])

  const TABS: { key: ReportTab; label: string; Icon: React.ElementType; adminOnly?: boolean }[] = [
    { key: 'sales',    label: 'Sales Trends',      Icon: TrendingUp  },
    { key: 'branches', label: 'Branch Performance', Icon: Building2, adminOnly: true },
    { key: 'stock',    label: 'Stock Ageing',       Icon: Package     },
  ]

  const fmt = (n: number) => {
    if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(2)}L`
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
    return `₹${n.toFixed(0)}`
  }

  const exportCSV = () => { window.location.href = `http://localhost:8000/api/v1/reports/export/${activeReport}?branch_id=${branchId}` }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1600 }}>
      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>BI Reports &amp; Analytics</h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Live business intelligence generated directly from database</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-select" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last 365 Days</option>
          </select>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={exportCSV}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)' }}>
        {TABS.filter(t => !t.adminOnly || isAdmin).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveReport(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeReport === key ? '2px solid var(--c-brand-400)' : '2px solid transparent', color: activeReport === key ? 'var(--c-brand-400)' : 'var(--c-text-muted)', fontWeight: activeReport === key ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem', transition: 'all var(--t-fast)' }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={32} className="animate-spin text-brand" /></div>}

      {!loading && activeReport === 'sales' && sales && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="grid-4 animate-fade-in">
            {[
              { label: 'Total Revenue',  value: fmt(sales.kpis.total_revenue),   color: 'var(--c-brand-500)' },
              { label: 'Total Orders',   value: sales.kpis.total_orders.toLocaleString(), color: 'var(--c-info)' },
              { label: 'Avg Order Value',value: fmt(sales.kpis.avg_order_value), color: '#8b5cf6' },
              { label: 'GST Collected',  value: fmt(sales.kpis.total_gst_collected), color: 'var(--c-warning)' },
            ].map((s) => (
              <div key={s.label} className="stat-card" style={{ '--accent-color': s.color } as any}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ fontSize: '1.6rem' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="card animate-fade-in">
            <div className="card-header"><span className="card-title">Daily Revenue Trend</span></div>
            <div className="card-body">
              {sales.trend.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--c-text-muted)' }}>No sales data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={sales.trend}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d9369" stopOpacity={0.4} /><stop offset="100%" stopColor="#2d9369" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#4a6080', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#4a6080', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip {...tt} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#2d9369" strokeWidth={2.5} fill="url(#revGrad)" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && activeReport === 'branches' && isAdmin && branches && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <span className="card-title">Branch Performance Rankings</span>
            <span className="badge badge-brand">{branches.network_totals.active_branches} Active Branches</span>
          </div>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>#</th><th>Branch</th><th>Name</th><th>Revenue</th><th>Orders</th><th>Avg Ticket</th></tr></thead>
              <tbody>
                {branches.branches.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>No branch data</td></tr> : null}
                {branches.branches.map((b: any, i: number) => (
                  <tr key={b.branch_id}>
                    <td style={{ fontWeight: 700, color: 'var(--c-text-muted)' }}>{i + 1}</td>
                    <td><span className="font-mono text-xs" style={{ color: 'var(--c-brand-400)' }}>{b.branch_code}</span></td>
                    <td style={{ color: 'var(--c-text-secondary)' }}>{b.branch_name}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(b.revenue)}</td>
                    <td style={{ color: 'var(--c-text-secondary)' }}>{b.orders.toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 600, color: '#8b5cf6' }}>{fmt(b.avg_ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeReport === 'stock' && (
        <div className="card animate-fade-in">
          <div className="card-header"><span className="card-title">Stock Ageing Analysis</span><span className="badge badge-muted">Branch {branchId}</span></div>
          <div className="card-body">
            {stockAgeing.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--c-text-muted)' }}>No stock data available for this branch</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {stockAgeing.map((row) => (
                  <div key={row.range} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ width: 100, fontSize: '0.8rem', color: 'var(--c-text-secondary)', flexShrink: 0 }}>{row.range}</span>
                    <div className="progress-bar" style={{ flex: 1, height: 28, borderRadius: 6, background: 'var(--c-surface-3)' }}>
                      <div className="progress-fill" style={{ width: `${Math.max(2, row.pct)}%`, height: '100%', borderRadius: 6, background: row.range === 'Expired' ? 'var(--c-danger)' : row.range === '>180 days' ? 'var(--c-warning)' : 'var(--c-brand-500)', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                        {row.pct > 0 && <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 700 }}>{row.pct}%</span>}
                      </div>
                    </div>
                    <div style={{ width: 120, textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{fmt(row.value)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{row.quantity.toLocaleString('en-IN')} units</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
