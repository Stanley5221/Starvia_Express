import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Package, Mail, Lock, User, Phone, Bike, Loader, Building, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import './Auth.css'

export default function Register() {
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  
  const [accountType, setAccountType] = useState('INDIVIDUAL') // 'INDIVIDUAL' | 'BUSINESS'
  const [role, setRole] = useState('CUSTOMER') // 'CUSTOMER' | 'RIDER'
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    businessType: 'RESTAURANT',
    ownerFullName: '',
    businessAddress: '',
    gpsAddress: '',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    
    if (accountType === 'BUSINESS' && form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match')
    }

    try {
      let params = {}
      if (accountType === 'BUSINESS') {
        params = {
          accountType: 'BUSINESS',
          businessName: form.businessName,
          businessType: form.businessType,
          ownerFullName: form.ownerFullName,
          email: form.email,
          phone: form.phone,
          businessAddress: form.businessAddress,
          gpsAddress: form.gpsAddress || null,
          password: form.password,
        }
      } else {
        params = {
          accountType: 'INDIVIDUAL',
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: role,
        }
      }

      const user = await register(params)
      toast.success(`Account created! Welcome, ${(user.name || form.ownerFullName).split(' ')[0]}!`)
      
      if (user.accountType === 'BUSINESS') {
        navigate('/business/dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <div className="auth-card card fade-in" style={accountType === 'BUSINESS' ? { maxWidth: '520px' } : {}}>
        <div className="auth-logo">
          <img src="/logo.png" alt="Starvia Express" className="auth-logo-img" />
        </div>
        <h1>Create account</h1>
        <p className="auth-sub">
          {accountType === 'BUSINESS' 
            ? 'Partner with Starvia to power your business deliveries' 
            : 'Start delivering or receiving packages today'}
        </p>

        {/* 2-way toggle */}
        <div className="role-toggle" style={{ gap: '0.25rem', marginBottom: '1.8rem' }}>
          <button type="button" className={accountType === 'INDIVIDUAL' && role === 'CUSTOMER' ? 'active' : ''}
            onClick={() => { setAccountType('INDIVIDUAL'); setRole('CUSTOMER'); }}>
            <User size={14}/> Individual
          </button>
          <button type="button" className={accountType === 'BUSINESS' ? 'active' : ''}
            onClick={() => { setAccountType('BUSINESS'); setRole('CUSTOMER'); }}>
            <Building size={14}/> Business Partner
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {accountType === 'BUSINESS' ? (
            /* ─── Business Partner Registration Form ─── */
            <>
              <div className="input-group">
                <label>Business Name</label>
                <div className="input-icon-wrap">
                  <Building size={16} className="input-icon"/>
                  <input className="input-field padded" type="text" placeholder="e.g. Kofi's Kitchen"
                    value={form.businessName} onChange={set('businessName')} required />
                </div>
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0' }}>
                <div className="input-group">
                  <label>Business Type</label>
                  <select className="input-field" value={form.businessType} onChange={set('businessType')} required>
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="PHARMACY">Pharmacy</option>
                    <option value="SUPERMARKET">Supermarket</option>
                    <option value="ONLINE_SHOP">Online Shop</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Owner Full Name</label>
                  <div className="input-icon-wrap">
                    <User size={16} className="input-icon"/>
                    <input className="input-field padded" type="text" placeholder="Kofi Mensah"
                      value={form.ownerFullName} onChange={set('ownerFullName')} required />
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0' }}>
                <div className="input-group">
                  <label>Email Address</label>
                  <div className="input-icon-wrap">
                    <Mail size={16} className="input-icon"/>
                    <input className="input-field padded" type="email" placeholder="kofi@kitchen.com"
                      value={form.email} onChange={set('email')} required />
                  </div>
                </div>

                <div className="input-group">
                  <label>Phone Number</label>
                  <div className="input-icon-wrap">
                    <Phone size={16} className="input-icon"/>
                    <input className="input-field padded" type="tel" placeholder="0244123456"
                      value={form.phone} onChange={set('phone')} required />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Business Address</label>
                <div className="input-icon-wrap">
                  <MapPin size={16} className="input-icon"/>
                  <input className="input-field padded" type="text" placeholder="12 Ring Road Central, Accra"
                    value={form.businessAddress} onChange={set('businessAddress')} required />
                </div>
              </div>

              <div className="input-group">
                <label>Ghana Post GPS Address (Optional)</label>
                <div className="input-icon-wrap">
                  <MapPin size={16} className="input-icon"/>
                  <input className="input-field padded" type="text" placeholder="e.g. GA-123-4567"
                    value={form.gpsAddress} onChange={set('gpsAddress')} />
                </div>
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0' }}>
                <div className="input-group">
                  <label>Password</label>
                  <div className="input-icon-wrap">
                    <Lock size={16} className="input-icon"/>
                    <input className="input-field padded" type="password" placeholder="Min. 8 characters"
                      value={form.password} onChange={set('password')} required />
                  </div>
                </div>

                <div className="input-group">
                  <label>Confirm Password</label>
                  <div className="input-icon-wrap">
                    <Lock size={16} className="input-icon"/>
                    <input className="input-field padded" type="password" placeholder="Repeat password"
                      value={form.confirmPassword} onChange={set('confirmPassword')} required />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ─── Individual / Rider Registration Form ─── */
            <>
              <div className="input-group">
                <label>Full name</label>
                <div className="input-icon-wrap">
                  <User size={16} className="input-icon"/>
                  <input className="input-field padded" type="text" placeholder="John Doe"
                    value={form.name} onChange={set('name')} required />
                </div>
              </div>
              <div className="input-group">
                <label>Email address</label>
                <div className="input-icon-wrap">
                  <Mail size={16} className="input-icon"/>
                  <input className="input-field padded" type="email" placeholder="you@example.com"
                    value={form.email} onChange={set('email')} required />
                </div>
              </div>
              <div className="input-group">
                <label>Phone number</label>
                <div className="input-icon-wrap">
                  <Phone size={16} className="input-icon"/>
                  <input className="input-field padded" type="tel" placeholder="e.g. 0244123456"
                    value={form.phone} onChange={set('phone')} required />
                </div>
              </div>
              <div className="input-group">
                <label>Password</label>
                <div className="input-icon-wrap">
                  <Lock size={16} className="input-icon"/>
                  <input className="input-field padded" type="password" placeholder="Min. 8 characters"
                    value={form.password} onChange={set('password')} required />
                </div>
              </div>
            </>
          )}

          <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop: '1.2rem' }}>
            {loading ? (
              <Loader size={16} className="loading"/>
            ) : accountType === 'BUSINESS' ? (
              'Register Business'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="auth-switch" style={{ marginTop: '1.5rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
