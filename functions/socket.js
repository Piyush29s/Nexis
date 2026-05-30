const { Server } = require("socket.io");
const crypto = require("crypto");
const { socketAuthMiddleware } = require("./authMiddleware");
const {
  saveMessage,
  deleteMessage,
  upsertRoom,
  deleteRoom,
} = require("./firestore");

/**
 * In-memory room state.
 * Map<roomId, Array<{ socketId, userId, username }>>
 */
const rooms = new Map();

/**
 * Cleanup timers for empty rooms (10-minute auto-delete).
 * Map<roomId, timeoutId>
 */
const roomCleanupTimers = new Map();

/**
 * Rate limiting: track message timestamps per user.
 * Map<uid, number[]> — array of timestamps
 */
const rateLimitMap = new Map();

const ROOM_CLEANUP_DELAY = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW = 10 * 1000; // 10 seconds
const RATE_LIMIT_MAX = 10; // max messages per window
const MAX_PAYLOAD_SIZE = 4096; // 4KB

/**
 * Generate a short, human-friendly room code.
 * 6 uppercase alphanumeric characters from an unambiguous alphabet.
 */
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

/**
 * Validate a room ID: 4–10 uppercase alphanumeric characters.
 */
function isValidRoomId(rid) {
  return typeof rid === "string" && /^[A-Z0-9]{4,10}$/.test(rid);
}

/**
 * Check if a Base64 string is valid and under maxLen.
 */
function isValidBase64(str, maxLen = 500) {
  if (typeof str !== "string" || str.length === 0 || str.length > maxLen) return false;
  return /^[A-Za-z0-9+/=]+$/.test(str);
}

/**
 * Check rate limit for a user. Returns true if allowed, false if exceeded.
 */
function checkRateLimit(uid) {
  const now = Date.now();
  let timestamps = rateLimitMap.get(uid);
  if (!timestamps) {
    timestamps = [];
    rateLimitMap.set(uid, timestamps);
  }
  // Remove timestamps outside the window
  while (timestamps.length > 0 && timestamps[0] <= now - RATE_LIMIT_WINDOW) {
    timestamps.shift();
  }
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }
  timestamps.push(now);
  return true;
}

/**
 * Schedule deletion of an empty room after ROOM_CLEANUP_DELAY.
 */
function scheduleRoomCleanup(roomId) {
  cancelRoomCleanup(roomId);
  const timerId = setTimeout(async () => {
    roomCleanupTimers.delete(roomId);
    const room = rooms.get(roomId);
    if (!room || room.length === 0) {
      rooms.delete(roomId);
      try {
        await deleteRoom(roomId);
        console.log(`[CLEANUP] Room ${roomId} auto-deleted (empty for 10 min)`);
      } catch (err) {
        console.error(`Failed to cleanup room ${roomId}:`, err.message);
      }
    }
  }, ROOM_CLEANUP_DELAY);
  roomCleanupTimers.set(roomId, timerId);
}

/**
 * Cancel a pending cleanup timer for a room.
 */
function cancelRoomCleanup(roomId) {
  const timerId = roomCleanupTimers.get(roomId);
  if (timerId) {
    clearTimeout(timerId);
    roomCleanupTimers.delete(roomId);
  }
}

/**
 * Handle a user leaving a room (explicit leave or disconnect).
 * Uses username instead of email for all notifications.
 */
async function handleLeave(socket, roomId, io) {
  const room = rooms.get(roomId);
  if (!room) return;

  const index = room.findIndex((p) => p.socketId === socket.id);
  if (index === -1) return;

  const user = room[index];
  room.splice(index, 1);
  socket.leave(roomId);

  if (room.length === 0) {
    scheduleRoomCleanup(roomId);
    try {
      await upsertRoom(roomId, []);
    } catch (err) {
      console.error("Failed to update room in Firestore:", err.message);
    }
  } else {
    io.to(roomId).emit("partner_left", {
      userId: user.userId,
      username: user.username,
    });
    const participantUids = room.map((p) => p.userId);
    try {
      await upsertRoom(roomId, participantUids);
    } catch (err) {
      console.error("Failed to update room in Firestore:", err.message);
    }
  }
}

/**
 * Attach a Socket.IO server to the given HTTP server.
 */
function attachSocketServer(server) {
  const allowedOrigins = [
    "http://localhost:3000",
    "https://nexis-ruby.vercel.app",
    `https://${process.env.GCLOUD_PROJECT || "ephemeral-chat-90969"}.web.app`,
  ];

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
    transports: ["websocket"],
    allowUpgrades: false,
    maxHttpBufferSize: MAX_PAYLOAD_SIZE,
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log(`[CONNECT] ${socket.username} (${socket.uid}) — socket ${socket.id}`);

    // ─── CREATE ROOM ──────────────────────────────────────────────
    socket.on("create_room", async () => {
      try {
        let roomId;
        let attempts = 0;
        do {
          roomId = generateRoomId();
          attempts++;
          if (attempts > 100) {
            socket.emit("error_event", { message: "Failed to generate a unique room ID" });
            return;
          }
        } while (rooms.has(roomId));

        rooms.set(roomId, []);
        await upsertRoom(roomId, []);
        scheduleRoomCleanup(roomId);

        socket.emit("room_created", { roomId });
        console.log(`[CREATE] Room ${roomId} created by ${socket.username}`);
      } catch (err) {
        console.error("create_room error:", err);
        socket.emit("error_event", { message: "Failed to create room" });
      }
    });

    // ─── JOIN ROOM ────────────────────────────────────────────────
    socket.on("join_room", async (payload) => {
      try {
        // Validate payload
        if (!payload || typeof payload !== "object") {
          socket.emit("error_event", { message: "Invalid payload" });
          return;
        }

        const rid = (payload.roomId || "").toUpperCase().trim();

        if (!isValidRoomId(rid)) {
          socket.emit("error_event", { message: "Invalid room ID format" });
          return;
        }

        if (!rooms.has(rid)) {
          socket.emit("room_not_found", { roomId: rid });
          return;
        }

        const room = rooms.get(rid);

        // Reconnect check — same userId already in room
        const existingIndex = room.findIndex((p) => p.userId === socket.uid);
        if (existingIndex !== -1) {
          const oldSocketId = room[existingIndex].socketId;
          room[existingIndex].socketId = socket.id;
          room[existingIndex].username = socket.username;
          socket.join(rid);

          const oldSocket = io.sockets.sockets.get(oldSocketId);
          if (oldSocket && oldSocket.id !== socket.id) {
            oldSocket.leave(rid);
          }

          cancelRoomCleanup(rid);

          const participants = room.map((p) => ({
            userId: p.userId,
            username: p.username,
          }));
          socket.emit("room_joined", { roomId: rid, participants });
          console.log(`[REJOIN] ${socket.username} rejoined ${rid}`);
          return;
        }

        if (room.length >= 2) {
          socket.emit("room_full");
          console.log(`[FULL] ${socket.username} rejected from ${rid}`);
          return;
        }

        cancelRoomCleanup(rid);

        room.push({
          socketId: socket.id,
          userId: socket.uid,
          username: socket.username,
        });
        socket.join(rid);

        socket.to(rid).emit("partner_joined", {
          userId: socket.uid,
          username: socket.username,
        });

        const participants = room.map((p) => ({
          userId: p.userId,
          username: p.username,
        }));
        socket.emit("room_joined", { roomId: rid, participants });

        const participantUids = room.map((p) => p.userId);
        await upsertRoom(rid, participantUids);

        console.log(`[JOIN] ${socket.username} joined ${rid} (${room.length}/2)`);
      } catch (err) {
        console.error("join_room error:", err);
        socket.emit("error_event", { message: "Failed to join room" });
      }
    });

    // ─── EXCHANGE KEY (E2E encryption) ────────────────────────────
    socket.on("exchange_key", (payload) => {
      if (!payload || typeof payload !== "object") {
        socket.emit("error_event", { message: "Invalid key exchange payload" });
        return;
      }

      const { roomId, publicKey } = payload;
      const rid = (roomId || "").toUpperCase().trim();

      if (!isValidRoomId(rid)) {
        socket.emit("error_event", { message: "Invalid room ID" });
        return;
      }

      if (!isValidBase64(publicKey, 500)) {
        socket.emit("error_event", { message: "Invalid public key" });
        return;
      }

      const room = rooms.get(rid);
      if (!room || !room.find((p) => p.userId === socket.uid)) {
        socket.emit("error_event", { message: "You are not in this room" });
        return;
      }

      // Relay the public key to the other participant
      socket.to(rid).emit("receive_key", { publicKey, userId: socket.uid });
      console.log(`[KEY] ${socket.username} exchanged key in ${rid}`);
    });

    // ─── SEND MESSAGE (encrypted) ─────────────────────────────────
    socket.on("send_message", async (payload) => {
      try {
        // Validate payload exists and is an object
        if (!payload || typeof payload !== "object") {
          socket.emit("error_event", { message: "Invalid message payload" });
          return;
        }

        const { id, roomId, encryptedMessage, iv } = payload;

        // Validate all required fields
        if (!id || typeof id !== "string") {
          socket.emit("error_event", { message: "Invalid message ID" });
          return;
        }

        const rid = (roomId || "").toUpperCase().trim();
        if (!isValidRoomId(rid)) {
          socket.emit("error_event", { message: "Invalid room ID" });
          return;
        }

        if (!encryptedMessage || typeof encryptedMessage !== "string" || encryptedMessage.length === 0) {
          socket.emit("error_event", { message: "Missing encrypted message" });
          return;
        }

        if (!iv || typeof iv !== "string" || iv.length === 0) {
          socket.emit("error_event", { message: "Missing IV" });
          return;
        }

        // Check payload size (rough estimate)
        const payloadSize = JSON.stringify(payload).length;
        if (payloadSize > MAX_PAYLOAD_SIZE) {
          socket.emit("error_event", { message: "Message too large" });
          return;
        }

        // Verify user is in the room
        const room = rooms.get(rid);
        if (!room || !room.find((p) => p.userId === socket.uid)) {
          socket.emit("error_event", { message: "You are not in this room" });
          return;
        }

        // Rate limit check
        if (!checkRateLimit(socket.uid)) {
          socket.emit("error_event", { message: "Rate limit exceeded. Slow down." });
          return;
        }

        // Server authoritative timestamps
        const now = Date.now();
        const msg = {
          id,
          roomId: rid,
          userId: socket.uid,
          username: socket.username,
          encryptedMessage,
          iv,
          createdAt: now,
          expiresAt: now + 5 * 60 * 1000,
        };

        // Persist encrypted message to Firestore
        await saveMessage(rid, msg);

        // Broadcast to everyone in the room
        io.to(rid).emit("new_message", msg);

        // Schedule auto-delete after 5 minutes
        setTimeout(async () => {
          io.to(rid).emit("delete_message", { messageId: id });
          await deleteMessage(rid, id);
          console.log(`[TTL] Message ${id} auto-deleted from ${rid}`);
        }, 5 * 60 * 1000);

        console.log(`[MSG] ${socket.username} → ${rid} (encrypted, ${encryptedMessage.length} chars)`);
      } catch (err) {
        console.error("send_message error:", err);
        socket.emit("error_event", { message: "Failed to send message" });
      }
    });

    // ─── LEAVE ROOM ───────────────────────────────────────────────
    socket.on("leave_room", async (payload) => {
      if (!payload || typeof payload !== "object") return;
      const rid = (payload.roomId || "").toUpperCase().trim();
      if (!rid) return;
      console.log(`[LEAVE] ${socket.username} leaving ${rid}`);
      await handleLeave(socket, rid, io);
    });

    // ─── DISCONNECT ───────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      console.log(`[DISCONNECT] ${socket.username} (${reason})`);
      for (const [roomId] of rooms.entries()) {
        const room = rooms.get(roomId);
        if (room && room.find((p) => p.socketId === socket.id)) {
          await handleLeave(socket, roomId, io);
          break;
        }
      }
      // Clean up rate limit data
      rateLimitMap.delete(socket.uid);
    });
  });

  return io;
}

module.exports = { attachSocketServer };
