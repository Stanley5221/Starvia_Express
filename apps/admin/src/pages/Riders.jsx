import { useState, useEffect, useRef } from 'react'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import toast from 'react-hot-toast'
import {
  Bike, Plus, X, Eye, EyeOff, Copy, Check,
  UserCheck, UserX, Trash2, Key, Camera, Package,
  Pencil, AlertCircle,
} from 'lucide-react'

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

// ─── Form input helper ────────────────────────────────────────────────────────
function FInput({ label, value, onChange, type = 'text' }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        style={type === 'date' ? { colorScheme: 'dark' } : {}} />
    </div>
  )
}

// ─── Add Rider Modal ──────────────────────────────────────────────────────────
function AddRiderModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '',
    motorPlate: '', motorMake: '', motorModel: '', motorColor: '',
    licenceNumber: '', licenceExpiry: '', profilePhoto: null,
  })
  const [photoPreview, setPhotoPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => { setPhotoPreview(reader.result); set('profilePhoto', reader.result) }
    reader.readAsDataURL(file)
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/admin/riders', form)
      onCreated(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create rider')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-box card fade-in" onClick={e => e.stopPropagation()} style={{
        maxWidth: 600, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(145deg, #18090f 0%, #0c0406 100%)',
        border: '1px solid rgba(245,166,35,0.25)', padding: 0, overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Add New Rider</h2>
          <button type="button" className="modal-close" style={{ position: 'relative', top: 0, right: 0 }} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', lineHeight: 1.5, marginTop: 0, marginBottom: '1.5rem' }}>
              Account is auto-approved. A temporary password is shown once — share it with the rider.
            </p>

            {/* Photo upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div onClick={() => fileRef.current?.click()} style={{
                width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
                background: photoPreview ? 'transparent' : 'rgba(245,166,35,0.08)',
                border: `2px dashed ${photoPreview ? 'rgba(245,166,35,0.5)' : 'rgba(245,166,35,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                {photoPreview
                  ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={24} color="rgba(245,166,35,0.5)" />}
              </div>
              <div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                  {photoPreview ? 'Change Photo' : 'Upload Profile Photo'}
                </button>
                <p style={{ color: 'var(--muted)', fontSize: '.75rem', margin: '4px 0 0' }}>Optional · JPEG / PNG</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.fullName} onChange={e => set('fullName', e.target.value)} required placeholder="Kwame Asante" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="kwame@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} required placeholder="0244000000" />
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem', marginTop: '.25rem', fontWeight: 800, fontSize: '.78rem', color: '#F5A623', textTransform: 'uppercase', letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <Bike size={16} /> Vehicle Details
              </div>
              <div className="form-group"><label className="form-label">Plate Number *</label><input className="form-input" value={form.motorPlate} onChange={e => set('motorPlate', e.target.value)} required placeholder="GR-1234-22" /></div>
              <div className="form-group"><label className="form-label">Make *</label><input className="form-input" value={form.motorMake} onChange={e => set('motorMake', e.target.value)} required placeholder="Honda" /></div>
              <div className="form-group"><label className="form-label">Model *</label><input className="form-input" value={form.motorModel} onChange={e => set('motorModel', e.target.value)} required placeholder="CB125F" /></div>
              <div className="form-group"><label className="form-label">Colour *</label><input className="form-input" value={form.motorColor} onChange={e => set('motorColor', e.target.value)} required placeholder="Red" /></div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem', marginTop: '.25rem', fontWeight: 800, fontSize: '.78rem', color: '#F5A623', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Licence Details
              </div>
              <div className="form-group"><label className="form-label">Licence Number *</label><input className="form-input" value={form.licenceNumber} onChange={e => set('licenceNumber', e.target.value)} required placeholder="DL-0001234" /></div>
              <div className="form-group"><label className="form-label">Licence Expiry *</label><input className="form-input" type="date" value={form.licenceExpiry} onChange={e => set('licenceExpiry', e.target.value)} required style={{ colorScheme: 'dark' }} /></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <button type="button" className="btn btn-outline" style={{ padding: '.65rem 1.25rem' }} onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ padding: '.65rem 1.5rem' }} disabled={loading}>{loading ? 'Creating…' : 'Create Rider Account'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Temp / Reset Password Modal ──────────────────────────────────────────────
function TempPasswordModal({ result, onClose, title = 'Rider Account Created' }) {
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(false)

  function copyAll() {
    const text = `Name: ${result.name}\nEmail: ${result.email}\nTemp Password: ${result.temporaryPassword}`
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>🔑</div>
        <h2 style={{ margin: '0 0 .5rem' }}>{title}</h2>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem' }}>
          Give these credentials to <strong>{result.name}</strong>. The temporary password is shown <strong>once only</strong>.
        </p>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', textAlign: 'left', marginBottom: '1.25rem' }}>
          <div style={{ marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: '.2rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Email</div>
            <div style={{ fontWeight: 600 }}>{result.email}</div>
          </div>
          <div>
            <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: '.2rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Temporary Password</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '.1em', color: '#F5A623' }}>
                {show ? result.temporaryPassword : '••••••••••'}
              </span>
              <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} onClick={() => setShow(s => !s)}>
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
          The rider will be prompted to set a new password when they first sign in.
        </p>
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={copyAll} style={{ minWidth: 140 }}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Credentials</>}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ─── Rider Detail Modal ───────────────────────────────────────────────────────
function RiderDetailModal({ riderId, onClose, onUpdated }) {
  const [rider, setRider] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [photoPreview, setPhotoPreview] = useState(null)
  const [pwResult, setPwResult] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState('profile')
  const fileRef = useRef()

  useEffect(() => { loadRider() }, [riderId])

  async function loadRider() {
    setLoading(true)
    try {
      const { data } = await api.get(`/admin/riders/${riderId}`)
      setRider(data)
      setEditForm({
        fullName: data.fullName, phone: data.phone,
        motorPlate: data.motorPlate, motorMake: data.motorMake,
        motorModel: data.motorModel, motorColor: data.motorColor,
        licenceNumber: data.licenceNumber,
        licenceExpiry: data.licenceExpiry ? new Date(data.licenceExpiry).toISOString().split('T')[0] : '',
        profilePhoto: data.profilePhoto || null,
      })
      setPhotoPreview(data.profilePhoto || null)
    } catch {
      toast.error('Failed to load rider')
      onClose()
    } finally { setLoading(false) }
  }

  function setEdit(k, v) { setEditForm(f => ({ ...f, [k]: v })) }

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => { setPhotoPreview(reader.result); setEdit('profilePhoto', reader.result) }
    reader.readAsDataURL(file)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await api.patch(`/admin/riders/${riderId}`, editForm)
      toast.success('Profile updated')
      loadRider(); onUpdated()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  async function toggleSuspend() {
    try {
      await api.patch(`/admin/riders/${riderId}/suspend`)
      toast.success(rider.isSuspended ? 'Rider reinstated' : 'Rider suspended')
      loadRider(); onUpdated()
    } catch (err) { toast.error(err.response?.data?.error || 'Action failed') }
  }

  async function resetPassword() {
    try {
      const { data } = await api.post(`/admin/riders/${riderId}/reset-password`)
      setPwResult(data)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to reset password') }
  }

  async function deleteRider() {
    try {
      await api.delete(`/admin/riders/${riderId}`)
      toast.success('Rider account deleted')
      onUpdated(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete')
      setConfirmDelete(false)
    }
  }

  if (loading) return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', padding: '3rem' }} onClick={e => e.stopPropagation()}>Loading rider…</div>
    </div>
  )

  if (pwResult) return <TempPasswordModal result={pwResult} title="Password Reset" onClose={() => setPwResult(null)} />

  if (confirmDelete) return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-box" style={{ maxWidth: 440, textAlign: 'center' }}>
        <AlertCircle size={40} color="#EF4444" style={{ marginBottom: '1rem' }} />
        <h2 style={{ margin: '0 0 .5rem' }}>Delete Rider?</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '.9rem' }}>
          This permanently deletes <strong>{rider?.fullName}</strong>'s account. Active orders will be re-queued to pending. Cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center' }}>
          <button className="btn btn-outline" onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button className="btn" style={{ background: '#EF4444', color: 'white', border: 'none' }} onClick={deleteRider}>Delete Permanently</button>
        </div>
      </div>
    </div>
  )

  const completedOrders = rider.orders?.filter(o => o.status === 'DELIVERED') || []
  const ratingOrders = completedOrders.filter(o => o.customerRating)
  const avgRating = ratingOrders.length > 0
    ? (ratingOrders.reduce((s, o) => s + o.customerRating, 0) / ratingOrders.length).toFixed(1)
    : null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 760, maxHeight: '94vh',
        background: 'linear-gradient(145deg, #18090f 0%, #0c0406 100%)',
        border: '1px solid rgba(245,166,35,0.25)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'rgba(245,166,35,0.1)', border: '2px solid rgba(245,166,35,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {rider.profilePhoto
              ? <img src={rider.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'rgba(245,166,35,0.7)' }}>{rider.fullName?.[0]?.toUpperCase()}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{rider.fullName}</h2>
              {rider.isSuspended && <span style={{ background: '#EF444422', color: '#EF4444', padding: '2px 10px', borderRadius: 6, fontSize: '.75rem', fontWeight: 700 }}>SUSPENDED</span>}
              {!rider.isSuspended && rider.isAvailable && <span style={{ background: '#10B98122', color: '#10B981', padding: '2px 10px', borderRadius: 6, fontSize: '.75rem', fontWeight: 700 }}>ONLINE</span>}
              {rider.isOnDelivery && <span style={{ background: '#F59E0B22', color: '#F59E0B', padding: '2px 10px', borderRadius: 6, fontSize: '.75rem', fontWeight: 700 }}>ON DELIVERY</span>}
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{rider.user?.email} · {rider.phone}</p>
            <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '.82rem' }}>
              Member since {rider.user?.createdAt ? new Date(rider.user.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
          <button type="button" className="modal-close" style={{ position: 'relative', top: 0, right: 0 }} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { label: 'Deliveries', value: rider.totalDeliveries || 0 },
            { label: 'Earnings', value: formatMoney(rider.totalEarnings || 0) },
            { label: 'Rating', value: avgRating ? `${avgRating}★` : '—' },
            { label: 'All Orders', value: rider.orders?.length || 0 },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: '.75rem 1rem', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F5A623' }}>{s.value}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['profile', 'Profile & Edit'], ['deliveries', 'Deliveries'], ['security', 'Security']].map(([id, label]) => (
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
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div onClick={() => fileRef.current?.click()} style={{
                  width: 64, height: 64, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden',
                  background: photoPreview ? 'transparent' : 'rgba(245,166,35,0.08)',
                  border: '2px dashed rgba(245,166,35,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {photoPreview
                    ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Camera size={20} color="rgba(245,166,35,0.5)" />}
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>Change Photo</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FInput label="Full Name" value={editForm.fullName} onChange={v => setEdit('fullName', v)} />
                <FInput label="Phone" value={editForm.phone} onChange={v => setEdit('phone', v)} />

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '.25rem', color: '#F5A623', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <Bike size={14} /> Vehicle
                </div>
                <FInput label="Plate" value={editForm.motorPlate} onChange={v => setEdit('motorPlate', v)} />
                <FInput label="Make" value={editForm.motorMake} onChange={v => setEdit('motorMake', v)} />
                <FInput label="Model" value={editForm.motorModel} onChange={v => setEdit('motorModel', v)} />
                <FInput label="Colour" value={editForm.motorColor} onChange={v => setEdit('motorColor', v)} />

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '.25rem', color: '#F5A623', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Licence
                </div>
                <FInput label="Licence No." value={editForm.licenceNumber} onChange={v => setEdit('licenceNumber', v)} />
                <FInput label="Expiry" value={editForm.licenceExpiry} onChange={v => setEdit('licenceExpiry', v)} type="date" />
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving} style={{ minWidth: 120 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* DELIVERIES TAB */}
          {tab === 'deliveries' && (
            <div>
              {!rider.orders?.length ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 0' }}>
                  <Package size={40} style={{ opacity: .3, marginBottom: '1rem', display: 'block', margin: '0 auto 1rem' }} />
                  <p>No deliveries yet.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Date', 'Customer', 'Route', 'Status', 'Amount', 'Rating'].map(h => (
                          <th key={h} style={{ padding: '.5rem .75rem', color: 'var(--muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rider.orders.map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '.6rem .75rem', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                            {new Date(o.createdAt).toLocaleDateString()}
                            <br /><span style={{ fontSize: '.72rem' }}>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td style={{ padding: '.6rem .75rem' }}>
                            <div style={{ fontWeight: 600 }}>{o.customer?.name || '—'}</div>
                            <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{o.customer?.phone}</div>
                          </td>
                          <td style={{ padding: '.6rem .75rem', maxWidth: 220 }}>
                            <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginBottom: 2 }}>📍 {o.pickupAddress}</div>
                            <div style={{ fontSize: '.75rem' }}>🏁 {o.dropoffAddress}</div>
                          </td>
                          <td style={{ padding: '.6rem .75rem' }}><StatusBadge status={o.status} /></td>
                          <td style={{ padding: '.6rem .75rem', fontWeight: 700, color: '#F5A623' }}>{formatMoney(o.finalPrice ?? o.estimatedPrice ?? 0)}</td>
                          <td style={{ padding: '.6rem .75rem' }}>
                            {o.customerRating
                              ? <span>{'⭐'.repeat(Math.min(o.customerRating, 5))}</span>
                              : <span style={{ color: 'var(--muted)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECURITY TAB */}
          {tab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Reset Password */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>Reset Password</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Generate a new temporary password. Rider must change it on next login.</div>
                </div>
                <button className="btn btn-outline btn-sm" style={{ flexShrink: 0 }} onClick={resetPassword}>
                  <Key size={14} /> Reset
                </button>
              </div>

              {/* Suspend / Reinstate */}
              <div style={{
                background: rider.isSuspended ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
                borderRadius: 12, padding: '1.25rem',
                border: `1px solid ${rider.isSuspended ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
              }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>{rider.isSuspended ? 'Reinstate Account' : 'Suspend Account'}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                    {rider.isSuspended
                      ? 'Lift the suspension and allow this rider to sign in and go online.'
                      : 'Block this rider from signing in or accepting deliveries. Reversible at any time.'}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={toggleSuspend} style={{
                  flexShrink: 0,
                  background: rider.isSuspended ? '#10B98122' : '#F59E0B22',
                  color: rider.isSuspended ? '#10B981' : '#F59E0B',
                  border: `1px solid ${rider.isSuspended ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                  {rider.isSuspended ? <><UserCheck size={14} /> Reinstate</> : <><UserX size={14} /> Suspend</>}
                </button>
              </div>

              {/* Delete */}
              <div style={{ background: 'rgba(239,68,68,0.04)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '.25rem', color: '#EF4444' }}>Delete Account</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Permanently removes the rider. Active orders are re-queued. Cannot be undone.</div>
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

// ─── Main Riders page ─────────────────────────────────────────────────────────
export default function Riders() {
  const [riders, setRiders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [tempResult, setTempResult] = useState(null)
  const [managingId, setManagingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/riders')
      setRiders(data)
    } finally { setLoading(false) }
  }

  function handleCreated(result) { setShowAddModal(false); setTempResult(result); load() }

  return (
    <div className="riders-page">
      {showAddModal && <AddRiderModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />}
      {tempResult && <TempPasswordModal result={tempResult} onClose={() => setTempResult(null)} />}
      {managingId && <RiderDetailModal riderId={managingId} onClose={() => setManagingId(null)} onUpdated={load} />}

      <div className="page-header">
        <div>
          <h1>Fleet Riders</h1>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem', margin: '4px 0 0' }}>
            {riders.length} rider{riders.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add New Rider
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : riders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <Bike size={48} style={{ opacity: .3, marginBottom: '1rem', display: 'block', margin: '0 auto 1rem' }} />
          <p style={{ margin: 0 }}>No riders yet. Add your first rider using the button above.</p>
        </div>
      ) : (
        <div className="riders-grid">
          {riders.map(r => (
            <div key={r.id} className="card rider-admin-card" style={{ opacity: r.isSuspended ? 0.75 : 1 }}>
              <div className="rider-admin-header">
                <div className="rider-avatar-lg" style={{ position: 'relative' }}>
                  {r.profilePhoto ? <img src={r.profilePhoto} alt="" /> : '🏍️'}
                  {r.isSuspended && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>⛔</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fullName}</b>
                  <p style={{ margin: '2px 0', fontSize: '.85rem', color: 'var(--muted)' }}>{r.phone}</p>
                  <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginTop: 4 }}>
                    {r.isSuspended
                      ? <span className="badge" style={{ background: '#EF444422', color: '#EF4444' }}>Suspended</span>
                      : <span className="badge badge-delivered">Approved</span>}
                    {!r.isSuspended && r.isAvailable && <span className="badge badge-pending">Available</span>}
                    {r.isOnDelivery && <span className="badge" style={{ background: '#f59e0b22', color: '#f59e0b' }}>On Delivery</span>}
                    {!r.isSuspended && !r.isAvailable && !r.isOnDelivery && <span className="badge" style={{ background: '#ffffff11', color: 'var(--muted)' }}>Offline</span>}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.75rem', marginTop: '.75rem' }}>
                <p style={{ margin: '0 0 .25rem', fontSize: '.82rem', color: 'var(--muted)' }}>
                  <Bike size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {r.motorColor} {r.motorMake} {r.motorModel} · <strong>{r.motorPlate}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '.82rem', color: 'var(--muted)' }}>
                  Licence: {r.licenceNumber} · exp. {new Date(r.licenceExpiry).toLocaleDateString()}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '.75rem', paddingTop: '.75rem', borderTop: '1px solid var(--border)', fontSize: '.82rem' }}>
                <span><strong>{r.totalDeliveries}</strong> deliveries</span>
                <span><strong>{formatMoney(r.totalEarnings)}</strong> earned</span>
                {r.averageRating && <span>⭐ {r.averageRating}</span>}
              </div>

              <button type="button" className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '.75rem' }} onClick={() => setManagingId(r.id)}>
                <Pencil size={14} /> Manage
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
