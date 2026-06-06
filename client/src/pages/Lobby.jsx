import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Plus, LogIn, Copy, Check, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { connectSocket, disconnectSocket } from "../services/socket";

/* ── Animation variants ────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function Lobby() {
  const { user, username, logout } = useAuth();
  const navigate = useNavigate();

  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  const socketRef = useRef(null);

  /* ── Connect socket on mount ─────────────────────────────────── */
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function init() {
      try {
        const token = await user.getIdToken();
        const socket = connectSocket(token);
        socketRef.current = socket;

        socket.on("connect", () => {
          if (mounted) setSocketReady(true);
        });

        socket.on("room_created", ({ roomId }) => {
          if (!mounted) return;
          setCreatedRoomId(roomId);
          setCreating(false);
        });

        socket.on("error_event", ({ message }) => {
          if (!mounted) return;
          setError(message);
          setCreating(false);
        });

        if (socket.connected) setSocketReady(true);
      } catch (err) {
        console.error("Lobby socket init failed:", err);
        if (mounted) setError("Failed to connect to server.");
      }
    }

    init();

    return () => {
      mounted = false;
      const socket = socketRef.current;
      if (socket) {
        socket.off("connect");
        socket.off("room_created");
        socket.off("error_event");
      }
    };
  }, [user]);

  /* ── Create a new room ───────────────────────────────────────── */
  function handleCreateRoom() {
    if (!socketRef.current || !socketRef.current.connected) {
      setError("Not connected to server. Please wait…");
      return;
    }
    setError("");
    setCreating(true);
    setCreatedRoomId(null);
    setCopied(false);
    socketRef.current.emit("create_room");
  }

  /* ── Join an existing room ───────────────────────────────────── */
  function handleJoinRoom(e) {
    e.preventDefault();
    const code = joinRoomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) {
      setError("Please enter a room code.");
      return;
    }
    if (code.length !== 6) {
      setError("Room codes are exactly 6 characters.");
      return;
    }
    setError("");
    navigate(`/chat/${code}`);
  }

  /* ── Enter created room ──────────────────────────────────────── */
  function handleEnterCreatedRoom() {
    if (createdRoomId) navigate(`/chat/${createdRoomId}`);
  }

  /* ── Copy room code ──────────────────────────────────────────── */
  async function handleCopyCode() {
    if (!createdRoomId) return;
    try {
      await navigator.clipboard.writeText(createdRoomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copy failed — select the code manually.");
    }
  }

  /* ── Sign out ────────────────────────────────────────────────── */
  async function handleSignOut() {
    disconnectSocket();
    await logout();
    navigate("/login");
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="min-h-dvh bg-black bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.03)_0%,_transparent_70%)] flex flex-col overflow-x-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 relative z-10">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <img src="/Nexis_logo.jpg" alt="Nexis" className="w-7 h-7 rounded-full object-cover" />
          <span className="text-white text-sm font-medium tracking-wide">Nexis</span>
          <div className={`w-2 h-2 rounded-full ${socketReady ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
        </Link>
        <div className="flex items-center gap-4">
          {username && <span className="text-white/40 text-xs hidden sm:block">@{username}</span>}
          <button id="lobby-sign-out" onClick={handleSignOut} className="flex items-center gap-2 text-white/30 text-xs hover:text-white/60 transition-colors min-h-[44px] px-2">
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-8 sm:pb-16">
        <motion.div
          className="w-full max-w-2xl"
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
        >
          <motion.div variants={fadeUp} className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl md:text-5xl text-white font-['Instrument_Serif'] tracking-tight mb-3">
              Secure <em className="italic">Rooms</em>
            </h1>
            <p className="text-white/30 text-sm max-w-md mx-auto">
              Create a private room or join one with a code.<br />All messages are end-to-end encrypted and self-destruct after 5 minutes.
            </p>
          </motion.div>

          {error && (
            <motion.div variants={fadeUp} className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-6 text-center max-w-md mx-auto">{error}</motion.div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            {/* ── Create Room Card ────────────────────────────────── */}
            <motion.div variants={fadeUp} className="liquid-glass rounded-3xl p-5 sm:p-7"
>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40"><Plus size={18} /></div>
                <h2 className="text-white text-lg font-['Instrument_Serif']">Create New Room</h2>
              </div>
              <p className="text-white/30 text-sm mb-6 leading-relaxed">Generate a secure room for two people. Share the code with your contact.</p>

              {!createdRoomId ? (
                <button id="create-room-button" onClick={handleCreateRoom} disabled={creating || !socketReady} className="w-full min-h-[44px] bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center">
                  {creating ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : "Create Room"}
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="text-center">
                  <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Your Room Code</p>
                  <div className="flex justify-center gap-2 mb-4">
                    {createdRoomId.split("").map((char, i) => (
                      <motion.span key={i} initial={{ opacity: 0, y: 12, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 20 }} >{char}</motion.span>
                    ))}
                  </div>className="w-9 h-12 sm:w-11 sm:h-14 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-white text-lg sm:text-xl font-mono font-bold"
                  <p className="text-white/20 text-xs mb-5">Share this code with one other person</p>
                  <div className="flex gap-3">
                    <button id="copy-code-button" onClick={handleCopyCode} className="flex-1 min-h-[44px] rounded-xl flex items-center justify-center gap-2 text-white/50 text-sm hover:bg-white/5 transition-colors liquid-glass">
                      {copied ? <><Check size={15} />Copied</> : <><Copy size={15} />Copy Code</>}
                    </button>
                    <button id="enter-room-button" onClick={handleEnterCreatedRoom} className="flex-1 min-h-[44px] bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all text-sm">Enter Room →</button>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* ── Join Room Card ──────────────────────────────────── */}
            <motion.div variants={fadeUp} className="liquid-glass rounded-3xl p-5 sm:p-7"
>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40"><LogIn size={18} /></div>
                <h2 className="text-white text-lg font-['Instrument_Serif']">Join Existing Room</h2>
              </div>
              <p className="text-white/30 text-sm mb-6 leading-relaxed">Enter a room code shared by another person to join their secure channel.</p>

              <form onSubmit={handleJoinRoom} className="space-y-3">
                <input id="join-room-input" type="text" placeholder="ROOM CODE" value={joinRoomCode} onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={6} autoComplete="off" spellCheck={false} className="w-full bg-[#1A1A1A] border-none rounded-xl min-h-[44px] px-4 text-white text-center text-lg font-mono font-bold tracking-[0.25em] placeholder:text-white/15 placeholder:text-sm placeholder:font-normal placeholder:tracking-widest focus:ring-2 focus:ring-white/20 focus:outline-none transition-shadow uppercase" />
                <button id="join-room-button" type="submit" disabled={joinRoomCode.trim().length !== 6} className="w-full min-h-[44px] bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed">Join Room</button>
              </form>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
