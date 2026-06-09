import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as storage from '../lib/storage';
import api from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

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
      await Notifications.setNotificationChannelAsync('order-offers', {
        name:              'Order Offers',
        importance:        Notifications.AndroidImportance.MAX,
        sound:             'default',
        vibrationPattern:  [0, 250, 250, 250],
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await api.post('/riders/push-token', { pushToken: tokenData.data });
  } catch (err) {
    console.warn('[Push] token registration failed:', err.message);
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const token = await storage.getItemAsync('token');
      const storedUser = await storage.getItemAsync('user');
      if (token && storedUser) {
        setUser(JSON.parse(storedUser));
        await fetchProfile();
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfile() {
    try {
      const { data } = await api.get('/riders/me');
      setRider(data);
      // Connect socket in background — failure must not clear rider state
      connectSocket()
        .then(socket => socket.emit('rider:join', { riderId: data.id }))
        .catch(() => {});
      // Register Expo push token — non-blocking, non-fatal
      registerPushToken().catch(() => {});
      return data;
    } catch (err) {
      setRider(null);
      if (err?.response?.status === 401) {
        await storage.deleteItemAsync('token');
        await storage.deleteItemAsync('user');
        setUser(null);
      }
      return null;
    }
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.user.role !== 'RIDER') throw new Error('Only riders can log in here');
    await storage.setItemAsync('token', data.token);
    await storage.setItemAsync('user', JSON.stringify(data.user));
    setUser(data.user);
    await fetchProfile();
    await connectSocket();
    return data.user;
  }

  async function logout() {
    disconnectSocket();
    await storage.deleteItemAsync('token');
    await storage.deleteItemAsync('user');
    setUser(null);
    setRider(null);
  }

  async function markPasswordChanged() {
    const updated = { ...user, mustChangePassword: false };
    await storage.setItemAsync('user', JSON.stringify(updated));
    setUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        rider,
        loading,
        login,
        logout,
        refreshProfile: fetchProfile,
        markPasswordChanged,
        isApproved: rider?.isApproved ?? false,
        mustChangePassword: user?.mustChangePassword ?? false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
