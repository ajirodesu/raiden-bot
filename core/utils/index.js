import { createWriteStream } from 'fs';
import { createRequire } from 'module';
import crypto from 'crypto';
import os from 'os';

const require = createRequire(import.meta.url);
const axios   = require('axios');

// ── File downloader ───────────────────────────────────────────────────────
export async function downloadFile(url, path) {
  const response = await axios({ method: 'GET', responseType: 'stream', url });
  const writer   = createWriteStream(path);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ── HTTP GET helper ────────────────────────────────────────────────────────
export async function getContent(url) {
  try {
    return await axios({ method: 'GET', url });
  } catch (err) {
    console.error('[getContent]', err.message);
    return null;
  }
}

// ── Random string ─────────────────────────────────────────────────────────
export function randomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── AES-256-CBC encrypt / decrypt ─────────────────────────────────────────
export const AES = {
  encrypt(cryptKey, cryptIv, plainData) {
    const cipher    = crypto.createCipheriv('aes-256-cbc', Buffer.from(cryptKey), Buffer.from(cryptIv));
    const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);
    return encrypted.toString('hex');
  },
  decrypt(cryptKey, cryptIv, encrypted) {
    const buf      = Buffer.from(encrypted, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(cryptKey), Buffer.from(cryptIv, 'binary'));
    const decrypted = Buffer.concat([decipher.update(buf), decipher.final()]);
    return String(decrypted);
  },
  makeIv() {
    return Buffer.from(crypto.randomBytes(16)).toString('hex').slice(0, 16);
  },
};

// ── Clean Anilist HTML tags ────────────────────────────────────────────────
export function cleanAnilistHTML(text) {
  return text
    .replace(/<br>/g, '\n')
    .replace(/<\/?(i|em)>/g, '*')
    .replace(/<\/?b>/g, '**')
    .replace(/~!|!~/g, '||')
    .replace('&amp;', '&')
    .replace('&lt;', '<')
    .replace('&gt;', '>')
    .replace('&quot;', '"')
    .replace('&#039;', "'");
}

// ── Home directory detection ───────────────────────────────────────────────
export function homeDir() {
  const home = process.env.HOME;
  const user = process.env.LOGNAME || process.env.USER || process.env.USERNAME;
  let returnHome, typeSystem;

  switch (process.platform) {
    case 'win32':
      returnHome = process.env.USERPROFILE || (process.env.HOMEDRIVE + process.env.HOMEPATH) || home || null;
      typeSystem  = 'win32';
      break;
    case 'darwin':
      returnHome = home || (user ? `/Users/${user}` : null);
      typeSystem  = 'darwin';
      break;
    case 'linux':
      returnHome = home || (process.getuid?.() === 0 ? '/root' : (user ? `/home/${user}` : null));
      typeSystem  = 'linux';
      break;
    default:
      returnHome = home || null;
      typeSystem  = 'unknown';
  }

  return [typeof os.homedir === 'function' ? os.homedir() : returnHome, typeSystem];
}