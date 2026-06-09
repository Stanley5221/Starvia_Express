import { createContext, useContext, useState } from 'react'
import api from '../../../../shared/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fw_admin_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  async function login(email, password) {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (data.user.role !== 'ADMIN') throw new Error('Not an admin account')
      localStorage.setItem('fw_admin_token', data.token)
      localStorage.setItem('fw_admin_user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    } finally { setLoading(false) }
  }

  function logout() {
    localStorage.removeItem('fw_admin_token')
    localStorage.removeItem('fw_admin_user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
