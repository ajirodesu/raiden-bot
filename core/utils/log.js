/**
 * core/utils/log.js
 * -----------------
 * Raiden Engine — Professional Logger
 *
 * Tag colors:
 *   [RAIDEN]    electric cyan   — core system messages
 *   [COMMANDS]  emerald green   — command scan / deploy
 *   [EVENT]     amber gold      — event scan / deploy
 *   [LOGIN]     violet          — authentication
 *   [DATABASE]  orange          — database operations
 *   [SYSTEM]    teal            — internal subsystems
 *   [USER]      sky blue        — user DB events
 *   [THREAD]    pink            — thread DB events
 *   [DEV]       grey            — developer mode only
 *   [WARN]      yellow          — warnings
 *   [ERROR]     red             — errors
 */

import chalk from 'chalk';

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  RAIDEN:   chalk.bold.hex('#00d4ff'),
  COMMANDS: chalk.bold.hex('#00e676'),
  EVENT:    chalk.bold.hex('#ffd600'),
  LOGIN:    chalk.bold.hex('#ce93d8'),
  DATABASE: chalk.bold.hex('#ff7043'),
  SYSTEM:   chalk.bold.hex('#4dd0e1'),
  USER:     chalk.bold.hex('#40c4ff'),
  THREAD:   chalk.bold.hex('#f48fb1'),
  DEV:      chalk.bold.grey,
  WARN:     chalk.bold.yellow,
  ERROR:    chalk.bold.red,
  SECTION:  chalk.bold.white,
  RESET:    chalk.reset,
};

// ── Tag registry ──────────────────────────────────────────────────────────
const TAG_COLORS = {
  RAIDEN:   C.RAIDEN,
  COMMANDS: C.COMMANDS,
  EVENT:    C.EVENT,
  LOGIN:    C.LOGIN,
  DATABASE: C.DATABASE,
  SYSTEM:   C.SYSTEM,
  USER:     C.USER,
  THREAD:   C.THREAD,
  DEV:      C.DEV,
  WARN:     C.WARN,
  ERROR:    C.ERROR,
};

const ANSI_RE = /\u001b\[[0-9;]*[A-Za-z]/g;
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu;
const UPDATE_RE = /\b(?:update|updat(?:e|ing)|checking|version|release|changelog|patch)\b/i;
const STATUS_RE = /\b(?:up to date|connected|login successful|logged as|online|reconnect|restart interval|maintained|enhanced|mqtt)\b/i;

// Lines matching any of these patterns are silently dropped — they are internal
// noise from stfca, bluebird, the legacy `request` package, and Node.js
// deprecation warnings that add no value to the operator.
const NOISE_PATTERNS = [
  /node_modules[/\\]bluebird/i,
  /node_modules[/\\]request/i,
  /node_modules[/\\]stfca/i,
  /node_modules[/\\]form-data/i,
  /\bpromisif(?:y|ied)\b/i,
  /\bFormData\.append\b/i,
  /\bappendFormValue\b/i,
  /\bpostFormData(?:WithDefault)?\b/i,
  /\bRequest\.init\b/i,
  /\bnew Request\b/i,
  /\[DEP\d{4}\]/,
  /DeprecationWarning/i,
  /util\.isArray/i,
  /Array\.isArray\(\)/i,
  /at promisified/i,
  /at Object\.setMessageReaction/i,
  // Suppress raw FCA createPoll response dumps — these produce many
  // repeated [RAIDEN] lines for a single failure. A single [ERROR] line
  // is emitted instead via the externalCreatePollError handler below.
  /^\s*createPoll\s*\{/i,
  /\[poll\]\s*createPoll\s*(error|failed)/i,
  /\b__ar\s*:/i,
  /\brid\s*:\s*['"][A-Za-z0-9_-]+['"]/,
  /\bshowUser\s*:\s*(?:true|false)/i,
  /\blid\s*:\s*['"]\d+['"]/,
];

function getRawLog() {
  return typeof globalThis.__rawConsoleLog === 'function'
    ? globalThis.__rawConsoleLog
    : console.log.bind(console);
}

function cleanExternalText(value) {
  return String(value)
    .replace(ANSI_RE, '')
    .replace(EMOJI_RE, '')
    .replace(/^%(?:[sdifoOjJc])(?:\s+|$)/i, '')
    .replace(/^(?:info|warn|error|debug|log)\s+/i, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\s+$/g, '')
    .trim();
}

function inferExternalTag(line, fallback = 'RAIDEN') {
  if (/\b(?:logging in|login successful|logged in|login failed|authenticated|auth|appstate)\b/i.test(line)) {
    return 'LOGIN';
  }

  if (/\b(?:loading data environment|loaded \d+ threads|loaded \d+ users|loaded \d+ wallets|database)\b/i.test(line)) {
    return 'DATABASE';
  }

  return fallback;
}

function emitTaggedLine(tag, message) {
  const upper = String(tag).toUpperCase();
  const colorFn = TAG_COLORS[upper] || C.SYSTEM;
  getRawLog()(`${colorFn(`[${upper}]`)} ${message}`);
}

function classifyExternalLine(line) {
  if (UPDATE_RE.test(line)) return 0;
  if (STATUS_RE.test(line)) return 1;
  return 2;
}

/**
 * Format and print a tagged log line.
 *   logger('Dashboard running', 'RAIDEN')  →  [RAIDEN] Dashboard running
 *
 * Special case: Messages containing "zero logs" or "0 logs" (case-insensitive)
 * are printed WITHOUT any system/tag prefix.
 *
 * Proper spacing applied:
 *   • Message is trimmed (no accidental leading/trailing whitespace)
 *   • Single leading space is added so the text aligns visually with
 *     the message portion of normal tagged logs.
 *
 * @param {string} message
 * @param {string} [tag='RAIDEN']
 */
function logger(message, tag = 'RAIDEN') {
  const msgStr = String(message);

  // ── Zero-logs special case: no prefix + proper spacing ──────────────────
  const lower = msgStr.toLowerCase();
  if (lower.includes('zero logs') || lower.includes('0 logs')) {
    const cleanMessage = msgStr.trim();
    getRawLog()(` ${cleanMessage}`);
    return;
  }

  // ── Normal tagged log ───────────────────────────────────────────────────
  const upper   = String(tag).toUpperCase();
  const colorFn = TAG_COLORS[upper] || C.SYSTEM;
  getRawLog()(`${colorFn(`[${upper}]`)} ${msgStr}`);
}

/**
 * Log an external subsystem line using the same tag style as the rest of the app.
 * This is used for raw stfca / runtime output so it blends into the current logger.
 *
 * The wrapper cleans emojis, removes ANSI fragments, strips accidental printf
 * placeholders, and groups update/version checks ahead of the rest of the burst
 * so startup output reads cleanly.
 *
 * @param {string} message
 * @param {string} [tag='RAIDEN']
 */
logger.external = function (message, tag = 'RAIDEN') {
  const text = String(message ?? '');
  if (!text.trim()) {
    getRawLog()('');
    return;
  }

  const lines = text
    .split(/[\r\n]+/)
    .map(cleanExternalText)
    .filter(line => line && !NOISE_PATTERNS.some(re => re.test(line)));

  if (!lines.length) {
    // Even if every line matched a NOISE_PATTERN, still surface a single
    // [ERROR] line when the raw text looks like a createPoll API failure,
    // so the operator knows it happened without seeing the full dump.
    const raw = text.toLowerCase();
    if (
      (raw.includes('createpoll') || raw.includes('[poll]')) &&
      (raw.includes('failure') || raw.includes('error'))
    ) {
      logger.error('[api] createPoll failed — Facebook rejected the request (not a bot error).');
    }
    return;
  }

  const grouped = lines
    .map((line, index) => ({
      line,
      index,
      rank: classifyExternalLine(line),
      tag: inferExternalTag(line, tag),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  // ── Single-prefix output ────────────────────────────────────────────
  // If the external source emitted a multi-line block (e.g. a serialised
  // error object), print only the FIRST line with the coloured tag and
  // indent every subsequent line so the console stays readable without
  // repeating [RAIDEN] / [ERROR] on every single line.
  if (grouped.length === 1) {
    emitTaggedLine(grouped[0].tag, grouped[0].line);
  } else {
    const first    = grouped[0];
    const upper    = String(first.tag).toUpperCase();
    const colorFn  = TAG_COLORS[upper] || C.SYSTEM;
    const tagLabel = colorFn(`[${upper}]`);
    const indent   = ' '.repeat(tagLabel.replace(ANSI_RE, '').length + 1);

    getRawLog()(`${tagLabel} ${first.line}`);
    for (let i = 1; i < grouped.length; i++) {
      getRawLog()(`${indent}${grouped[i].line}`);
    }
  }
};

/**
 * Print a blank-line-padded uppercase section header.
 *   logger.section('SCANNING COMMANDS')
 *
 *   →  (blank line)
 *   →  SCANNING COMMANDS
 */
logger.section = function (title) {
  getRawLog()('');
  getRawLog()(C.SECTION(String(title).toUpperCase()));
};

/**
 * Print the ASCII-art boot banner.
 */
logger.banner = function () {
  getRawLog()(C.SECTION('  RAIDEN ENGINE INITIALIZING...'));
  getRawLog()('');
};

/** @param {string} message */
logger.warn = function (message) {
  getRawLog()(`${C.WARN('[WARN]')} ${String(message)}`);
};

/** @param {string} message */
logger.error = function (message) {
  getRawLog()(`${C.ERROR('[ERROR]')} ${String(message)}`);
};

/**
 * Backwards-compatible .loader() alias.
 * @param {string} message
 * @param {'warn'|'error'|string} [option]
 */
logger.loader = function (message, option) {
  const o = option?.toLowerCase();
  if (o === 'error') return logger.error(message);
  if (o === 'warn')  return logger.warn(message);
  logger(message, 'RAIDEN');
};

export default logger;
