import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import { 
  Package, Search, Calendar, ChevronLeft, ChevronRight, 
  ArrowLeft, ArrowUpDown, TrendingDown, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import './Business.css'

export default function BusinessOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)

  async function fetchOrders() {
    setLoading(true)
    try {
      const res = await api.get('/business/orders', {
        params: { status, page, limit: 15 }
      })
      setOrders(res.data.orders)
      setTotalPages(res.data.pages)
      setTotalOrders(res.data.total)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch order history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [status, page])

  const handleFilterChange = (e) => {
    setStatus(e.target.value)
    setPage(1) // Reset page on filter update
  }

  return (
    <div className="page fade-in">
      <div className="container">
        
        {/* Back Link */}
        <div className="back-nav">
          <Link to="/business/dashboard" className="back-link">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>

        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <h1>Delivery History</h1>
          <p>View and manage all deliveries placed by your business account.</p>
        </div>

        {/* Filters and Search Bar */}
        <div className="card filters-card" style={{ marginBottom: '1.5rem' }}>
          <div className="filters-row">
            <div className="filter-group">
              <label>Filter by Status</label>
              <select className="input-field" value={status} onChange={handleFilterChange}>
                <option value="">All Deliveries</option>
                <option value="PENDING">Pending Assignment</option>
                <option value="ACCEPTED">Accepted by Rider</option>
                <option value="PICKED_UP">Picked Up</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="ARRIVED">Rider Arrived</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            
            <div className="filter-stats" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Total: <b>{totalOrders}</b> deliveries
              </span>
            </div>
          </div>
        </div>

        {/* Orders List / Table */}
        <div className="card orders-list-card">
          {loading ? (
            <div className="loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
              <Loader size={24} className="loading" />
              <span style={{ marginLeft: '0.8rem', color: 'var(--text-secondary)' }}>Loading history...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-orders-view" style={{ padding: '4rem 0' }}>
              <Package size={44} className="empty-icon" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>No delivery orders found matching the filter.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Recipient</th>
                      <th>Dropoff Address</th>
                      <th>Status</th>
                      <th>Rider</th>
                      <th>Price</th>
                      <th>Savings</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td className="date-col">
                          {new Date(o.createdAt).toLocaleDateString('en-GH', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </td>
                        <td>
                          <div className="recipient-details">
                            <span className="rec-name" style={{ fontWeight: '600' }}>{o.recipientName}</span>
                            <span className="rec-phone" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{o.recipientPhone}</span>
                          </div>
                        </td>
                        <td className="address-col" title={o.dropoffAddress}>{o.dropoffAddress}</td>
                        <td>
                          <span className={`badge badge-${o.status.toLowerCase()}`}>
                            {o.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="rider-col">
                          {o.rider ? (
                            <div>
                              <span className="rider-name" style={{ fontWeight: '500' }}>{o.rider.fullName}</span>
                              <span className="rider-plate" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--brand-accent)', fontWeight: 'bold' }}>{o.rider.motorPlate}</span>
                            </div>
                          ) : (
                            <span className="no-rider" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Unassigned</span>
                          )}
                        </td>
                        <td className="price-col" style={{ fontWeight: 'bold' }}>
                          {formatMoney(o.finalPrice ?? o.estimatedPrice)}
                        </td>
                        <td className="saving-col">
                          {o.businessSaving > 0 ? (
                            <span className="savings-badge">
                              Saved {formatMoney(o.businessSaving)}
                            </span>
                          ) : (
                            <span className="no-savings">-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-outline btn-sm action-icon-btn" title="Track Order" onClick={() => navigate(`/order/${o.id}`)}>
                            <Eye size={14} /> Track
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                  <button className="btn btn-outline btn-sm pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span className="pagination-text" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Page <b>{page}</b> of <b>{totalPages}</b>
                  </span>
                  <button className="btn btn-outline btn-sm pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}

// Small helper loader component for within order list card
function Loader({ size = 18, className = '' }) {
  return <TrendingDown size={size} className={`loading ${className}`} style={{ transform: 'rotate(0deg)', animation: 'spin 1s linear infinite' }} />
}
