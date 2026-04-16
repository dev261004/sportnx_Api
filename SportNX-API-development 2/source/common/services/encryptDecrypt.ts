import crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const algorithm = "aes-256-cbc";

function getEncryptionKeyAndIv() {
  const key = process.env.ENCRYPTION_KEY;
  const iv = process.env.ENCRYPTION_IV;

  if (!key || !iv) {
    throw new Error("Encryption key or IV not found in secrets");
  }

  // Convert hex strings to Buffers
  const keyBuffer = Buffer.from(key, "hex");
  const ivBuffer = Buffer.from(iv, "hex");

  return { key: keyBuffer, iv: ivBuffer };
}

export async function encrypt(text: string): Promise<string> {
  const { key, iv } = getEncryptionKeyAndIv();

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

export async function decrypt(encrypted: string): Promise<string> {
  const { key, iv } = getEncryptionKeyAndIv();

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}
