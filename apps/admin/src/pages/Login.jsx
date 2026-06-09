import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await login(form.email, form.password)
      toast.success('Admin authenticated')
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-header">
          <div className="logo-icon">
            <img src="/favicon-32x32.png" alt="Starvia Express" style={{ width: '32px', height: '32px' }} />
          </div>
          <h2>Starvia Express Admin</h2>
          <p>Access control panel</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Admin Email</label>
            <input
              type="email"
              placeholder="admin@starviadelivery.com"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              required
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              required
            />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? <Loader size={16} className="loading"/> : 'Sign In to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
