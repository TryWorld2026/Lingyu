const path = require('path');
const fs = require('fs');
const extract = require('extract-zip');

const cacheRoot = path.join(process.env.LOCALAPPDATA, 'electron', 'Cache');
const zips = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.zip')) zips.push(p);
  }
}
walk(cacheRoot);
const target = zips.find((z) => /electron-v35\.7\.5-win32-x64\.zip$/.test(z));
if (!target) {
  console.error('zip not found in', zips);
  process.exit(1);
}
console.log('zip:', target);
const dist = path.join(process.cwd(), 'node_modules', 'electron', 'dist');
fs.rmSync(dist, { recursive: true, force: true });
extract(target, { dir: dist })
  .then(() => {
    fs.writeFileSync(path.join(process.cwd(), 'node_modules', 'electron', 'path.txt'), 'electron.exe');
    console.log('extract ok, electron.exe exists:', fs.existsSync(path.join(dist, 'electron.exe')));
  })
  .catch((e) => {
    console.error('extract fail:', e.message);
    process.exit(1);
  });
