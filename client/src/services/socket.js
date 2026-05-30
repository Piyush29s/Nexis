import { io } from "socket.io-client";
import { auth } from "./firebase";

let socket = null;

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

/**
 * Connect to the Socket.IO server with a Firebase ID token.
 * Uses WebSocket transport only — no polling fallback.
 */
export function connectSocket(token) {
  if (socket && socket.connected) {
    return socket;
  }

  // Disconnect any stale socket before creating a new one
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // On reconnect attempt, refresh the Firebase ID token so the
  // server auth middleware gets a valid, non-expired token.
  socket.io.on("reconnect_attempt", async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const freshToken = await user.getIdToken(true);
        socket.auth.token = freshToken;
      }
    } catch (err) {
      console.error("Failed to refresh token on reconnect:", err);
    }
  });

  return socket;
}

/**
 * Return the current socket instance (may be null).
 */
export function getSocket() {
  return socket;
}

/**
 * Disconnect the socket and clear the reference.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
