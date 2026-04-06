/**
 * cmd.js
 * ------
 * Manage command files at runtime: load, reload, unload, loadAll, install.
 *
 * ES modules don't support require.cache invalidation, so dynamic reloads
 * use a timestamp-busted import URL to force Node to re-evaluate the file.
 *
 * Place in: app/commands/cmd.js
 */

import fs   from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';

const COMMANDS_DIR = path.resolve(process.cwd(), 'app/commands');
const EVENTS_DIR   = path.resolve(process.cwd(), 'app/events');

// ── Internal helpers ─────────────────────────────────────────────────────────

function resolveFilePath(fileName, dir = COMMANDS_DIR) {
  const name = fileName.endsWith('.js') ? fileName : `${fileName}.js`;
  return path.join(dir, name);
}

function isURL(str) {
  try { new URL(str); return true; } catch { return false; }
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

/**
 * Dynamically (re)import a file, bypassing Node's ESM module cache via
 * a timestamp query param on the file URL.
 */
async function importFresh(filePath) {
  return import(pathToFileURL(filePath).href + `?v=${Date.now()}`);
}

/**
 * Load (or reload) a command file into global.client.commands.
 * Returns { ok: bool, name: string, error?: string }
 */
async function loadCommand(fileName) {
  const filePath = resolveFilePath(fileName);

  if (!fs.existsSync(filePath))
    return { ok: false, name: fileName, error: `File not found: ${filePath}` };

  try {
    const mod = await importFresh(filePath);

    if (!mod.meta)                         throw new Error('Missing export: meta');
    if (typeof mod.onStart !== 'function') throw new Error('Missing export: onStart');

    const { commands, eventRegistered } = global.client;

    // Remove old entry so the new one takes over
    commands.delete(mod.meta.name);

    // Remove from eventRegistered if previously registered
    const eidx = eventRegistered.indexOf(mod.meta.name);
    if (eidx !== -1) eventRegistered.splice(eidx, 1);

    commands.set(mod.meta.name, mod);

    if (typeof mod.onEvent === 'function')
      eventRegistered.push(mod.meta.name);

    return { ok: true, name: mod.meta.name };
  } catch (err) {
    return { ok: false, name: fileName, error: err.message };
  }
}

/**
 * Unload a command from global.client.commands by command name or file name.
 */
function unloadCommand(nameOrFile) {
  const { commands, eventRegistered } = global.client;

  // Allow either command name or file name (strip .js)
  const cmdName = nameOrFile.replace(/\.js$/, '');
  const found   = commands.get(cmdName)
    ? cmdName
    : [...commands.keys()].find(k => k.toLowerCase() === cmdName.toLowerCase());

  if (!found) return { ok: false, name: nameOrFile, error: `Command "${nameOrFile}" is not currently loaded.` };

  commands.delete(found);
  const idx = eventRegistered.indexOf(found);
  if (idx !== -1) eventRegistered.splice(idx, 1);

  return { ok: true, name: found };
}

// ── Command ──────────────────────────────────────────────────────────────────

export const meta = {
  name:        'cmd',
  aliases:     ['command', 'script'],
  version:     '1.0.0',
  type:        'developer',
  author:      'NTKhang | Converted for Raiden by AjiroDesu',
  description: 'Manage command files at runtime — load, reload, unload, loadAll, install.',
  category:    'developer',
  guide: [
    'load <filename>               – load or reload a command file',
    'loadAll                       – reload all command files',
    'unload <commandName>          – unload a running command',
    'install <url> <filename.js>   – download and install from a URL',
  ],
  cooldowns: 5,
};

export async function onStart({ api, event, args, response, usage }) {
  const sub = (args[0] || '').toLowerCase();

  if (!args[0]) return usage();

  // ── load <filename> ───────────────────────────────────────────────────
  if (sub === 'load' && args.length === 2) {
    const result = await loadCommand(args[1]);
    return result.ok
      ? response.reply(`✅ Command "${result.name}" loaded successfully.`)
      : response.reply(`❌ Failed to load "${args[1]}":\n${result.error}`);
  }

  // ── loadAll | load <file1> <file2> ... ───────────────────────────────
  if (sub === 'loadall' || (sub === 'load' && args.length > 2)) {
    const fileNames = sub === 'loadall'
      ? fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3))
      : args.slice(1);

    const succeeded = [];
    const failed    = [];

    for (const name of fileNames) {
      const result = await loadCommand(name);
      result.ok
        ? succeeded.push(result.name)
        : failed.push(`  ❗ ${name}: ${result.error}`);
    }

    const lines = [];
    if (succeeded.length) lines.push(`✅ Loaded ${succeeded.length} command(s) successfully.`);
    if (failed.length)    lines.push(`❌ Failed to load ${failed.length}:\n${failed.join('\n')}`);
    return response.reply(lines.join('\n'));
  }

  // ── unload <commandName> ──────────────────────────────────────────────
  if (sub === 'unload') {
    if (!args[1]) return response.reply('⚠️ Please enter the command name to unload.');
    const result = unloadCommand(args[1]);
    return result.ok
      ? response.reply(`✅ Command "${result.name}" has been unloaded.`)
      : response.reply(`❌ ${result.error}`);
  }

  // ── install <url> <filename.js> ───────────────────────────────────────
  if (sub === 'install') {
    let urlOrCode = args[1];
    let fileName  = args[2];

    if (!urlOrCode || !fileName) return usage();

    // Allow reversed order: cmd install file.js <url>
    if (urlOrCode.endsWith('.js') && !isURL(urlOrCode)) {
      [urlOrCode, fileName] = [fileName, urlOrCode];
    }

    if (!fileName || !fileName.endsWith('.js'))
      return response.reply('⚠️ The destination file name must end in .js');

    const filePath = resolveFilePath(fileName);
    let   rawCode  = null;

    if (isURL(urlOrCode)) {
      let downloadURL = urlOrCode;
      const domain    = getDomain(downloadURL);
      if (!domain) return response.reply('⚠️ Invalid URL.');

      // Normalise pastebin / GitHub URLs to raw
      if (domain === 'pastebin.com')
        downloadURL = downloadURL.replace(/pastebin\.com\/(?!raw\/)(.+)/, 'pastebin.com/raw/$1').replace(/\/$/, '');
      else if (domain === 'github.com')
        downloadURL = downloadURL.replace(/github\.com\/(.+)\/blob\/(.+)/, 'raw.githubusercontent.com/$1/$2');

      try {
        const { data } = await axios.get(downloadURL, { responseType: 'text' });
        if (domain === 'savetext.net') {
          const $ = cheerio.load(data);
          rawCode  = $('#content').text();
        } else {
          rawCode = typeof data === 'string' ? data : JSON.stringify(data);
        }
      } catch (err) {
        return response.reply(`❌ Download failed: ${err.message}`);
      }
    } else {
      return response.reply('⚠️ Please provide a valid URL to download the command from.');
    }

    if (!rawCode?.trim()) return response.reply('⚠️ Could not retrieve command code from the URL.');

    if (fs.existsSync(filePath)) {
      const info = await response.send(`⚠️ "${fileName}" already exists. React to this message with any emoji to overwrite.`);
      response.addReaction({
        messageID: info.messageID,
        name:      meta.name,
        type:      'confirmInstall',
        author:    String(event.senderID),
        filePath,
        fileName,
        rawCode,
      });
      return;
    }

    return _writeAndLoad(filePath, fileName, rawCode, response);
  }

  return usage();
}

// ── onReaction: overwrite confirm for install ─────────────────────────────────

export async function onReaction({ event, response, onReaction: reactionData }) {
  const { type, author, filePath, fileName, rawCode } = reactionData;
  if (type !== 'confirmInstall') return;
  if (String(event.userID) !== String(author)) return;
  return _writeAndLoad(filePath, fileName, rawCode, response);
}

// ── Internal: write file to disk then hot-load it ────────────────────────────

async function _writeAndLoad(filePath, fileName, rawCode, response) {
  try {
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, rawCode, 'utf-8');
  } catch (err) {
    return response.reply(`❌ Failed to write file: ${err.message}`);
  }

  const baseName = fileName.replace(/\.js$/, '');
  const result   = await loadCommand(baseName);

  return result.ok
    ? response.reply(`✅ "${result.name}" installed and loaded from ${filePath.replace(process.cwd(), '.')}`)
    : response.reply(`❌ File saved but failed to load:\n${result.error}`);
}
