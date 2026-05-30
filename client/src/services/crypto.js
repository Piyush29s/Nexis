/**
 * End-to-end encryption helpers using the Web Crypto API.
 * Uses ECDH P-256 for key exchange and AES-256-GCM for message encryption.
 * No external libraries required — all APIs are built into modern browsers.
 */

/**
 * Convert an ArrayBuffer to a Base64 string.
 */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Base64 string to an ArrayBuffer.
 */
export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a fresh ECDH key pair for key exchange.
 * Returns { publicKey: CryptoKey, privateKey: CryptoKey }.
 */
export async function generateKeyPair() {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}

/**
 * Export a CryptoKey (public) to a Base64 string (SPKI format).
 */
export async function exportPublicKey(publicKey) {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import a Base64-encoded SPKI public key into a CryptoKey.
 */
export async function importPublicKey(base64Key) {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    "spki",
    keyBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

/**
 * Derive a shared AES-256-GCM key from our private key and the partner's public key.
 */
export async function deriveSharedKey(privateKey, partnerPublicKey) {
  return await crypto.subtle.deriveKey(
    { name: "ECDH", public: partnerPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext message using AES-256-GCM.
 * Returns { encryptedMessage: base64string, iv: base64string }.
 */
export async function encryptMessage(sharedKey, plaintext) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    data
  );

  return {
    encryptedMessage: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt a ciphertext using AES-256-GCM.
 * Returns the plaintext string, or "[encrypted message]" if decryption fails.
 */
export async function decryptMessage(sharedKey, encryptedBase64, ivBase64) {
  try {
    const ciphertext = base64ToArrayBuffer(encryptedBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      sharedKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return "[encrypted message]";
  }
}
