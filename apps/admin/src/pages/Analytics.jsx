import { useEffect, useState } from 'react'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const COLORS = ['#7C3AED', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#94A3B8']

export default function Analytics() {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data))
    api.get('/admin/analytics').then((r) => setAnalytics(r.data))
  }, [])

  const pieData = analytics
    ? Object.entries(analytics.statusBreakdown).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="analytics-page">
      <h1>Analytics</h1>
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card card">
            <b>{stats.deliveredToday}</b>
            <span>Orders today</span>
          </div>
          <div className="stat-card card">
            <b>{formatMoney(stats.revenueToday)}</b>
            <span>Revenue today</span>
          </div>
          <div className="stat-card card">
            <b>{stats.activeRiders}</b>
            <span>Active riders</span>
          </div>
          <div className="stat-card card">
            <b>{stats.pendingOrders}</b>
            <span>Active orders</span>
          </div>
        </div>
      )}

      {analytics && (
        <>
          <div className="card chart-card">
            <h3>Orders per day (30d)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analytics.ordersPerDay}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#7C3AED" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card chart-card">
            <h3>Revenue per day (30d)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.ordersPerDay}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card chart-card">
              <h3>Status breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Top riders this month</h3>
              <ul>
                {analytics.topRiders?.map((r) => (
                  <li key={r.fullName} style={{ marginBottom: '.5rem' }}>
                    <b>{r.fullName}</b> — {r.totalDeliveries} deliveries
                    {r.averageRating != null && ` · ★ ${r.averageRating}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
