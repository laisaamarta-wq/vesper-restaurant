// Production QA against the deployable file set (what Vercel serves).
// usage: node tools/qa.js <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const ignore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8').split('\n').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const types = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2' };
const srv = http.createServer((q, r) => {
  let rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'index.html';
  if (ignore.some(i => rel === i || rel.startsWith(i + '/'))) { r.writeHead(404); return r.end(); }
  fs.readFile(path.join(root, rel), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(rel)] || 'application/octet-stream' }); r.end(d); });
}).listen(5178);
const views = [['desktop', { viewport: { width: 1440, height: 900 } }],
  ['m375', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }],
  ['m390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }],
  ['m430', { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]];
const stops = [['hero','arrival',0],['door','arrival',.55],['inside','arrival',.95],['room','room',.45],['plate','table',.3],['menuopen','table',.8],['menu','menu',.3],['night','night',.3],['reserve','reserve',.2]];
(async () => {
  const out = process.argv[2] || 'qa'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
  const report = {};
  for (const [name, opts] of views) {
    const p = await b.newPage(opts); const errs = [], fails = [];
    p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => r.status() >= 400 && fails.push(r.status() + ' ' + r.url()));
    p.on('requestfailed', r => fails.push('failed ' + r.url()));
    await p.goto('http://localhost:5178/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
    const loaderGone = await p.evaluate(() => { const l = document.querySelector('.loader'); return !l || getComputedStyle(l).opacity === '0' || l.hidden || getComputedStyle(l).display === 'none' || getComputedStyle(l).visibility === 'hidden'; });
    for (const [label, id, f] of stops) {
      await p.evaluate(([id, f]) => { const el = document.getElementById(id) || document.querySelector(`[data-stage="${id}"]`); const top = el.getBoundingClientRect().top + scrollY; const pinned = el.matches('[data-stage="arrival"],[data-stage="table"]'); window.scrollTo(0, top + (pinned ? el.offsetHeight - innerHeight : el.offsetHeight) * f); }, [id, f]);
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${out}/${name}-${label}.jpg`, quality: 70 });
    }
    const info = await p.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - innerWidth,
      brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => i.getAttribute('src')),
      fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight + ' ' + f.style),
      webgl: !!document.querySelector('[data-dish] canvas, canvas') && !!document.createElement('canvas').getContext('webgl'),
      menuItems: document.querySelectorAll('#menu li, #menu .item, #menu [class*=dish]').length,
    }));
    // interactions
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
    const nav = {};
    if (name !== 'desktop') {
      const t = await p.$('.nav__toggle, [aria-controls], .menu-toggle');
      if (t) { await t.click(); await p.waitForTimeout(500); nav.sheetOpen = await p.evaluate(() => { const s = document.querySelector('.sheet'); return s && !s.hidden; }); await p.screenshot({ path: `${out}/${name}-sheet.jpg`, quality: 70 }); const l = await p.$('.sheet a[href="#menu"], .sheet a'); if (l) { await l.click(); await p.waitForTimeout(2500); } }
    } else {
      const l = await p.$('nav a[href="#menu"], header a[href="#menu"]'); if (l) { await l.click(); await p.waitForTimeout(2500); }
    }
    nav.afterLinkY = await p.evaluate(() => { const m = document.getElementById('menu'); const r = m.getBoundingClientRect(); return { menuTop: Math.round(r.top), menuBottom: Math.round(r.bottom), vh: innerHeight }; });
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(900);
    nav.ctaClicked = await p.evaluate(() => { const v = [...document.querySelectorAll('a[href="#reserve"]')].find(a => { const r = a.getBoundingClientRect(); return r.width && r.top >= 0 && r.bottom <= innerHeight; }); v && v.click(); return v ? v.className || v.textContent.trim() : 'none visible'; });
    await p.waitForTimeout(2500);
    nav.reserveTop = await p.evaluate(() => Math.round(document.getElementById('reserve').getBoundingClientRect().top));
    // reservation flow
    nav.form = await p.evaluate(async () => {
      const f = document.querySelector('[data-res]'); if (!f) return 'no form';
      const chips = [...f.querySelectorAll('[data-dates] .chip:not(:disabled)')]; chips[1] && chips[1].click();
      await new Promise(r => setTimeout(r, 200));
      const t = f.querySelector('[data-times] .chip:not(:disabled)'); t && t.click();
      f.querySelector('[data-guests="1"]').click();
      f.querySelector('#res-name').value = 'Test Guest';
      f.querySelector('[type=submit]').click();
      await new Promise(r => setTimeout(r, 600));
      const d = f.querySelector('[data-res-done]'); return d.hidden ? 'not shown' : d.textContent.trim();
    });
    await p.screenshot({ path: `${out}/${name}-reserved.jpg`, quality: 70 });
    report[name] = { errs, fails, loaderGone, ...info, nav };
    await p.close();
  }
  // reduced motion
  const rm = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const rmErr = [];
  rm.on('pageerror', e => rmErr.push(e.message)); await rm.goto('http://localhost:5178/', { waitUntil: 'networkidle' }); await rm.waitForTimeout(1200);
  await rm.evaluate(() => scrollTo(0, document.getElementById('menu').offsetTop)); await rm.waitForTimeout(800);
  report.reducedMotion = { errs: rmErr };
  console.log(JSON.stringify(report, null, 1));
  await b.close(); srv.close();
})();
