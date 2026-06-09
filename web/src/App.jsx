import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import PlaceOrder from './pages/PlaceOrder'
import TrackOrder from './pages/TrackOrder'
import Orders from './pages/Orders'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import BusinessDashboard from './pages/business/BusinessDashboard'
import BusinessDocuments from './pages/business/BusinessDocuments'
import BusinessOrders from './pages/business/BusinessOrders'
import BusinessProfile from './pages/business/BusinessProfile'

function ProtectedRoute({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

function BusinessRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.accountType !== 'BUSINESS') return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/order/new"  element={<ProtectedRoute><PlaceOrder /></ProtectedRoute>} />
        <Route path="/order/:id"  element={<ProtectedRoute><TrackOrder /></ProtectedRoute>} />
        <Route path="/orders"     element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        
        {/* Business Partner Routes */}
        <Route path="/business/dashboard" element={<BusinessRoute><BusinessDashboard /></BusinessRoute>} />
        <Route path="/business/documents" element={<BusinessRoute><BusinessDocuments /></BusinessRoute>} />
        <Route path="/business/orders"    element={<BusinessRoute><BusinessOrders /></BusinessRoute>} />
        <Route path="/business/profile"   element={<BusinessRoute><BusinessProfile /></BusinessRoute>} />

        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
