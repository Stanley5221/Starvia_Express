import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as storage from '../lib/storage';
import api from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerPushToken() {
  if (Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('order-updates', {
        name: 'Order Updates',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await api.post('/users/me/push-token', { pushToken: tokenData.data });
  } catch (err) {
    console.warn('[Push] customer token registration failed:', err.message);
  }
}

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
        registerPushToken();
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
    registerPushToken();
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
    try { await api.post('/users/me/push-token', { pushToken: null }); } catch (_) {}
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
