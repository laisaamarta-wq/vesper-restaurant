// usage: node tools/shots.js <outdir> [mobile]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.mp4':'video/mp4' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(5177);
(async () => {
  const out = process.argv[2] || 'shots'; const mobile = process.argv[3] === 'mobile';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
  const p = await b.newPage(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('http://localhost:5177/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const marks = JSON.parse(process.argv[4] || 'null') || [
    ['a00', 'arrival', 0], ['a20', 'arrival', .2], ['a40', 'arrival', .4], ['a55', 'arrival', .55], ['a68', 'arrival', .68], ['a78', 'arrival', .78], ['a95', 'arrival', .95],
    ['room1', 'room', 0.15], ['room2', 'room', 0.45], ['room3', 'room', 0.8],
    ['t03', 'table', .03], ['t20', 'table', .2], ['t36', 'table', .36], ['t44', 'table', .44], ['t62', 'table', .62], ['t80', 'table', .8], ['t95', 'table', .95],
    ['menu1', 'menu', .05], ['menu2', 'menu', .5], ['night', 'night', .3], ['outro', 'outro', .7],
  ];
  for (const [name, id, f] of marks) {
    await p.evaluate(([id, f]) => {
      const el = document.getElementById(id) || document.querySelector(`[data-stage="${id}"]`);
      const top = el.getBoundingClientRect().top + scrollY;
      const pinned = el.matches('[data-stage="arrival"],[data-stage="table"]');
      const span = pinned ? el.offsetHeight - innerHeight : el.offsetHeight;
      window.scrollTo(0, top + span * f);
    }, [id, f]);
    await p.waitForTimeout(1300);
    await p.screenshot({ path: `${out}/${name}.jpg`, quality: 70, type: 'jpeg' });
  }
  await b.close(); srv.close();
})();
