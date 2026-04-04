import React, { useState, useRef, useEffect } from 'react'
import { Bot, MessageCircle, AlertTriangle, TrendingUp, Receipt, Package, Send, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { aiApi, inventoryApi } from '../lib/api'
import { useAuthStore, useUIStore } from '../store'

const SUGGESTED = [
  'Which branches had the highest revenue last month?',
  'Show me products expiring within 30 days',
  'What are the top 10 best-selling products?',
  'Show me current low stock items',
  'Recent sales orders summary',
  'Products by category breakdown',
]

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  data?: any[]
  chart_type?: string
  disclaimer?: string
  loading?: boolean
  exec_ms?: number
  row_count?: number
}

export default function AIConsole() {
  const { user } = useAuthStore()
  const { activeBranchId } = useUIStore()
  const branchId = activeBranchId ?? user?.branch_id ?? undefined

  const [activeTab, setActiveTab] = useState<'query' | 'anomaly' | 'forecast'>('query')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0', role: 'ai',
      content: "Hello! I'm **PharmaCentral AI**, powered by Groq LLaMA-3. Ask me anything about your pharmacy operations — sales trends, stock levels, expiry risks, top performers, and more. I query your live database in real time.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Forecast tab state
  const [forecastBranch, setForecastBranch] = useState('')
  const [forecastProduct, setForecastProduct] = useState('')
  const [forecastData, setForecastData] = useState<any>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [products, setProducts] = useState<any[]>([])

  // Anomaly tab state - live from DB
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [anomalyLoading, setAnomalyLoading] = useState(false)

  useEffect(() => {
    inventoryApi.listProducts({ per_page: 100 }).then(r => setProducts(r.data?.items || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab === 'anomaly') loadAnomalies()
  }, [activeTab])

  const loadAnomalies = async () => {
    setAnomalyLoading(true)
    try {
      const res = await aiApi.getRecentAnomalies(branchId ?? 1, 7)
      setAnomalies(res.data?.anomalies || [])
    } catch {
      setAnomalies([])
    } finally {
      setAnomalyLoading(false)
    }
  }

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q }
    const loadingMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', content: '', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const res = await aiApi.conversationalQuery(q, branchId)
      const { answer, data, chart_type, disclaimer, execution_time_ms, row_count } = res.data
      setMessages(prev => prev.map(m => m.loading ? {
        id: m.id, role: 'ai', content: answer,
        data: data, chart_type: chart_type, disclaimer: disclaimer,
        exec_ms: execution_time_ms, row_count: row_count, loading: false,
      } : m))
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'AI service is starting up. Please try again in a moment.'
      setMessages(prev => prev.map(m => m.loading ? {
        id: m.id, role: 'ai', content: `⚠️ ${errMsg}`, loading: false,
      } : m))
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const handleForecast = async () => {
    if (!forecastProduct) return
    setForecastLoading(true)
    try {
      const res = await aiApi.getBranchForecastSummary(branchId ?? 1)
      setForecastData(res.data)
    } catch {
      setForecastData(null)
    } finally {
      setForecastLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, height: 'calc(100vh - 120px)' }}>
      <div className="animate-fade-in" style={{ flexShrink: 0 }}>
        <h1 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={24} style={{ color: 'var(--c-brand-400)' }} /> AI Console
        </h1>
        <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
          Powered by Groq LLaMA-3 · Real-time database queries · Anomaly detection · Demand forecasting
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', gap: 0, flexShrink: 0 }}>
        {[
          { key: 'query',    label: 'Conversational Query', Icon: MessageCircle },
          { key: 'anomaly',  label: 'Anomaly Alerts',       Icon: AlertTriangle },
          { key: 'forecast', label: 'Demand Forecast',      Icon: TrendingUp },
        ].map(({ key, label, Icon }) => (
          <button key={key} id={`ai-tab-${key}`} onClick={() => setActiveTab(key as any)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: activeTab === key ? '2px solid var(--c-brand-400)' : '2px solid transparent',
            color: activeTab === key ? 'var(--c-brand-400)' : 'var(--c-text-muted)',
            fontWeight: activeTab === key ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem',
          }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Conversational Query Tab ── */}
      {activeTab === 'query' && (
        <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
          {/* Suggestions sidebar */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div className="card" style={{ height: '100%' }}>
              <div className="card-header"><span className="card-title" style={{ fontSize: '0.8rem' }}>Suggested Queries</span></div>
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)',
                    padding: '8px 10px', cursor: 'pointer', textAlign: 'left', fontSize: '0.75rem',
                    color: 'var(--c-text-secondary)', transition: 'all var(--t-fast)', lineHeight: 1.4,
                  }}
                    onMouseEnter={e => { (e.currentTarget as any).style.borderColor = 'var(--c-brand-500)'; (e.currentTarget as any).style.color = 'var(--c-text-primary)' }}
                    onMouseLeave={e => { (e.currentTarget as any).style.borderColor = 'var(--c-border)'; (e.currentTarget as any).style.color = 'var(--c-text-secondary)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chat panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
                    {msg.role === 'ai' && (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-brand-500), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bot size={16} color="white" />
                      </div>
                    )}
                    <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{
                        background: msg.role === 'user' ? 'linear-gradient(135deg, var(--c-brand-600), var(--c-brand-800))' : 'var(--c-surface-2)',
                        border: `1px solid ${msg.role === 'user' ? 'transparent' : 'var(--c-border)'}`,
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                        padding: '12px 16px', fontSize: '0.875rem', lineHeight: 1.6,
                      }}>
                        {msg.loading ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {[0, 1, 2].map(i => (
                              <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-brand-400)', display: 'block', animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />
                            ))}
                          </div>
                        ) : msg.content}
                      </div>
                      {msg.data && msg.data.length > 0 && !(msg.data[0]?.info) && (
                        <div className="card" style={{ background: 'var(--c-surface-0)' }}>
                          <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: 'var(--c-text-muted)', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 12 }}>
                            <span>{msg.row_count} rows</span>
                            {msg.exec_ms && <span>{msg.exec_ms.toFixed(0)}ms</span>}
                            <span className={`badge badge-muted`} style={{ fontSize: '0.65rem' }}>{msg.chart_type}</span>
                          </div>
                          <div className="table-wrapper" style={{ maxHeight: 220, border: 'none' }}>
                            <table>
                              <thead>
                                <tr>{Object.keys(msg.data[0]).map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr>
                              </thead>
                              <tbody>
                                {msg.data.slice(0, 15).map((row, i) => (
                                  <tr key={i}>{Object.values(row).map((v: any, j) => <td key={j} style={{ fontSize: '0.75rem' }}>{String(v ?? '—')}</td>)}</tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {msg.disclaimer && (
                        <p style={{ fontSize: '0.68rem', color: 'var(--c-text-muted)', fontStyle: 'italic', margin: 0 }}>{msg.disclaimer}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', gap: 10 }}>
                <input
                  id="ai-query-input"
                  className="form-input"
                  placeholder="Ask anything about your pharmacy operations… (powered by Groq LLaMA-3)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                  disabled={loading}
                />
                <button id="ai-send-btn" className="btn btn-primary" onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Anomaly Alerts Tab ── */}
      {activeTab === 'anomaly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={loadAnomalies} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          {anomalyLoading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><Loader2 size={32} className="animate-spin" style={{ color: 'var(--c-brand-400)' }} /></div>
          ) : anomalies.length === 0 ? (
            <div className="card animate-fade-in">
              <div className="card-body" style={{ textAlign: 'center', padding: 60, color: 'var(--c-text-muted)' }}>
                <AlertTriangle size={48} strokeWidth={1} style={{ margin: '0 auto 16px', display: 'block', color: 'var(--c-success)' }} />
                <h3 style={{ color: 'var(--c-success)' }}>All Clear!</h3>
                <p style={{ marginTop: 8 }}>No anomalies detected in the last 7 days. Your operations look healthy.</p>
              </div>
            </div>
          ) : (
            anomalies.map((a: any, i: number) => (
              <div key={i} className="card animate-fade-in" style={{ borderLeft: `3px solid ${a.severity === 'CRITICAL' ? 'var(--c-danger)' : a.severity === 'HIGH' ? 'var(--c-warning)' : 'var(--c-info)'}` }}>
                <div className="card-body" style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span className={`badge ${a.severity === 'CRITICAL' ? 'badge-danger' : a.severity === 'HIGH' ? 'badge-warning' : 'badge-info'}`}>{a.severity}</span>
                      <span className="badge badge-muted">{a.type}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>Branch: {a.branch_id}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700 }}>Score: {a.anomaly_score?.toFixed(2)}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--c-text-primary)', margin: 0 }}>{a.description}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm">Investigate</button>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem' }}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Forecast Tab ── */}
      {activeTab === 'forecast' && (
        <div className="card animate-fade-in">
          <div className="card-body" style={{ padding: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <TrendingUp size={48} strokeWidth={1} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--c-brand-400)' }} />
              <h3>Demand Forecasting Console</h3>
              <p style={{ marginTop: 8, color: 'var(--c-text-muted)', fontSize: '0.875rem' }}>
                Select a product to view 30-day demand forecast
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              <select className="form-select" style={{ width: 220 }} value={forecastProduct} onChange={e => setForecastProduct(e.target.value)}>
                <option value="">Select Product…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
              <button className="btn btn-primary" onClick={handleForecast} disabled={!forecastProduct || forecastLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {forecastLoading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />} Generate Forecast
              </button>
            </div>
            {forecastData && (
              <div className="card" style={{ background: 'var(--c-surface-2)' }}>
                <div className="card-body">
                  <p style={{ fontSize: '0.875rem' }}>
                    Branch <strong>{forecastData.branch_id}</strong> — {forecastData.reorder_needed?.length ?? 0} products need reordering.
                  </p>
                  {forecastData.reorder_needed?.length === 0 && (
                    <p style={{ color: 'var(--c-success)', fontWeight: 600 }}>✅ All stock levels are healthy for the next 30 days!</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
