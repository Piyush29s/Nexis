const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { attachSocketServer } = require("./socket");
const crypto = require("crypto");
const { admin, getUserByUid, saveVerificationToken, getVerificationToken, markEmailVerified } = require("./firestore");
const { sendVerificationEmail } = require("./email");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://nexis-ruby.vercel.app",
  `https://${process.env.GCLOUD_PROJECT}.web.app`,
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

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

app.post("/send-verification", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const tokenStr = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(tokenStr);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    const userDoc = await getUserByUid(uid);
    const username = (userDoc && userDoc.username) ? userDoc.username : "User";

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 86400000;

    await saveVerificationToken(uid, token, expiresAt);

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`;
    const url = `${backendUrl}/verify-email?token=${token}&uid=${uid}`;

    await sendVerificationEmail(email, username, url);

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to send verification:", error);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

app.get("/verify-email", async (req, res) => {
  try {
    const { token, uid } = req.query;
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

    if (!token || !uid) {
      return res.redirect(`${clientUrl}/verify-email?error=invalid`);
    }

    const verification = await getVerificationToken(uid);
    if (!verification) {
      return res.redirect(`${clientUrl}/verify-email?error=invalid`);
    }

    if (verification.token !== token || verification.used || Date.now() > verification.expiresAt) {
      return res.redirect(`${clientUrl}/verify-email?error=invalid`);
    }

    await markEmailVerified(uid);
    return res.redirect(`${clientUrl}/verify-email?verified=true`);
  } catch (error) {
    console.error("Failed to verify email:", error);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(`${clientUrl}/verify-email?error=invalid`);
  }
});

const server = createServer(app);
attachSocketServer(server);

if (!process.env.FUNCTION_TARGET) {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`\n Chatroom server running on port ${PORT}`);
  });
}

exports.api = functions.https.onRequest(app);
