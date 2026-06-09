import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../../shared/api'
import { formatMoney } from '../../../shared/currency'
import { Package, MapPin, Clock, ChevronRight, Loader } from 'lucide-react'
import './Orders.css'

const STATUS_COLORS = {
  PENDING: 'badge-pending',
  ACCEPTED: 'badge-accepted',
  PICKED_UP: 'badge-picked_up',
  IN_TRANSIT: 'badge-in_transit',
  ARRIVED: 'badge-arrived',
  DELIVERED: 'badge-delivered',
  CANCELLED: 'badge-cancelled',
}

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
]

const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED']

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setLoading(true)
    const params = filter && filter !== 'active' ? { status: filter } : {}
    api
      .get('/orders', { params })
      .then((r) => {
        let list = r.data
        if (filter === 'active') {
          list = list.filter((o) => ACTIVE_STATUSES.includes(o.status))
        }
        setOrders(list)
      })
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="orders page">
      <div className="container">
        <div className="page-header fade-in orders-header">
          <div>
            <h1>Order History</h1>
            <p>All your deliveries, newest first.</p>
          </div>
          <Link to="/order/new" className="btn btn-primary btn-sm">
            + New Delivery
          </Link>
        </div>

        <div className="orders-filters fade-in">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="orders-loading">
            <Loader size={24} className="loading" />
          </div>
        ) : orders.length === 0 ? (
          <div className="orders-empty card fade-in">
            <Package size={48} style={{ opacity: 0.3 }} />
            <h3>No orders found</h3>
            <Link to="/order/new" className="btn btn-primary">
              Place a Delivery
            </Link>
          </div>
        ) : (
          <div className="orders-list fade-in">
            {orders.map((order) => (
              <div key={order.id} className="order-card card">
                <button
                  type="button"
                  className="order-card-main"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                >
                  <div className="order-card-left">
                    <div className="order-icon">
                      <Package size={20} />
                    </div>
                    <div className="order-details">
                      <div className="order-id">#{order.id.slice(-8).toUpperCase()}</div>
                      <div className="order-desc">{order.recipientName}</div>
                      <div className="order-route">
                        <MapPin size={12} /> {order.pickupAddress}
                      </div>
                      <div className="order-meta">
                        <Clock size={11} />
                        {new Date(order.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        <span className="dot">·</span>
                        {formatMoney(order.finalPrice ?? order.estimatedPrice)}
                      </div>
                    </div>
                  </div>
                  <div className="order-card-right">
                    <span className={`badge ${STATUS_COLORS[order.status] || 'badge-pending'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <ChevronRight
                      size={18}
                      style={{
                        color: 'var(--text-muted)',
                        transform: expanded === order.id ? 'rotate(90deg)' : 'none',
                      }}
                    />
                  </div>
                </button>
                {expanded === order.id && (
                  <div className="order-expanded">
                    <p>
                      <b>To:</b> {order.dropoffAddress}
                    </p>
                    {(order.packageDescription || order.packageSize || order.packagePhotoUrl) && (
                      <div className="order-package-detail">
                        {order.packagePhotoUrl && (
                          <a href={order.packagePhotoUrl} target="_blank" rel="noopener noreferrer" className="order-package-photo">
                            <img src={order.packagePhotoUrl} alt="Package" />
                          </a>
                        )}
                        <div>
                          {order.packageDescription && <p style={{ margin: '0 0 4px' }}><b>Package:</b> {order.packageDescription}</p>}
                          {order.packageSize && <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>Size: {order.packageSize}</p>}
                        </div>
                      </div>
                    )}
                    {order.rider && (
                      <p>
                        <b>Rider:</b> {order.rider.fullName} ({order.rider.motorPlate})
                      </p>
                    )}
                    <Link to={`/order/${order.id}`} className="btn btn-outline btn-sm">
                      Track order
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
