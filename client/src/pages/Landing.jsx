import React, { useRef, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useInView } from "motion/react";
import { ArrowRight, ArrowUpRight, MessageCircle, Zap, Globe } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  // ─── Hero video refs & fade logic ──────────────────────────────────
  const videoRef = useRef(null);
  const animFrameRef = useRef(null);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Start fully transparent
    video.style.opacity = "0";

    /**
     * Smoothly animate the video's opacity from its current value
     * to `to` over `duration` milliseconds using requestAnimationFrame.
     */
    const fadeVideo = (to, duration = 500) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const start = parseFloat(video.style.opacity) || 0;
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        video.style.opacity = String(start + (to - start) * progress);
        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        }
      };

      animFrameRef.current = requestAnimationFrame(step);
    };

    // Fade in when the browser has enough data to start playback
    const handleCanPlay = () => {
      fadeVideo(1, 500);
      fadingOutRef.current = false;
    };

    // Fade out 0.55 s before the video ends for a seamless crossfade
    const handleTimeUpdate = () => {
      if (
        video.duration - video.currentTime <= 0.55 &&
        !fadingOutRef.current
      ) {
        fadingOutRef.current = true;
        fadeVideo(0, 500);
      }
    };

    // Once ended, briefly wait then restart with a fade-in
    const handleEnded = () => {
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
        fadeVideo(1, 500);
        fadingOutRef.current = false;
      }, 100);
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ─── Section 2 (About) scroll trigger ──────────────────────────────
  const aboutRef = useRef(null);
  const isInView = useInView(aboutRef, { once: true, margin: "-100px" });

  // ─── Section 3 (Featured Video) scroll trigger ─────────────────────
  const videoSectionRef = useRef(null);
  const isInView2 = useInView(videoSectionRef, { once: true, margin: "-100px" });

  return (
    <>
      {/* ================================================================
          SECTION 1 — Hero (full viewport)
          ================================================================ */}
      <section className="min-h-screen overflow-hidden relative flex flex-col bg-black">
        {/* Background video */}
        <video
          ref={videoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
          muted
          autoPlay
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover object-bottom"
          style={{ opacity: 0 }}
        />

        {/* ── Navbar ─────────────────────────────────────────────────── */}
        <div className="z-20 relative pt-5 px-6">
          <div className="max-w-5xl mx-auto">
            <nav className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between">
              {/* Left — Logo */}
              <Link to="/" className="flex items-center gap-2.5 no-underline">
                <img src="/Nexis_logo.jpg" alt="Nexis" className="w-7 h-7 rounded-full object-cover" />
                <span className="text-white text-sm font-medium tracking-wide">
                  Nexis
                </span>
              </Link>

              {/* Right — Links & auth */}
              <div className="flex items-center gap-6">
                <span className="text-white/50 text-sm hover:text-white transition-colors cursor-pointer hidden md:block">
                  Features
                </span>
                <span className="text-white/50 text-sm hover:text-white transition-colors cursor-pointer hidden md:block">
                  How it works
                </span>
                <span className="text-white/50 text-sm hover:text-white transition-colors cursor-pointer hidden md:block">
                  About
                </span>
                <button
                  onClick={() => navigate("/signup")}
                  className="text-white/70 text-sm hover:text-white transition-colors"
                >
                  Sign Up
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="liquid-glass rounded-full px-5 py-2 text-white text-sm hover:bg-white/5 transition-colors"
                >
                  Log In
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* ── Hero content ───────────────────────────────────────────── */}
        <div className="z-10 flex-1 flex flex-col items-center justify-center -translate-y-[10%] px-6">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-7xl md:text-9xl text-white tracking-tight font-['Instrument_Serif'] text-center leading-[0.95]"
          >
            Conversations that
            <br />
            <em className="italic">disappear</em>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-white/40 text-sm md:text-base mt-6 text-center max-w-md"
          >
            Two people. One room. Messages gone in 5 minutes.
          </motion.p>

          {/* Email CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mt-10 flex flex-col items-center gap-4"
          >
            {/* Input pill */}
            <div className="liquid-glass rounded-full flex items-center w-full max-w-sm">
              <input
                type="email"
                placeholder="Enter your email"
                className="bg-transparent border-none outline-none text-white placeholder:text-white/20 text-sm px-6 py-4 flex-1 w-full"
              />
              <button
                onClick={() => navigate("/signup")}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center mr-2 shrink-0 hover:bg-white/90 transition-colors"
              >
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Start a Room button */}
            <button
              onClick={() => navigate("/signup")}
              className="liquid-glass rounded-full px-8 py-3 text-white text-sm hover:bg-white/5 transition-colors"
            >
              Start a Room →
            </button>
          </motion.div>
        </div>

        {/* ── Social footer ──────────────────────────────────────────── */}
        <div className="z-10 absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <button className="liquid-glass rounded-full w-10 h-10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <MessageCircle size={16} />
          </button>
          <button className="liquid-glass rounded-full w-10 h-10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <Zap size={16} />
          </button>
          <button className="liquid-glass rounded-full w-10 h-10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <Globe size={16} />
          </button>
        </div>
      </section>

      {/* ================================================================
          SECTION 2 — About
          ================================================================ */}
      <section className="bg-black pt-32 pb-10 px-6 relative">
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.02)_0%,_transparent_60%)]" />

        <div ref={aboutRef} className="max-w-5xl mx-auto relative">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-white/40 text-sm tracking-widest uppercase mb-8"
          >
            What is Nexis
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-4xl md:text-7xl text-white tracking-tight leading-[1.1] font-['Instrument_Serif']"
          >
            Messages that <em className="italic">vanish</em>.
            <br />
            Conversations that <em className="italic">matter</em>.
          </motion.h2>
        </div>
      </section>

      {/* ================================================================
          SECTION 3 — Featured Video
          ================================================================ */}
      <section className="bg-black pt-6 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            ref={videoSectionRef}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView2 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div className="rounded-3xl overflow-hidden relative aspect-video">
              {/* Video */}
              <video
                src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4"
                muted
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* Bottom overlay content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex items-end justify-between gap-6">
                {/* Promise card */}
                <div className="liquid-glass rounded-2xl p-6 max-w-sm">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
                    Our Promise
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Every message self-destructs after 5 minutes. No history. No
                    logs. No trace.
                  </p>
                </div>

                {/* CTA button */}
                <button
                  onClick={() => navigate("/signup")}
                  className="bg-white text-black font-semibold rounded-xl px-6 py-3 text-sm hover:bg-white/90 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
                >
                  Enter a Room →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          SECTION 4 — How it works
          ================================================================ */}
      <section className="bg-black py-28 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Heading */}
          <h2 className="text-5xl md:text-8xl text-white tracking-tight font-['Instrument_Serif'] mb-16">
            Simple <em className="italic">by</em> design.
          </h2>

          {/* Two-column grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* ── Card 1 — Create a Room ──────────────────────────────── */}
            <div className="group liquid-glass rounded-3xl overflow-hidden">
              <div className="aspect-video overflow-hidden">
                <video
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>

              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/30 text-xs uppercase tracking-widest">
                    Step 1
                  </span>
                  <div className="liquid-glass rounded-full w-8 h-8 flex items-center justify-center text-white/40 group-hover:text-white transition-colors">
                    <ArrowUpRight size={14} />
                  </div>
                </div>
                <h3 className="text-white text-xl font-['Instrument_Serif'] mb-2">
                  Create a Room
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">
                  Generate a unique 6-character code in one click. Share it with
                  exactly one other person.
                </p>
              </div>
            </div>

            {/* ── Card 2 — Chat & Vanish ──────────────────────────────── */}
            <div className="group liquid-glass rounded-3xl overflow-hidden">
              <div className="aspect-video overflow-hidden">
                <video
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4"
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>

              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/30 text-xs uppercase tracking-widest">
                    Step 2
                  </span>
                  <div className="liquid-glass rounded-full w-8 h-8 flex items-center justify-center text-white/40 group-hover:text-white transition-colors">
                    <ArrowUpRight size={14} />
                  </div>
                </div>
                <h3 className="text-white text-xl font-['Instrument_Serif'] mb-2">
                  Chat & Vanish
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">
                  Messages disappear after 5 minutes. When you leave, the room
                  is gone. No record, no trace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 5 — Footer CTA
          ================================================================ */}
      <section className="bg-black py-28 px-6 text-center">
        <h2 className="text-5xl md:text-7xl text-white tracking-tight font-['Instrument_Serif'] mb-4">
          <em className="italic">Ready</em> to disappear?
        </h2>

        <p className="text-white/40 text-sm mb-12">
          No account needed to join. Just a code.
        </p>

        {/* Button row */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate("/signup")}
            className="bg-white text-black font-semibold rounded-xl px-8 py-4 text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            Create a Room
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="liquid-glass rounded-xl px-8 py-4 text-white text-sm hover:bg-white/5 transition-colors"
          >
            Join a Room
          </button>
        </div>

        {/* Footer bar */}
        <p className="mt-20 text-white/20 text-xs">
          Nexis © 2026 · Messages self-destruct · No logs · No trace
        </p>
      </section>
    </>
  );
}
