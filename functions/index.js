const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { attachSocketServer } = require("./socket");

// ─── Express App ──────────────────────────────────────────────────
const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://nexis-ruby.vercel.app",
  `https://${process.env.GCLOUD_PROJECT}.web.app`,
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ─── Security Headers ────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.get("/", (_req, res) => {
  res.json({ status: "Chatroom API is running" });
});

// ─── HTTP Server + Socket.IO ──────────────────────────────────────
const server = createServer(app);
attachSocketServer(server);

// Start standalone server for local development.
if (!process.env.FUNCTION_TARGET) {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`\n Chatroom server running on port ${PORT}`);
  });
}

// ─── Firebase Cloud Function Export ───────────────────────────────
exports.api = functions.https.onRequest(app);
