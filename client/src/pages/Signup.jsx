import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/* ── Error messages ────────────────────────────────────────────── */
function getSignupErrorMessage(code) {
  switch (code) {
    case "username-taken":
      return "Username already taken.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password does not meet requirements.";
    case "auth/operation-not-allowed":
      return "Email/Password signup is not enabled.";
    default:
      return "Signup failed. Please try again.";
  }
}

/* ── Username validation ───────────────────────────────────────── */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
function isValidUsername(u) {
  return USERNAME_REGEX.test(u);
}

/* ── Email validation ──────────────────────────────────────────── */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Password rules ────────────────────────────────────────────── */
const passwordRules = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p) },
];

function getPasswordStrength(password) {
  const passed = passwordRules.filter((r) => r.test(password)).length;
  if (passed <= 1) return { level: 0, label: "Weak", color: "bg-red-500" };
  if (passed <= 2) return { level: 1, label: "Fair", color: "bg-orange-500" };
  if (passed <= 3) return { level: 2, label: "Strong", color: "bg-yellow-500" };
  return { level: 3, label: "Very Strong", color: "bg-emerald-500" };
}

/* ── Animation variants ────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const steps = [
  "Create a secure room",
  "Share the code with one person",
  "Messages vanish in 5 minutes",
];

/* ── Google SVG icon ───────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ── GitHub SVG icon ───────────────────────────────────────────── */
function GitHubIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default function Signup() {
  const { signup, checkUsernameAvailable } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsernameVal] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle | checking | available | taken | invalid
  const debounceRef = useRef(null);

  // Password strength
  const strength = getPasswordStrength(password);

  // Debounced username check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username) {
      setUsernameStatus("idle");
      return;
    }

    if (!isValidUsername(username)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, checkUsernameAvailable]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!email.trim() || !username || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isValidUsername(username)) {
      setError("Username: 3–20 chars, letters/numbers/underscores/hyphens only.");
      return;
    }
    if (usernameStatus === "taken") {
      setError("Username already taken.");
      return;
    }
    // Password strength re-validation
    const allPassed = passwordRules.every((r) => r.test(password));
    if (!allPassed) {
      setError("Password does not meet all requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await signup(email.trim(), password, username);
      navigate("/lobby");
    } catch (err) {
      setError(getSignupErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-black">
      {/* ── Left Column — Video ──────────────────────────────────── */}
      <div className="hidden lg:block w-[52%] relative rounded-3xl overflow-hidden shadow-2xl m-3">
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 p-10 z-10">
          <div className="flex items-center gap-2.5 mb-6">
            <img src="/Nexis_logo.jpg" alt="Nexis" className="w-7 h-7 rounded-full object-cover" />
            <span className="text-white text-sm font-medium tracking-wide">Nexis</span>
          </div>
          <h2 className="text-3xl text-white font-['Instrument_Serif'] italic mb-8 leading-snug">
            Conversations that<br />disappear.
          </h2>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.15, duration: 0.4 }} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-medium">{i + 1}</div>
                <span className="text-white/60 text-sm">{step}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Column — Form ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-16 overflow-y-auto py-10">
        <motion.div
          className="w-full max-w-sm"
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
        >
          {/* Brand (mobile only) */}
          <motion.div variants={fadeUp} className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/Nexis_logo.jpg" alt="Nexis" className="w-7 h-7 rounded-full object-cover" />
            <span className="text-white text-sm font-medium tracking-wide">Nexis</span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-3xl text-white font-['Instrument_Serif'] mb-2">Create an account</motion.h1>
          <motion.p variants={fadeUp} className="text-white/40 text-sm mb-8">Join the disappearing conversation</motion.p>

          {error && (
            <motion.div variants={fadeUp} className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-6">{error}</motion.div>
          )}

          {/* Social buttons */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 mb-6">
            <button type="button" className="liquid-glass rounded-xl h-11 flex items-center justify-center gap-2 text-white/60 text-sm hover:bg-white/5 transition-colors"><GoogleIcon /><span>Google</span></button>
            <button type="button" className="liquid-glass rounded-xl h-11 flex items-center justify-center gap-2 text-white/60 text-sm hover:bg-white/5 transition-colors"><GitHubIcon /><span>GitHub</span></button>
          </motion.div>

          {/* Divider */}
          <motion.div variants={fadeUp} className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-xs uppercase tracking-widest">Or</span>
            <div className="flex-1 h-px bg-white/10" />
          </motion.div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <motion.div variants={fadeUp} className="mb-3">
              <input id="signup-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} autoComplete="email" className="w-full bg-[#1A1A1A] border-none rounded-xl h-11 px-4 text-white text-sm placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-shadow disabled:opacity-40" />
            </motion.div>

            {/* Username */}
            <motion.div variants={fadeUp} className="mb-3">
              <div className="relative">
                <input id="signup-username" type="text" placeholder="Username" value={username} onChange={(e) => setUsernameVal(e.target.value.replace(/\s/g, ""))} disabled={loading} autoComplete="off" spellCheck={false} maxLength={20} className="w-full bg-[#1A1A1A] border-none rounded-xl h-11 px-4 pr-10 text-white text-sm placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-shadow disabled:opacity-40" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && <Loader2 size={16} className="text-white/30 animate-spin" />}
                  {usernameStatus === "available" && <Check size={16} className="text-emerald-400" />}
                  {usernameStatus === "taken" && <X size={16} className="text-red-400" />}
                  {usernameStatus === "invalid" && username.length > 0 && <X size={16} className="text-red-400" />}
                </div>
              </div>
              {usernameStatus === "taken" && <p className="text-red-400 text-xs mt-1.5 ml-1">Username already taken</p>}
              {usernameStatus === "invalid" && username.length > 0 && <p className="text-red-400 text-xs mt-1.5 ml-1">3–20 chars: letters, numbers, _ or - only</p>}
            </motion.div>

            {/* Password */}
            <motion.div variants={fadeUp} className="mb-2 relative">
              <input id="signup-password" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoComplete="new-password" className="w-full bg-[#1A1A1A] border-none rounded-xl h-11 px-4 pr-12 text-white text-sm placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-shadow disabled:opacity-40" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors" tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </motion.div>

            {/* Password strength bar */}
            {password.length > 0 && (
              <motion.div variants={fadeUp} className="mb-3">
                <div className="flex gap-1 mb-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength.level ? strength.color : "bg-white/10"}`} />
                  ))}
                </div>
                <p className={`text-xs mb-2 ${strength.level >= 3 ? "text-emerald-400" : strength.level >= 2 ? "text-yellow-400" : strength.level >= 1 ? "text-orange-400" : "text-red-400"}`}>{strength.label}</p>
                <div className="space-y-1">
                  {passwordRules.map((rule, i) => {
                    const passed = rule.test(password);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        {passed ? <Check size={12} className="text-emerald-400 shrink-0" /> : <X size={12} className="text-white/20 shrink-0" />}
                        <span className={`text-xs ${passed ? "text-emerald-400" : "text-white/30"}`}>{rule.label}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Confirm Password */}
            <motion.div variants={fadeUp} className="mb-4 relative">
              <input id="signup-confirm" type={showConfirm ? "text" : "password"} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} autoComplete="new-password" className="w-full bg-[#1A1A1A] border-none rounded-xl h-11 px-4 pr-12 text-white text-sm placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-shadow disabled:opacity-40" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors" tabIndex={-1}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </motion.div>

            {/* Privacy notice */}
            <motion.p variants={fadeUp} className="text-white/20 text-xs mb-5 leading-relaxed">
              🔒 Your email is never shown to other users. Only your username is visible.
            </motion.p>

            {/* Submit */}
            <motion.button variants={fadeUp} type="submit" disabled={loading} className="w-full h-14 bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              {loading ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : "Create Account"}
            </motion.button>
          </form>

          <motion.p variants={fadeUp} className="text-center text-white/40 text-sm mt-8">
            Already have an account? <Link to="/login" className="text-white hover:underline underline-offset-4">Sign in</Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
