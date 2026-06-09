import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../../../shared/api'
import { Bike, Menu, X, LogOut, User, Bell, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import './Navbar.css'

export default function Navbar() {
  const { user, logout, isBusiness, businessStatus } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user || isBusiness) return
    api.get('/notifications').then((r) => setUnread(r.data.unreadCount || 0)).catch(() => {})
  }, [user, location.pathname, isBusiness])

  function handleLogout() {
    logout()
    toast.success('Signed out')
    navigate('/login', { replace: true })
    setOpen(false)
  }

  const active = (path) => (location.pathname === path ? 'nav-link active' : 'nav-link')

  return (
    <nav className="navbar">
      <div className="nav-inner container">
        <Link to={isBusiness ? "/business/dashboard" : "/"} className="nav-logo" onClick={() => setOpen(false)}>
          <img src="/logo.png" alt="Starvia Express" className="navbar-logo" />
        </Link>

        <div className="nav-links">
          {isBusiness ? (
            <>
              <Link to="/business/dashboard" className={active('/business/dashboard')}>
                Dashboard
              </Link>
              <Link to="/business/orders" className={active('/business/orders')}>
                Orders
              </Link>
              <Link to="/business/documents" className={active('/business/documents')}>
                Documents
              </Link>
              {businessStatus === 'APPROVED' && (
                <Link to="/order/new" className="btn btn-accent btn-sm">
                  + New Delivery
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/" className={active('/')}>
                Home
              </Link>
              {user && (
                <Link to="/orders" className={active('/orders')}>
                  My Orders
                </Link>
              )}
              {user && user.role === 'CUSTOMER' && (
                <Link to="/order/new" className="btn btn-accent btn-sm">
                  + New Delivery
                </Link>
              )}
            </>
          )}
        </div>

        <div className="nav-auth">
          {user ? (
            <div className="nav-user">
              {!isBusiness && user.role === 'CUSTOMER' && (
                <Link to="/notifications" className="nav-notif-btn" title="Notifications">
                  <Bell size={18} />
                  {unread > 0 && <span className="notif-badge">{unread}</span>}
                </Link>
              )}
              <Link to={isBusiness ? "/business/profile" : "/profile"} className="nav-link" title="Profile">
                <User size={14} />
              </Link>
              <span className="user-name">{user.name.split(' ')[0]}</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>

        <button type="button" className="nav-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="nav-drawer">
          {isBusiness ? (
            <>
              <Link to="/business/dashboard" className={active('/business/dashboard')} onClick={() => setOpen(false)}>
                Dashboard
              </Link>
              <Link to="/business/orders" className={active('/business/orders')} onClick={() => setOpen(false)}>
                Orders
              </Link>
              <Link to="/business/documents" className={active('/business/documents')} onClick={() => setOpen(false)}>
                Documents
              </Link>
              <Link to="/business/profile" className={active('/business/profile')} onClick={() => setOpen(false)}>
                Profile
              </Link>
              {businessStatus === 'APPROVED' && (
                <Link to="/order/new" className="btn btn-accent btn-sm" onClick={() => setOpen(false)}>
                  + New Delivery
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/" className={active('/')} onClick={() => setOpen(false)}>
                Home
              </Link>
              {user && (
                <Link to="/orders" className={active('/orders')} onClick={() => setOpen(false)}>
                  My Orders
                </Link>
              )}
              {user && user.role === 'CUSTOMER' && (
                <>
                  <Link to="/notifications" className={active('/notifications')} onClick={() => setOpen(false)}>
                    Notifications {unread > 0 ? `(${unread})` : ''}
                  </Link>
                  <Link to="/profile" className={active('/profile')} onClick={() => setOpen(false)}>
                    Profile
                  </Link>
                  <Link to="/order/new" className="btn btn-accent btn-sm" onClick={() => setOpen(false)}>
                    + New Delivery
                  </Link>
                </>
              )}
            </>
          )}
          {user ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout} style={{ marginTop: '1rem' }}>
              <LogOut size={14} /> Logout
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
