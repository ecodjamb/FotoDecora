import { cp, mkdir, rm, appendFile, readFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html','styles.css','app.js','favicon.svg','app-icon.svg','manifest.webmanifest']) await cp(`public/${file}`, `dist/${file}`);
await appendFile('dist/styles.css','\n'+await readFile('public/brand.css','utf8'));
console.log('FotoDecora listo para publicar');
