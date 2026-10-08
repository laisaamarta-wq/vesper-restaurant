/* ==========================================================
   VESPER — scroll-driven camera
   The camera is the visitor. Native scrolling stays untouched;
   scroll position only drives what the camera sees.
   ========================================================== */
(() => {
'use strict';

/* ---------- art direction data (normalised to each image) ----------
   door: the glass opening of the entrance, as seen in each photo
   plate: bounding box of the cut-out dish inside the table photo   */
const ART = window.VESPER_ART || {
  ext:   { w: 5504, h: 3072, door: { x: .4375, y: .272, w: .130, h: .453 }, arch: .245 },
  door:  { w: 5504, h: 3072, door: { x: .369,  y: .054, w: .261, h: .842 }, arch: .222 },
  table: { w: 2528, h: 1696, plate:{ x: .1576, y: .3416, w: .6990, h: .5766 } },
};

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
// the phone experience: any touch device, or any window narrow enough to get the phone layout
const NARROW = matchMedia('(max-width: 760px)');
const PHONE = () => !FINE || NARROW.matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const map = (v, a, b) => clamp((v - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;        // inOutCubic
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;

let vw = innerWidth, vh = innerHeight;

/* cover-fit: where does a normalised rect inside an image land on screen? */
function coverRect(img, r) {
  const s = Math.max(vw / img.w, vh / img.h);
  const dw = img.w * s, dh = img.h * s;
  const ox = (vw - dw) / 2, oy = (vh - dh) / 2;
  return { x: ox + r.x * dw, y: oy + r.y * dh, w: r.w * dw, h: r.h * dh, cx: ox + (r.x + r.w / 2) * dw, cy: oy + (r.y + r.h / 2) * dh };
}
/* transform that maps point P to F and scales by Z (transform-origin 0 0) */
const camT = (P, F, Z) => `translate3d(${F.x - P.x * Z}px, ${F.y - P.y * Z}px, 0) scale(${Z})`;

/* ==========================================================
   LOADER
   ========================================================== */
const loaderLine = $('.loader__line span');
function boot() {
  const critical = $$('[data-layer="ext"] img, [data-layer="door"] img, [data-layer="int"] img');
  let done = 0;
  const step = () => { done++; loaderLine && loaderLine.style.setProperty('--p', done / critical.length); if (done >= critical.length) finish(); };
  let finished = false;
  function finish() {
    if (finished) return; finished = true;
    setTimeout(() => { document.body.classList.remove('is-loading'); $('[data-hero]').classList.add('is-in'); }, 350);
  }
  // wait until each frame is decoded, not just downloaded, so the street never flashes black
  const ready = img => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(step);
  critical.forEach(img => {
    if (img.complete && img.naturalWidth) ready(img);
    else { img.addEventListener('load', () => ready(img), { once: true }); img.addEventListener('error', step, { once: true }); }
  });
  setTimeout(finish, 4500);
}

/* ==========================================================
   LIVE STATUS — Riga time
   ========================================================== */
function status() {
  const el = $('[data-status]'); if (!el) return;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Riga', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).map(p => [p.type, p.value]));
  const h = +parts.hour, open = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = parts.weekday, yesterday = { Sun: 'Sat', Mon: 'Sun', Tue: 'Mon', Wed: 'Tue', Thu: 'Wed', Fri: 'Thu', Sat: 'Fri' }[today];
  const time = `${parts.hour}:${parts.minute}`;
  const short = innerWidth < 761;
  let msg;
  if ((open.includes(today) && h >= 18) || (open.includes(yesterday) && h < 1)) msg = `Riga ${time} · <span style="color:var(--amber)">●</span> Open now`;
  else if (open.includes(today)) msg = short ? `Riga ${time} · Open from 18:00` : `Riga ${time} · Doors open tonight at 18:00`;
  else msg = short ? `Riga ${time} · Opens Tue, 18:00` : `Riga ${time} · Closed tonight · Opens Tuesday, 18:00`;
  el.innerHTML = msg;
}

/* ==========================================================
   STAGE PROGRESS (smoothed, never hijacks scroll)
   ========================================================== */
const stages = $$('[data-stage]').map(el => ({ el, id: el.dataset.stage, top: 0, h: 0, target: 0, p: 0 }));
function measure() {
  vw = innerWidth; vh = innerHeight;
  const y = scrollY;
  stages.forEach(s => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.h = s.el.offsetHeight; });
  // the walk ends the moment the doorway has passed the edges of the screen: from there you are in the room
  PIN = coverP(); PEND = Math.min(.95, PIN + .025);
  const a = stages.find(s => s.id === 'arrival');
  // same walking pace as always (2.81 screens of scroll per full camera move on desktop, 2.18 on phones)
  if (a) WALK = clamp((NARROW.matches ? 2.18 : 2.81) * PEND / Math.max(1, a.h / vh - 1), .2, .9);
  ENTER.build();
}
function targets() {
  const y = scrollY;
  stages.forEach(s => {
    if (s.id === 'outro') s.target = clamp((y + vh - s.top) / (s.h + vh));
    else s.target = clamp((y - s.top) / Math.max(1, s.h - vh));
  });
}

/* ==========================================================
   01 ARRIVAL — street → door → room
   ========================================================== */
const A = {
  ext: $('[data-layer="ext"]'), door: $('[data-layer="door"]'), int: $('[data-layer="int"]'),
  glow: $('[data-layer="glow"]'), shade: $('[data-layer="shade"]'), hero: $('[data-hero]'), inside: $('[data-inside]'),
};
let breathe = 0;
/* The arrival stage has two parts.
   WALK  — street → door → through the doorway. It ends exactly when the doorway has passed the
           edges of the screen (PIN, measured for this screen), so there is no held frame after it.
   then  — inside: the room is live at once (look around), and every further scroll moves the camera on,
           turning toward a candle-lit table before the next chapter. Nothing on this stage ever stands still
           while the visitor scrolls. */
let WALK = .5, PIN = .66, PEND = .685;
const camP = raw => PEND * Math.min(1, raw / WALK);
function doorway(p) {
  const De = coverRect(ART.ext, ART.ext.door);
  const C = { x: vw / 2, y: vh * .5 }, Pe = { x: De.cx, y: De.cy };
  // one camera depth for the whole walk-in (log-linear = constant perceived speed). On a tall screen the arched
  // doorway is as tall as the screen itself, so the camera steps further through it to really be inside.
  const Zend = Math.max(vw / De.w, vh / De.h) * (vw < vh ? 1.4 : 1.12);
  const Z = Math.pow(Zend, ease(map(p, 0, .84))) * (1 + breathe);
  const e = easeOut(map(p, .05, .7));
  const F = { x: lerp(Pe.x, C.x, e), y: lerp(Pe.y, C.y, e) };
  const w = De.w * Z, h = De.h * Z;
  return { De, C, Pe, Z, F, w, h, L: F.x - w / 2, T: F.y - h / 2, ry: h * ART.ext.arch };
}
// first camera position at which the arched doorway covers the whole screen (corners included)
function coverP() {
  const keep = breathe; breathe = 0;
  let found = .84;
  for (let p = .3; p <= .84; p += .0025) {
    const g = doorway(p);
    if (g.L > 0 || g.T > 0 || g.L + g.w < vw || g.T + g.h < vh) continue;
    const cx = g.L + g.w / 2, rx = g.w / 2, cy = g.T + g.ry;
    const inArch = x => cy <= 0 || ((x - cx) / rx) ** 2 + ((0 - cy) / g.ry) ** 2 <= 1;
    if (inArch(0) && inArch(vw)) { found = p; break; }
  }
  breathe = keep;
  return found;
}
function arrival(raw) {
  const hold = map(raw, WALK, 1);
  const p = camP(raw);
  const inside = p >= PIN - .001;
  A.isIn = inside;

  if (RM) {                                    // reduced motion: dissolves only
    A.ext.style.opacity = 1 - map(p, .2, .45);
    A.door.style.opacity = 0;
    A.int.style.opacity = map(p, .2, .45); A.int.style.clipPath = 'none';
    A.hero.style.opacity = 1 - map(p, 0, .15);
    A.inside.style.opacity = map(p, .45, PIN) * (P.ok ? P.textK * (1 - map(hold, .08, .3)) : 1); A.inside.classList.toggle('is-in', p > .44);
    A.glow.style.opacity = 0;
    A.F = { x: vw / 2, y: vh / 2 };
    return;
  }

  const g = doorway(p), { De, C, Pe, Z, F } = g;
  const Dd = coverRect(ART.door, ART.door.door);
  A.F = F;

  // exterior — the street
  A.ext.style.transform = camT(Pe, F, Z);
  // door — the same door, photographed closer: locked to the exterior door, so the swap is invisible
  const k = De.h / Dd.h;                         // size ratio between the two photographs' doors
  A.door.style.transform = camT({ x: Dd.cx, y: Dd.cy }, F, Z * k);
  const zSwap = 1 / k;                           // the depth at which the close-up is shown at native resolution
  // swap only once the close-up fully covers the frame (scale ≥ 1), so no edges ever show
  const zc = Math.max(zSwap, 1.04 / k);
  A.door.style.opacity = map(Z, zc, zc * 1.3);
  A.ext.style.opacity = 1 - map(Z, zc * 1.25, zc * 1.4);

  // the doorway becomes the frame of the room (the 360° room is drawn in the same opening, see pano())
  const { w, h, L, T, ry } = g;
  const inset = `${T}px ${vw - (L + w)}px ${vh - (T + h)}px ${L}px`;
  const r = `round ${w / 2}px ${w / 2}px 0 0 / ${ry}px ${ry}px 0 0`;
  A.int.style.clipPath = inside ? 'inset(0 0 0 0)' : `inset(${inset} ${r})`;
  A.int.style.opacity = map(p, .38, .56);
  // the photograph is the fallback if the 360° room can't be shown
  const hd = h / vh;                             // the room is further away than the door: it grows more slowly
  const Zi = inside ? (1 + .06 * easeOut(map(p, PIN, PEND))) * (1 + .06 * hold) : Math.max(.5, Math.min(1, .38 + .62 * hd));
  A.int.style.transform = camT(C, F, Zi);

  // warmth on the threshold, gone as you step in
  A.glow.style.opacity = .75 * Math.sin(Math.PI * map(p, .5, PEND + .03));
  A.shade.style.opacity = 1 - .35 * map(p, .4, PIN);

  // type
  const ho = 1 - map(p, .01, .12);
  A.hero.style.opacity = ho;
  A.hero.style.transform = `translate3d(0, ${-map(p, 0, .15) * 40}px, 0)`;
  A.hero.style.visibility = ho <= 0 ? 'hidden' : '';
  // the line arrives with you, and steps aside on the first look around or as you move on
  const io = map(p, PIN - .04, PEND) * (P.ok ? P.textK * (1 - map(hold, .08, .3)) : 1);
  A.inside.style.opacity = io;
  A.inside.classList.toggle('is-in', p > PIN - .05);
}

/* ==========================================================
   01b INSIDE — the room in 360°
   One continuous panorama of the same room (cylindrical, 360° × ~76°), drawn by a tiny shader:
   every screen pixel becomes a ray, the ray becomes a point on the cylinder. Drag / swipe / a
   sideways trackpad gesture turns the head; vertical scrolling is never taken — it carries the
   visitor on, and on the way out the gaze settles on a candle-lit table (the next chapter).
   The room is first seen through the doorway itself, so stepping in and being able to look around
   are one moment. If WebGL or the image is unavailable, the interior photograph simply stays.
   ========================================================== */
const DEG = Math.PI / 180;
const PANO = {
  u0: .469,                 // texture u that lines up with the interior photograph (forward, toward the bar)
  vc: .47,                  // horizon row of the panorama
  R: 4 / (2 * Math.PI),     // 4:1 texture covering 360°: texture-v per unit of tan(elevation)
  pitch0: -3 * DEG,         // eye level, a touch down — the same as the photograph
  exitYaw: 38 * DEG,        // the table on the right, under the arches
};
const TOP = Math.atan(PANO.vc / PANO.R), BOT = Math.atan((1 - PANO.vc) / PANO.R);
const P = {
  cv: $('[data-pano]'), cue: $('[data-lookcue]'), scue: $('[data-scrollcue]'),
  gl: null, ok: false, loading: false, failed: false, fadeIn: 0,
  yaw: 0, pitch: PANO.pitch0, vy: 0, vp: 0,
  drag: null, touched: false, seen: false, textK: 1, live: false,
  lastAct: 0, cueY: null, movedOn: false,
  uni: null,
};
function panoInit() {
  const cv = P.cv; if (!cv) return;
  let gl = null;
  try { gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) {}
  if (!gl) { P.failed = true; return; }
  const hp = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const prec = hp && hp.precision > 0 ? 'highp' : 'mediump';
  const vs = 'attribute vec2 a; varying vec2 q; void main(){ q = a; gl_Position = vec4(a, 0., 1.); }';
  const fs = `precision ${prec} float;
    varying vec2 q; uniform sampler2D tx; uniform vec4 cam; uniform vec3 pr; uniform vec2 off;
    void main(){
      vec3 d = vec3((q.x - off.x) * cam.z * cam.w, (q.y - off.y) * cam.z, -1.);
      float c = cos(cam.y), s = sin(cam.y);
      float y = d.y * c - d.z * s, z = d.y * s + d.z * c;
      float u = pr.x + (atan(d.x, -z) + cam.x) / 6.2831853;
      float v = pr.y - pr.z * y / length(vec2(d.x, z));
      gl_FragColor = vec4(texture2D(tx, vec2(u, v)).rgb, 1.);
    }`;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { P.failed = true; return; }
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  P.uni = { cam: gl.getUniformLocation(pr, 'cam'), pr: gl.getUniformLocation(pr, 'pr'), tx: gl.getUniformLocation(pr, 'tx'), off: gl.getUniformLocation(pr, 'off') };
  P.gl = gl;
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); P.ok = false; P.failed = true; cv.style.opacity = 0; cv.classList.remove('is-live'); });
  P.cue && ($('[data-lookcue-label]').textContent = FINE ? 'Drag to look around' : 'Swipe to look around');
  bindLook();
  // the hero stays fast: the room is fetched once the page has settled, or as soon as the visitor heads for the door
  addEventListener('load', () => setTimeout(panoLoad, 2500), { once: true });
}
function panoLoad() {
  if (P.loading || P.failed || !P.gl) return;
  P.loading = true;
  const gl = P.gl;
  const big = (gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0) >= 8192;
  const W = big ? 8192 : 4096, H = W / 4;
  const src = `assets/web/interior-360-${W}.webp?v=1`;
  const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);             // the room closes on itself behind you
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(P.uni.tx, 0);
  const ready = () => { if (gl.getError() !== gl.NO_ERROR) { P.failed = true; return; } P.ok = true; };
  const fail = () => { P.failed = true; };
  // decoded off the main thread, then handed to the GPU in four slices on separate frames,
  // so a scroll that is already under way never stalls on one big upload
  const sliced = () => fetch(src).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(b => createImageBitmap(b))
    .then(bmp => {
      if (bmp.width !== W || bmp.height !== H) throw new Error('size');
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, W, H, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
      const N = 4, sw = W / N;
      let i = 0;
      const next = () => {
        if (i >= N) { bmp.close && bmp.close(); return ready(); }
        const x = i * sw; i++;
        createImageBitmap(bmp, x, 0, sw, H)
          .then(part => { gl.bindTexture(gl.TEXTURE_2D, tx); gl.texSubImage2D(gl.TEXTURE_2D, 0, x, 0, gl.RGB, gl.UNSIGNED_BYTE, part); part.close && part.close(); setTimeout(next, 16); })
          .catch(fail);
      };
      next();
    });
  const whole = () => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
      gl.bindTexture(gl.TEXTURE_2D, tx); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); ready();
    });
    img.onerror = fail; img.src = src;
  };
  if (window.createImageBitmap) sliced().catch(() => { if (!P.ok) whole(); }); else whole();
}
const wrapA = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
// vertical field of view for this screen: ~82° across on a desktop, a tall eye-level frame on a phone
function baseV() {
  const asp = vw / vh;
  const v = 2 * Math.atan(Math.tan(41 * DEG) / asp);
  return clamp(v, 40 * DEG, (PHONE() ? 68 : 62) * DEG);
}
let panoV = 1;
function touch() {
  if (!P.touched) { P.touched = true; P.cue && P.cue.classList.remove('is-on'); }
  P.seen = true; P.lastAct = performance.now();
}
function bindLook() {
  const cv = P.cv;
  const perPx = () => panoV / Math.max(1, cv.clientHeight);
  cv.addEventListener('pointerdown', e => {
    if (!P.live || (e.pointerType === 'mouse' && e.button !== 0)) return;
    P.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0, mouse: e.pointerType === 'mouse', moved: false };
    P.vy = P.vp = 0;
    if (P.drag.mouse) { cv.setPointerCapture(e.pointerId); cv.classList.add('is-drag'); e.preventDefault(); }
  });
  cv.addEventListener('pointermove', e => {
    const d = P.drag; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, now = performance.now(), dt = Math.max(1, now - d.t);
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!d.moved) { d.moved = true; touch(); }
    P.lastAct = now;
    const k = perPx();
    P.yaw -= dx * k;
    if (d.mouse) P.pitch += dy * k;                         // on touch, vertical movement belongs to the page
    d.vx = lerp(d.vx, -dx * k / dt, .5); d.vy = lerp(d.vy, d.mouse ? dy * k / dt : 0, .5);
    d.x = e.clientX; d.y = e.clientY; d.t = now;
  });
  const end = e => {
    const d = P.drag; if (!d || d.id !== e.pointerId) return;
    if (!RM && performance.now() - d.t < 90) { P.vy = d.vx; P.vp = d.vy; }   // let go while moving: the head keeps turning, softly
    P.drag = null; cv.classList.remove('is-drag'); P.lastAct = performance.now();
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('lostpointercapture', end);
  // trackpad: a sideways two-finger gesture turns the head; a vertical one still scrolls the page
  cv.addEventListener('wheel', e => {
    if (!P.live || Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2 || e.ctrlKey) return;
    e.preventDefault();
    const px = e.deltaX * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vw : 1);
    touch(); P.yaw += px * perPx() * .9; P.vy = 0;
  }, { passive: false });
  addEventListener('keydown', e => {
    if (!P.live || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.metaKey) return;
    const tg = e.target; if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    touch(); P.vy = (e.key === 'ArrowLeft' ? -1 : 1) * .0016;
  });
}
const showCue = (el, on) => { if (el && on !== el.classList.contains('is-on')) el.classList.toggle('is-on', on); };
function pano(raw, t, dt) {
  const cv = P.cv; if (!cv || !P.gl) return;
  const p = camP(raw), hold = map(raw, WALK, 1);
  const inside = p >= PIN - .001;
  if (!P.loading && raw > .04) panoLoad();
  // back outside: the next entry is welcomed again
  if (p < PIN - .06) { P.seen = false; P.cueY = null; P.movedOn = false; }
  P.textK = lerp(P.textK, P.seen ? 0 : 1, 1 - Math.exp(-dt / 260));
  if (!P.ok) { cv.style.opacity = 0; cv.classList.remove('is-live'); P.live = false; showCue(P.cue, false); showCue(P.scue, false); return; }
  P.fadeIn = Math.min(1, P.fadeIn + dt / 600);              // if the image arrives late, it still fades in
  // the room is seen through the doorway first — same opening, same fade as the photograph it replaces
  const alpha = (RM ? map(p, .2, .45) : map(p, .38, .56)) * P.fadeIn;
  cv.style.opacity = alpha < .002 ? 0 : alpha.toFixed(3);
  cv.style.clipPath = inside || RM ? '' : A.int.style.clipPath;
  P.live = inside && alpha > .6 && hold < .97;
  cv.classList.toggle('is-live', P.live);

  // hints: first "look around"; once the visitor has looked, "scroll to continue" — each disappears as soon as it's done
  showCue(P.cue, !P.touched && P.live && hold < .1);
  if (P.touched && P.live && !P.movedOn) {
    if (P.cueY == null) { if (hold > .1) P.movedOn = true; else if (!P.drag && t - P.lastAct > 650) P.cueY = scrollY; }
    else if (Math.abs(scrollY - P.cueY) > 50 || hold > .14) P.movedOn = true;
  }
  showCue(P.scue, P.cueY != null && !P.movedOn && P.live);
  if (alpha <= 0) return;

  // inertia
  if (!P.drag && (P.vy || P.vp)) {
    P.yaw += P.vy * dt; P.pitch += P.vp * dt;
    const f = Math.exp(-dt / 320); P.vy *= f; P.vp *= f;
    if (Math.abs(P.vy) < 1e-6 && Math.abs(P.vp) < 1e-6) P.vy = P.vp = 0;
  }
  P.pitch = clamp(P.pitch, -BOT + 20 * DEG, TOP - 18 * DEG);
  P.yaw = wrapA(P.yaw);

  // walking in: the room starts wide (seen through the door) and comes to eye level as you step inside
  const enter = RM ? 1 : ease(map(p, .45, PEND));
  // moving on: every bit of scroll turns the gaze toward a candle-lit table and takes a step closer
  const x = RM ? 0 : map(hold, 0, .92), out = 1 - (1 - x) * (1 - x);
  const sway = RM ? 0 : Math.sin(t * .00041) * .35 * DEG * (P.drag ? 0 : 1);
  const yawU = P.yaw + sway;
  const yaw = yawU + wrapA(PANO.exitYaw - yawU) * out;
  const V = lerp(TOP + BOT, baseV(), enter) * lerp(1, .84, out);
  const half = Math.min(V / 2, (TOP + BOT) / 2 - .5 * DEG);
  let pitch = lerp(P.pitch, (PHONE() ? -5 : -7) * DEG, out);
  pitch = clamp(pitch, -BOT + half, TOP - half);
  panoV = half * 2;
  // through the doorway the view is centred on the opening, wherever it is on screen
  const F = A.F || { x: vw / 2, y: vh / 2 };

  // draw
  const gl = P.gl, dpr = Math.min(devicePixelRatio || 1, PHONE() ? 2 : 1.5);
  const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h);
  gl.uniform4f(P.uni.cam, yaw, pitch, Math.tan(half), w / h);
  gl.uniform3f(P.uni.pr, PANO.u0, PANO.vc, PANO.R);
  gl.uniform2f(P.uni.off, (F.x / vw) * 2 - 1, 1 - (F.y / vh) * 2);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ==========================================================
   03 TABLE → DISH → MENU
   ========================================================== */
const T = {
  cam: $('[data-table-cam]'), shade: $('[data-table-shade]'), label: $('[data-table-label]'),
  dish: $('[data-dish]'), tilt: $('[data-dish-tilt]'), shadow: $('[data-dish-shadow]'),
  copy: $('[data-dishcopy]'), open: $('[data-menuopen]'),
};
let hero = { w: 600, h: 450 };                    // fixed CSS size of the dish element (= its hero size)
const PUSH = () => (vw < 961 ? 1.06 : 1.08);      // how far the camera walks toward the table
function sizeDish() {
  const R0 = coverRect(ART.table, ART.table.plate);
  const pr = R0.w / R0.h;
  let w, h;
  if (vw < 961) { w = vw * .94; h = w / pr; }      // phone: the plate is isolated and settles into the frame
  else { h = R0.h * 1.04; w = h * pr; }            // desktop: the plate keeps its size and rises a little
  hero = { w, h };
  T.dish.style.width = w + 'px'; T.dish.style.height = h + 'px';
  dishGL && dishGL.resize(w, h);
  steam && steam.resize();
}
let tilt = { x: 0, y: 0, tx: 0, ty: 0 };
function table(p, t) {
  const mobile = vw < 961;
  const R0 = coverRect(ART.table, ART.table.plate);
  const P = { x: R0.cx, y: R0.cy };
  const heroC = mobile ? { x: vw / 2, y: vh * .38 } : { x: vw * .28, y: vh * .5 };
  const menuC = mobile ? { x: vw * .5, y: vh * .72 } : { x: vw * .73, y: vh * .52 };
  const menuS = mobile ? .62 : .55;

  // One continuous move, ~2 viewport heights of scrolling in total:
  // 0 → .14 frame opens · 0 → .30 camera approaches · .12 → .36 room falls away, plate lifts
  // .30 → .56 the dish holds (copy + depth) · .56 → .80 plate settles into the menu · .80 → 1 menu opening
  const open = easeOut(map(p, 0, .14));
  const ix = lerp(mobile ? 6 : 16, 0, open), iy = lerp(mobile ? 14 : 13, 0, open);
  T.cam.style.clipPath = RM ? 'none' : `inset(${iy}vh ${ix}vw ${iy}vh ${ix}vw)`;

  const a = ease(map(p, 0, .3));
  const Z = RM ? 1 : lerp(1, PUSH(), a);
  let tx = lerp(P.x, heroC.x, a) - P.x * Z, ty = lerp(P.y, heroC.y, a) - P.y * Z;
  tx = clamp(tx, vw - vw * Z, 0); ty = clamp(ty, vh - vh * Z, 0);
  const F = { x: tx + P.x * Z, y: ty + P.y * Z };
  T.cam.style.transform = RM ? 'none' : camT(P, F, Z);

  // label: already readable as the table arrives, gone before the plate lifts
  const lo = 1 - map(p, .06, .13);
  T.label.style.opacity = lo;
  T.label.style.transform = `translate3d(0, ${-map(p, .06, .13) * 16}px, 0)`;

  // the room falls away
  const fall = map(p, .14, .32);
  T.shade.style.opacity = fall;
  T.cam.style.filter = fall > 0 && fall < 1 && !RM ? `blur(${fall * 8}px)` : '';
  T.cam.style.opacity = 1 - map(p, .3, .34);

  // the dish: glued to the photograph, then it lifts and becomes the object
  const glued = { x: F.x + (R0.x - P.x) * Z, y: F.y + (R0.y - P.y) * Z, w: R0.w * Z, h: R0.h * Z };
  let rect = glued;
  const lift = ease(map(p, .12, .36));
  const go = ease(map(p, .56, .8));
  if (go > 0) {
    const w = hero.w * lerp(1.03, menuS, go), h = hero.h * lerp(1.03, menuS, go);
    const cx = lerp(heroC.x, menuC.x, go), cy = lerp(heroC.y - hero.h * .03, menuC.y, go);
    rect = { x: cx - w / 2, y: cy - h / 2, w, h };
  } else if (lift > 0) {
    // separates from the table: drifts to its place in the frame and rises a few percent toward the viewer
    const w = lerp(glued.w, hero.w * 1.03, lift), h = lerp(glued.h, hero.h * 1.03, lift);
    const cx = lerp(glued.x + glued.w / 2, heroC.x, lift), cy = lerp(glued.y + glued.h / 2, heroC.y - hero.h * .03, lift);
    rect = { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  const float = RM ? 0 : Math.sin(t * .0009) * 3 * lift * (1 - go);
  if (RM) {
    const k = p < .56 ? 1 : menuS, w = hero.w * k, h = hero.h * k, c = p < .56 ? heroC : menuC;
    rect = { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }
  T.dish.style.transform = `translate3d(${rect.x}px, ${rect.y + float}px, 0) scale(${rect.w / hero.w})`;
  T.dish.style.opacity = RM ? map(p, .2, .3) : (p > .1 ? 1 : 0);
  T.shadow.style.opacity = map(p, .16, .34) * .9;
  T.dish.dataset.live = p > .1 && p < .995 ? '1' : '0';

  // subtle physical response to the cursor (auto-drift on touch)
  if (!RM) {
    const idle = !FINE || !pointer.active;
    const tx = idle ? Math.sin(t * .00045) * .6 : pointer.nx;
    const ty = idle ? Math.cos(t * .00037) * .4 : pointer.ny;
    tilt.x = lerp(tilt.x, tx, .06); tilt.y = lerp(tilt.y, ty, .06);
    const k = lift * (1 - go * .7);
    T.tilt.style.transform = `perspective(1400px) rotateX(${-tilt.y * 3.2 * k}deg) rotateY(${tilt.x * 4.2 * k}deg)`;
    dishGL && dishGL.set(tilt.x * k, tilt.y * k, t, lift);
  }

  // copy
  const co = map(p, .28, .36) * (1 - map(p, .54, .6));
  T.copy.style.opacity = co;
  T.copy.style.transform = mobile ? `translate3d(0, ${(1 - map(p, .28, .38)) * 18}px, 0)` : `translate3d(0, calc(-50% + ${(1 - map(p, .28, .38)) * 18}px), 0)`;
  T.copy.classList.toggle('is-in', p > .28 && p < .6);
  T.copy.classList.toggle('is-live', co > .6);

  const mo = map(p, .66, .8);
  T.open.style.opacity = mo;
  T.open.classList.toggle('is-in', p > .66);

  steam && steam.active(p > .3 && p < .64 ? lift * (1 - go) : 0);
}

/* ==========================================================
   DISH — WebGL depth parallax + moving light
   One photograph, a hand-built depth map: plate low, food high.
   Pixels are displaced (never duplicated), so there is no ghosting.
   ========================================================== */
let dishGL = null;
function initDishGL() {
  if (RM) return;
  const canvas = $('[data-dish-gl]');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return;
  const vs = `attribute vec2 p; varying vec2 v; void main(){ v = p*.5+.5; v.y = 1.-v.y; gl_Position = vec4(p,0.,1.); }`;
  const fs = `precision mediump float;
    varying vec2 v; uniform sampler2D c; uniform sampler2D d; uniform vec2 m; uniform float t; uniform float l; uniform vec2 px;
    void main(){
      float dep = texture2D(d, v).r;
      vec2 off = m * (dep - .42) * .022;
      vec2 uv = v - off;
      float dd = texture2D(d, uv).r;
      uv = v - m * (dd - .42) * .022;
      vec4 col = texture2D(c, uv);
      // normal from depth → a soft light that drifts across the glaze and butter
      float dx = texture2D(d, uv + vec2(px.x*3.,0.)).r - texture2D(d, uv - vec2(px.x*3.,0.)).r;
      float dy = texture2D(d, uv + vec2(0.,px.y*3.)).r - texture2D(d, uv - vec2(0.,px.y*3.)).r;
      vec3 n = normalize(vec3(-dx*6., -dy*6., 1.));
      vec3 L = normalize(vec3(-.45 + sin(t*.00025)*.35 + m.x*.5, -.55 + m.y*.4, .75));
      float spec = pow(max(dot(reflect(-L, n), vec3(0.,0.,1.)), 0.), 18.);
      float shade = .94 + .1 * dot(n, L);
      vec3 rgb = col.rgb * shade + vec3(1., .86, .66) * spec * .16 * col.a * l * smoothstep(.45,.75,dd);
      gl_FragColor = vec4(rgb, col.a);
    }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const uc = U('c'), ud = U('d'), um = U('m'), ut = U('t'), ul = U('l'), upx = U('px');
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const tex = (unit, img) => {
    const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  };
  const load = src => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  let ready = false, iw = 1, ih = 1;
  const state = { mx: 0, my: 0, t: 0, l: 0, dirty: true };
  Promise.all([load($('[data-dish-img]').getAttribute('src')), load('assets/web/dish-signature-depth.webp')]).then(([c, d]) => {
    iw = c.naturalWidth; ih = c.naturalHeight;
    tex(0, c); tex(1, d); gl.uniform1i(uc, 0); gl.uniform1i(ud, 1);
    ready = true; T.dish.classList.add('has-gl'); state.dirty = true; draw();
  }).catch(() => {});
  function draw() {
    if (!ready) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(um, state.mx, state.my); gl.uniform1f(ut, state.t); gl.uniform1f(ul, state.l);
    gl.uniform2f(upx, 1 / iw, 1 / ih);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  dishGL = {
    resize(w, h) { const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); draw(); },
    set(mx, my, t, l) {
      if (T.dish.dataset.live !== '1') return;
      state.mx = mx; state.my = my; state.t = t; state.l = l; draw();
    },
  };
}

/* ---------- steam: a few soft, slow, almost invisible wisps ---------- */
let steam = null;
function initSteam() {
  if (RM) return;
  const c = $('[data-dish-steam]'); const x = c.getContext('2d');
  let W = 0, H = 0, amt = 0, parts = [];
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 128;
  const sx = sprite.getContext('2d'); const g = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,246,232,.9)'); g.addColorStop(.5, 'rgba(255,246,232,.25)'); g.addColorStop(1, 'rgba(255,246,232,0)');
  sx.fillStyle = g; sx.fillRect(0, 0, 128, 128);
  const spawn = () => ({ x: .36 + Math.random() * .3, y: .78 + Math.random() * .06, r: .05 + Math.random() * .05, life: 0, max: 5000 + Math.random() * 4000, drift: (Math.random() - .5) * .00002, ph: Math.random() * 6.28 });
  for (let i = 0; i < 16; i++) { const s = spawn(); s.life = Math.random() * s.max; parts.push(s); }
  let last = 0;
  steam = {
    resize() { const r = c.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 1.5); W = c.width = Math.max(1, r.width * dpr); H = c.height = Math.max(1, r.height * dpr); },
    active(a) { amt = a; },
    tick(t) {
      const dt = Math.min(50, t - (last || t)); last = t;
      if (amt <= .01) { if (c.dataset.clear !== '1') { x.clearRect(0, 0, W, H); c.dataset.clear = '1'; } return; }
      c.dataset.clear = '0';
      x.clearRect(0, 0, W, H);
      parts.forEach((s, i) => {
        s.life += dt; if (s.life > s.max) { parts[i] = spawn(); return; }
        const k = s.life / s.max;
        const y = s.y - k * .62;
        const xx = s.x + Math.sin(s.ph + k * 3.2) * .05 + s.drift * s.life;
        const r = s.r * (1 + k * 2.6);
        const a = Math.sin(Math.PI * k) * .032 * amt;
        x.globalAlpha = a;
        x.drawImage(sprite, (xx - r) * W, (y - r) * H, r * 2 * W, r * 2 * W);
      });
    },
  };
}

/* ==========================================================
   02 THE ROOM — words lit as you read, images revealed
   ========================================================== */
const words = [];
function splitWords() {
  $$('[data-words]').forEach(el => {
    const txt = el.textContent.trim().split(/\s+/);
    el.innerHTML = txt.map(w => `<span class="w">${w}</span>`).join(' ');
    words.push(el);
  });
}
function lightWords() {
  words.forEach(el => {
    const r = el.getBoundingClientRect();
    const k = clamp((vh * .85 - r.top) / (r.height + vh * .35));
    const ws = el.children, n = Math.floor(k * ws.length * 1.05);
    for (let i = 0; i < ws.length; i++) ws[i].classList.toggle('on', i < n);
  });
}
const plates = $$('[data-reveal]');
function plateParallax() {
  if (RM) return;
  plates.forEach(pl => {
    const r = pl.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const k = (r.top + r.height / 2 - vh / 2) / vh;
    pl.style.setProperty('--py', `${k * -4}%`);
  });
}

/* ==========================================================
   NIGHT + OUTRO
   ========================================================== */
const nightBg = $('[data-night-bg] img'), outroImg = $('[data-outro-img] img'), night = $('#reserve');
function nightFx() {
  if (RM) return;
  const r = night.getBoundingClientRect();
  if (r.bottom > 0 && r.top < vh) nightBg.style.transform = `translate3d(0, ${((r.top + r.height / 2) - vh / 2) * -.08}px, 0) scale(1.06)`;
  const o = stages.find(s => s.id === 'outro');
  if (o) outroImg.style.transform = `scale(${lerp(1.16, 1.0, easeOut(o.p))})`;   // a slow step back into the street
}

/* ==========================================================
   CHAPTER INDICATOR + NAV
   ========================================================== */
const chapters = $$('[data-chapter-id]');
const chNum = $('[data-chapter-num]'), chName = $('[data-chapter-name]'), chBar = $('[data-chapter-bar]'), chEl = $('[data-chapter]');
let lastY = 0;
const nav = $('[data-nav]');
function chrome() {
  const y = scrollY;
  let cur = chapters[0];
  for (const c of chapters) if (c.getBoundingClientRect().top <= vh * .5) cur = c;
  let [n, name] = cur.dataset.chapterId.split('|');
  if (cur === chapters[0] && A.isIn) [n, name] = ['02', 'The Room'];   // through the door, the room's chapter has begun
  if (chNum.textContent !== n) { chNum.textContent = n; chName.textContent = name; }
  const r = cur.getBoundingClientRect();
  chBar.parentElement.style.setProperty('--cp', clamp((vh * .5 - r.top) / r.height).toFixed(3));
  // hide over the dish copy and the hero title (they already speak)
  const arr = stages[0];
  // only shown in the cinematic chapters; it would compete with the menu and the form
  const quiet = ['menu', 'reserve'].some(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.top < vh * .9 && r.bottom > vh * .1; });
  chEl.classList.toggle('is-hidden', arr.p < .1 || quiet);
  // nav: out of the way while descending, back when the visitor looks up
  const dy = y - lastY;
  if (Math.abs(dy) > 4) { nav.classList.toggle('is-hidden', dy > 0 && y > vh * .4 && !sheetOpen); lastY = y; }
  nav.classList.toggle('is-solid', y > vh * .2);
}

/* mobile sheet */
let sheetOpen = false;
const sheet = $('[data-sheet]'), toggle = $('[data-sheet-toggle]');
function setSheet(open) {
  sheetOpen = open;
  toggle.setAttribute('aria-expanded', open);
  if (open) { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('is-open')); document.body.style.overflow = 'hidden'; }
  else { sheet.classList.remove('is-open'); document.body.style.overflow = ''; setTimeout(() => { if (!sheetOpen) sheet.hidden = true; }, 700); }
}
toggle.addEventListener('click', () => setSheet(!sheetOpen));
$$('[data-sheet-close]').forEach(a => a.addEventListener('click', () => setSheet(false)));
addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen) setSheet(false); });

/* in-page links: land on the meaningful frame of a pinned stage */
function jump(e) {
  const href = e.currentTarget.getAttribute('href'); if (!href || href[0] !== '#') return;
  let y = null;
  const arr = stages.find(s => s.id === 'arrival'), tab = stages.find(s => s.id === 'table');
  if (href === '#room' && e.currentTarget.hasAttribute('data-enter')) { y = arr.top + (arr.h - vh) * WALK + 1; panoLoad(); }   // walk in
  else if (href === '#menu' && e.currentTarget.hasAttribute('data-to-menu')) y = tab.top + (tab.h - vh) * .9;
  else if (href === '#top') y = 0;
  else { const t = $(href); if (t) y = t.getBoundingClientRect().top + scrollY - (href === '#reserve' ? 40 : 0); }
  if (y == null) return;
  e.preventDefault();
  // touch: ENTER walks the same camera path as a scroll would, at walking pace —
  // it drives the page through the arrival timeline instead of the browser's quick smooth-scroll
  if (PHONE() && e.currentTarget.hasAttribute('data-enter')) {
    // reduced motion: no camera walk, but still a calm dissolve into the room rather than a cut
    return RM ? glide(() => arr.top + (arr.h - vh) * WALK + 1, 1600) : enterGlide(arr);
  }
  scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
}
/* ENTER on touch: paced by what the camera does, not by scroll distance.
   The arrival choreography already eases the camera; driving scroll with another ease on top
   squeezed the whole walk into one second. Here the camera's own progress is laid out in time:
   a soft first step, an even walk, an unhurried crossing of the threshold while the room fades in,
   and one continuous settle into the room — no pause between "outside" and "inside". */
const easeInv = x => x < .5 ? Math.cbrt(x / 4) : 1 - Math.cbrt(2 * (1 - x)) / 2;   // inverse of ease()
const ENTER = (() => {
  // the camera's own progress (x: 0 → 1 over the walk) laid out in time:
  // a soft first step, an even walk, an unhurried crossing of the threshold, and you are in
  const SPLIT = .78, N = 1000, tbl = new Float32Array(N + 1);
  let cE = .7, xd = .65;
  const dens = x => 1 + 1.6 * Math.exp(-((x / .07) ** 2)) + .75 * Math.exp(-(((x - xd) / .11) ** 2)) + .35 * Math.exp(-(((1 - x) / .08) ** 2));
  function build() {
    cE = SPLIT * ease(Math.min(1, PEND / .84)); xd = Math.min(.9, .47 / cE);
    let acc = 0; for (let i = 1; i <= N; i++) { acc += dens((i - .5) / N); tbl[i] = acc; }
    for (let i = 1; i <= N; i++) tbl[i] /= acc;
  }
  const cAt = tau => { let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tbl[m] < tau) lo = m; else hi = m; }
    const f = (tau - tbl[lo]) / Math.max(1e-6, tbl[hi] - tbl[lo]); return (lo + f) / N; };
  const tauAt = x => tbl[Math.min(N, Math.max(0, Math.floor(x * N)))];
  const pOf = x => .84 * easeInv(Math.min(1, x * cE / SPLIT));          // camera progress → camera position p
  const xOf = p => SPLIT * ease(Math.min(1, p / .84)) / cE;
  build();
  return { build, cAt, tauAt, pOf, xOf, T: 2300 };
})();
function enterGlide(arr) {
  if (gliding) gliding();
  const span = () => (arr.h - vh) * WALK;
  const p0 = PEND * clamp((scrollY - arr.top) / Math.max(1, span()));
  const tau0 = ENTER.tauAt(ENTER.xOf(p0));
  if (tau0 >= .995) return;
  const dur = ENTER.T * (1 - tau0), t0 = performance.now();
  let raf = 0;
  const stop = () => { cancelAnimationFrame(raf); gliding = null; ['touchstart', 'wheel', 'keydown'].forEach(ev => removeEventListener(ev, stop)); };
  ['touchstart', 'wheel', 'keydown'].forEach(ev => addEventListener(ev, stop, { passive: true }));   // a finger always wins
  const step = now => {
    const k = clamp((now - t0) / dur);
    const p = ENTER.pOf(ENTER.cAt(tau0 + (1 - tau0) * k));
    window.scrollTo(0, arr.top + span() * Math.min(1, p / PEND) + (k >= 1 ? 1 : 0));
    if (k < 1) raf = requestAnimationFrame(step); else stop();
  };
  gliding = stop;
  raf = requestAnimationFrame(step);
}
let gliding = null;
const easeWalk = t => .5 - Math.cos(Math.PI * t) / 2;            // inOutSine: a soft first step, a soft arrival
function glide(targetY, dur) {
  if (gliding) gliding();
  const y0 = scrollY, t0 = performance.now();
  let raf = 0;
  const stop = () => { cancelAnimationFrame(raf); gliding = null; ['touchstart', 'wheel', 'keydown'].forEach(ev => removeEventListener(ev, stop)); };
  // the visitor can take over at any moment with a finger, wheel or key
  ['touchstart', 'wheel', 'keydown'].forEach(ev => addEventListener(ev, stop, { passive: true }));
  const step = now => {
    const k = clamp((now - t0) / dur);
    window.scrollTo(0, lerp(y0, targetY(), easeWalk(k)));   // target re-read each frame: toolbar collapse can change vh
    if (k < 1) raf = requestAnimationFrame(step); else stop();
  };
  gliding = stop;
  raf = requestAnimationFrame(step);
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', jump));

/* ==========================================================
   04 MENU — one interaction: the plate follows the cursor
   ========================================================== */
/* touch menu: one photograph at a time, shown when its dish reaches the reading area.
   Each photo loads only as its dish approaches; a dish has to rest in the reading band for a beat
   before its photograph appears, so a quick flick never flashes images. The layer sits inside the
   list and scrolls with it — no drift of its own — and nothing here ever touches the scroll. */
function dishFloat(items) {
  const host = $('[data-menu]'); if (!host) return;
  const mk = () => { const f = document.createElement('div'); f.className = 'dishfloat'; f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<div class="dishfloat__in"><img alt="" decoding="async"></div>'; host.appendChild(f); return f; };
  const layers = [mk(), mk(), mk()];
  let flip = 0, cur = null, curLayer = null, raf = 0, live = false, cand = null, candT = 0;
  const cache = new Map();
  const load = li => { if (!PHONE()) return null; if (cache.has(li)) return cache.get(li); const im = new Image(); im.decoding = 'async'; im.src = li.dataset.img; cache.set(li, im); return im; };
  const row = li => $('.mi__row', li) || li;
  const IN_A = .30, IN_B = .64, STAY_A = .14, STAY_B = .80, DWELL = 160;   // fractions of the viewport; ms
  const line = li => { const r = row(li).getBoundingClientRect(); return (r.top + r.height / 2) / vh; };
  function place(layer, li) {
    // sit just above the dish name, so the dish itself and what comes next stay readable
    const r = row(li), h = layer.offsetHeight || 260;
    const top = r.getBoundingClientRect().top - host.getBoundingClientRect().top;
    layer.style.top = Math.max(0, top - h - 18) + 'px';
  }
  function show(li) {
    if (curLayer) { const old = curLayer; old.classList.add('is-out'); old.classList.remove('is-on');
      setTimeout(() => old.classList.remove('is-out'), 1200); }
    cur = li; curLayer = null;
    if (!li) return;
    const layer = layers[flip = (flip + 1) % layers.length], img = $('img', layer), src = load(li);
    layer.classList.remove('is-out', 'is-on');
    img.src = li.dataset.img; place(layer, li);
    curLayer = layer;
    const go = () => { if (cur === li) requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('is-on'))); };
    (src.decode ? src.decode() : Promise.resolve()).catch(() => {}).then(go);
  }
  function tick(now) {
    raf = 0; if (!live) return;
    if (!PHONE()) { if (cur) show(null); cand = null; return; }
    if (cur) { const c = line(cur); if (c < STAY_A || c > STAY_B) show(null); }
    if (!cur) {
      let best = null, bd = 1;
      items.forEach(li => { const c = line(li); if (c >= IN_A && c <= IN_B && Math.abs(c - .47) < bd) { bd = Math.abs(c - .47); best = li; } });
      if (best !== cand) { cand = best; candT = now; }
      if (cand && now - candT >= DWELL) show(cand);
      else if (cand) ask();                 // keep watching until the dish has rested long enough
    }
  }
  const ask = () => { if (!raf) raf = requestAnimationFrame(tick); };
  // load each photograph only as its dish comes within about a screen of the reading line
  const near = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { load(e.target); near.unobserve(e.target); } }), { rootMargin: '0px 0px 90% 0px' });
  items.forEach(li => near.observe(li));
  new IntersectionObserver(es => es.forEach(e => {
    live = e.isIntersecting; if (live) ask(); else if (cur) show(null);
  })).observe(host);
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', () => { if (cur && curLayer) place(curLayer, cur); ask(); }, { passive: true });
}

function menu() {
  const items = $$('.mi[data-img]');
  // touch: no hover, so the room shows you the dish as you pass it.
  if (items.length) dishFloat(items);   // active whenever PHONE() is true — re-checked on resize
  // index highlight
  const links = $$('[data-mi]');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(l => l.classList.toggle('is-on', l.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('.mcat').forEach(s => io.observe(s));

  if (!FINE) return;
  const peek = $('[data-peek]'), pimg = $('img', peek);
  let on = false, px = 0, py = 0, cx = 0, cy = 0;
  items.forEach(li => {
    li.addEventListener('mouseenter', () => { if (NARROW.matches) return; pimg.src = li.dataset.img; on = true; peek.classList.add('is-on'); });
    li.addEventListener('mouseleave', () => { on = false; peek.classList.remove('is-on'); });
  });
  addEventListener('mousemove', e => { px = e.clientX; py = e.clientY; }, { passive: true });
  const loop = () => {
    cx = lerp(cx, px + 250, .12); cy = lerp(cy, py - 10, .12);
    peek.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${on ? 1 : .85}) rotate(${(px + 250 - cx) * .02}deg)`;
    requestAnimationFrame(loop);
  };
  loop();
}

/* ==========================================================
   05 RESERVATION (concept — nothing is booked)
   ========================================================== */
function reservation() {
  const form = $('[data-res]'); if (!form) return;
  const dates = $('[data-dates]'), times = $('[data-times]'), out = $('[data-guests-out]'), done = $('[data-res-done]');
  let guests = 2, date = null, time = null;
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Riga' });
  const now = new Date();
  const seeded = n => { const s = Math.sin(n * 9301 + 49297) * 233280; return s - Math.floor(s); };
  let firstOpen = null;
  for (let i = 0; i < 16; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    const wd = d.getDay(); const closed = wd === 0 || wd === 1;
    const [w, dm] = (() => { const p = fmt.formatToParts(d); const g = t => (p.find(x => x.type === t) || {}).value; return [g('weekday'), `${g('day')} ${g('month')}`]; })();
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio');
    b.innerHTML = `<small>${i === 0 ? 'Tonight' : i === 1 ? 'Tomorrow' : w}</small>${dm}`;
    b.setAttribute('aria-checked', 'false'); b.disabled = closed; if (closed) b.title = 'Closed Sundays and Mondays';
    b.dataset.v = `${w} ${dm}`; b.dataset.seed = d.getDate() + d.getMonth() * 31;
    dates.appendChild(b);
    if (!closed && !firstOpen) firstOpen = b;
  }
  const slots = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];
  function renderTimes(seed) {
    times.innerHTML = '';
    slots.forEach((s, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio'); b.textContent = s;
      b.disabled = seeded(seed * 13 + i) < .22; b.setAttribute('aria-checked', 'false'); b.dataset.v = s;
      times.appendChild(b);
    });
    time = null;
    const pref = $$('.chip:not(:disabled)', times).find(b => b.dataset.v === '20:00') || $('.chip:not(:disabled)', times);
    pref && pick(times, pref);
  }
  function pick(group, b) {
    $$('.chip', group).forEach(c => c.setAttribute('aria-checked', c === b ? 'true' : 'false'));
    if (group === dates) { date = b.dataset.v; renderTimes(+b.dataset.seed); } else time = b.dataset.v;
  }
  dates.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b && !b.disabled) pick(dates, b); });
  times.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b && !b.disabled) pick(times, b); });
  $$('[data-guests]').forEach(b => b.addEventListener('click', () => { guests = clamp(guests + +b.dataset.guests, 1, 8); out.textContent = guests; }));
  firstOpen && pick(dates, firstOpen);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.name.value.trim();
    if (!name) { form.name.focus(); form.name.placeholder = 'A name for the table'; return; }
    done.hidden = false;
    done.innerHTML = `Thank you, ${name.replace(/[<>&"]/g, '')}. A table for ${guests}, ${date} at ${time}.<small>Vesper is a concept — no reservation has been made.</small>`;
  });
}

/* ==========================================================
   POINTER
   ========================================================== */
const pointer = { nx: 0, ny: 0, active: false };
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  pointer.nx = (e.clientX / vw) * 2 - 1; pointer.ny = (e.clientY / vh) * 2 - 1; pointer.active = true;
}, { passive: true });
document.addEventListener('mouseleave', () => { pointer.active = false; });

/* ==========================================================
   LOOP
   ========================================================== */
let lastT = 0;
function frame(t) {
  const dt = Math.min(64, t - (lastT || t)); lastT = t;
  targets();
  const k = RM ? 1 : 1 - Math.exp(-dt / 110);          // gentle inertia, ~0.1s
  stages.forEach(s => { s.p += (s.target - s.p) * k; if (Math.abs(s.target - s.p) < .0001) s.p = s.target; });
  const arr = stages.find(s => s.id === 'arrival'), tab = stages.find(s => s.id === 'table');
  breathe = RM ? 0 : (1 - map(arr.p, 0, .08)) * (Math.sin(t * .00035) * .5 + .5) * .012;
  const inView = s => scrollY + vh > s.top - vh && scrollY < s.top + s.h + vh;
  if (inView(arr)) { arrival(arr.p); pano(arr.p, t, dt); } else P.live = false;
  if (inView(tab)) table(tab.p, t);
  steam && inView(tab) && steam.tick(t);
  lightWords(); plateParallax(); nightFx(); chrome();
  requestAnimationFrame(frame);
}

/* reveal-on-enter */
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }), { threshold: .18 });
$$('[data-reveal], .night__head, .finale__copy').forEach(el => rio.observe(el));

function resize() { measure(); sizeDish(); }
addEventListener('resize', () => { resize(); }, { passive: true });
addEventListener('load', resize);

/* ---------- go ---------- */
splitWords(); status(); setInterval(status, 30000);
initDishGL(); initSteam(); panoInit();
measure(); sizeDish(); menu(); reservation(); boot();
requestAnimationFrame(frame);

})();
