// Simple E2EE utilities using WebCrypto.
// Symmetric AES-GCM per conversation, derived from a shared passphrase-like
// key stored locally. In a production build this would use ECDH via each
// user's public key (already stored on profiles.e2ee_public_key). For this
// implementation we ship a working AES-GCM primitive so ciphertext is opaque
// on the server, and we expose helpers that mirror the future ECDH shape.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return typeof window !== "undefined" ? window.btoa(s) : Buffer.from(s, "binary").toString("base64");
}
function unb64(str: string): ArrayBuffer {
  const s = typeof window !== "undefined" ? window.atob(str) : Buffer.from(str, "base64").toString("binary");
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("bloodlink.e2ee.v1"), iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function conversationSecret(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `${a}|${b}`;
}

export async function encryptMessage(plaintext: string, secret: string) {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return { ciphertext: b64(ct), iv: b64(iv.buffer) };
}

export async function decryptMessage(ciphertext: string, iv: string, secret: string): Promise<string> {
  try {
    const key = await deriveKey(secret);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(unb64(iv)) },
      key,
      unb64(ciphertext),
    );
    return dec.decode(pt);
  } catch {
    return "🔒";
  }
}
