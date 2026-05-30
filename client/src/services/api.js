import { firestore, doc, getDoc } from "./firebase";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

export async function sendVerificationEmail(idToken) {
  const res = await fetch(`${SERVER_URL}/send-verification`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` }
  });
  return res.json();
}

export async function checkEmailVerified(uid) {
  const docSnap = await getDoc(doc(firestore, "users", uid));
  if (docSnap.exists()) {
    return !!docSnap.data().emailVerified;
  }
  return false;
}
