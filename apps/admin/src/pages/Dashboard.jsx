import { useState, useEffect } from 'react'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import { LayoutDashboard, Package, Bike, Users, Clock, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats').then(r => {
      setStats(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading dashboard...</div>

  const cards = [
    { label: 'Total Orders', value: stats?.totalOrders, icon: <Package/>, color: '#F5A623' },
    { label: 'Pending Orders', value: stats?.pendingOrders, icon: <Clock/>, color: '#FF6B9D' },
    { label: 'Active Riders', value: stats?.activeRiders, icon: <Bike/>, color: '#10B981' },
    { label: 'Today Revenue', value: stats?.revenueToday, icon: <TrendingUp/>, color: '#A50E2A', money: true },
  ]

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard Overview</h1>
        <div className="date-badge">Today: {new Date().toLocaleDateString()}</div>
      </div>

      <div className="stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card card">
            <div className="stat-icon" style={{color: c.color}}>{c.icon}</div>
            <div className="stat-info">
              <h3>{c.label}</h3>
              <div className="value">{c.money ? formatMoney(c.value) : (c.value?.toLocaleString() || 0)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
        <div className="card">
          <h3>Recent Activity</h3>
          <p style={{color:'var(--text-muted)', fontSize:'.9rem', marginTop:'.5rem'}}>Live order stream will appear here.</p>
        </div>
        <div className="card">
          <h3>Live Rider Map</h3>
          <div style={{height:300, background:'rgba(0,0,0,0.2)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)'}}>
            Mapbox Integration Active
          </div>
        </div>
      </div>
    </div>
  )
}
