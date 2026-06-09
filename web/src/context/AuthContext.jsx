import { createContext, useContext, useState, useEffect } from 'react'
import api from '../../../shared/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('fw_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  const isBusiness = user?.accountType === 'BUSINESS'
  const businessId = user?.business?.id ?? null
  const businessStatus = user?.business?.verificationStatus ?? null

  async function checkMe() {
    const token = localStorage.getItem('fw_token')
    if (!token) return null
    try {
      const { data } = await api.get('/auth/me')
      localStorage.setItem('fw_user', JSON.stringify(data))
      setUser(data)
      return data
    } catch (err) {
      if (err.response?.status === 401) {
        logout()
      }
      return null
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('fw_token')
    if (token) {
      checkMe()
    }
  }, [])

  async function login(email, password) {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('fw_token', data.token)
      const loggedUser = { ...data.user, business: data.business || null }
      localStorage.setItem('fw_user', JSON.stringify(loggedUser))
      setUser(loggedUser)
      return loggedUser
    } finally { setLoading(false) }
  }

  async function register(params) {
    setLoading(true)
    try {
      // params can be individual object { name, email, phone, password, role } 
      // or business object { accountType, businessName, businessType, ownerFullName, email, phone, businessAddress, gpsAddress, password }
      const { data } = await api.post('/auth/register', params)
      localStorage.setItem('fw_token', data.token)
      const loggedUser = { ...data.user, business: data.business || null }
      localStorage.setItem('fw_user', JSON.stringify(loggedUser))
      setUser(loggedUser)
      return loggedUser
    } finally { setLoading(false) }
  }

  function logout() {
    localStorage.removeItem('fw_token')
    localStorage.removeItem('fw_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading, isBusiness, businessId, businessStatus, checkMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

