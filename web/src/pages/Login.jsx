import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import './Auth.css'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      if (user.role === 'ADMIN') {
        toast('Use the admin app at http://localhost:5174', { icon: 'ℹ️' })
        window.open('http://localhost:5174', '_blank')
      }
      if (user.accountType === 'BUSINESS') {
        navigate('/business/dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <div className="auth-card card fade-in">
        <div className="auth-logo">
          <img src="/logo.png" alt="Starvia Express" className="auth-logo-img" />
        </div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email address</label>
            <div className="input-icon-wrap">
              <Mail size={16} className="input-icon"/>
              <input className="input-field padded" type="email" placeholder="you@example.com"
                value={form.email} onChange={set('email')} required />
            </div>
          </div>
          <div className="input-group">
            <label>Password</label>
            <div className="input-icon-wrap">
              <Lock size={16} className="input-icon"/>
              <input className="input-field padded" type="password" placeholder="••••••••"
                value={form.password} onChange={set('password')} required />
            </div>
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <Loader size={16} className="loading"/> : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  )
}
