/* Nüve Dijital — hareket katmanı (GSAP + ScrollTrigger + Lenis) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!window.gsap || !window.ScrollTrigger) {
    body.classList.remove('is-loading');
    $('.loader')?.remove();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  if (reduced) root.classList.add('reduced');

  /* ---------- Metni bölme ---------- */
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
    return $$('.w', el);
  }
  function splitLines(el) {
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map(p => `<span class="line"><span class="li">${p.trim()}</span></span>`).join('');
    return $$('.li', el);
  }

  /* ---------- Yumuşak kaydırma ---------- */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const navH = () => parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 72;

  /* ---------- Menü ---------- */
  const burger = $('.nav-burger');
  const menu = $('#menu');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Bağlantılar ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    setMenu(false);
    if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -navH() + 1, duration: 1.4 });
    else window.scrollTo({ top: id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY - navH(), behavior: reduced ? 'auto' : 'smooth' });
  }));

  /* ---------- Gezinme çubuğu ---------- */
  const nav = $('[data-nav]');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40);
      if (!body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > lastY && y > 400);
      lastY = y;
    }
  });
  $$('.nav-links a').forEach(a => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: s => a.classList.toggle('is-active', s.isActive) });
  });

  /* ---------- Yazı hazırlığı ---------- */
  const scrubTargets = $$('[data-scrub-words]').map(el => ({ el, words: splitWords(el) }));
  const lineTargets = $$('[data-reveal-lines]').map(el => ({ el, lines: splitLines(el) }));

  /* ---------- Az hareket: her şeyi göster, bitir ---------- */
  if (reduced) {
    $('.loader')?.remove();
    body.classList.remove('is-loading');
    $$('.step').forEach(s => s.classList.add('is-on'));
    setupAppSteps();
    return;
  }

  /* ---------- Açılış ---------- */
  const heroLines = $$('.hero .li');
  gsap.set(heroLines, { yPercent: 115 });
  gsap.set('.u-dot', { y: -900, opacity: 0 });
  gsap.set(['.hero-pill', '.hero-actions', '.hero-founder', '.hero-scroll'], { opacity: 0, y: 20 });
  gsap.set('.hero-arch', { yPercent: 40, rotate: -8, opacity: 0 });

  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro
    .fromTo('.loader-arch', { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: .7, ease: 'power3.inOut' })
    .fromTo('.loader-dot', { y: -70, opacity: 0 }, { y: 0, opacity: 1, duration: .55, ease: 'bounce.out' }, '-=.15')
    .to('.loader', { yPercent: -100, duration: .9, ease: 'expo.inOut' }, '+=.1')
    .add(() => { body.classList.remove('is-loading'); lenis?.start(); }, '-=.5')
    .to('.hero-arch', { yPercent: 0, rotate: 0, opacity: 1, duration: 1.6 }, '-=.6')
    .to(heroLines, { yPercent: 0, duration: 1.3, stagger: .08 }, '<.1')
    .to('.u-dot', { y: 0, opacity: 1, duration: 1, ease: 'bounce.out' }, '<.45')
    .to(['.hero-pill', '.hero-actions', '.hero-founder', '.hero-scroll'], { opacity: 1, y: 0, duration: 1, stagger: .08 }, '<.1')
    .add(() => $('.loader')?.remove());

  /* ---------- Hero: kemerin içinden geçiş ---------- */
  const hero = $('.hero');
  const archWrap = $('.hero-arch-wrap');
  function zoomScale() {
    const h = hero.getBoundingClientRect();
    const w = archWrap.getBoundingClientRect();
    const u = w.width / 100;
    const px = w.left - h.left + w.width * .5;
    const py = w.top - h.top + w.height * .3;
    const vw = innerWidth, vh = innerHeight;
    return Math.max(py / (8 * u), (vh - py) / (10 * u), px / (16 * u), (vw - px) / (16 * u)) * 1.15;
  }
  const heroTl = gsap.timeline({
    scrollTrigger: { trigger: hero, start: 'top top', end: '+=110%', pin: true, scrub: .6, invalidateOnRefresh: true }
  });
  heroTl
    .to('.hero-inner', { yPercent: -18, opacity: 0, ease: 'power2.in', duration: .45 }, 0)
    .to(['.hero-founder', '.hero-scroll'], { opacity: 0, duration: .2 }, 0)
    .to('.hero-arch', { scale: () => zoomScale(), transformOrigin: '50% 30%', ease: 'power2.in', duration: 1 }, 0)
    .to('.hero-arch-dot', { opacity: 0, duration: .3 }, 0);

  if (finePointer) {
    const ax = gsap.quickTo(archWrap, 'x', { duration: 1.2, ease: 'power3' });
    const ay = gsap.quickTo(archWrap, 'y', { duration: 1.2, ease: 'power3' });
    hero.addEventListener('pointermove', e => {
      ax((e.clientX / innerWidth - .5) * -30);
      ay((e.clientY / innerHeight - .5) * -20);
    });
  }

  /* ---------- Kelime kelime aydınlanan metin ---------- */
  scrubTargets.forEach(({ el, words }) => {
    gsap.fromTo(words, { opacity: .16 }, {
      opacity: 1, stagger: .1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: true }
    });
  });

  /* ---------- Satır maskesiyle başlıklar ---------- */
  lineTargets.forEach(({ el, lines }) => {
    gsap.from(lines, {
      yPercent: 115, duration: 1.2, stagger: .09, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
  $$('.sec-lede, .contact-sub').forEach(el => gsap.from(el, {
    y: 30, opacity: 0, duration: 1.1, ease: 'expo.out',
    scrollTrigger: { trigger: el, start: 'top 90%', once: true }
  }));

  /* ---------- Bant: kaydırma hızına göre akan şerit ---------- */
  const track = $('[data-marquee]');
  if (track) {
    track.innerHTML += track.innerHTML + track.innerHTML;
    let x = 0, dir = 1, boost = 0;
    ScrollTrigger.create({
      trigger: '.band', start: 'top bottom', end: 'bottom top',
      onUpdate: s => { dir = s.direction; boost = Math.min(Math.abs(s.getVelocity()) / 120, 18); }
    });
    gsap.ticker.add((t, dt) => {
      const third = track.scrollWidth / 3;
      x -= (0.6 + boost) * dir * (dt / 16.7);
      boost *= .92;
      if (x <= -third) x += third;
      if (x > 0) x -= third;
      gsap.set(track, { x });
    });
  }

  /* ---------- Hizmet kartları: üst üste binen yığın ---------- */
  const cards = $$('[data-card]');
  cards.forEach((card, i) => {
    card.style.setProperty('--i', i);
    const img = $('.card-media img', card);
    gsap.to(img, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 20%', scrub: true } });
    gsap.from($$('.card-text > *, .card li', card), {
      y: 40, opacity: 0, duration: 1, stagger: .05, ease: 'expo.out',
      scrollTrigger: { trigger: card, start: 'top 70%', once: true }
    });
    const next = cards[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: .9 + i * .02, ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: () => `top ${navH() + 16 + (i + 1) * 14}px`, scrub: true, invalidateOnRefresh: true }
    });
  });

  /* ---------- Uygulama: adım adım telefon ---------- */
  setupAppSteps();
  gsap.fromTo('.phone', { rotate: -5, y: 40 }, {
    rotate: 4, y: -30, ease: 'none',
    scrollTrigger: { trigger: '.app-scroller', start: 'top bottom', end: 'bottom top', scrub: true }
  });
  gsap.fromTo('.app-glow', { scale: .6 }, {
    scale: 1.1, ease: 'none',
    scrollTrigger: { trigger: '.app-scroller', start: 'top 80%', end: 'bottom bottom', scrub: true }
  });
  gsap.from('.app-icon', { scale: 0, rotate: -30, duration: 1.2, ease: 'back.out(1.8)', scrollTrigger: { trigger: '.app-head', start: 'top 80%', once: true } });
  gsap.from('.app-facts li', { y: 30, opacity: 0, stagger: .1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.app-facts', start: 'top 90%', once: true } });

  /* ---------- İşler: masaüstünde yatay kaydırma ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', () => {
    const workTrack = $('.work-track');
    const dist = () => Math.max(0, workTrack.scrollWidth - innerWidth);
    const tween = gsap.to(workTrack, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.work-pin', start: 'center center', end: () => `+=${dist()}`, pin: true, scrub: .8, invalidateOnRefresh: true, anticipatePin: 1 }
    });
    $$('.proj', workTrack).forEach(p => {
      const img = $('.proj-media img', p);
      gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
  });
  gsap.from('.proj', { y: 80, opacity: 0, stagger: .08, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.work-pin', start: 'top 85%', once: true } });

  /* ---------- Süreç ---------- */
  const stepEls = $$('.step');
  stepEls.forEach((step, i) => {
    gsap.from(step, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', delay: (i % 4) * .08, scrollTrigger: { trigger: step, start: 'top 88%', once: true } });
  });
  mm.add('(min-width: 961px)', () => {
    gsap.to('.steps-line span', {
      scaleX: 1, ease: 'none',
      scrollTrigger: {
        trigger: '.steps', start: 'top 72%', end: 'bottom 45%', scrub: .5,
        onUpdate: st => stepEls.forEach((el, i) => el.classList.toggle('is-on', st.progress >= i / (stepEls.length - 1) - .001))
      }
    });
  });
  mm.add('(max-width: 960px)', () => {
    stepEls.forEach(step => ScrollTrigger.create({ trigger: step, start: 'top 62%', onEnter: () => step.classList.add('is-on'), onLeaveBack: () => step.classList.remove('is-on') }));
  });

  /* ---------- Kurucu ve sayılar ---------- */
  gsap.from('.founder', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.founder', start: 'top 85%', once: true } });
  gsap.from('.founder-frame', { clipPath: 'inset(100% 0 0 0)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: '.founder', start: 'top 80%', once: true } });
  $$('[data-count]').forEach(el => {
    const end = +el.dataset.count;
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  /* ---------- İletişim ve altbilgi ---------- */
  gsap.fromTo('.contact-arches', { xPercent: 20 }, { xPercent: -10, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.contact-actions .btn', { y: 40, opacity: 0, stagger: .1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.contact-actions', start: 'top 92%', once: true } });
  gsap.from('.foot-mark img', { yPercent: 70, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* ---------- İmleç ve mıknatıs ---------- */
  if (finePointer) {
    const cursor = $('.cursor');
    const label = $('.cursor-label', cursor);
    const cx = gsap.quickTo(cursor, 'x', { duration: .35, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: .35, ease: 'power3' });
    window.addEventListener('pointermove', e => { cx(e.clientX); cy(e.clientY); cursor.classList.remove('is-hidden'); });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    $$('a, button').forEach(el => {
      el.addEventListener('pointerenter', () => {
        if (el.dataset.cursor) { label.textContent = el.dataset.cursor; cursor.classList.add('is-label'); }
        else cursor.classList.add('is-link');
      });
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-link', 'is-label'));
    });

    $$('.magnetic').forEach(el => {
      const mx = gsap.quickTo(el, 'x', { duration: .6, ease: 'elastic.out(1, .4)' });
      const my = gsap.quickTo(el, 'y', { duration: .6, ease: 'elastic.out(1, .4)' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * .3);
        my((e.clientY - r.top - r.height / 2) * .4);
      });
      el.addEventListener('pointerleave', () => { mx(0); my(0); });
    });

    $$('.proj').forEach(p => {
      const rx = gsap.quickTo(p, 'rotationY', { duration: .8, ease: 'power3' });
      const ry = gsap.quickTo(p, 'rotationX', { duration: .8, ease: 'power3' });
      gsap.set(p, { transformPerspective: 900 });
      p.addEventListener('pointermove', e => {
        const r = p.getBoundingClientRect();
        rx(((e.clientX - r.left) / r.width - .5) * 6);
        ry(((e.clientY - r.top) / r.height - .5) * -6);
      });
      p.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());

  /* ---------- Yardımcı: uygulama adımları ---------- */
  function setupAppSteps() {
    const screens = $$('.phone-screen img');
    const steps = $$('.app-step');
    const set = i => {
      screens.forEach((s, k) => s.classList.toggle('is-on', k === i));
      steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    };
    steps.forEach((step, i) => {
      ScrollTrigger.create({
        trigger: step, start: () => innerWidth <= 960 ? 'top 88%' : 'top 62%', end: () => innerWidth <= 960 ? 'bottom 88%' : 'bottom 62%',
        onToggle: s => { if (s.isActive) set(i); }
      });
    });
  }
})();
