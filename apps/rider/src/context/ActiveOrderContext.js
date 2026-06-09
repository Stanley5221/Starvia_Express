import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

const ActiveOrderContext = createContext(null);

const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'];

async function loadActiveOrderList(api) {
  const { data: orders } = await api.get('/riders/orders');
  const list = Array.isArray(orders) ? orders : [];
  return list.find((o) => ACTIVE_STATUSES.includes(o.status)) ?? null;
}

async function loadActiveOrder(api) {
  try {
    const { data } = await api.get('/riders/orders/active');
    if (data?.id) return data;
    if (data === null || data === undefined) return loadActiveOrderList(api);
  } catch (err) {
    const status = err.response?.status;
    if (status !== 404 && status !== 500) throw err;
  }
  return loadActiveOrderList(api);
}

export function ActiveOrderProvider({ children }) {
  const { rider, isApproved } = useAuth();
  const [activeOrder, setActiveOrder] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshActiveOrder = useCallback(async () => {
    if (!rider?.isApproved) return null;
    try {
      const order = await loadActiveOrder(api);
      setActiveOrder(order);
      return order;
    } catch {
      setActiveOrder(null);
      return null;
    }
  }, [rider?.isApproved]);

  useEffect(() => {
    if (isApproved) refreshActiveOrder();
  }, [isApproved, refreshActiveOrder]);

  useEffect(() => {
    if (!rider?.id) return undefined;
    let mounted = true;

    (async () => {
      const socket = await connectSocket();
      socket.emit('rider:join', { riderId: rider.id });

      socket.on('order:new', (offer) => {
        if (mounted) setIncomingOffer({ ...offer, receivedAt: Date.now() });
      });

      socket.on('order:status_changed', ({ orderId, status }) => {
        if (!mounted) return;
        setActiveOrder((prev) => (prev?.id === orderId ? { ...prev, status } : prev));
        if (status === 'DELIVERED' || status === 'CANCELLED') {
          setActiveOrder(null);
          setIncomingOffer(null);
        }
      });
    })();

    return () => {
      mounted = false;
    };
  }, [rider?.id]);

  // Send idle location every 60s when available and not on a delivery
  // so geo-dispatch always has a fresh rider position
  useEffect(() => {
    if (!rider?.isAvailable || activeOrder) return;

    async function sendLocation() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await api.post('/riders/location', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch (_) {}
    }

    sendLocation();
    const id = setInterval(sendLocation, 60_000);
    return () => clearInterval(id);
  }, [rider?.isAvailable, !!activeOrder]);

  async function acceptOrder(orderId) {
    const { data } = await api.post(`/riders/orders/${orderId}/accept`);
    setIncomingOffer(null);
    setActiveOrder(data);
    return data;
  }

  async function rejectOrder(orderId) {
    await api.post(`/riders/orders/${orderId}/reject`);
    setIncomingOffer(null);
  }

  return (
    <ActiveOrderContext.Provider
      value={{
        activeOrder,
        incomingOffer,
        setIncomingOffer,
        loading,
        setLoading,
        refreshActiveOrder,
        acceptOrder,
        rejectOrder,
        setActiveOrder,
      }}
    >
      {children}
    </ActiveOrderContext.Provider>
  );
}

export const useActiveOrder = () => useContext(ActiveOrderContext);
