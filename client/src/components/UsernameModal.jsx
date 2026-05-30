import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function UsernameModal({ uid, email, onComplete }) {
  const { checkUsernameAvailable, completeOAuthSignup } = useAuth();
  
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("idle"); // idle, checking, available, taken, error
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Validate formatting: 3-20 chars, alphanumeric/underscore/hyphen
  const isValidFormat = (val) => {
    return /^[a-zA-Z0-9_-]{3,20}$/.test(val);
  };

  // Debounced uniqueness check
  useEffect(() => {
    if (!username) {
      setStatus("idle");
      setErrorMsg("");
      return;
    }

    if (!isValidFormat(username)) {
      setStatus("error");
      setErrorMsg("3-20 chars. Letters, numbers, -, _ only.");
      return;
    }

    setStatus("checking");
    setErrorMsg("");

    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username);
        if (available) {
          setStatus("available");
        } else {
          setStatus("taken");
          setErrorMsg("Username is already taken");
        }
      } catch (err) {
        setStatus("error");
        setErrorMsg("Failed to check availability");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, checkUsernameAvailable]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "available" || submitting) return;

    setSubmitting(true);
    try {
      await completeOAuthSignup(uid, email, username);
      onComplete();
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg("Failed to create profile. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="liquid-glass relative w-full max-w-sm p-8 rounded-3xl z-10"
      >
        <h2 className="text-2xl text-white font-['Instrument_Serif'] mb-2">
          Choose a username
        </h2>
        <p className="text-white/50 text-sm mb-6">
          This is how others will see you in Nexis.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="Username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {status === "checking" && <Loader2 size={16} className="text-white/50 animate-spin" />}
                {status === "available" && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                {status === "taken" && <div className="w-2 h-2 rounded-full bg-red-400" />}
              </div>
            </div>
            {errorMsg && (
              <p className="text-red-400 text-xs mt-2 px-1">{errorMsg}</p>
            )}
            {status === "available" && (
              <p className="text-emerald-400 text-xs mt-2 px-1">Username is available!</p>
            )}
          </div>

          <button
            type="submit"
            disabled={status !== "available" || submitting}
            className="w-full h-12 mt-2 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Continue"}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
