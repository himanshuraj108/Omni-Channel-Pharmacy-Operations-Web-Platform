import React, { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, FileText, AlertTriangle,
  Clock, Users, Pill, ClipboardList, RotateCcw, Download,
  ChevronRight, Bell, Package, Loader2, Building2
} from 'lucide-react'
import { useAuthStore, useUIStore } from '../store'
import { reportsApi, inventoryApi } from '../lib/api'

const STOCK_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem' }}>
      <p style={{ color: 'var(--c-text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: ₹{Number(p.value).toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  )
}

interface StatCardProps {
  label: string; value: string; sub?: string; trend?: string
  trendUp?: boolean; Icon: React.ElementType; accentColor: string; loading?: boolean
}
function StatCard({ label, value, sub, trend, trendUp, Icon, accentColor, loading }: StatCardProps) {
  return (
    <div className="stat-card animate-fade-in" style={{ '--accent-color': accentColor } as any}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{loading ? <Loader2 size={20} className="animate-spin" /> : value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {trend && (
        <div className={`stat-trend ${trendUp ? 'up' : 'down'}`} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
          {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend}</span>
        </div>
      )}
      <div className="stat-icon"><Icon size={40} strokeWidth={1.2} /></div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { activeBranchId } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [expiryRisk, setExpiryRisk] = useState<any[]>([])
  const [stockHealth, setStockHealth] = useState<any[]>([])
  const [period, setPeriod] = useState('30D')

  const branchId = activeBranchId ?? user?.branch_id ?? 1
  const isAdmin = user?.role === 'HEAD_ADMIN'

  const dayMap: Record<string, number> = { '7D': 7, '30D': 30, '90D': 90 }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const days = dayMap[period] || 30
      const toDate = new Date().toISOString().split('T')[0]
      const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

      // Parallel fetch
      const [salesRes, branchRes, lowStockRes, expiryRes] = await Promise.allSettled([
        reportsApi.getSalesSummary({ from_date: fromDate, to_date: toDate, branch_id: isAdmin ? undefined : branchId }),
        reportsApi.getBranchPerformance({ from_date: fromDate, to_date: toDate }),
        inventoryApi.getLowStock(branchId),
        inventoryApi.getExpiryRisk(branchId),
      ])

      if (salesRes.status === 'fulfilled') {
        const d = salesRes.value.data
        setKpis(d.kpis)
        setTrend(d.trend || [])
      }
      if (branchRes.status === 'fulfilled') {
        setBranches(branchRes.value.data.branches || [])
      }
      if (lowStockRes.status === 'fulfilled') {
        setLowStock(lowStockRes.value.data || [])
      }
      if (expiryRes.status === 'fulfilled') {
        const expItems = expiryRes.value.data || []
        setExpiryRisk(expItems)
        // Build stock health pie
        const safe = expItems.filter((i: any) => i.expiry_risk === 'SAFE').length
        const watch = expItems.filter((i: any) => i.expiry_risk === 'WATCH').length
        const warning = expItems.filter((i: any) => i.expiry_risk === 'WARNING').length
        const critical = expItems.filter((i: any) => ['CRITICAL', 'EXPIRED'].includes(i.expiry_risk)).length
        const total = expItems.length || 1
        setStockHealth([
          { name: 'Safe',     value: Math.round(safe / total * 100),     color: '#22c55e' },
          { name: 'Watch',    value: Math.round(watch / total * 100),    color: '#3b82f6' },
          { name: 'Warning',  value: Math.round(warning / total * 100),  color: '#f59e0b' },
          { name: 'Critical', value: Math.round(critical / total * 100), color: '#ef4444' },
        ])
      }
    } catch (err) {
      console.error('Dashboard fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [branchId, period, isAdmin])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fmt = (n: number) => {
    if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
    return `₹${n.toFixed(0)}`
  }

  const alerts = [
    ...lowStock.slice(0, 3).map(i => ({
      id: `ls-${i.product_id}`, type: 'LOW_STOCK', severity: 'HIGH',
      message: `${i.name} — only ${i.stock} units left (threshold: ${i.threshold})`,
      time: 'Live',
    })),
    ...expiryRisk.filter(i => ['CRITICAL', 'EXPIRED'].includes(i.expiry_risk)).slice(0, 3).map(i => ({
      id: `exp-${i.id}`, type: 'EXPIRY', severity: 'CRITICAL',
      message: `${i.product_name} batch ${i.batch_no} — expires ${i.expiry_date}`,
      time: 'Live',
    })),
  ]

  const ALERT_ICON: Record<string, React.ReactNode> = {
    LOW_STOCK:  <TrendingDown size={16} style={{ color: 'var(--c-warning)' }} />,
    EXPIRY:     <Clock size={16} style={{ color: 'var(--c-danger)' }} />,
    ANOMALY:    <AlertTriangle size={16} style={{ color: 'var(--c-danger)' }} />,
  }
  const SEVERITY_CLS: Record<string, string> = {
    CRITICAL: 'badge-danger', HIGH: 'badge-warning', MEDIUM: 'badge-info', LOW: 'badge-muted',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1600 }}>

      {/* Page header */}
      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>
            {isAdmin ? 'Operations Overview' : `${user?.branch_name || 'Branch'} Dashboard`}
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            Live data from your database · Last refreshed just now
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="refresh-dashboard" className="btn btn-secondary btn-sm" onClick={fetchAll} disabled={loading}>
            <RotateCcw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => reportsApi.exportReport('dashboard', {})}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4">
        <StatCard loading={loading} label="Total Revenue" value={kpis ? fmt(kpis.total_revenue) : '₹0'} sub={`${kpis?.total_orders || 0} orders`} Icon={DollarSign} accentColor="var(--c-brand-500)" />
        <StatCard loading={loading} label="Bills Processed" value={kpis ? String(kpis.total_orders) : '0'} sub={`Avg ${kpis ? fmt(kpis.avg_order_value) : '₹0'} per bill`} Icon={FileText} accentColor="var(--c-info)" />
        <StatCard loading={loading} label="Low Stock Alerts" value={String(lowStock.length)} sub={`${lowStock.filter(i => i.stock === 0).length} out of stock`} Icon={AlertTriangle} accentColor="var(--c-warning)" />
        <StatCard loading={loading} label="Expiry Risks" value={String(expiryRisk.filter(i => ['CRITICAL','EXPIRED'].includes(i.expiry_risk)).length)} sub="Batches within 90 days" Icon={Clock} accentColor="var(--c-danger)" />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20 }}>
        <div className="card animate-fade-in">
          <div className="card-header">
            <span className="card-title">Revenue Trend</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['7D', '30D', '90D'].map((d) => (
                <button key={d} onClick={() => setPeriod(d)} className={`tab ${period === d ? 'active' : ''}`} style={{ flex: 'none', padding: '4px 10px', fontSize: '0.7rem' }}>{d}</button>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--c-text-muted)' }}>
                <Loader2 size={32} className="animate-spin" />
              </div>
            ) : trend.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--c-text-muted)' }}>
                <FileText size={40} strokeWidth={1} style={{ marginBottom: 8 }} />
                <p>No sales data yet — create your first order in Billing</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2d9369" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#2d9369" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#4a6080', fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(trend.length / 6)} />
                  <YAxis tick={{ fill: '#4a6080', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#2d9369" strokeWidth={2.5} fill="url(#salesGrad)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card animate-fade-in">
          <div className="card-header"><span className="card-title">Stock Health</span></div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {stockHealth.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={stockHealth} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {stockHealth.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 8, fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {stockHealth.map((s) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'block' }} />
                      <span style={{ color: 'var(--c-text-secondary)' }}>{s.name}</span>
                      <span style={{ fontWeight: 700, color: s.color }}>{s.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--c-text-muted)', fontSize: '0.8rem' }}>
                <Package size={32} strokeWidth={1} style={{ marginBottom: 8 }} />
                <p>Add inventory batches to see stock health</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card animate-fade-in">
          <div className="card-header">
            <span className="card-title">Top Branches by Revenue</span>
            <span className="badge badge-brand">Last {period}</span>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            {branches.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--c-text-muted)' }}>
                <Building2 size={40} strokeWidth={1} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: '0.85rem' }}>No branch revenue data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={branches.slice(0,5)} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="branch_name" tick={{ fill: '#8ea0c0', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} contentStyle={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border-2)', borderRadius: 8, fontSize: '0.8rem' }} />
                  <Bar dataKey="revenue" fill="#2d9369" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card animate-fade-in">
          <div className="card-header">
            <span className="card-title">Live Alerts</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={12} style={{ color: 'var(--c-danger)' }} />
              {alerts.filter(a => ['CRITICAL','HIGH'].includes(a.severity)).length > 0 && (
                <span className="badge badge-danger animate-pulse">
                  {alerts.filter(a => ['CRITICAL','HIGH'].includes(a.severity)).length} Urgent
                </span>
              )}
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 280 }}>
            {alerts.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>
                <Bell size={32} strokeWidth={1} style={{ marginBottom: 8 }} />
                All clear — no critical alerts
              </div>
            ) : alerts.map((alert) => (
              <div key={alert.id}
                style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--c-border)', cursor: 'pointer', transition: 'background var(--t-fast)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--c-surface-2)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>{ALERT_ICON[alert.type]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span className={`badge ${SEVERITY_CLS[alert.severity]}`}>{alert.severity}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--c-text-muted)' }}>{alert.time}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>{alert.message}</p>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--c-text-muted)', flexShrink: 0, marginTop: 2 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom KPI row */}
      <div className="grid-4">
        <StatCard loading={loading} label="GST Collected" value={kpis ? fmt(kpis.total_gst_collected) : '₹0'} sub={`CGST ${fmt(kpis?.cgst || 0)} | SGST ${fmt(kpis?.sgst || 0)}`} Icon={ClipboardList} accentColor="#f59e0b" />
        <StatCard loading={loading} label="Avg Bill Value" value={kpis ? fmt(kpis.avg_order_value) : '₹0'} sub="Per completed order" Icon={FileText} accentColor="#06b6d4" />
        <StatCard loading={loading} label="Expiry Batches" value={String(expiryRisk.length)} sub="Within 90 days" Icon={Clock} accentColor="#ec4899" />
        <StatCard loading={loading} label="Low Stock Items" value={String(lowStock.length)} sub="Below threshold" Icon={Package} accentColor="#8b5cf6" />
      </div>
    </div>
  )
}
