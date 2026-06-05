import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { auth, firestore, doc, getDoc, writeBatch, serverTimestamp } from "../services/firebase";
import { sendVerificationEmail } from "../services/api";

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
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
        setEmailVerified(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    if (user) {
      unsubscribe = onSnapshot(doc(firestore, "users", user.uid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().emailVerified) {
          setEmailVerified(true);
        } else {
          setEmailVerified(false);
        }
      });
    }
    return () => unsubscribe();
  }, [user]);

  async function checkUsernameAvailable(usernameToCheck) {
    const lower = usernameToCheck.toLowerCase();
    try {
      const docSnap = await getDoc(doc(firestore, "usernames", lower));
      return !docSnap.exists();
    } catch (err) {
      console.error("Username availability check failed:", err);
      return true;
    }
  }

  async function signup(email, password, usernameValue) {
    const lowerUsername = usernameValue.toLowerCase();

    try {
      const available = await checkUsernameAvailable(usernameValue);
      if (!available) {
        throw { code: "username-taken", message: "Username already taken" };
      }
    } catch (err) {
      if (err.code === "username-taken") throw err;
      throw { code: "username-check-failed", message: "Could not verify username availability." };
    }

    let result;
    try {
      result = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw err;
    }

    const uid = result.user.uid;

    try {
      const batch = writeBatch(firestore);
      batch.set(doc(firestore, "users", uid), {
        username: usernameValue,
        emailVerified: false,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(firestore, "usernames", lowerUsername), {
        userId: uid,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      console.warn("Firestore batch write failed.");
    }

    try {
      const idToken = await result.user.getIdToken();
      await sendVerificationEmail(idToken);
    } catch (err) {
      console.error("Failed to send verification email via API:", err);
    }

    setUsername(usernameValue);
    return result;
  }

  async function googleSignIn() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function githubSignIn() {
    const provider = new GithubAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function checkUserExists(uid) {
    const docSnap = await getDoc(doc(firestore, "users", uid));
    return docSnap.exists();
  }

  async function completeOAuthSignup(uid, email, usernameValue) {
    const lowerUsername = usernameValue.toLowerCase();
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, "users", uid), {
      username: usernameValue,
      emailVerified: true,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(firestore, "usernames", lowerUsername), {
      userId: uid,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    setUsername(usernameValue);
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    setUsername(null);
    setEmailVerified(false);
    return signOut(auth);
  }

  async function resendVerificationEmail() {
    if (user) {
      const idToken = await user.getIdToken();
      await sendVerificationEmail(idToken);
    }
  }

  const value = { 
    user, 
    username,
    emailVerified,
    loading, 
    signup, 
    login, 
    logout, 
    checkUsernameAvailable,
    googleSignIn,
    githubSignIn,
    checkUserExists,
    completeOAuthSignup,
    resendVerificationEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
