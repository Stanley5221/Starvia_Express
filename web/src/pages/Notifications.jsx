import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../../shared/api'
import { Bell, Loader } from 'lucide-react'

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/notifications')
      .then((r) => setItems(r.data.notifications))
      .finally(() => setLoading(false))
  }, [])

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`)
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="page-header">
          <h1><Bell size={22} /> Notifications</h1>
        </div>
        {loading ? (
          <Loader className="loading" />
        ) : items.length === 0 ? (
          <div className="card">No notifications yet.</div>
        ) : (
          <div className="orders-list">
            {items.map((n) => (
              <div
                key={n.id}
                className="card"
                style={{
                  opacity: n.read ? 0.7 : 1,
                  borderLeft: n.read ? undefined : '3px solid var(--brand-primary)',
                }}
              >
                <b>{n.title}</b>
                <p style={{ margin: '.25rem 0' }}>{n.message}</p>
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(n.createdAt).toLocaleString()}
                </small>
                <div style={{ marginTop: '.5rem', display: 'flex', gap: '.5rem' }}>
                  {n.orderId && (
                    <Link to={`/order/${n.orderId}`} className="btn btn-outline btn-sm">
                      View order
                    </Link>
                  )}
                  {!n.read && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
