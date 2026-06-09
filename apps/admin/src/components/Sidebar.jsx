import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Package, Bike, Users, DollarSign, LogOut, Map, BarChart3, Building, Radio, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import './Sidebar.css'

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const links = [
    { to: '/',          icon: <LayoutDashboard size={20}/>, label: 'Dashboard' },
    { to: '/map',        icon: <Map size={20}/>,             label: 'Live Map' },
    { to: '/orders',     icon: <Package size={20}/>,         label: 'Orders' },
    { to: '/riders',     icon: <Bike size={20}/>,            label: 'Riders' },
    { to: '/customers',  icon: <Users size={20}/>,           label: 'Customers' },
    { to: '/businesses', icon: <Building size={20}/>,        label: 'Businesses' },
    { to: '/analytics',  icon: <BarChart3 size={20}/>,       label: 'Analytics' },
    { to: '/pricing',    icon: <DollarSign size={20}/>,      label: 'Pricing' },
    { to: '/dispatch',   icon: <Radio size={20}/>,            label: 'Dispatch Zone' },
    { to: '/admins',     icon: <ShieldCheck size={20}/>,      label: 'Admins' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/logo.png" alt="Starvia Express" className="sidebar-logo" />
      </div>

      <nav className="sidebar-nav">
        {links.map(link => (
          <NavLink key={link.to} to={link.to} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="logout-btn" onClick={() => { logout(); toast.success('Signed out'); navigate('/login', { replace: true }) }}>
        <LogOut size={20}/>
        <span>Logout</span>
      </button>
    </aside>
  )
}
