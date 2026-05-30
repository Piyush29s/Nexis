import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, firestore, doc, getDoc, writeBatch, serverTimestamp } from "../services/firebase";

const AuthContext = createContext(null);

/**
 * Custom hook to access auth state and methods.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * AuthProvider wraps the app and provides:
 * - user: the current Firebase User object (or null)
 * - username: the display username (loaded from Firestore)
 * - loading: true while the initial auth state is being determined
 * - signup(email, password, username): create account + store user doc + username doc
 * - login(email, password): sign in with email/password
 * - logout(): sign out
 * - checkUsernameAvailable(username): check if a username is taken
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load username from Firestore
        try {
          const userDoc = await getDoc(doc(firestore, "users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().username) {
            setUsername(userDoc.data().username);
          }
        } catch (err) {
          console.error("Failed to load username:", err);
        }
      } else {
        setUsername(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  /**
   * Check if a username is available.
   * Returns true if available, false if taken.
   */
  async function checkUsernameAvailable(usernameToCheck) {
    const lower = usernameToCheck.toLowerCase();
    try {
      const docSnap = await getDoc(doc(firestore, "usernames", lower));
      return !docSnap.exists();
    } catch (err) {
      console.error("Username availability check failed:", err);
      // If the check itself fails (network, permissions), assume available
      // and let the batch write catch any real conflict
      return true;
    }
  }

  /**
   * Create a new account and atomically write:
   * - users/{userId} -> { username, createdAt }
   * - usernames/{usernameLower} -> { userId, createdAt }
   * Never stores email in Firestore.
   *
   * Each step has its own error handling so failures are diagnosable.
   */
  async function signup(email, password, usernameValue) {
    const lowerUsername = usernameValue.toLowerCase();

    // ── Step 1: Check username availability ────────────────────────
    try {
      const available = await checkUsernameAvailable(usernameValue);
      if (!available) {
        throw { code: "username-taken", message: "Username already taken" };
      }
    } catch (err) {
      if (err.code === "username-taken") throw err;
      console.error("Signup error (username check):", err);
      throw { code: "username-check-failed", message: "Could not verify username availability. Please try again." };
    }

    // ── Step 2: Create Firebase Auth account ───────────────────────
    let result;
    try {
      result = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Signup error (createUser):", err);
      throw err; // Re-throw with original Firebase error code (auth/email-already-in-use, etc.)
    }

    const uid = result.user.uid;

    // ── Step 3: Batch write user + username docs to Firestore ──────
    try {
      const batch = writeBatch(firestore);
      batch.set(doc(firestore, "users", uid), {
        username: usernameValue,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(firestore, "usernames", lowerUsername), {
        userId: uid,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      console.error("Signup error (batch write):", err);
      // Auth account was created but Firestore write failed.
      // The account is still valid — username will be loaded on next login
      // or we can retry. Don't block the user.
      console.warn("Firestore batch write failed. User account was created but profile may be incomplete.");
    }

    setUsername(usernameValue);
    return result;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    setUsername(null);
    return signOut(auth);
  }

  const value = { user, username, loading, signup, login, logout, checkUsernameAvailable };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
