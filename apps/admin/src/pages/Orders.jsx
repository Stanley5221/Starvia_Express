import { useState, useEffect } from 'react'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import { Package, MapPin, User, Phone, X, Truck, CheckCircle, Clock, Image } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_CLASS = {
  PENDING: 'badge-pending',
  ACCEPTED: 'badge-accepted',
  PICKED_UP: 'badge-picked_up',
  IN_TRANSIT: 'badge-in_transit',
  ARRIVED: 'badge-arrived',
  DELIVERED: 'badge-delivered',
  CANCELLED: 'badge-cancelled',
}

const STATUS_COLOR = {
  PENDING: '#9CA3AF',
  ACCEPTED: '#F59E0B',
  PICKED_UP: '#6366F1',
  IN_TRANSIT: '#3B82F6',
  ARRIVED: '#8B5CF6',
  DELIVERED: '#10B981',
  CANCELLED: '#EF4444',
}

const STATUS_ICON = {
  PENDING: Clock,
  ACCEPTED: Truck,
  PICKED_UP: Package,
  IN_TRANSIT: Truck,
  ARRIVED: MapPin,
  DELIVERED: CheckCircle,
  CANCELLED: X,
}

function OrderDetailModal({ order, onClose, onCancel }) {
  const color = STATUS_COLOR[order.status] || '#9CA3AF'
  const StatusIcon = STATUS_ICON[order.status] || Clock

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 680, maxHeight: '92vh',
        background: 'linear-gradient(145deg, #18090f 0%, #0c0406 100%)',
        border: '1px solid rgba(245,166,35,0.2)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{ padding: '1.4rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '.05em' }}>
                #{order.id.slice(-8).toUpperCase()}
              </span>
              <span style={{ background: color + '22', color, padding: '3px 12px', borderRadius: 20, fontSize: '.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <StatusIcon size={11} /> {order.status.replace('_', ' ')}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.8rem' }}>
              <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
              {new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            {order.customer && (
              <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '.8rem' }}>
                <User size={11} style={{ display: 'inline', marginRight: 4 }} />
                {order.customer.name} · {order.customer.phone}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#F5A623' }}>
              {formatMoney(order.finalPrice ?? order.estimatedPrice)}
            </span>
            <button type="button" className="modal-close" style={{ position: 'relative', top: 0, right: 0 }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* ── Pickup / Dropoff grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Pickup */}
            <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.25)', borderLeft: '3px solid #7C3AED', borderRadius: 10, padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#7C3AED', marginBottom: '.6rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={11} /> Pickup
              </div>
              <p style={{ margin: '0 0 .5rem', fontSize: '.88rem', fontWeight: 600, lineHeight: 1.4 }}>{order.pickupAddress}</p>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span><User size={10} style={{ marginRight: 4 }} />{order.pickupContactName}</span>
                <a href={`tel:${order.pickupPhone}`} style={{ color: '#7C3AED' }}><Phone size={10} style={{ marginRight: 4 }} />{order.pickupPhone}</a>
                {order.pickupNotes && <span style={{ fontStyle: 'italic' }}>"{order.pickupNotes}"</span>}
              </div>
            </div>
            {/* Drop-off */}
            <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderLeft: '3px solid #F59E0B', borderRadius: 10, padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#F59E0B', marginBottom: '.6rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={11} /> Drop-off
              </div>
              <p style={{ margin: '0 0 .5rem', fontSize: '.88rem', fontWeight: 600, lineHeight: 1.4 }}>{order.dropoffAddress}</p>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span><User size={10} style={{ marginRight: 4 }} />{order.recipientName}</span>
                <a href={`tel:${order.recipientPhone}`} style={{ color: '#F59E0B' }}><Phone size={10} style={{ marginRight: 4 }} />{order.recipientPhone}</a>
                {order.dropoffNotes && <span style={{ fontStyle: 'italic' }}>"{order.dropoffNotes}"</span>}
              </div>
            </div>
          </div>

          {/* ── Package ── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Package size={11} /> Package
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                {order.packageDescription && (
                  <p style={{ margin: '0 0 .4rem', fontSize: '.88rem', fontWeight: 600 }}>{order.packageDescription}</p>
                )}
                {order.packageSize && (
                  <span style={{ display: 'inline-block', background: 'rgba(124,58,237,0.15)', color: '#a78bfa', padding: '2px 10px', borderRadius: 6, fontSize: '.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                    {order.packageSize}
                  </span>
                )}
                {!order.packageDescription && !order.packageSize && (
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.85rem' }}>No details provided</p>
                )}
              </div>
              {/* Package photo */}
              {order.packagePhotoUrl ? (
                <div style={{ flexShrink: 0 }}>
                  <a href={order.packagePhotoUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={order.packagePhotoUrl}
                      alt="Package"
                      style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', display: 'block' }}
                    />
                  </a>
                  <p style={{ margin: '4px 0 0', fontSize: '.68rem', color: 'var(--muted)', textAlign: 'center' }}>Tap to enlarge</p>
                </div>
              ) : (
                <div style={{ flexShrink: 0, width: 90, height: 90, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Image size={20} style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>No photo</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Rider ── */}
          {order.rider && (
            <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {order.rider.profilePhoto || order.rider.photo
                  ? <img src={order.rider.profilePhoto || order.rider.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Truck size={20} style={{ color: '#10B981' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#10B981', marginBottom: 3 }}>Assigned Rider</div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '.95rem' }}>{order.rider.fullName}</p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: 3, fontSize: '.8rem', color: 'var(--muted)' }}>
                  <span>{order.rider.motorPlate}</span>
                  <a href={`tel:${order.rider.phone}`} style={{ color: '#10B981' }}><Phone size={10} style={{ marginRight: 3 }} />{order.rider.phone}</a>
                </div>
              </div>
            </div>
          )}

          {/* ── Delivery proof ── */}
          {order.deliveryPhotoUrl && (
            <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#10B981', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={11} /> Delivery Proof
              </div>
              <a href={order.deliveryPhotoUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={order.deliveryPhotoUrl}
                  alt="Delivery proof"
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', display: 'block' }}
                />
              </a>
            </div>
          )}

          {/* ── Pricing ── */}
          <div style={{ display: 'grid', gridTemplateColumns: order.finalPrice ? '1fr 1fr' : '1fr', gap: '.75rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '.9rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Estimated</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(245,166,35,0.6)' }}>{formatMoney(order.estimatedPrice)}</div>
            </div>
            {order.finalPrice && (
              <div style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 10, padding: '.9rem', textAlign: 'center' }}>
                <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Final</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F5A623' }}>{formatMoney(order.finalPrice)}</div>
              </div>
            )}
          </div>

          {/* ── Cancel button ── */}
          {order.status === 'PENDING' && (
            <button type="button" className="btn btn-sm" onClick={() => onCancel(order.id)}
              style={{ alignSelf: 'flex-end', background: '#EF444422', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [riders, setRiders] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [oRes, rRes] = await Promise.all([
        api.get('/admin/orders?limit=100'),
        api.get('/admin/riders?approved=true'),
      ])
      setOrders(oRes.data.orders)
      setRiders(rRes.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(orderId, riderId) {
    if (!riderId) return
    try {
      await api.patch(`/admin/orders/${orderId}/assign`, { riderId })
      toast.success('Rider assigned')
      fetchData()
    } catch {
      toast.error('Failed to assign rider')
    }
  }

  async function handleCancel(orderId) {
    if (!confirm('Cancel this order?')) return
    try {
      await api.patch(`/admin/orders/${orderId}/cancel`)
      toast.success('Order cancelled')
      fetchData()
      setDetail(null)
    } catch {
      toast.error('Cancel failed')
    }
  }

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1>Orders</h1>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="card table-container">
          <table>
            <thead>
              <tr>
                <th>ID / Date</th>
                <th>Customer</th>
                <th>Pickup</th>
                <th>Drop-off</th>
                <th>Package</th>
                <th>Rider</th>
                <th>Status</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <code>#{order.id.slice(-8)}</code>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    <b>{order.customer?.name}</b>
                    <div style={{ fontSize: '.75rem' }}>{order.customer?.phone}</div>
                  </td>
                  <td style={{ fontSize: '.75rem', maxWidth: 140 }}>
                    {order.pickupAddress}
                    <div>
                      <User size={10} /> {order.pickupContactName}
                    </div>
                    <a href={`tel:${order.pickupPhone}`}>{order.pickupPhone}</a>
                  </td>
                  <td style={{ fontSize: '.75rem', maxWidth: 140 }}>
                    {order.dropoffAddress}
                    <div>{order.recipientName}</div>
                    <a href={`tel:${order.recipientPhone}`}>{order.recipientPhone}</a>
                  </td>
                  <td style={{ fontSize: '.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {order.packagePhotoUrl && (
                        <img src={order.packagePhotoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div>
                        {order.packageDescription || '—'}
                        <br />{order.packageSize}
                      </div>
                    </div>
                  </td>
                  <td>
                    {order.rider ? (
                      order.rider.fullName
                    ) : order.status === 'PENDING' ? (
                      <select
                        className="btn btn-outline btn-sm"
                        defaultValue=""
                        onChange={(e) => handleAssign(order.id, e.target.value)}
                      >
                        <option value="" disabled>
                          Assign
                        </option>
                        {riders
                          .filter((r) => r.isAvailable)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.fullName}
                            </option>
                          ))}
                      </select>
                    ) : (
                      'Unassigned'
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[order.status] || ''}`}>{order.status}</span>
                  </td>
                  <td>{formatMoney(order.finalPrice ?? order.estimatedPrice)}</td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetail(order)}>
                      View
                    </button>
                    {order.status === 'PENDING' && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => handleCancel(order.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <OrderDetailModal
          order={detail}
          onClose={() => setDetail(null)}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
