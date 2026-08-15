import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html','styles.css','brand.css','app.js','favicon.svg','app-icon.svg','manifest.webmanifest']) await cp(`public/${file}`, `dist/${file}`);
console.log('FotoDecora listo para publicar');
