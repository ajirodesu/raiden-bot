/**
 * login.js — standalone script to generate an appstate.json from credentials.
 * Run with:  node core/system/login.js
 *
 * This only needs to be run once; the resulting appstate.json is used
 * by the main bot to authenticate without credentials.
 */
import { createRequire } from 'module';
import { writeFileSync }  from 'fs';
import { fileURLToPath }  from 'url';
import { dirname, join }  from 'path';
import readline           from 'readline';

const require = createRequire(import.meta.url);
const login   = require('stfca');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '../../json/appstate.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

(async () => {
  console.log('── Raiden Bot Login ─────────────────────────');
  const email    = await ask('Facebook email:    ');
  const password = await ask('Facebook password: ');
  rl.close();

  console.log('\nAttempting login…');
  login({ email, password }, (err, api) => {
    if (err) {
      console.error('Login failed:', err);
      process.exit(1);
    }
    writeFileSync(outputPath, JSON.stringify(api.getAppState(), null, 2));
    console.log(`✅ appstate.json saved to: ${outputPath}`);
    process.exit(0);
  });
})();