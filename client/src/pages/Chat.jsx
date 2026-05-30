import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Send, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { connectSocket, disconnectSocket } from "../services/socket";
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from "../services/crypto";

const TTL_MS = 5 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const [status, setStatus] = useState("connecting");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [partner, setPartner] = useState(null);
  const [now, setNow] = useState(Date.now());

  // E2E encryption state
  const [encrypted, setEncrypted] = useState(false);
  const [keyExchanging, setKeyExchanging] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Crypto refs (ephemeral — never persisted)
  const keyPairRef = useRef(null);
  const sharedKeyRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Socket connection & event handlers ─────────────────────────
  useEffect(() => {
    if (!user || !roomId) return;
    let mounted = true;

    async function initSocket() {
      try {
        const token = await user.getIdToken();
        const socket = connectSocket(token);
        socketRef.current = socket;

        socket.on("connect", () => {
          if (!mounted) return;
          setStatus("connecting");
          socket.emit("join_room", { roomId });
        });

        socket.on("disconnect", (reason) => {
          if (!mounted) return;
          setStatus("connecting");
          // Reset encryption on disconnect
          setEncrypted(false);
          setKeyExchanging(false);
          sharedKeyRef.current = null;
          keyPairRef.current = null;
        });

        socket.on("connect_error", (err) => {
          if (!mounted) return;
          console.error("[socket] connect_error:", err.message);
          setStatus("error");
        });

        socket.on("room_joined", async ({ participants }) => {
          if (!mounted) return;

          // Generate fresh key pair for this room session
          const kp = await generateKeyPair();
          keyPairRef.current = kp;

          if (participants.length >= 2) {
            const other = participants.find((p) => p.userId !== user.uid);
            setPartner(other || null);
            setStatus("active");
            setKeyExchanging(true);

            // Send our public key for exchange
            const pubKeyBase64 = await exportPublicKey(kp.publicKey);
            socket.emit("exchange_key", { roomId, publicKey: pubKeyBase64 });
          } else {
            setPartner(null);
            setStatus("waiting");
          }
        });

        socket.on("partner_joined", async ({ userId, username }) => {
          if (!mounted) return;
          setPartner({ userId, username });
          setStatus("active");
          setKeyExchanging(true);
          setMessages((prev) => [
            ...prev,
            { id: `sys-join-${Date.now()}`, type: "system", message: `${username} joined the room`, createdAt: Date.now() },
          ]);

          // Generate new keys and send public key
          const kp = await generateKeyPair();
          keyPairRef.current = kp;
          const pubKeyBase64 = await exportPublicKey(kp.publicKey);
          socket.emit("exchange_key", { roomId, publicKey: pubKeyBase64 });
        });

        socket.on("partner_left", ({ userId, username }) => {
          if (!mounted) return;
          setPartner(null);
          setStatus("waiting");
          // Reset encryption — partner left
          setEncrypted(false);
          setKeyExchanging(false);
          sharedKeyRef.current = null;
          keyPairRef.current = null;
          setMessages((prev) => [
            ...prev,
            { id: `sys-leave-${Date.now()}`, type: "system", message: `${username} left the room`, createdAt: Date.now() },
          ]);
        });

        socket.on("room_full", () => {
          if (!mounted) return;
          setStatus("full");
        });

        socket.on("room_not_found", () => {
          if (!mounted) return;
          setStatus("not_found");
        });

        // ── Key exchange ──────────────────────────────────────────
        socket.on("receive_key", async ({ publicKey }) => {
          if (!mounted || !keyPairRef.current) return;
          try {
            const partnerPubKey = await importPublicKey(publicKey);
            const shared = await deriveSharedKey(keyPairRef.current.privateKey, partnerPubKey);
            sharedKeyRef.current = shared;
            setEncrypted(true);
            setKeyExchanging(false);
            setMessages((prev) => [
              ...prev,
              { id: `sys-enc-${Date.now()}`, type: "system", message: "🔐 Secure channel established", createdAt: Date.now() },
            ]);
          } catch (err) {
            console.error("Key exchange failed:", err);
            setKeyExchanging(false);
          }
        });

        // ── Message events ───────────────────────────────────────
        socket.on("new_message", async (msg) => {
          if (!mounted) return;
          // Decrypt the message
          let plaintext = "[encrypted message]";
          if (sharedKeyRef.current && msg.encryptedMessage && msg.iv) {
            plaintext = await decryptMessage(sharedKeyRef.current, msg.encryptedMessage, msg.iv);
          }
          setMessages((prev) => [...prev, { ...msg, type: "chat", message: plaintext }]);
        });

        socket.on("delete_message", ({ messageId }) => {
          if (!mounted) return;
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        });

        socket.on("error_event", ({ message }) => {
          if (!mounted) return;
          console.error("[socket] error_event:", message);
        });

        if (socket.connected) {
          setStatus("connecting");
          socket.emit("join_room", { roomId });
        }
      } catch (err) {
        console.error("Failed to init socket:", err);
        if (mounted) setStatus("error");
      }
    }

    initSocket();

    return () => {
      mounted = false;
      const socket = socketRef.current;
      if (socket) {
        socket.emit("leave_room", { roomId });
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.off("room_joined");
        socket.off("partner_joined");
        socket.off("partner_left");
        socket.off("room_full");
        socket.off("room_not_found");
        socket.off("receive_key");
        socket.off("new_message");
        socket.off("delete_message");
        socket.off("error_event");
      }
      disconnectSocket();
      // Discard keys
      keyPairRef.current = null;
      sharedKeyRef.current = null;
      setEncrypted(false);
    };
  }, [user, roomId]);

  // ─── Send message (encrypt before sending) ─────────────────────
  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || status !== "active" || !socketRef.current || !encrypted || !sharedKeyRef.current) return;

    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    try {
      const { encryptedMessage, iv } = await encryptMessage(sharedKeyRef.current, text);
      socketRef.current.emit("send_message", { id, roomId, encryptedMessage, iv });
      setInputValue("");
      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to encrypt message:", err);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleSignOut() {
    disconnectSocket();
    await logout();
    navigate("/login");
  }

  function handleBackToLobby() {
    navigate("/lobby");
  }

  function getStatusDotClass() {
    if (status === "active") return "bg-emerald-400";
    if (status === "waiting" || status === "connecting") return "bg-amber-400 animate-pulse";
    return "bg-red-400";
  }

  const canSend = status === "active" && encrypted && inputValue.trim().length > 0 && inputValue.trim().length <= MAX_MESSAGE_LENGTH;

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3.5 bg-[#111111] border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={handleBackToLobby} title="Back to lobby" className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all">
            <ArrowLeft size={18} />
          </button>
          <Link to="/" className="flex items-center gap-2 no-underline">
            <img src="/Nexis_logo.jpg" alt="Nexis" className="w-6 h-6 rounded-full object-cover" />
            <h1 className="text-white text-base font-['Instrument_Serif']">Nexis</h1>
          </Link>
          <span className="liquid-glass rounded-full px-3 py-1 text-white/50 text-xs tracking-widest">{roomId}</span>
          <div className={`w-2 h-2 rounded-full ${getStatusDotClass()}`} />
          {encrypted && (
            <div className="flex items-center gap-1 text-emerald-400" title="End-to-end encrypted">
              <Lock size={12} />
              <span className="text-[10px] hidden sm:inline">Encrypted</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {status === "active" && partner && (
            <span className="text-white/30 text-xs hidden sm:block">@{partner.username}</span>
          )}
          <button onClick={handleSignOut} className="text-white/30 text-xs hover:text-white/60 transition-colors">Sign Out</button>
        </div>
      </header>

      {/* ── Status Screens ────────────────────────────────────────── */}
      {status === "connecting" && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-8 h-8 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Establishing connection…</p>
        </div>
      )}

      {status === "waiting" && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <div key={i} className="absolute border border-white/10 rounded-full animate-ping" style={{ width: 40 + i * 24, height: 40 + i * 24, animationDelay: `${i * 0.4}s`, animationDuration: "2.5s" }} />
            ))}
            <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
          </div>
          <p className="text-white/30 text-sm">Waiting for another person…</p>
          <p className="text-white/20 text-xs">Share code <strong className="text-white/40">{roomId}</strong></p>
        </div>
      )}

      {status === "full" && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <p className="text-white/30 text-4xl font-['Instrument_Serif']">Room Full</p>
          <p className="text-white/20 text-sm">Two people are already connected.</p>
          <button onClick={handleBackToLobby} className="bg-white text-black font-semibold rounded-xl px-6 py-3 text-sm mt-2 hover:bg-white/90 active:scale-[0.98] transition-all">← Back to Lobby</button>
        </div>
      )}

      {status === "not_found" && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <p className="text-white/30 text-4xl font-['Instrument_Serif']">Room Not Found</p>
          <p className="text-white/20 text-sm">No room exists with code <strong className="text-white/40">{roomId}</strong>.</p>
          <button onClick={handleBackToLobby} className="bg-white text-black font-semibold rounded-xl px-6 py-3 text-sm mt-2 hover:bg-white/90 active:scale-[0.98] transition-all">← Back to Lobby</button>
        </div>
      )}

      {status === "error" && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <p className="text-white/30 text-4xl font-['Instrument_Serif']">Connection Error</p>
          <p className="text-white/20 text-sm">Failed to establish a connection.</p>
          <button onClick={handleBackToLobby} className="bg-white text-black font-semibold rounded-xl px-6 py-3 text-sm mt-2 hover:bg-white/90 active:scale-[0.98] transition-all">← Back to Lobby</button>
        </div>
      )}

      {/* ── Key Exchange Status ──────────────────────────────────── */}
      {status === "active" && keyExchanging && !encrypted && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <Lock size={32} className="text-white/20" />
          <p className="text-white/30 text-sm">Establishing secure channel…</p>
          <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      )}

      {/* ── Messages Area ─────────────────────────────────────────── */}
      {(encrypted || messages.length > 0) && (status === "active" || messages.length > 0) && (
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          <AnimatePresence>
            {messages.map((msg) => {
              if (msg.type === "system") {
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className="flex justify-center">
                      <span className="bg-white/5 text-white/30 text-xs px-4 py-1.5 rounded-full">{msg.message}</span>
                    </div>
                  </motion.div>
                );
              }

              const isOwn = msg.userId === user?.uid;
              const remaining = msg.expiresAt - now;
              const progress = Math.max(0, Math.min(1, remaining / TTL_MS));

              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {isOwn ? (
                    <div className="flex justify-end">
                      <div className="bg-white text-black rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[75%] relative">
                        <p className="text-sm leading-relaxed">{msg.message}</p>
                        <div className="flex items-center justify-end gap-2 mt-1.5">
                          <span className="text-black/30 text-[10px]">{formatTime(msg.createdAt)}</span>
                          <span className="text-black/20 text-[10px] tabular-nums">{remaining > 0 ? formatCountdown(remaining) : "Expiring…"}</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/5">
                          <div style={{ width: `${progress * 100}%` }} className="h-full bg-black/10 transition-all duration-1000" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="bg-[#1A1A1A] text-white rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[75%] relative">
                        <p className="text-white/30 text-[10px] mb-1">@{msg.username}</p>
                        <p className="text-sm leading-relaxed">{msg.message}</p>
                        <div className="flex items-center justify-end gap-2 mt-1.5">
                          <span className="text-white/20 text-[10px]">{formatTime(msg.createdAt)}</span>
                          <span className="text-white/15 text-[10px] tabular-nums">{remaining > 0 ? formatCountdown(remaining) : "Expiring…"}</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
                          <div style={{ width: `${progress * 100}%` }} className="h-full bg-white/10 transition-all duration-1000" />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Input Area ────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-[#111111] border-t border-white/5">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-[#1A1A1A] border-none rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-shadow resize-none min-h-[44px] max-h-32 disabled:opacity-40"
            placeholder={encrypted ? "Type a message…" : "Waiting for encryption…"}
            value={inputValue}
            onChange={(e) => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                setInputValue(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={!encrypted || status !== "active"}
            rows={1}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-[0.95] transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
        {/* Character counter */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-1.5">
            {encrypted && (
              <div className="flex items-center gap-1 text-emerald-400/50">
                <Lock size={10} />
                <span className="text-[10px]">End-to-end encrypted</span>
              </div>
            )}
          </div>
          {inputValue.length > 0 && (
            <span className={`text-[10px] tabular-nums ${inputValue.length > MAX_MESSAGE_LENGTH * 0.9 ? (inputValue.length >= MAX_MESSAGE_LENGTH ? "text-red-400" : "text-amber-400") : "text-white/20"}`}>
              {inputValue.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
