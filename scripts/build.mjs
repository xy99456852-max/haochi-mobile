import { build } from 'esbuild';
import { mkdir, cp, copyFile, writeFile, access } from 'node:fs/promises';
await mkdir('docs/assets',{recursive:true});
await build({entryPoints:['src/main.tsx'],outfile:'docs/assets/app.js',bundle:true,minify:true,format:'iife',platform:'browser',jsx:'automatic',target:['safari15.4','chrome100'],define:{'process.env.NODE_ENV':'"production"'}});
try { await access('data/menu.json'); } catch {
  const r=await build({entryPoints:['lib/menu.ts'],bundle:true,format:'esm',platform:'node',write:false});
  const {seeds}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
  await writeFile('data/menu.json',JSON.stringify({items:seeds.map(i=>({...i,image:i.image.replace(/^\//,'')}))},null,2)+'\n');
}
await cp('public','docs',{recursive:true});
await cp('data','docs/data',{recursive:true});
await copyFile('src/style.css','docs/assets/style.css');
await copyFile('index.html','docs/index.html');
await writeFile('docs/.nojekyll','');
console.log('Built GitHub Pages mobile app in docs/');
