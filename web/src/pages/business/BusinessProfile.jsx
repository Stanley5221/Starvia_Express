import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../../../shared/api'
import { 
  Building, User, Mail, Phone, MapPin, ArrowLeft, 
  Save, Loader, Lock, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import './Business.css'

export default function BusinessProfile() {
  const { checkMe } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState({
    phone: '',
    businessAddress: '',
    gpsAddress: ''
  })

  async function fetchProfile() {
    try {
      const res = await api.get('/business/profile')
      setProfile(res.data)
      setForm({
        phone: res.data.phone || '',
        businessAddress: res.data.businessAddress || '',
        gpsAddress: res.data.gpsAddress || ''
      })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch business profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.phone || !form.businessAddress) {
      return toast.error('Phone and Business Address are required')
    }

    setSaving(true)
    const toastId = toast.loading('Saving updates...')
    try {
      await api.patch('/business/profile', form)
      toast.success('Profile updated successfully!', { id: toastId })
      
      // Update global context state
      await checkMe()
      await fetchProfile()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="pulsing" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Profile...</div>
      </div>
    )
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
        <div className="page-header">
          <h1>Business Profile</h1>
          <p>Manage your business credentials and contact details.</p>
        </div>

        <div className="grid-2 profile-layout">
          
          {/* Read Only Details Card */}
          <div className="card profile-info-card">
            <div className="card-header-with-badge">
              <h2>Registration Details</h2>
              <span className="badge badge-delivered" style={{ textTransform: 'capitalize' }}>
                <ShieldCheck size={12} style={{ marginRight: '0.2rem' }} /> Verified Profile
              </span>
            </div>
            <p className="card-sub-hint" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Registration properties are verified on review and cannot be modified directly.
            </p>

            <div className="readonly-group">
              <span className="readonly-label">Business Name</span>
              <div className="readonly-value">
                <Building size={16} />
                <span>{profile?.businessName}</span>
              </div>
            </div>

            <div className="readonly-group">
              <span className="readonly-label">Business Sector / Type</span>
              <div className="readonly-value" style={{ textTransform: 'capitalize' }}>
                <Building size={16} />
                <span>{profile?.businessType.toLowerCase()}</span>
              </div>
            </div>

            <div className="readonly-group">
              <span className="readonly-label">Owner Full Name</span>
              <div className="readonly-value">
                <User size={16} />
                <span>{profile?.ownerFullName}</span>
              </div>
            </div>

            <div className="readonly-group">
              <span className="readonly-label">Registration Email</span>
              <div className="readonly-value">
                <Mail size={16} />
                <span>{profile?.email}</span>
              </div>
            </div>

            <div className="readonly-group">
              <span className="readonly-label">Verification Status</span>
              <div className="readonly-value" style={{ fontWeight: '700' }}>
                <ShieldCheck size={16} />
                <span>{profile?.verificationStatus}</span>
              </div>
            </div>
          </div>

          {/* Editable Form Card */}
          <div className="card profile-form-card">
            <h2>Editable Details</h2>
            <p className="card-sub-hint" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Keep these details updated so our riders can easily locate your pickup operations.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Operational Phone Number</label>
                <div className="input-icon-wrap">
                  <Phone size={16} className="input-icon" />
                  <input className="input-field padded" type="tel" placeholder="Operational phone"
                    value={form.phone} onChange={set('phone')} required />
                </div>
              </div>

              <div className="input-group">
                <label>Operational Street Address</label>
                <div className="input-icon-wrap">
                  <MapPin size={16} className="input-icon" />
                  <input className="input-field padded" type="text" placeholder="Street name, landmark"
                    value={form.businessAddress} onChange={set('businessAddress')} required />
                </div>
              </div>

              <div className="input-group">
                <label>Ghana Post GPS Address (Optional)</label>
                <div className="input-icon-wrap">
                  <MapPin size={16} className="input-icon" />
                  <input className="input-field padded" type="text" placeholder="e.g. GA-123-4567"
                    value={form.gpsAddress} onChange={set('gpsAddress')} />
                </div>
              </div>

              <button className="btn btn-primary w-full" type="submit" disabled={saving} style={{ marginTop: '2rem' }}>
                {saving ? <Loader size={16} className="loading" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  )
}
