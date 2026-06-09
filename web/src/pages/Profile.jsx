import { useEffect, useState } from 'react'
import api from '../../../shared/api'
import { formatMoney } from '../../../shared/currency'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { User, MapPin, Lock, Loader } from 'lucide-react'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '' })
  const [passwords, setPasswords] = useState({ current: '', next: '' })
  const [addresses, setAddresses] = useState([])
  const [stats, setStats] = useState(null)
  const [addrForm, setAddrForm] = useState({ label: 'home', address: '', lat: '', lng: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) setForm({ name: user.name, phone: user.phone || '' })
    api.get('/users/me/addresses').then((r) => setAddresses(r.data)).catch(() => {})
    api.get('/users/me/stats').then((r) => setStats(r.data)).catch(() => {})
  }, [user])

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.patch('/users/me', form)
      setUser({ ...user, ...data })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    try {
      await api.post('/users/me/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      })
      toast.success('Password changed')
      setPasswords({ current: '', next: '' })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password change failed')
    }
  }

  async function addAddress(e) {
    e.preventDefault()
    if (!addrForm.address || !addrForm.lat) return toast.error('Address and coordinates required')
    try {
      const { data } = await api.post('/users/me/addresses', addrForm)
      setAddresses((a) => [...a, data])
      setAddrForm({ label: 'work', address: '', lat: '', lng: '' })
      toast.success('Address saved')
    } catch (err) {
      toast.error('Could not save address')
    }
  }

  async function removeAddress(id) {
    await api.delete(`/users/me/addresses/${id}`)
    setAddresses((a) => a.filter((x) => x.id !== id))
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="page-header">
          <h1>Profile</h1>
        </div>

        {stats && (
          <div className="card mb-1" style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <b>{stats.totalOrders}</b>
              <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--text-muted)' }}>Total orders</p>
            </div>
            <div>
              <b>{formatMoney(stats.totalSpent)}</b>
              <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--text-muted)' }}>Total spent</p>
            </div>
          </div>
        )}

        <form className="card mb-1" onSubmit={saveProfile}>
          <h3><User size={16} /> Personal details</h3>
          <div className="input-group">
            <label>Full name</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="input-group">
            <label>Email</label>
            <input className="input-field" value={user?.email || ''} disabled />
          </div>
          <div className="input-group">
            <label>Phone</label>
            <input className="input-field" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <Loader size={14} className="loading" /> : 'Save'}
          </button>
        </form>

        <div className="card mb-1">
          <h3><MapPin size={16} /> Saved addresses</h3>
          {addresses.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
              <span>
                <b>{a.label}</b> — {a.address}
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => removeAddress(a.id)}>
                Delete
              </button>
            </div>
          ))}
          <form onSubmit={addAddress} style={{ marginTop: '1rem' }}>
            <div className="input-group">
              <label>Label</label>
              <select className="input-field" value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}>
                <option value="home">Home</option>
                <option value="work">Work</option>
              </select>
            </div>
            <div className="input-group">
              <label>Address</label>
              <input className="input-field" value={addrForm.address} onChange={(e) => setAddrForm({ ...addrForm, address: e.target.value })} />
            </div>
            <div className="input-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
              <input className="input-field" placeholder="Lat" value={addrForm.lat} onChange={(e) => setAddrForm({ ...addrForm, lat: e.target.value })} />
              <input className="input-field" placeholder="Lng" value={addrForm.lng} onChange={(e) => setAddrForm({ ...addrForm, lng: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-outline btn-sm">Add address</button>
          </form>
        </div>

        <form className="card" onSubmit={changePassword}>
          <h3><Lock size={16} /> Change password</h3>
          <div className="input-group">
            <label>Current password</label>
            <input className="input-field" type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
          </div>
          <div className="input-group">
            <label>New password</label>
            <input className="input-field" type="password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Update password</button>
        </form>
      </div>
    </div>
  )
}
