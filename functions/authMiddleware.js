const { admin, getUsernameByUid } = require("./firestore");

/**
 * Socket.IO authentication middleware.
 * Verifies the Firebase ID token sent via socket.handshake.auth.token.
 * On success, attaches uid and username (looked up from Firestore) to the socket.
 * Never attaches email — only username is visible to other users.
 *
 * The username lookup has its own try/catch so a Firestore failure
 * (e.g., missing emulator env var) doesn't block the connection.
 */
async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    socket.uid = decoded.uid;

    // Look up username from Firestore — wrapped in its own try/catch
    // so the connection still succeeds even if Firestore is unreachable.
    let username = null;
    try {
      username = await getUsernameByUid(decoded.uid);
    } catch (lookupErr) {
      console.warn(
        `Username lookup failed for uid ${decoded.uid}:`,
        lookupErr.message
      );
    }

    // Fallback: if username is null (doc doesn't exist yet, or lookup failed),
    // use a truncated uid as a temporary display name.
    socket.username = username || `user_${decoded.uid.substring(0, 6)}`;

    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    next(new Error("Authentication error: Invalid token"));
  }
}

module.exports = { socketAuthMiddleware };
