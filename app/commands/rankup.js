/**
 * rankup.js  v8.3.0
 * ---------
 * Tracks per-message EXP and announces level-ups with a high-quality canvas card.
 *
 * onStart  → toggle rankup announcements on/off for this thread
 * onEvent  → fires on every message; checks for level-up and sends the card
 *
 * Dependencies:
 *   @napi-rs/canvas   — canvas rendering
 *   axios             — HTTP requests
 *   fs-extra          — file utilities
 */

import axios             from 'axios';
import fs                from 'fs-extra';
import path              from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../cache');

// ── Card dimensions ───────────────────────────────────────────────────────
const CARD_W   = 900;
const CARD_H   = 300;
const AVT_SIZE = 162;
const AVT_X    = 675;
const AVT_Y    = 68;

// ── Card backgrounds ──────────────────────────────────────────────────────
const BACKGROUNDS = [
  'https://i.postimg.cc/NFwc831C/20221109-230208.jpg',
  'https://i.postimg.cc/903W8Rjp/20221109-230805.jpg',
  'https://i.postimg.cc/rFN8jwZ1/20221109-233203.jpg',
  'https://i.postimg.cc/3rpryBgb/20221109-233648.jpg',
  'https://i.postimg.cc/d38JzssK/20221109-233900.jpg',
  'https://i.postimg.cc/R0N4vQSd/20221109-234421.jpg',
  'https://i.postimg.cc/YqHrQWR2/20221109-234810.jpg',
  'https://i.postimg.cc/nhdn8wJM/20221109-235226.jpg',
  'https://i.postimg.cc/P5fdRn0B/20221109-235633.jpg',
  'https://i.postimg.cc/ZnFhwwHb/20221110-000032.jpg',
  'https://i.postimg.cc/RFtmHSnn/20221110-000130.jpg',
];

// ── Meta ──────────────────────────────────────────────────────────────────
export const meta = {
  name:        'rankup',
  version:     '8.3.0',
  type:        'groupadmin',
  author:      'Plue | Converted by AjiroDesu',
  description: 'Toggle rank-up announcements for this group.',
  category:    'system',
  guide:       [''],
  cooldowns:   2,
};

// ── Level formula ─────────────────────────────────────────────────────────
function expToLevel(exp) {
  return Math.floor((Math.sqrt(1 + (4 * exp / 3) + 1) / 2));
}

// ── Avatar helpers ────────────────────────────────────────────────────────

function buildHdAvatarUrl(userID) {
  return `https://graph.facebook.com/${userID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
}

async function getAvatarUrl(api, userID) {
  try {
    const info = await new Promise((resolve) => {
      api.getUserInfo(userID, (err, data) => {
        if (err || !data?.[userID]) return resolve(null);
        resolve(data[userID]);
      });
    });
    return buildHdAvatarUrl(userID) || info?.profilePicture || info?.thumbSrc || null;
  } catch {
    return buildHdAvatarUrl(userID);
  }
}

async function downloadBuffer(url, timeoutMs = 8000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data } = await axios.get(encodeURI(url), {
        responseType: 'arraybuffer',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RankupBot/8.3)' },
      });
      return Buffer.from(data);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function circleClip(imageBuffer, targetSize) {
  const SCALE  = 2;
  const render = targetSize * SCALE;

  const img    = await loadImage(imageBuffer);
  const canvas = createCanvas(render, render);
  const ctx    = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.beginPath();
  ctx.arc(render / 2, render / 2, render / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, 0, 0, render, render);

  const out    = createCanvas(targetSize, targetSize);
  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(canvas, 0, 0, render, render, 0, 0, targetSize, targetSize);

  return out.toBuffer('image/png');
}

function drawAvatarBorder(ctx, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r  = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth   = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth   = 3;
  ctx.stroke();
  ctx.restore();
}

async function buildCard(api, senderID) {
  try {
    await fs.ensureDir(CACHE_DIR);

    const bgUrl     = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
    const avatarUrl = await getAvatarUrl(api, senderID);

    const [bgBuf, avtBuf] = await Promise.all([
      downloadBuffer(bgUrl),
      avatarUrl ? downloadBuffer(avatarUrl).catch(() => null) : Promise.resolve(null),
    ]);

    const bgImg  = await loadImage(bgBuf);
    const canvas = createCanvas(CARD_W, CARD_H);
    const ctx    = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Background only — no text, no overlay, no separator line
    ctx.drawImage(bgImg, 0, 0, CARD_W, CARD_H);

    // Avatar
    if (avtBuf) {
      const circleAvt = await circleClip(avtBuf, AVT_SIZE);
      const avtImg    = await loadImage(circleAvt);

      drawAvatarBorder(ctx, AVT_X, AVT_Y, AVT_SIZE);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.beginPath();
      ctx.arc(AVT_X + AVT_SIZE / 2, AVT_Y + AVT_SIZE / 2, AVT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avtImg, AVT_X, AVT_Y, AVT_SIZE, AVT_SIZE);
      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  } catch (err) {
    console.error('[rankup] buildCard error:', err?.message || err);
    return null;
  }
}

// ── onStart — toggle rankup for this thread ───────────────────────────────
export async function onStart({ event, Threads, response }) {
  const { threadID } = event;
  const threadRow    = await Threads.getData(String(threadID));
  const data         = threadRow?.data || {};

  data.rankup = !data.rankup;

  await Threads.setData(String(threadID), { data });
  global.data.threadData.set(String(threadID), data);

  return response.reply(
    data.rankup
      ? '🟢 Rank-up announcements have been ENABLED for this group.'
      : '🔴 Rank-up announcements have been DISABLED for this group.',
  );
}

// ── onEvent — per-message EXP + level-up check ───────────────────────────
export async function onEvent({ api, event, Currencies, Users, response }) {
  const { threadID, senderID } = event;

  if (!event.body && event.type !== 'message') return;

  const tID = String(threadID);
  const sID = String(senderID);

  const thread = global.data.threadData.get(tID) || {};
  if (thread.rankup === false) return;

  const currencyRow = await Currencies.getData(sID);
  if (!currencyRow) return;

  const oldExp = Number(currencyRow.exp) || 0;
  const newExp = oldExp + 1;
  if (isNaN(newExp)) return;

  await Currencies.setData(sID, { exp: newExp });

  const oldLevel = expToLevel(oldExp);
  const newLevel = expToLevel(newExp);
  if (newLevel <= oldLevel || newLevel === 1) return;

  // Level up!
  const name = global.data.userName.get(sID) || await Users.getNameUser(sID);

  const customMsg = thread.customRankup;
  const body = (customMsg || '🎉 Congrats {name}!\nYour level has reached Level {level}!')
    .replace(/\{name}/g, name)
    .replace(/\{level}/g, newLevel);

  const cardBuf = await buildCard(api, sID);

  if (cardBuf) {
    const tmpPath = path.join(CACHE_DIR, `rankup_${sID}_${Date.now()}.png`);
    try {
      await fs.writeFile(tmpPath, cardBuf);
      await response.send(
        {
          body,
          mentions: [{ tag: name, id: sID }],
          attachment: fs.createReadStream(tmpPath),
        },
        tID,
      );
    } finally {
      fs.remove(tmpPath).catch(() => {});
    }
  } else {
    await response.send(body, tID);
  }
}