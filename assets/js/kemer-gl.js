/* Nüve Dijital — HTML-in-Canvas katmanı
 *
 * Destekleyen tarayıcılarda (Chrome/Edge 157+) üç bölüm bir WebGL tuvaline taşınır.
 * Bölümün HTML'i yerinde kalır: yazılar seçilir, bağlantılar ve butonlar çalışır.
 * Tuval o HTML'in resmini alıp gölgelendiriciyle işler:
 *   giriş     → kemer mercek (imlecin altını büyütür, gece renklerine çevirir)
 *   manifesto → mürekkep (kaydırdıkça yazı turunç kâğıda yayılıp kurur)
 *   iletişim  → su (imleç turunç yüzeyde dalga yapar)
 * Desteklemeyen tarayıcı, az hareket tercihi ya da ?efektsiz → hiçbir şey değişmez.
 */
(() => {
  const root = document.documentElement;
  let resolveReady;
  window.nuveGLReady = new Promise(r => { resolveReady = r; });
  const finish = v => { if (resolveReady) { resolveReady(v); resolveReady = null; } };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const optOut = /[?&]efektsiz\b/.test(location.search);

  function supported() {
    try {
      const c = document.createElement('canvas');
      c.setAttribute('content', 'drawable');
      return c.content === 'drawable'
        && typeof c.requestPaint === 'function'
        && typeof c.updateElementGeometry === 'function'
        && !!window.WebGL2RenderingContext
        && typeof WebGL2RenderingContext.prototype.texElementSubImage2D === 'function';
    } catch (e) { return false; }
  }
  if (reduced || optOut || !supported()) { finish(false); return; }

  /* ---------------------------------------------------------------- renkler */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const C = { turunc: hex('#FF5B1F'), murekkep: hex('#121212'), kirec: hex('#EFEEE9') };

  /* ---------------------------------------------------------------- GL yardımcıları */
  const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

  const HEAD = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;      // tuval, cihaz pikseli
uniform float uDpr;
uniform float uT;
out vec4 o;
vec2 topUv(){ return vec2(gl_FragCoord.x / uRes.x, 1. - gl_FragCoord.y / uRes.y); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }
vec3 page(vec2 uv, vec3 bg){ vec4 t = texture(uTex, uv); return t.rgb + bg * (1. - t.a); }
`;

  function program(gl, fs) {
    const make = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      loc[name] = gl.getUniformLocation(p, name);
    }
    return { p, loc };
  }

  /* ---------------------------------------------------------------- imleç */
  const ptr = { x: -1, y: -1, t: -1e9, vx: 0, vy: 0, down: false, touch: false };
  addEventListener('pointermove', e => {
    if (ptr.x >= 0) { ptr.vx = e.clientX - ptr.x; ptr.vy = e.clientY - ptr.y; }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now();
    ptr.touch = e.pointerType !== 'mouse';
  }, { passive: true });
  addEventListener('pointerdown', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); ptr.down = true; ptr.touch = e.pointerType !== 'mouse'; islands.forEach(I => I.fx.press && I.fx.press(I, e)); }, { passive: true });
  addEventListener('pointerup', () => { ptr.down = false; }, { passive: true });

  /* ---------------------------------------------------------------- ada: bir bölüm, bir tuval */
  const islands = [];

  function mount(sec, fx) {
    const cv = document.createElement('canvas');
    cv.setAttribute('content', 'drawable');
    cv.className = 'gl-host gl-' + fx.name;
    const parent = sec.parentNode, next = sec.nextSibling;
    sec.before(cv);
    cv.append(sec);
    sec.setAttribute('drawable', '');
    const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    const I = { sec, cv, gl, fx, parent, next, tex: null, tw: 0, th: 0, w: 0, h: 0, dpr: 1, vis: false, ready: false, dead: false, sizeOpt: true };
    const undo = () => {
      I.dead = true;
      if (I.ro) I.ro.disconnect();
      if (I.io) I.io.disconnect();
      sec.removeAttribute('drawable');
      cv.replaceWith(sec);
      fx.undo && fx.undo(I);
      const k = islands.indexOf(I);
      if (k >= 0) islands.splice(k, 1);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    };
    I.undo = undo;
    if (!gl) { undo(); return null; }
    try {
      I.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, I.tex);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      I.vao = gl.createVertexArray();
      fx.init(I);
    } catch (e) {
      console.warn('[nüve gl]', fx.name, e);
      undo();
      return null;
    }

    const size = () => {
      if (I.dead) return;
      const w = cv.clientWidth || sec.offsetWidth;
      const h = sec.offsetHeight;
      if (!w || !h) return;
      if (cv.style.height !== h + 'px') cv.style.height = h + 'px';
      I.dpr = Math.min(devicePixelRatio || 1, fx.maxDpr || 2, 4096 / Math.max(w, h));
      const W = Math.round(w * I.dpr), H = Math.round(h * I.dpr);
      I.w = w; I.h = h;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; fx.resize && fx.resize(I); }
      try { cv.updateElementGeometry(sec, { canvasTransform: new DOMMatrix() }); } catch (e) { }
      if (!I.ready) { gl.viewport(0, 0, W, H); gl.clearColor(...fx.bg, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      cv.requestPaint();
    };
    I.size = size;
    let pending = 0;
    I.ro = new ResizeObserver(() => { cancelAnimationFrame(pending); pending = requestAnimationFrame(size); });
    I.ro.observe(sec);
    I.io = new IntersectionObserver(es => { I.vis = es[es.length - 1].isIntersecting; if (I.vis) { cv.requestPaint(); watch(I); } }, { rootMargin: '120px 0px' });
    I.io.observe(cv);

    cv.addEventListener('paint', () => {
      if (I.dead || !I.w) return;
      upload(I);
      draw(I, performance.now());
    });
    size();
    islands.push(I);
    return I;
  }

  function upload(I) {
    const { gl, cv } = I;
    const W = cv.width, H = cv.height;
    gl.bindTexture(gl.TEXTURE_2D, I.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try {
      if (I.sizeOpt) {
        if (I.tw !== W || I.th !== H) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); I.tw = W; I.th = H; }
        try {
          gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, I.sec, { width: W, height: H });
        } catch (e) {
          if (!(e instanceof TypeError)) throw e;
          I.sizeOpt = false;
        }
      }
      if (!I.sizeOpt) {
        const s = cv.getElementImageDefaultSize ? cv.getElementImageDefaultSize(I.sec) : { width: W, height: H };
        const w = Math.max(1, Math.round(s.width)), h = Math.max(1, Math.round(s.height));
        if (I.tw !== w || I.th !== h) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); I.tw = w; I.th = h; }
        gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, I.sec);
      }
      I.ready = true;
    } catch (e) {
      if (!I.err) { I.err = 1; console.warn('[nüve gl] upload', I.fx.name, e); }
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  // Görünür olduğu hâlde resmi gelmeyen ada, düz bölüme geri döner.
  function watch(I) {
    if (I.watching || I.ready) return;
    I.watching = true;
    setTimeout(() => { I.watching = false; if (!I.ready && !I.dead && I.vis) { console.warn('[nüve gl] resim gelmedi:', I.fx.name); I.undo(); } }, 2500);
  }

  function draw(I, now) {
    if (!I.ready || I.dead) return;
    const { gl } = I;
    const r = I.cv.getBoundingClientRect();
    I.rect = r;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, I.cv.width, I.cv.height);
    gl.bindVertexArray(I.vao);
    I.fx.render(I, now / 1000);
  }

  function common(I, P, t) {
    const { gl } = I;
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, I.tex);
    gl.uniform1i(P.loc.uTex, 0);
    gl.uniform2f(P.loc.uRes, I.cv.width, I.cv.height);
    if (P.loc.uDpr) gl.uniform1f(P.loc.uDpr, I.dpr);
    if (P.loc.uT) gl.uniform1f(P.loc.uT, t % 1000);
  }

  /* ================================================================ 1 · kemer mercek */
  const LENS_FS = HEAD + `
uniform vec2 uM;       // merceğin merkezi, cihaz pikseli, üst-sol başlangıç
uniform float uA;      // kemerin yarı genişliği
uniform float uOn;
uniform vec3 uBg, uInk, uPaper, uOr;
float sdArch(vec2 q, float a){           // q: y yukarı, kemerin çember merkezi başlangıç
  float hb = a * 1.05;
  vec2 d = abs(q - vec2(0., -hb * .5)) - vec2(a, hb * .5);
  float box = length(max(d, 0.)) + min(max(d.x, d.y), 0.);
  return min(length(q) - a, box);              // yarım çember + gövde, dikişsiz
}
float arch(vec2 px){ vec2 q = vec2(px.x - uM.x, uM.y - px.y); q.y += uA * .02; return sdArch(q, uA); }
// gündüz ↔ gece: kireç ile mürekkep yer değiştirir, turunç kalır
vec3 night(vec3 c){
  vec3 ax = uPaper - uInk;
  float k = clamp(dot(c - uInk, ax) / dot(ax, ax), 0., 1.);
  vec3 rest = c - (uInk + k * ax);
  return uInk + (1. - k) * ax + rest;
}
void main(){
  vec2 uv = topUv();
  vec2 px = uv * uRes;
  vec3 base = page(uv, uBg);
  float a = uA * uOn;
  if (a < 1.) { o = vec4(base, 1.); return; }
  float d = arch(px);
  // dışarıda yumuşak gölge
  float ds = arch(px - vec2(0., 18. * uDpr));
  float shade = (1. - smoothstep(0., 46. * uDpr, ds)) * step(0., d) * .16 * uOn;
  vec3 col = base * (1. - shade);
  if (d < 2. * uDpr) {
    float e = clamp(-d / (a * .42), 0., 1.);
    float bend = pow(1. - e, 2.4);
    vec2 h = vec2(1.5, 0.);
    vec2 g = normalize(vec2(arch(px + h.xy) - arch(px - h.xy), arch(px + h.yx) - arch(px - h.yx)) + 1e-5);
    vec2 rel = px - uM;
    float zoom = 1.5;
    vec2 s0 = uM + rel / zoom;
    vec2 push = g * bend * a * .22;
    vec3 c;
    c.r = page((s0 + push * 1.10) / uRes, uBg).r;
    c.g = page((s0 + push * 1.00) / uRes, uBg).g;
    c.b = page((s0 + push * .88) / uRes, uBg).b;
    c = night(c);
    c = mix(c, uOr, .05 + .18 * bend);
    float spec = (1. - smoothstep(0., 14. * uDpr, -d)) * max(0., dot(g, normalize(vec2(-.6, -.8))));
    c += vec3(spec * .35);
    float inside = 1. - smoothstep(-1.2 * uDpr, .6 * uDpr, d);
    col = mix(col, c, inside);
    float rim = 1. - smoothstep(.0, 1.6 * uDpr, abs(d + 1.2 * uDpr));
    col = mix(col, uOr, rim * .95);
  }
  o = vec4(col, 1.);
}`;

  const lensFx = {
    name: 'mercek', bg: C.kirec, maxDpr: 1.75,
    init(I) {
      I.P = program(I.gl, LENS_FS);
      I.m = { x: -1, y: -1 }; I.on = 0; I.last = performance.now();
    },
    render(I, t) {
      const { gl } = I, r = I.rect, now = t * 1000;
      const dt = Math.min(.05, Math.max(0, (now - I.last) / 1000)); I.last = now;
      const inside = ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom;
      const recent = now - ptr.t < 2600 && inside;
      let tx, ty;
      if (recent) { tx = ptr.x - r.left; ty = ptr.y - r.top; }
      else {
        // kimse dokunmuyorsa başlığın üstünde yavaşça dolaşır
        const title = I.sec.querySelector('.hero-title');
        const b = title ? title.getBoundingClientRect() : r;
        tx = b.left - r.left + b.width * (.5 + .42 * Math.sin(t * .23));
        ty = b.top - r.top + b.height * (.5 + .32 * Math.sin(t * .37 + 1.3));
      }
      if (I.m.x < 0) { I.m.x = tx; I.m.y = ty; }
      const f = 1 - Math.exp(-dt * (recent ? 11 : 2.2));
      I.m.x += (tx - I.m.x) * f; I.m.y += (ty - I.m.y) * f;
      // giriş sabitlendiği için konumu değil kaydırma miktarını izler
      const fade = 1 - Math.min(1, Math.max(0, scrollY / (innerHeight * .22)));
      const goal = (document.body.classList.contains('is-loading') ? 0 : 1) * fade;
      I.on += (goal - I.on) * (1 - Math.exp(-dt * 5));
      const a = Math.max(58, Math.min(124, innerWidth * .07));
      common(I, I.P, t);
      const L = I.P.loc;
      gl.uniform2f(L.uM, I.m.x * I.dpr, I.m.y * I.dpr);
      gl.uniform1f(L.uA, a * I.dpr);
      gl.uniform1f(L.uOn, I.on);
      gl.uniform3f(L.uBg, ...C.kirec);
      gl.uniform3f(L.uInk, ...C.murekkep);
      gl.uniform3f(L.uPaper, ...C.kirec);
      gl.uniform3f(L.uOr, ...C.turunc);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };

  /* ================================================================ 2 · mürekkep */
  const INK_FS = HEAD + `
uniform float uP;      // ilerleme
uniform vec3 uBg, uInk, uPaper;
float inkOf(vec3 c){ vec3 ax = uBg - uInk; return clamp(dot(uBg - c, ax) / dot(ax, ax), 0., 1.); }
void main(){
  vec2 uv = topUv();
  vec2 px = uv * uRes;
  float sc = uRes.y / uDpr;
  vec3 c = page(uv, uBg);
  float k = inkOf(c);
  // okuma yönünde ilerleyen, lifli bir cephe
  float n = fbm(px / (uDpr * 90.));
  float fib = fbm(px / (uDpr * 9.) + vec2(0., uT * .05));
  float f = uv.y * .78 + uv.x * .22 + (n - .5) * .26 + (fib - .5) * .05;
  float r = clamp((uP - f) / .13, 0., 1.);
  float wet = r * (1. - r) * 4.;
  // ıslak bölgede mürekkep kâğıda taşar
  float kw = k;
  if (wet > .01) {
    float rad = (1. + 4.5 * wet) * uDpr * clamp(uRes.x / uDpr / 1300., .4, 1.);
    float ang = n * 6.283;
    for (int i = 0; i < 6; i++) {
      float an = ang + float(i) * 1.047;
      vec2 off = vec2(cos(an), sin(an)) * rad * (.6 + .8 * hash(px + float(i)));
      kw = max(kw, inkOf(page((px + off) / uRes, uBg)) * (.45 + .4 * fib));
    }
  }
  float shown = max(k * .13, mix(k, kw, wet) * smoothstep(0., .3, r));
  vec3 ink = mix(uInk, vec3(.30, .07, .02), wet * .6);
  vec3 col = mix(uBg, ink, shown);
  col += vec3(1., .95, .85) * pow(fib, 5.) * wet * shown * .6;   // ıslak parıltı
  col *= 1. + (hash(floor(px / uDpr)) - .5) * .03;                  // kâğıt dokusu
  o = vec4(col, 1.);
}`;

  const inkFx = {
    name: 'murekkep', bg: C.turunc,
    init(I) {
      I.P = program(I.gl, INK_FS);
      // eski kelime kelime aydınlatmayı bu bölümde kapat
      const t = I.sec.querySelector('[data-scrub-words]');
      if (t) { t.removeAttribute('data-scrub-words'); t.dataset.glInk = ''; I.scrub = t; }
    },
    undo(I) { if (I.scrub) I.scrub.setAttribute('data-scrub-words', ''); },
    render(I, t) {
      const { gl } = I, r = I.rect, vh = innerHeight;
      const p = (vh * .84 - r.top) / (r.height + vh * .3);
      common(I, I.P, t);
      const L = I.P.loc;
      gl.uniform1f(L.uP, -.16 + Math.max(0, Math.min(1, p)) * 1.46);
      gl.uniform3f(L.uBg, ...C.turunc);
      gl.uniform3f(L.uInk, ...C.murekkep);
      gl.uniform3f(L.uPaper, ...C.kirec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };

  /* ================================================================ 3 · su */
  const SIM_FS = `#version 300 es
precision highp float;
uniform sampler2D uS;
uniform vec2 uTexel;
uniform vec4 uDrop[4];   // x, y (simülasyon pikseli), yarıçap, güç
uniform int uN;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec4 s = texture(uS, uv);
  float avg = (texture(uS, uv + vec2(uTexel.x, 0.)).r + texture(uS, uv - vec2(uTexel.x, 0.)).r
             + texture(uS, uv + vec2(0., uTexel.y)).r + texture(uS, uv - vec2(0., uTexel.y)).r) * .25;
  s.g += (avg - s.r) * 2.;
  s.g *= .986;
  s.r += s.g;
  s.r *= .998;
  for (int i = 0; i < 4; i++) {
    if (i >= uN) break;
    float d = distance(gl_FragCoord.xy, uDrop[i].xy) / uDrop[i].z;
    if (d < 1.) s.r += (cos(d * 3.14159) * .5 + .5) * uDrop[i].w;
  }
  o = s;
}`;

  const WATER_FS = HEAD + `
uniform sampler2D uS;
uniform vec2 uSTexel;
uniform vec3 uBg, uPaper;
void main(){
  vec2 suv = gl_FragCoord.xy / uRes;
  float h = texture(uS, suv).r;
  float hx = texture(uS, suv + vec2(uSTexel.x, 0.)).r - texture(uS, suv - vec2(uSTexel.x, 0.)).r;
  float hy = texture(uS, suv + vec2(0., uSTexel.y)).r - texture(uS, suv - vec2(0., uSTexel.y)).r;
  vec2 uv = topUv() + vec2(hx, -hy) * .045;
  vec3 col = page(uv, uBg);
  vec3 n = normalize(vec3(-hx * 6., -hy * 6., 1.));
  vec3 L = normalize(vec3(-.45, .55, 1.));
  float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 70.);
  col *= 1. + h * .22;
  col = mix(col, uPaper, clamp(spec * .55, 0., .55));
  o = vec4(col, 1.);
}`;

  const waterFx = {
    name: 'su', bg: C.turunc, maxDpr: 2,
    init(I) {
      const { gl } = I;
      if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw new Error('float hedef yok');
      I.P = program(gl, WATER_FS);
      I.S = program(gl, SIM_FS);
      I.drops = []; I.nextRain = 0; I.lastPtr = { x: -1, y: -1 };
    },
    resize(I) {
      const { gl } = I;
      const sw = Math.max(64, Math.min(512, Math.round(I.cv.clientWidth / 3)));
      const sh = Math.max(64, Math.round(sw * I.cv.height / I.cv.width));
      if (I.sw === sw && I.sh === sh) return;
      I.sw = sw; I.sh = sh;
      (I.st || []).forEach(s => { gl.deleteTexture(s.t); gl.deleteFramebuffer(s.f); });
      I.st = [0, 1].map(() => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, sw, sh, 0, gl.RGBA, gl.HALF_FLOAT, null);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        return { t, f };
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      I.cur = 0;
    },
    // ekran noktası → simülasyon pikseli
    drop(I, cx, cy, radiusCss, power) {
      const r = I.rect || I.cv.getBoundingClientRect();
      const x = (cx - r.left) / r.width * I.sw, y = (1 - (cy - r.top) / r.height) * I.sh;
      if (I.drops.length < 4) I.drops.push([x, y, radiusCss / r.width * I.sw, power]);
    },
    press(I, e) {
      const r = I.cv.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) this.drop(I, e.clientX, e.clientY, 34, .9);
    },
    step(I, t) {
      const { gl } = I, r = I.rect;
      if (ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom) {
        const dx = ptr.x - I.lastPtr.x, dy = ptr.y - I.lastPtr.y;
        const v = Math.hypot(dx, dy);
        if (I.lastPtr.x >= 0 && v > 1.5) this.drop(I, ptr.x, ptr.y, 20, Math.min(.5, v * .02));
        I.lastPtr = { x: ptr.x, y: ptr.y };
      } else I.lastPtr = { x: -1, y: -1 };
      if (t > I.nextRain) {
        I.nextRain = t + 1.4 + Math.random() * 2.2;
        this.drop(I, r.left + Math.random() * r.width, r.top + Math.random() * r.height, 16 + Math.random() * 18, .35);
      }
      const src = I.st[I.cur], dst = I.st[1 - I.cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f);
      gl.viewport(0, 0, I.sw, I.sh);
      gl.useProgram(I.S.p);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, src.t);
      gl.uniform1i(I.S.loc.uS, 1);
      gl.uniform2f(I.S.loc.uTexel, 1 / I.sw, 1 / I.sh);
      const flat = new Float32Array(16);
      I.drops.forEach((d, i) => flat.set(d, i * 4));
      gl.uniform4fv(I.S.loc.uDrop, flat);
      gl.uniform1i(I.S.loc.uN, I.drops.length);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      I.drops.length = 0;
      I.cur = 1 - I.cur;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, I.cv.width, I.cv.height);
    },
    render(I, t) {
      const { gl } = I;
      if (!I.st) this.resize(I);
      if (I.stepNow) { I.stepNow = false; this.step(I, t); }
      common(I, I.P, t);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, I.st[I.cur].t);
      gl.uniform1i(I.P.loc.uS, 1);
      gl.uniform2f(I.P.loc.uSTexel, 1 / I.sw, 1 / I.sh);
      gl.uniform3f(I.P.loc.uBg, ...C.turunc);
      gl.uniform3f(I.P.loc.uPaper, ...C.kirec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };

  /* ---------------------------------------------------------------- kurulum */
  const plan = [['.hero', lensFx], ['.manifesto', inkFx], ['.contact', waterFx]];
  for (const [sel, fx] of plan) {
    const sec = document.querySelector(sel);
    if (sec) mount(sec, fx);
  }
  if (!islands.length) { finish(false); return; }
  root.classList.add('gl');

  let lastStep = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const stepDue = now - lastStep > 15;
    if (stepDue) lastStep = now;
    for (const I of islands) {
      if (!I.vis || !I.ready) continue;
      if (I.fx.step && stepDue) I.stepNow = true;
      draw(I, now);
    }
  }
  requestAnimationFrame(loop);

  // Girişin ilk resmi gelince (en geç 1,2 sn) hareket katmanı başlar.
  const hero = islands.find(I => I.fx === lensFx);
  const t0 = performance.now();
  (function wait() {
    if (!hero || hero.dead || hero.ready) return finish(true);
    if (performance.now() - t0 > 1200) { hero.undo(); return finish(true); }
    requestAnimationFrame(wait);
  })();
})();
