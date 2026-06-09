import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Riders from './pages/Riders'
import Customers from './pages/Customers'
import Pricing from './pages/Pricing'
import LiveMap from './pages/LiveMap'
import Analytics from './pages/Analytics'
import Businesses from './pages/Businesses'
import BusinessDetail from './pages/BusinessDetail'
import DispatchSettings from './pages/DispatchSettings'
import Admins from './pages/Admins'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main">
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/map"       element={<LiveMap />} />
          <Route path="/orders"     element={<Orders />} />
          <Route path="/riders"     element={<Riders />} />
          <Route path="/customers"  element={<Customers />} />
          <Route path="/businesses" element={<Businesses />} />
          <Route path="/businesses/:id" element={<BusinessDetail />} />
          <Route path="/analytics"  element={<Analytics />} />
          <Route path="/pricing"    element={<Pricing />} />
          <Route path="/dispatch"   element={<DispatchSettings />} />
          <Route path="/admins"     element={<Admins />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*"     element={<ProtectedRoute><AdminLayout /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}
