import React, { createContext, useContext, useState, useEffect } from 'react';
import * as storage from '../lib/storage';
import api from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

// Persistent reconnect handler reference so it can be properly removed on logout
let _customerJoinHandler = null;

async function setupCustomerSocket() {
  try {
    const socket = await connectSocket();
    // Remove any previous handler to avoid duplicates
    if (_customerJoinHandler) socket.off('connect', _customerJoinHandler);
    _customerJoinHandler = () => socket.emit('customer:join');
    socket.on('connect', _customerJoinHandler);
    // Emit immediately if already connected, otherwise wait for connect event
    if (socket.connected) socket.emit('customer:join');
  } catch (_) {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSession(); }, []);

  async function loadSession() {
    try {
      const token = await storage.getItemAsync('cust_token');
      const raw   = await storage.getItemAsync('cust_user');
      if (token && raw) {
        const parsed = JSON.parse(raw);
        setUser(parsed);
        api.defaults.headers.Authorization = `Bearer ${token}`;
        setupCustomerSocket();
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.user.role !== 'CUSTOMER') throw new Error('This app is for customers only.');
    await storage.setItemAsync('cust_token', data.token);
    await storage.setItemAsync('cust_user', JSON.stringify(data.user));
    setUser(data.user);
    await setupCustomerSocket();
    return data.user;
  }

  async function register(fields) {
    const { data } = await api.post('/auth/register', { role: 'CUSTOMER', ...fields });
    await storage.setItemAsync('cust_token', data.token);
    await storage.setItemAsync('cust_user', JSON.stringify(data.user));
    setUser(data.user);
    await setupCustomerSocket();
    return data.user;
  }

  async function logout() {
    _customerJoinHandler = null;
    disconnectSocket();
    await storage.deleteItemAsync('cust_token');
    await storage.deleteItemAsync('cust_user');
    setUser(null);
  }

  async function updateProfile(updates) {
    const { data } = await api.patch('/users/me', updates);
    const updated = { ...user, ...data };
    await storage.setItemAsync('cust_user', JSON.stringify(updated));
    setUser(updated);
    return updated;
  }

  async function refreshUser() {
    try {
      const { data } = await api.get('/auth/me');
      const updated = { ...user, ...data };
      await storage.setItemAsync('cust_user', JSON.stringify(updated));
      setUser(updated);
      return updated;
    } catch (_) {}
  }

  const isBusiness      = user?.accountType === 'BUSINESS';
  const businessStatus  = user?.business?.verificationStatus ?? null;
  const businessId      = user?.business?.id ?? null;

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, updateProfile, refreshUser,
      isBusiness, businessStatus, businessId,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
