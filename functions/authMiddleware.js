const { admin, getUsernameByUid } = require("./firestore");

async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    socket.uid = decoded.uid;

    let username = null;
    try {
      username = await getUsernameByUid(decoded.uid);
    } catch (lookupErr) {
      console.warn(`Username lookup failed for uid ${decoded.uid}:`, lookupErr.message);
    }

    socket.username = username || `user_${decoded.uid.substring(0, 6)}`;
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    next(new Error("Authentication error: Invalid token"));
  }
}

module.exports = { socketAuthMiddleware };
