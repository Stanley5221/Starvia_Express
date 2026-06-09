import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../shared/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Bike, Hash, Palette, Camera, Loader, User, Phone, CreditCard, Calendar } from 'lucide-react'
import './Auth.css'

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function RiderRegister() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [profilePreview, setProfilePreview] = useState(null)
  const [form, setForm] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    motorMake: '',
    motorModel: '',
    motorColor: '',
    motorPlate: '',
    licenceNumber: '',
    licenceExpiry: '',
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onProfilePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file')
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2MB')
    const dataUrl = await readImageAsDataUrl(file)
    setProfilePreview(dataUrl)
    setForm((f) => ({ ...f, profilePhoto: dataUrl }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/riders/register', {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        profilePhoto: form.profilePhoto || null,
        motorPlate: form.motorPlate.trim(),
        motorMake: form.motorMake.trim(),
        motorModel: form.motorModel.trim(),
        motorColor: form.motorColor.trim(),
        licenceNumber: form.licenceNumber.trim(),
        licenceExpiry: form.licenceExpiry,
      })
      toast.success('Rider profile submitted! Awaiting admin approval.')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit rider profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <div className="auth-card card fade-in" style={{ maxWidth: 520 }}>
        <div className="auth-logo">
          <img src="/logo.png" alt="Starvia Express" className="auth-logo-img" />

        </div>
        <h1>Complete rider registration</h1>
        <p className="auth-sub">
          Add your photo and bike details. Your photo appears on the customer tracking screen.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Profile photo</label>
            <div className="rider-photo-upload">
              <div className="rider-photo-preview">
                {profilePreview ? (
                  <img src={profilePreview} alt="Profile preview" />
                ) : (
                  <User size={32} />
                )}
              </div>
              <label className="btn btn-outline btn-sm">
                <Camera size={14} /> Upload photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={onProfilePhoto}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          <div className="input-group">
            <label>Full name</label>
            <div className="input-icon-wrap">
              <User size={16} className="input-icon" />
              <input
                className="input-field padded"
                value={form.fullName}
                onChange={set('fullName')}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Phone</label>
            <div className="input-icon-wrap">
              <Phone size={16} className="input-icon" />
              <input
                className="input-field padded"
                type="tel"
                placeholder="+233 24 000 0000"
                value={form.phone}
                onChange={set('phone')}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Bike make</label>
            <div className="input-icon-wrap">
              <Bike size={16} className="input-icon" />
              <input
                className="input-field padded"
                placeholder="e.g. Honda"
                value={form.motorMake}
                onChange={set('motorMake')}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Bike model</label>
            <input
              className="input-field"
              placeholder="e.g. CB125"
              value={form.motorModel}
              onChange={set('motorModel')}
              required
            />
          </div>

          <div className="input-group">
            <label>Bike color</label>
            <div className="input-icon-wrap">
              <Palette size={16} className="input-icon" />
              <input
                className="input-field padded"
                placeholder="e.g. Black"
                value={form.motorColor}
                onChange={set('motorColor')}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Plate number</label>
            <div className="input-icon-wrap">
              <Hash size={16} className="input-icon" />
              <input
                className="input-field padded"
                placeholder="e.g. GR-1234-20"
                value={form.motorPlate}
                onChange={set('motorPlate')}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Licence number</label>
            <div className="input-icon-wrap">
              <CreditCard size={16} className="input-icon" />
              <input
                className="input-field padded"
                placeholder="e.g. DL-12345"
                value={form.licenceNumber}
                onChange={set('licenceNumber')}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Licence expiry</label>
            <div className="input-icon-wrap">
              <Calendar size={16} className="input-icon" />
              <input
                className="input-field padded"
                type="date"
                value={form.licenceExpiry}
                onChange={set('licenceExpiry')}
                required
              />
            </div>
          </div>

          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <Loader size={16} className="loading" /> : 'Submit for approval'}
          </button>
        </form>
      </div>
    </div>
  )
}
