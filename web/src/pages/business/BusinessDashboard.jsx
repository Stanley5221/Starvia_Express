import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import { 
  Building, Package, DollarSign, ArrowRight, ShieldAlert, 
  ShieldCheck, Upload, FileText, User, PlusCircle, History, TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import './Business.css'

export default function BusinessDashboard() {
  const { user, businessStatus, checkMe } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchDashboard() {
    try {
      const res = await api.get('/business/dashboard')
      setData(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    // Proactively verify verification status transitions
    checkMe()
  }, [])

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="pulsing" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Dashboard...</div>
      </div>
    )
  }

  const { business, stats, recentOrders = [], pricing } = data || {}

  // Helper to resolve status badge class
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return 'badge badge-pending'
      case 'UNDER_REVIEW': return 'badge badge-in_transit'
      case 'APPROVED': return 'badge badge-delivered'
      case 'REJECTED': return 'badge badge-cancelled'
      case 'SUSPENDED': return 'badge badge-cancelled'
      default: return 'badge'
    }
  }

  return (
    <div className="page fade-in">
      <div className="container">
        
        {/* Banner Alerts depending on verificationStatus */}
        {business?.verificationStatus === 'PENDING' && (
          <div className="business-alert alert-pending">
            <ShieldAlert size={20} className="alert-icon" />
            <div className="alert-content">
              <h3>Verification Pending</h3>
              <p>Please upload your verification documents (Ghana Card & Business Registration) so we can approve your account and unlock business rates.</p>
              <Link to="/business/documents" className="btn btn-outline btn-sm alert-btn">
                <Upload size={14} /> Upload Documents
              </Link>
            </div>
            *** End Patch
          </div>
        )}

        {business?.verificationStatus === 'UNDER_REVIEW' && (
          <div className="business-alert alert-review">
            <ShieldAlert size={20} className="alert-icon" style={{ color: 'var(--warning)' }} />
            <div className="alert-content">
              <h3>Documents Under Review</h3>
              <p>Your documents have been submitted and are under review by our admin team. This usually takes 1-2 business days.</p>
              <Link to="/business/documents" className="btn btn-outline btn-sm alert-btn" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                <FileText size={14} /> View Uploads
              </Link>
            </div>
          </div>
        )}

        {business?.verificationStatus === 'REJECTED' && (
          <div className="business-alert alert-rejected">
            <ShieldAlert size={20} className="alert-icon" style={{ color: 'var(--danger)' }} />
            <div className="alert-content">
              <h3>Verification Rejected</h3>
              <p className="rejection-reason"><b>Reason:</b> {business.rejectionReason || 'Documents were invalid or unreadable.'}</p>
              <p>Please re-upload valid documents for review to reactivate your partner account.</p>
              <Link to="/business/documents" className="btn btn-primary btn-sm alert-btn" style={{ background: 'var(--danger)' }}>
                <Upload size={14} /> Re-upload Documents
              </Link>
            </div>
          </div>
        )}

        {business?.verificationStatus === 'SUSPENDED' && (
          <div className="business-alert alert-rejected">
            <ShieldAlert size={20} className="alert-icon" style={{ color: 'var(--danger)' }} />
            <div className="alert-content">
              <h3>Business Account Suspended</h3>
              <p>Your business account has been suspended by the administrator. Please contact our support team at support@starviaexpress.com.</p>
            </div>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="dashboard-header">
          <div className="header-title">
            <Building size={32} className="header-icon" />
            <div>
              <h1>{business?.businessName}</h1>
              <p className="business-type-label">
                <span>{business?.businessType} PARTNER</span>
                <span className={getStatusBadge(business?.verificationStatus)} style={{ marginLeft: '0.8rem' }}>
                  {business?.verificationStatus}
                </span>
              </p>
            </div>
          </div>
          
          {business?.verificationStatus === 'APPROVED' && (
            <Link to="/order/new" className="btn btn-primary">
              <PlusCircle size={18} /> New Delivery
            </Link>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid-4 stats-grid">
          <div className="card stat-card">
            <div className="stat-icon-wrap bg-primary">
              <Package size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Total Deliveries</span>
              <h2 className="stat-value">{stats?.totalDeliveries}</h2>
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-icon-wrap bg-accent">
              <TrendingUp size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Monthly Deliveries</span>
              <h2 className="stat-value">{stats?.monthlyDeliveries}</h2>
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-icon-wrap bg-success">
              <DollarSign size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Total Spend</span>
              <h2 className="stat-value">{formatMoney(stats?.totalSpend)}</h2>
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-icon-wrap bg-info">
              <ShieldCheck size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Active Orders</span>
              <h2 className="stat-value">{stats?.pendingOrders}</h2>
            </div>
          </div>
        </div>

        {/* Dashboard Actions and Pricing Row */}
        <div className="grid-2 dashboard-sections" style={{ marginTop: '2rem' }}>
          
          {/* Quick Actions Card */}
          <div className="card flex-col-card">
            <h2>Quick Actions</h2>
            <div className="quick-actions-grid">
              {business?.verificationStatus === 'APPROVED' && (
                <button className="action-btn" onClick={() => navigate('/order/new')}>
                  <div className="action-icon"><PlusCircle size={22} /></div>
                  <span>Create Order</span>
                </button>
              )}
              <button className="action-btn" onClick={() => navigate('/business/orders')}>
                <div className="action-icon"><History size={22} /></div>
                <span>Order History</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/business/documents')}>
                <div className="action-icon"><Upload size={22} /></div>
                <span>Documents</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/business/profile')}>
                <div className="action-icon"><User size={22} /></div>
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          {/* Pricing Info Card */}
          <div className="card pricing-info-card">
            <h2>Pricing Discount</h2>
            {pricing ? (
              <div className="pricing-details">
                <div className="rate-badge">{pricing.label}</div>
                <div className="pricing-grid">
                  <div className="price-item">
                    <span className="price-label">Base Rate</span>
                    <span className="price-value">{formatMoney(pricing.basePrice)}</span>
                  </div>
                  <div className="price-item">
                    <span className="price-label">Per Kilometer</span>
                    <span className="price-value">{formatMoney(pricing.pricePerKm)}</span>
                  </div>
                  <div className="price-item">
                    <span className="price-label">Minimum Order</span>
                    <span className="price-value">{formatMoney(pricing.minPrice)}</span>
                  </div>
                </div>
                <p className="pricing-footnote">These discounted rates are applied automatically to all delivery orders placed by your business.</p>
              </div>
            ) : (
              <div className="no-pricing">
                <p>Standard rates currently apply. Custom business pricing will activate once your verification is complete.</p>
              </div>
            )}
          </div>

        </div>

        {/* Recent Deliveries */}
        <div className="card recent-orders-card" style={{ marginTop: '2rem' }}>
          <div className="card-header-flex">
            <h2>Recent Deliveries</h2>
            <Link to="/business/orders" className="view-all-link">
              View All History <ArrowRight size={14} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="empty-orders-view">
              <Package size={40} className="empty-icon" />
              <p>No delivery orders placed yet.</p>
              {business?.verificationStatus === 'APPROVED' && (
                <Link to="/order/new" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                  Place Your First Order
                </Link>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pickup Address</th>
                    <th>Dropoff Address</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Partnership Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="date-col">{new Date(o.createdAt).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="address-col" title={o.pickupAddress}>{o.pickupAddress}</td>
                      <td className="address-col" title={o.dropoffAddress}>{o.dropoffAddress}</td>
                      <td>
                        <span className={`badge badge-${o.status.toLowerCase()}`}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="price-col">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
