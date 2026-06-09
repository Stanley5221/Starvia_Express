import { io } from 'socket.io-client';
import * as storage from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let socket = null;

export async function getSocket() {
  if (!socket) {
    const token = await storage.getItemAsync('token');
    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export async function connectSocket() {
  const s = await getSocket();
  if (!s.connected) await s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
  socket = null;
}
