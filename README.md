# Nexis

Real-time, ephemeral chat application with end-to-end encryption. Messages are encrypted client-side and auto-deleted server-side — the server never has access to plaintext or persistent message history.

**Live:** [nexis-ruby.vercel.app](https://nexis-ruby.vercel.app)

## Tech Stack

- **Frontend:** Deployed on Vercel
- **Backend:** Deployed on Render
- **Real-time:** Socket.IO
- **Encryption:** ECDH key exchange + AES-GCM for message encryption
- **Auth:** Firebase Auth

## How It Works

1. Users authenticate via Firebase
2. On entering a room, clients perform an ECDH key exchange to derive a shared secret
3. Messages are encrypted with AES-GCM before leaving the client
4. Server relays ciphertext only — no plaintext storage
5. Messages auto-delete server-side after [X — fill in your actual TTL/condition]

## Status

Deployed and functional. Solo project.
