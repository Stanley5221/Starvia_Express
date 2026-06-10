import { io } from 'socket.io-client';
import * as storage from './storage';

const BASE = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000')
  : 'https://starvia-express.onrender.com';
const SOCKET_URL = BASE.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');

let socket = null;

export async function connectSocket() {
  // Return existing socket (even if reconnecting) to avoid duplicate instances
  if (socket) return socket;
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
