import React, { useState, useEffect } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, RefreshCw, CheckCircle, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { checkEmailVerified } from "../services/api";

export default function VerifyEmail() {
  const { user, emailVerified, logout, loading, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSuccessDelay, setIsSuccessDelay] = useState(false);

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      setMessage("Email verified successfully!");
      setIsSuccessDelay(true);
    } else if (searchParams.get("error") === "invalid") {
      setError("Link expired or invalid. Please request a new one.");
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setResendDisabled(false);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (loading) {
    return <div className="min-h-screen bg-black" />;
  }

  // Semi-protection: Must be logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If already verified and not currently delaying success redirect, go to lobby
  if (emailVerified && !isSuccessDelay) {
    return <Navigate to="/lobby" replace />;
  }

  const handleResend = async () => {
    try {
      setResendDisabled(true);
      setCountdown(60);
      setMessage("");
      setError("");
      await resendVerificationEmail();
      setMessage("Verification email sent!");
    } catch (err) {
      console.error(err);
      setError("Failed to resend email. Please try again later.");
      setResendDisabled(false);
      setCountdown(0);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setChecking(true);
      setMessage("");
      setError("");
      const isVerified = await checkEmailVerified(user.uid);
      if (isVerified) {
        navigate("/lobby");
      } else {
        setError("Email is not verified yet. Please check your inbox.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to check status.");
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="liquid-glass w-full max-w-md p-10 rounded-3xl flex flex-col items-center text-center z-10"
      >
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <Mail className="text-white/80" size={28} />
        </div>

        <h1 className="text-3xl text-white font-['Instrument_Serif'] mb-4">
          Verify your email
        </h1>

        <p className="text-white/60 text-sm mb-8 leading-relaxed">
          We sent a verification link to <span className="text-white font-medium">{user.email}</span>. 
          Please check your inbox and click the link to continue.
        </p>

        {message && (
          <div className="w-full p-3 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            {message}
          </div>
        )}

        {isSuccessDelay && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => navigate("/lobby", { replace: true })}
            className="w-full h-12 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} />
            Enter Nexis
          </motion.button>
        )}

        {error && (
          <div className="w-full p-3 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full h-12 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {checking ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <CheckCircle size={16} />
            )}
            {checking ? "Checking..." : "Check Verification Status"}
          </button>

          <button
            onClick={handleResend}
            disabled={resendDisabled}
            className="w-full h-12 bg-white/5 text-white text-sm font-medium rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendDisabled ? `Resend Email (${countdown}s)` : "Resend Email"}
          </button>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-8 flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </motion.div>
    </div>
  );
}
