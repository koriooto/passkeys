import { fromBase64, toBase64 } from "./base64";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const deriveKey = async (
  masterPassword: string,
  saltBase64: string
): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(masterPassword),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(saltBase64),
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

export const encryptField = async (value: string, key: CryptoKey) => {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    textEncoder.encode(value)
  );
  return {
    cipher: toBase64(new Uint8Array(ciphertext)),
    nonce: toBase64(nonce)
  };
};

export const decryptField = async (
  cipher: string,
  nonce: string,
  key: CryptoKey
) => {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(nonce) },
    key,
    fromBase64(cipher)
  );
  return textDecoder.decode(plaintext);
};
