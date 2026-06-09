import { useState, useEffect } from 'react'
import api from '../../../../shared/api'
import { ShieldCheck, UserPlus, Trash2, Loader, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Admins() {
  const { user } = useAuth()
  const [admins, setAdmins]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPw, setShowPw]       = useState(false)
  const [form, setForm]           = useState({ name: '', email: '', password: '' })

  async function fetchAdmins() {
    try {
      const { data } = await api.get('/admin/admins')
      setAdmins(data)
    } catch {
      toast.error('Failed to load admins')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAdmins() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('All fields are required')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/admin/admins', form)
      toast.success(`Admin account created for ${form.name}`)
      setForm({ name: '', email: '', password: '' })
      setShowForm(false)
      fetchAdmins()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create admin')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(admin) {
    if (!window.confirm(`Remove admin access for ${admin.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/admins/${admin.id}`)
      toast.success(`${admin.name} removed`)
      fetchAdmins()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove admin')
    }
  }

  if (loading) return <div style={{ padding: '3rem' }}>Loading admins...</div>

  return (
    <div className="fade-in" style={{ maxWidth: 800 }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Admin Accounts</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage who has access to the admin panel.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          <UserPlus size={16} />
          {showForm ? 'Cancel' : 'Add Admin'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontWeight: 700, color: 'var(--brand-accent)' }}>
            <ShieldCheck size={18} />
            New Admin Account
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13 }}>Full Name</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Jane Smith"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13 }}>Email Address</label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="admin@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Choose a strong password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ justifyContent: 'center' }}>
              {submitting ? <Loader size={15} className="loading" /> : <><ShieldCheck size={15} /> Create Admin</>}
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Added</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin, i) => {
              const isSelf = admin.id === user?.id
              return (
                <tr key={admin.id} style={{ borderBottom: i < admins.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'var(--brand-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0,
                      }}>
                        {admin.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{admin.name}</div>
                        {isSelf && <div style={{ fontSize: 11, color: 'var(--brand-accent)', fontWeight: 600 }}>You</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 14 }}>{admin.email}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(admin.createdAt)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {isSelf ? (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    ) : (
                      <button
                        className="btn"
                        onClick={() => handleDelete(admin)}
                        style={{ background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #dc2626)', border: '1px solid var(--danger-border, #fecaca)', padding: '6px 12px', gap: 6, fontSize: 13 }}
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {admins.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No admins found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
