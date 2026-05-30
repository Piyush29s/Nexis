const admin = require("firebase-admin");

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const serviceAccount = JSON.parse(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
} else {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || "ephemeral-chat-90969",
  });
}

const db = admin.firestore();

/**
 * Save an encrypted message to Firestore under rooms/{roomId}/messages/{messageId}
 * Only stores encrypted ciphertext and IV — never plaintext.
 */
async function saveMessage(roomId, msg) {
  await db
    .collection("rooms")
    .doc(roomId)
    .collection("messages")
    .doc(msg.id)
    .set({
      id: msg.id,
      roomId: msg.roomId,
      userId: msg.userId,
      username: msg.username,
      encryptedMessage: msg.encryptedMessage,
      iv: msg.iv,
      createdAt: msg.createdAt,
      expiresAt: msg.expiresAt,
    });
}

/**
 * Delete a message from Firestore
 */
async function deleteMessage(roomId, messageId) {
  try {
    await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .doc(messageId)
      .delete();
  } catch (err) {
    console.error(`Failed to delete message ${messageId}:`, err.message);
  }
}

/**
 * Upsert room participant list in Firestore for security rule checks
 */
async function upsertRoom(roomId, participants) {
  await db
    .collection("rooms")
    .doc(roomId)
    .set(
      {
        participants,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

/**
 * Delete room document from Firestore when empty
 */
async function deleteRoom(roomId) {
  try {
    await db.collection("rooms").doc(roomId).delete();
  } catch (err) {
    console.error(`Failed to delete room ${roomId}:`, err.message);
  }
}

/**
 * Look up a user's username from Firestore by uid.
 * Returns the username string or null if not found.
 */
async function getUsernameByUid(uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists && doc.data().username) {
      return doc.data().username;
    }
    return null;
  } catch (err) {
    console.error(`Failed to look up username for uid ${uid}:`, err.message);
    return null;
  }
}

/**
 * Fetch full user document by UID
 */
async function getUserByUid(uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists) return doc.data();
    return null;
  } catch (err) {
    console.error(`Failed to fetch user ${uid}:`, err.message);
    return null;
  }
}

/**
 * Save a verification token for email verification
 */
async function saveVerificationToken(uid, token, expiresAt) {
  await db.collection("emailVerifications").doc(uid).set({
    token,
    expiresAt,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Get the verification token doc
 */
async function getVerificationToken(uid) {
  const doc = await db.collection("emailVerifications").doc(uid).get();
  return doc.exists ? doc.data() : null;
}

/**
 * Mark email as verified using a batch write
 */
async function markEmailVerified(uid) {
  const batch = db.batch();
  const userRef = db.collection("users").doc(uid);
  const tokenRef = db.collection("emailVerifications").doc(uid);

  batch.update(userRef, { emailVerified: true });
  batch.update(tokenRef, { used: true });

  await batch.commit();
}

module.exports = { 
  admin, 
  db, 
  saveMessage, 
  deleteMessage, 
  upsertRoom, 
  deleteRoom, 
  getUsernameByUid,
  getUserByUid,
  saveVerificationToken,
  getVerificationToken,
  markEmailVerified
};
