const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const richDir = path.join(__dirname, 'games', 'lets-get-rich');
const distAssets = path.join(richDir, 'dist', 'assets');
fs.mkdirSync(distAssets, { recursive: true });

// 0a. Reassemble gameEngine.ts if split into chunks
const engineDir = path.join(richDir, 'src', 'engine');
if (fs.existsSync(path.join(engineDir, 'gameEngine.p1'))) {
  const parts = [1, 2, 3, 4, 5, 6].map(i => path.join(engineDir, `gameEngine.p${i}`));
  const combined = parts.map(p => fs.readFileSync(p, 'utf8')).join('');
  fs.writeFileSync(path.join(engineDir, 'gameEngine.ts'), combined, 'utf8');
}

// 0b. Reassemble uiManager.ts if split into chunks
const uiDir = path.join(richDir, 'src', 'ui');
if (fs.existsSync(path.join(uiDir, 'uiManager.p1'))) {
  const parts = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => path.join(uiDir, `uiManager.p${i}`));
  const combined = parts.map(p => fs.readFileSync(p, 'utf8')).join('');
  fs.writeFileSync(path.join(uiDir, 'uiManager.ts'), combined, 'utf8');
}

// 1. Bundle server-side authoritative engine
esbuild.buildSync({
  entryPoints: [path.join(richDir, 'src', 'engine', 'gameEngine.ts')],
  bundle: true,
  platform: 'node',
  outfile: path.join(richDir, 'engine.bundle.cjs'),
  logLevel: 'warning'
});

// 2. Bundle client-side 3D game & styles
esbuild.buildSync({
  entryPoints: [path.join(richDir, 'src', 'main.ts')],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: path.join(distAssets, 'app.js'),
  logLevel: 'warning'
});

// 3. Write dist/index.html
const indexHtml = `<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Let's Get Rich (Peak Era) — 16:9</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Kanit:wght@400;500;600;700&family=Mitr:wght@500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,600;1,6..72,600&display=swap" rel="stylesheet" />
    <script type="module" crossorigin src="/assets/app.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/app.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`;
fs.writeFileSync(path.join(richDir, 'dist', 'index.html'), indexHtml, 'utf8');
console.log('[build-rich] Built engine.bundle.cjs and dist/assets/app.{js,css} successfully.');
