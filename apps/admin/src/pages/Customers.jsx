import { useState, useEffect } from 'react'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import toast from 'react-hot-toast'
import { Users, Package, X, UserCheck, UserX, Trash2, AlertCircle, Percent, Pencil } from 'lucide-react'

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  DELIVERED: '#10B981', CANCELLED: '#EF4444', IN_TRANSIT: '#3B82F6',
  PICKED_UP: '#6366F1', ACCEPTED: '#F59E0B', ARRIVED: '#8B5CF6', PENDING: '#9CA3AF',
}
function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || '#9CA3AF'
  return (
    <span style={{ background: c + '22', color: c, padding: '2px 8px', borderRadius: 6, fontSize: '.7rem', fontWeight: 700 }}>
      {status}
    </span>
  )
}

// ─── Customer Detail Modal ────────────────────────────────────────────────────
function CustomerDetailModal({ customerId, onClose, onUpdated }) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [discountForm, setDiscountForm] = useState({ discountPercent: 0 })
  const [savingDiscount, setSavingDiscount] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState('profile')

  useEffect(() => { loadCustomer() }, [customerId])

  async function loadCustomer() {
    setLoading(true)
    try {
      const { data } = await api.get(`/admin/customers/${customerId}`)
      setCustomer(data)
      setEditForm({ name: data.name, phone: data.phone || '' })
      setDiscountForm({ discountPercent: data.discountPercent ?? 0 })
    } catch {
      toast.error('Failed to load customer')
      onClose()
    } finally { setLoading(false) }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await api.patch(`/admin/customers/${customerId}`, editForm)
      toast.success('Profile updated')
      loadCustomer(); onUpdated()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  async function saveDiscount() {
    setSavingDiscount(true)
    try {
      await api.patch(`/admin/customers/${customerId}/discount`, discountForm)
      toast.success('Discount updated')
      loadCustomer()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save discount')
    } finally { setSavingDiscount(false) }
  }

  async function toggleSuspend() {
    try {
      await api.patch(`/admin/customers/${customerId}/suspend`)
      toast.success(customer.isSuspended ? 'Customer reinstated' : 'Customer suspended')
      loadCustomer(); onUpdated()
    } catch (err) { toast.error(err.response?.data?.error || 'Action failed') }
  }

  async function deleteCustomer() {
    try {
      await api.delete(`/admin/customers/${customerId}`)
      toast.success('Customer deleted')
      onUpdated(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete')
      setConfirmDelete(false)
    }
  }

  if (loading) return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', padding: '3rem' }} onClick={e => e.stopPropagation()}>Loading customer…</div>
    </div>
  )

  if (confirmDelete) return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-box" style={{ maxWidth: 440, textAlign: 'center' }}>
        <AlertCircle size={40} color="#EF4444" style={{ marginBottom: '1rem' }} />
        <h2 style={{ margin: '0 0 .5rem' }}>Delete Customer?</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '.9rem' }}>
          This permanently deletes <strong>{customer?.name}</strong>'s account.
          {customer?.orders?.length > 0 && ` Note: customers with ${customer.orders.length} order(s) cannot be deleted — use Suspend instead.`}
        </p>
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center' }}>
          <button className="btn btn-outline" onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button className="btn" style={{ background: '#EF4444', color: 'white', border: 'none' }} onClick={deleteCustomer}>Delete</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 720, maxHeight: '94vh',
        background: 'linear-gradient(145deg, #18090f 0%, #0c0406 100%)',
        border: '1px solid rgba(245,166,35,0.25)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,166,35,0.1)', border: '2px solid rgba(245,166,35,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(245,166,35,0.7)' }}>
              {customer.name?.[0]?.toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{customer.name}</h2>
              {customer.isSuspended && (
                <span style={{ background: '#EF444422', color: '#EF4444', padding: '2px 10px', borderRadius: 6, fontSize: '.75rem', fontWeight: 700 }}>SUSPENDED</span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{customer.email} · {customer.phone || '—'}</p>
            <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '.82rem' }}>
              Member since {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
          <button type="button" className="modal-close" style={{ position: 'relative', top: 0, right: 0 }} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { label: 'Total Orders', value: customer.orders?.length || 0 },
            { label: 'Completed', value: customer.totalDeliveries || 0 },
            { label: 'Total Spent', value: formatMoney(customer.totalSpent || 0) },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: '.75rem 1rem', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F5A623' }}>{s.value}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['profile', 'Profile & Edit'], ['orders', 'Order History'], ['discount', 'Discount'], ['security', 'Security']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} style={{
              flex: 1, padding: '.85rem', background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === id ? '#F5A623' : 'var(--muted)', fontWeight: tab === id ? 700 : 600, fontSize: '.9rem',
              borderBottom: tab === id ? '2px solid #F5A623' : '2px solid transparent', transition: 'all .2s',
            }}>{label}</button>
          ))}
        </div>

        {/* Tab body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* PROFILE TAB */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233…" />
              </div>
              <div className="form-group">
                <label className="form-label">Email (read-only)</label>
                <input className="form-input" value={customer.email} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving} style={{ minWidth: 120 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {tab === 'orders' && (
            <div>
              {!customer.orders?.length ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 0' }}>
                  <Package size={40} style={{ opacity: .3, display: 'block', margin: '0 auto 1rem' }} />
                  <p>No orders yet.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Date', 'Rider', 'Route', 'Status', 'Amount'].map(h => (
                          <th key={h} style={{ padding: '.5rem .75rem', color: 'var(--muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders.map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '.6rem .75rem', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                            {new Date(o.createdAt).toLocaleDateString()}
                            <br /><span style={{ fontSize: '.72rem' }}>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td style={{ padding: '.6rem .75rem' }}>
                            {o.rider ? (
                              <div>
                                <div style={{ fontWeight: 600 }}>{o.rider.fullName}</div>
                                <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{o.rider.phone}</div>
                              </div>
                            ) : <span style={{ color: 'var(--muted)' }}>Unassigned</span>}
                          </td>
                          <td style={{ padding: '.6rem .75rem', maxWidth: 220 }}>
                            <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: 2 }}>📍 {o.pickupAddress}</div>
                            <div style={{ fontSize: '.75rem' }}>🏁 {o.dropoffAddress}</div>
                          </td>
                          <td style={{ padding: '.6rem .75rem' }}><StatusBadge status={o.status} /></td>
                          <td style={{ padding: '.6rem .75rem', fontWeight: 700, color: '#F5A623' }}>
                            {formatMoney(o.finalPrice ?? o.estimatedPrice ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DISCOUNT TAB */}
          {tab === 'discount' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Current global rate notice */}
              <div style={{ background: 'rgba(245,166,35,0.06)', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid rgba(245,166,35,0.2)' }}>
                <div style={{ fontSize: '.8rem', color: '#F5A623', fontWeight: 700, marginBottom: '.25rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>How discounts work</div>
                <div style={{ fontSize: '.83rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  Set a per-customer discount below. If 0, the global individual discount from <strong>Pricing → Individual Standard Rate</strong> applies.
                  A non-zero value here overrides the global rate for this customer only.
                </div>
              </div>

              {/* Current discount badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.4rem' }}>Current Discount</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: customer.discountPercent > 0 ? '#10B981' : 'var(--muted)' }}>
                    {customer.discountPercent ?? 0}%
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.15rem' }}>
                    {customer.discountPercent > 0 ? 'Personal override active' : 'Using global rate'}
                  </div>
                </div>
                <Percent size={40} style={{ opacity: .15 }} />
              </div>

              {/* Discount input */}
              <div className="form-group">
                <label className="form-label">Personal Discount (%)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="0"
                  value={discountForm.discountPercent}
                  onChange={e => setDiscountForm({ discountPercent: Math.min(100, Math.max(0, +e.target.value)) })}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>
                  Enter 0 to remove the personal override and fall back to the global individual discount.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={saveDiscount} disabled={savingDiscount} style={{ minWidth: 140 }}>
                  {savingDiscount ? 'Saving…' : 'Save Discount'}
                </button>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {tab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Suspend / Reinstate */}
              <div style={{
                background: customer.isSuspended ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
                borderRadius: 12, padding: '1.25rem',
                border: `1px solid ${customer.isSuspended ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
              }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>{customer.isSuspended ? 'Reinstate Account' : 'Suspend Account'}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                    {customer.isSuspended
                      ? 'Lift the suspension and allow this customer to sign in and place orders.'
                      : 'Prevent this customer from signing in or placing new orders. Reversible.'}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={toggleSuspend} style={{
                  flexShrink: 0,
                  background: customer.isSuspended ? '#10B98122' : '#F59E0B22',
                  color: customer.isSuspended ? '#10B981' : '#F59E0B',
                  border: `1px solid ${customer.isSuspended ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                  {customer.isSuspended ? <><UserCheck size={14} /> Reinstate</> : <><UserX size={14} /> Suspend</>}
                </button>
              </div>

              {/* Delete */}
              <div style={{ background: 'rgba(239,68,68,0.04)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '.25rem', color: '#EF4444' }}>Delete Account</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                    Only possible if the customer has no order history. Use Suspend for active customers.
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => setConfirmDelete(true)} style={{ flexShrink: 0, background: '#EF444422', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Customers page ──────────────────────────────────────────────────────
export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [managingId, setManagingId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/customers')
      setCustomers(data)
    } finally { setLoading(false) }
  }

  const filtered = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  return (
    <div className="customers-page">
      {managingId && <CustomerDetailModal customerId={managingId} onClose={() => setManagingId(null)} onUpdated={load} />}

      <div className="page-header">
        <div>
          <h1>Customer Directory</h1>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem', margin: '4px 0 0' }}>
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <input
          className="form-input"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Orders</th>
              <th>Total Spent</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                {search ? 'No customers match your search.' : 'No customers yet.'}
              </td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>
                  <div>{c.email}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{c.phone}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={14} style={{ color: 'var(--brand-primary)' }} />
                    {c.totalOrders || 0}
                  </div>
                </td>
                <td style={{ fontWeight: 600, color: '#F5A623' }}>{formatMoney(c.totalSpent || 0)}</td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                <td>
                  {c.isSuspended ? (
                    <span style={{ background: '#EF444422', color: '#EF4444', padding: '2px 8px', borderRadius: 6, fontSize: '.75rem', fontWeight: 700 }}>Suspended</span>
                  ) : (
                    <span style={{ background: '#10B98122', color: '#10B981', padding: '2px 8px', borderRadius: 6, fontSize: '.75rem', fontWeight: 700 }}>Active</span>
                  )}
                </td>
                <td>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setManagingId(c.id)}>
                    <Pencil size={12} /> Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
