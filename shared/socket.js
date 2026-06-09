import { io } from 'socket.io-client';

function env(key) {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return undefined;
}

const SOCKET_URL =
  env('EXPO_PUBLIC_API_URL') || env('VITE_SOCKET_URL') || 'http://localhost:4000';

let socket = null;

function getAuthToken() {
  // Web customer app stores token under 'fw_token', admin under 'fw_admin_token'
  if (typeof localStorage === 'undefined') return null;
  return (
    localStorage.getItem('fw_admin_token') ||
    localStorage.getItem('fw_token') ||
    null
  );
}

export function getSocket() {
  const token = getAuthToken();
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      transports: ['websocket'],
    });
  } else if (token && socket.auth?.token !== token) {
    // Token changed (e.g. re-login) — update auth before reconnecting
    socket.auth = { token };
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}
