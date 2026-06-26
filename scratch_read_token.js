import fs from 'fs';
import path from 'path';
import os from 'os';

const paths = [
  path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
  path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    console.log('Found config at:', p);
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      console.log('Tokens:', Object.keys(data.tokens || {}));
      console.log('User:', data.user);
      // Let's print the token if it exists (masking it slightly for safety, or just print it for local usage)
      if (data.tokens && data.tokens.active) {
        console.log('Active Token found!');
        // We will output it to a temp file in scratch
        fs.writeFileSync('./scratch_token.json', JSON.stringify({ token: data.tokens.active }), 'utf8');
      }
    } catch (e) {
      console.error('Error reading config:', e);
    }
  }
}
