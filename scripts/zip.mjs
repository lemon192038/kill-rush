// Creates kill-rush.zip: full source (no node_modules) + prebuilt dist/ ready for static hosting / GitHub Pages.
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
const out = 'kill-rush.zip';
if (existsSync(out)) rmSync(out);
execSync('npm run build', { stdio: 'inherit' });
execSync('cp dist/index.html dist/404.html');
execSync(`zip -qr ${out} . -x "node_modules/*" ".git/*" "*.zip"`, { stdio: 'inherit' });
console.log(`created ${out}`);
