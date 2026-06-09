import { io } from 'socket.io-client';
import * as storage from './storage';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const SOCKET_URL = BASE.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');

let socket = null;

export async function connectSocket() {
  if (socket?.connected) return socket;
  const token = await storage.getItemAsync('cust_token');
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
