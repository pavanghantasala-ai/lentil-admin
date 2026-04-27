import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'

const API_BASE = import.meta.env.VITE_API_BASE || ''
const ENDPOINT = `${API_BASE}/api/analytics/public-dashboard`
const GREEN = '#16a34a'
const PIE_COLORS = ['#16a34a', '#4ade80', '#86efac']

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function fmtGrowth(n) {
  if (n === null || n === undefined) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n}%`
}

function growthColor(n) {
  if (!n) return '#6b7280'
  return n >= 0 ? '#16a34a' : '#ef4444'
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KPICard({ title, value, sub, growth, suffix = '' }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{fmt(value)}{suffix}</div>
      {(sub || growth !== undefined) && (
        <div style={styles.cardFooter}>
          {sub && <span style={styles.cardSub}>{sub}</span>}
          {growth !== undefined && (
            <span style={{ ...styles.cardGrowth, color: growthColor(growth) }}>
              {fmtGrowth(growth)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function AdoptionBar({ label, pct, users, color }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 14, color: '#6b7280' }}>{users} users · {pct}%</span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: 99, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function SectionHeader({ children }) {
  return <h2 style={styles.sectionHeader}>{children}</h2>
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Unknown error')
      setData(json)
      setFetchedAt(new Date().toISOString())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  // ── Derived chart data ──────────────────────────────────────────────────

  const featureData = data
    ? [
        { name: 'Food Scans', value: data.features_30d.scans, fill: '#16a34a' },
        { name: 'Challenges', value: data.features_30d.challenges, fill: '#22c55e' },
        { name: 'Recipes', value: data.features_30d.recipes, fill: '#4ade80' },
        { name: 'AI Coach', value: data.features_30d.coach, fill: '#86efac' },
      ]
    : []

  const subData = data
    ? [
        { name: 'Monthly', value: data.subscriptions.monthly },
        { name: 'Annual', value: data.subscriptions.annual },
      ].filter((d) => d.value > 0)
    : []

  const dauData = data?.trend?.dau_14d?.map((d) => ({
    date: fmtDate(d.date),
    users: d.users,
  })) || []

  const adoption = data?.adoption_30d
  const engagement = data?.engagement
  const retention = data?.retention

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <div style={styles.logo}>
              <span style={styles.logoLeaf}>🌱</span>
              <span style={styles.logoText}>Lentil</span>
              <span style={styles.logoBadge}>Admin</span>
            </div>
            <p style={styles.headerTagline}>Growth & Engagement Metrics</p>
          </div>
          <div style={styles.headerRight}>
            {fetchedAt && (
              <span style={styles.lastUpdated}>Updated {timeAgo(fetchedAt)}</span>
            )}
            <button onClick={fetchData} style={styles.refreshBtn} title="Refresh">↻</button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {loading && (
          <div style={styles.centerMsg}>
            <div style={styles.spinner} />
            <p style={{ color: '#6b7280', marginTop: 12 }}>Loading metrics…</p>
          </div>
        )}

        {error && !loading && (
          <div style={styles.errorBox}>
            <strong>Could not load data</strong>
            <p style={{ marginTop: 4, fontSize: 13 }}>{error}</p>
            <button onClick={fetchData} style={styles.retryBtn}>Retry</button>
          </div>
        )}

        {data && (
          <>
            {/* ── Users ── */}
            <SectionHeader>Users</SectionHeader>
            <div style={styles.grid3}>
              <KPICard
                title="Total Users"
                value={data.users.total}
                sub={`+${data.users.new_7d} this week · +${data.users.new_30d} this month`}
              />
              <KPICard
                title="Monthly Active Users"
                value={data.active.mau}
                growth={data.growth.mom_percent}
                sub="last 30 days"
              />
              <KPICard
                title="Weekly Active Users"
                value={data.active.wau}
                growth={data.growth.wow_percent}
                sub="last 7 days"
              />
            </div>

            {/* ── Today ── */}
            <SectionHeader>Today</SectionHeader>
            <div style={styles.grid4}>
              <KPICard title="Active Users" value={data.active.today} />
              <KPICard title="Actions Today" value={data.active.today_events} />
              <KPICard
                title="Avg Actions / MAU"
                value={engagement?.avg_actions_per_mau ?? '—'}
                sub="last 30 days"
              />
              <KPICard
                title="WoW Retention"
                value={retention?.wow_retention_pct ?? 0}
                suffix="%"
                sub={`${retention?.wow_retained_users ?? 0} users retained`}
              />
            </div>

            {/* ── DAU Trend ── */}
            <SectionHeader>Daily Active Users — Last 14 Days</SectionHeader>
            <div style={styles.card}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dauData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} interval={1} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} width={32} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v) => [v, 'Active Users']}
                  />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke={GREEN}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: GREEN }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── Feature Adoption ── */}
            <SectionHeader>Feature Adoption — % of MAU (30d)</SectionHeader>
            <div style={styles.card}>
              <AdoptionBar label="Food Scans" pct={adoption?.scanning_pct ?? 0} users={adoption?.scanning_users ?? 0} color="#16a34a" />
              <AdoptionBar label="AI Coach" pct={adoption?.coaching_pct ?? 0} users={adoption?.coaching_users ?? 0} color="#22c55e" />
              <AdoptionBar label="Recipes" pct={adoption?.recipes_pct ?? 0} users={adoption?.recipes_users ?? 0} color="#4ade80" />
              <AdoptionBar label="Challenges" pct={adoption?.challenges_pct ?? 0} users={adoption?.challenges_users ?? 0} color="#86efac" />
            </div>

            {/* ── Feature Usage Charts ── */}
            <SectionHeader>Feature Volume — Last 30 Days</SectionHeader>
            <div style={styles.chartRow}>
              <div style={{ ...styles.card, flex: 2, minWidth: 0 }}>
                <div style={styles.chartTitle}>Total Actions by Feature</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={featureData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} width={40} />
                    <Tooltip
                      contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      cursor={{ fill: '#f0fdf4' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {featureData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {subData.length > 0 ? (
                <div style={{ ...styles.card, flex: 1, minWidth: 220 }}>
                  <div style={styles.chartTitle}>Subscription Split</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={subData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {subData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend iconType="circle" iconSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ ...styles.card, flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>No active subscriptions yet</p>
                </div>
              )}
            </div>

            {/* ── Feature Breakdown Table ── */}
            <SectionHeader>Feature Breakdown</SectionHeader>
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Feature</th>
                    <th style={styles.th}>Actions (30d)</th>
                    <th style={styles.th}>Users (30d)</th>
                    <th style={styles.th}>% of Total Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Food Scans', value: data.features_30d.scans, users: adoption?.scanning_users ?? 0, fill: '#16a34a' },
                    { name: 'Challenges', value: data.features_30d.challenges, users: adoption?.challenges_users ?? 0, fill: '#22c55e' },
                    { name: 'Recipes', value: data.features_30d.recipes, users: adoption?.recipes_users ?? 0, fill: '#4ade80' },
                    { name: 'AI Coach', value: data.features_30d.coach, users: adoption?.coaching_users ?? 0, fill: '#86efac' },
                  ].map((row, i) => {
                    const total = data.features_30d.total_actions || 1
                    const pct = ((row.value / total) * 100).toFixed(1)
                    return (
                      <tr key={row.name} style={i % 2 === 0 ? styles.trEven : undefined}>
                        <td style={styles.td}>
                          <span style={{ ...styles.dot, background: row.fill }} />
                          {row.name}
                        </td>
                        <td style={styles.tdNum}>{row.value.toLocaleString()}</td>
                        <td style={styles.tdNum}>{row.users}</td>
                        <td style={styles.tdNum}>
                          <div style={styles.barWrap}>
                            <div style={{ ...styles.barFill, width: `${pct}%`, background: row.fill }} />
                            <span>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Subscriptions ── */}
            <SectionHeader>Subscriptions</SectionHeader>
            <div style={styles.grid3}>
              <KPICard title="Active Subscribers" value={data.subscriptions.active} />
              <KPICard title="Monthly Plan" value={data.subscriptions.monthly} />
              <KPICard title="Annual Plan" value={data.subscriptions.annual} />
            </div>

            <p style={styles.footer}>
              Lentil Admin · Auto-refreshes every 5 minutes ·{' '}
              {fetchedAt && new Date(fetchedAt).toLocaleString()}
            </p>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: { minHeight: '100vh', background: '#f0fdf4' },
  header: {
    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    padding: '20px 0',
    boxShadow: '0 2px 12px rgba(22,163,74,0.3)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 4 },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoLeaf: { fontSize: 26 },
  logoText: { color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' },
  logoBadge: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 99,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  headerTagline: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginLeft: 36 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  lastUpdated: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  refreshBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    fontSize: 20,
    width: 36,
    height: 36,
    borderRadius: 99,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: 12,
    marginTop: 32,
  },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  },
  cardTitle: { fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 8 },
  cardValue: { fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1.1 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  cardSub: { fontSize: 12, color: '#9ca3af' },
  cardGrowth: { fontSize: 13, fontWeight: 600 },
  chartRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  chartTitle: { fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #f3f4f6',
  },
  td: { padding: '12px 12px', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 },
  tdNum: { padding: '12px 12px', color: '#374151', fontVariantNumeric: 'tabular-nums' },
  trEven: { background: '#fafafa' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  barWrap: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 },
  barFill: { height: 8, borderRadius: 4, minWidth: 4, maxWidth: 100, transition: 'width 0.4s ease' },
  centerMsg: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #dcfce7',
    borderTop: `3px solid ${GREEN}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 12,
    padding: '20px 24px',
    color: '#dc2626',
    maxWidth: 500,
    margin: '60px auto',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    padding: '8px 20px',
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  footer: { marginTop: 48, fontSize: 12, color: '#9ca3af', textAlign: 'center' },
}
