import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../../shared/api'
import { 
  Building, Search, ShieldAlert, CheckCircle, XCircle, 
  Clock, RefreshCw, Eye, ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Businesses() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  async function fetchStats() {
    try {
      const res = await api.get('/admin/businesses/stats')
      setStats(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchBusinesses() {
    setLoading(true)
    try {
      const res = await api.get('/admin/businesses', {
        params: { status, type, search, page, limit: 10 }
      })
      setBusinesses(res.data.businesses)
      setTotalPages(res.data.pages)
    } catch (err) {
      toast.error('Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchBusinesses()
  }, [status, type, page])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchBusinesses()
  }

  const getStatusBadge = (s) => {
    switch (s) {
      case 'PENDING': return 'badge badge-pending'
      case 'UNDER_REVIEW': return 'badge badge-in_transit'
      case 'APPROVED': return 'badge badge-delivered'
      case 'REJECTED': return 'badge badge-cancelled'
      case 'SUSPENDED': return 'badge badge-cancelled'
      default: return 'badge'
    }
  }

  return (
    <div className="businesses-page fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Partnership Businesses</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>Verify and manage corporate and merchant partner accounts.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { fetchStats(); fetchBusinesses(); }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Aggregate Stats Bar */}
      {stats && (
        <div className="grid-4 stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => { setStatus(''); setPage(1); }}>
            <div className="stat-icon-wrap" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
              <Building size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Total Partners</span>
              <h2 className="stat-value">{stats.total}</h2>
            </div>
          </div>

          <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => { setStatus('PENDING'); setPage(1); }}>
            <div className="stat-icon-wrap" style={{ background: 'rgba(245, 166, 35, 0.15)', color: '#F5A623' }}>
              <Clock size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Pending / Review</span>
              <h2 className="stat-value">{(stats.byStatus?.PENDING || 0) + (stats.byStatus?.UNDER_REVIEW || 0)}</h2>
            </div>
          </div>

          <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => { setStatus('APPROVED'); setPage(1); }}>
            <div className="stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
              <CheckCircle size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Approved Partners</span>
              <h2 className="stat-value">{stats.byStatus?.APPROVED || 0}</h2>
            </div>
          </div>

          <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => { setStatus('REJECTED'); setPage(1); }}>
            <div className="stat-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
              <XCircle size={20} />
            </div>
            <div className="stat-data">
              <span className="stat-label">Rejected / Suspended</span>
              <h2 className="stat-value">{(stats.byStatus?.REJECTED || 0) + (stats.byStatus?.SUSPENDED || 0)}</h2>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: '1', minWidth: '240px', marginBottom: '0' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Search Business</label>
            <div className="input-icon-wrap" style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                className="input-field" 
                style={{ paddingLeft: '1rem' }} 
                type="text" 
                placeholder="Name, email, owner..."
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>

          <div className="input-group" style={{ minWidth: '180px', marginBottom: '0' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Verification Status</label>
            <select className="input-field" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div className="input-group" style={{ minWidth: '180px', marginBottom: '0' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Business Type</label>
            <select className="input-field" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="RESTAURANT">Restaurant</option>
              <option value="PHARMACY">Pharmacy</option>
              <option value="SUPERMARKET">Supermarket</option>
              <option value="ONLINE_SHOP">Online Shop</option>
              <option value="CORPORATE">Corporate</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <button className="btn btn-primary" type="submit" style={{ padding: '0.85rem 1.5rem' }}>
            <Search size={16} /> Search
          </button>
        </form>
      </div>

      {/* Partners List */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
            <div className="pulsing">Loading partners...</div>
          </div>
        ) : businesses.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <Building size={40} style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p>No business accounts found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="orders-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Type</th>
                    <th>Owner</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>KYC Progress</th>
                    <th>Deliveries</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: '600' }}>{b.businessName}</td>
                      <td style={{ textTransform: 'capitalize' }}>{b.businessType.toLowerCase().replace('_', ' ')}</td>
                      <td>{b.ownerFullName}</td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>{b.email}</span>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.phone}</span>
                      </td>
                      <td>
                        <span className={getStatusBadge(b.verificationStatus)}>
                          {b.verificationStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          <span style={{ color: b.documentsApproved === b.documentsCount && b.documentsCount > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                            {b.documentsApproved} / {b.documentsCount} Approved
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{b.totalDeliveries}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/businesses/${b.id}`)}>
                          <Eye size={12} /> Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={16} /> Prev
                </button>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Page <b>{page}</b> of <b>{totalPages}</b>
                </span>
                <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
