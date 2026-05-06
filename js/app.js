/* ═══════════════════════════════════════════════════════════════
   CHEMALI DIGITAL — APP LOGIC
   Navigation · Animations · Terminal · Counter · Form · Cursor
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  const intro         = $('intro');
  const app           = $('app');
  const navbar        = $('navbar');
  const navProgress   = $('navProgress');
  const hamburger     = $('hamburger');
  const mobileMenu    = $('mobileMenu');
  const pageTransition= $('pageTransition');
  const contactForm   = $('contactForm');
  const submitBtn     = $('submitBtn');
  const btnText       = $('btnText');
  const btnArrow      = $('btnArrow');
  const btnLoader     = $('btnLoader');
  const formSuccess   = $('formSuccess');
  const formError     = $('formError');
  const terminalBody  = $('terminalBody');
  const introTagline  = $('introTagline');
  const introLoadFill = $('introLoadingFill');

  let currentPage     = 'home';
  let isTransitioning = false;
  let bgParticles     = null;
  let terminalDone    = false;

  /* ═══════════════════════════════════════════════════════════
     1. INTRO SEQUENCE
     ═══════════════════════════════════════════════════════════ */
  function startIntro() {
    // Tagline typing effect
    const tagline = 'WEB DESIGN FOR ELECTRICIANS';
    let ti = 0;
    const typeTagline = () => {
      if (ti <= tagline.length) {
        introTagline.textContent = tagline.slice(0, ti) + (ti < tagline.length ? '_' : '');
        ti++;
        setTimeout(typeTagline, 60);
      }
    };
    setTimeout(typeTagline, 400);

    // Timer
    let seconds = 0;
    const timerEl = $('introTimer');
    const timerId = setInterval(() => {
      seconds++;
      const s = String(seconds).padStart(2, '0');
      if (timerEl) timerEl.textContent = `00:${s}`;
    }, 1000);

    // Loading bar timed to match assembly (~4.5s total)
    let pct = 0;
    const fillId = setInterval(() => {
      pct += 100 / 45; // 45 steps over ~4.5s
      if (pct >= 100) { pct = 100; clearInterval(fillId); }
      if (introLoadFill) introLoadFill.style.width = pct + '%';
    }, 100);

    // Particle system
    const ps = new ParticleSystem('particleCanvas');
    ps.onDone = () => {
      clearInterval(timerId);
      clearInterval(fillId);
      if (introLoadFill) introLoadFill.style.width = '100%';

      // Small pause then transition out
      setTimeout(() => revealApp(ps), 600);
    };
    ps.start();
  }

  function revealApp(ps) {
    // Fade intro out
    intro.classList.add('exit');

    // Show app
    app.style.opacity     = '1';
    app.style.pointerEvents = 'auto';

    // Start background ambient canvas
    bgParticles = new BackgroundParticles('bgCanvas');
    bgParticles.start();

    // Trigger home page reveal animations
    setTimeout(() => {
      triggerReveal('home');
      triggerCounters();
      intro.style.display = 'none'; // remove after animation
    }, 400);

    // Stop intro canvas (save resources)
    setTimeout(() => ps.stop(), 1200);
  }

  /* ═══════════════════════════════════════════════════════════
     2. NAVIGATION
     ═══════════════════════════════════════════════════════════ */
  function navigateTo(name, push = true) {
    if (name === currentPage || isTransitioning) return;
    isTransitioning = true;

    // Close mobile menu
    closeMobileMenu();

    // Transition wipe in
    pageTransition.classList.remove('out');
    pageTransition.classList.add('active');

    setTimeout(() => {
      // Swap pages
      const prev = $(`page-${currentPage}`);
      const next = $(`page-${name}`);
      if (prev) prev.classList.remove('active');
      if (next) { next.classList.add('active'); next.classList.add('entering'); }

      // Update nav links
      $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.nav === name));
      $$('.mm-link').forEach(l => l.classList.toggle('active', l.dataset.nav === name));

      // Wipe out
      pageTransition.classList.remove('active');
      pageTransition.classList.add('out');

      currentPage = name;
      window.scrollTo({ top: 0, behavior: 'instant' });

      if (push) history.pushState({ page: name }, '', '#' + name);

      // Trigger page-specific logic
      setTimeout(() => {
        if (next) next.classList.remove('entering');
        triggerReveal(name);
        if (name === 'about')   initTerminal();
        if (name === 'home')    triggerCounters();
        isTransitioning = false;
      }, 350);

      setTimeout(() => pageTransition.classList.remove('out'), 500);
    }, 280);
  }

  /* Attach navigation to all [data-nav] elements */
  function bindNavigation() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-nav]');
      if (!el) return;
      e.preventDefault();
      navigateTo(el.dataset.nav);
    });

    // Browser back/forward
    window.addEventListener('popstate', e => {
      const page = (e.state && e.state.page) || 'home';
      navigateTo(page, false);
    });

    // Initial hash
    const hash = window.location.hash.slice(1);
    if (hash && ['home', 'about', 'contact'].includes(hash)) {
      currentPage = 'home'; // force transition
      navigateTo(hash, false);
    }
  }

  /* ── Hamburger ─────────────────────────────────────────────── */
  function bindHamburger() {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }
  function closeMobileMenu() {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Scroll: navbar + progress ─────────────────────────────── */
  function bindScroll() {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 20;
      navbar.classList.toggle('scrolled', scrolled);

      // Progress bar
      const docH   = document.documentElement.scrollHeight - window.innerHeight;
      const pct    = docH > 0 ? (window.scrollY / docH) * 100 : 0;
      navProgress.style.width = pct + '%';
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     3. SCROLL REVEAL
     ═══════════════════════════════════════════════════════════ */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el    = entry.target;
      const delay = parseInt(el.dataset.delay || 0);
      setTimeout(() => el.classList.add('revealed'), delay);
      revealObserver.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      const children = entry.target.querySelectorAll('.reveal');
      children.forEach((child, i) => {
        const base  = parseInt(child.dataset.delay || 0);
        setTimeout(() => child.classList.add('revealed'), base + i * 80);
      });
    });
  }, { threshold: 0.1 });

  function triggerReveal(pageName) {
    const page = $(`page-${pageName}`);
    if (!page) return;
    page.querySelectorAll('.reveal').forEach(el => {
      revealObserver.observe(el);
    });
    page.querySelectorAll('.reveal-section').forEach(el => {
      sectionObserver.observe(el);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     4. NUMBER COUNTERS
     ═══════════════════════════════════════════════════════════ */
  function triggerCounters() {
    $$('.counter').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      if (!target) return;
      const duration = 2000;
      const start    = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(ease * target);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     5. TERMINAL ANIMATION (About page)
     ═══════════════════════════════════════════════════════════ */
  const TERMINAL_LINES = [
    '> INITIALIZING PROFILE...',
    '> ─────────────────────────',
    '> NAME ........ Marc Chemali',
    '> LOCATION .... Montreal, QC',
    '> ROLE ........ Web Designer',
    '> FOCUS ....... Electrical Industry',
    '> METHOD ...... 100% Custom Code',
    '> TEMPLATES ... 0 (ZERO)',
    '> ─────────────────────────',
    '> STATUS: BUILDING INSANE SITES',
    '> ACCEPTING CLIENTS: ✓ YES',
    '> ─────────────────────────',
    '> _',
  ];

  async function initTerminal() {
    if (terminalDone || !terminalBody) return;
    terminalBody.innerHTML = '';

    const cursor = document.createElement('span');
    cursor.id = 'termCursor';
    cursor.className = 'tc-cursor';
    cursor.textContent = '█';
    terminalBody.appendChild(cursor);

    for (const line of TERMINAL_LINES) {
      await typeTerminalLine(line, cursor);
      await sleep(line.includes('──') ? 80 : 120);
    }

    terminalDone = true;
  }

  function typeTerminalLine(text, cursor) {
    return new Promise(resolve => {
      const span = document.createElement('span');
      span.style.display = 'block';

      // Color the line
      if (text.startsWith('> STATUS') || text.startsWith('> ACCEPTING')) {
        span.style.color = '#00FF88';
      } else if (text.startsWith('> ──')) {
        span.style.color = 'rgba(0,212,255,0.3)';
      } else if (text === '> _') {
        span.style.color = 'rgba(0,212,255,0.5)';
      } else if (text.startsWith('>')) {
        // Key: cyan, value: default
        span.innerHTML = text; // will be replaced below
      }

      terminalBody.insertBefore(span, cursor);

      let i = 0;
      const interval = setInterval(() => {
        span.textContent = text.slice(0, i + 1);
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          resolve();
        }
      }, text.includes('──') ? 15 : 30);
    });
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ═══════════════════════════════════════════════════════════
     6. CONTACT FORM
     ═══════════════════════════════════════════════════════════ */
  function bindContactForm() {
    if (!contactForm) return;

    contactForm.addEventListener('submit', async e => {
      e.preventDefault();

      // Validation
      const fields = contactForm.querySelectorAll('[required]');
      let valid = true;
      fields.forEach(f => {
        if (!f.value.trim()) {
          f.closest('.form-field')?.querySelector('.ff-line')
            ?.style.setProperty('--line-color', '#FF4444');
          valid = false;
        }
      });
      if (!valid) { shakeForm(); return; }

      // Loading state
      btnText.textContent = 'SENDING...';
      btnArrow.style.display = 'none';
      btnLoader.style.display = 'inline-block';
      submitBtn.disabled = true;
      formSuccess.style.display = 'none';
      formError.style.display   = 'none';

      try {
        const formData = new FormData(contactForm);
        const object   = Object.fromEntries(formData.entries());
        const res = await fetch('https://api.web3forms.com/submit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body:    JSON.stringify(object),
        });
        const json = await res.json();

        if (json.success) {
          formSuccess.style.display = 'flex';
          contactForm.reset();
          // Animate success
          formSuccess.animate(
            [{ opacity: 0, transform: 'translateY(10px)' },
             { opacity: 1, transform: 'translateY(0)' }],
            { duration: 400, easing: 'ease' }
          );
        } else {
          formError.style.display = 'flex';
        }
      } catch (err) {
        formError.style.display = 'flex';
      } finally {
        btnText.textContent = 'SEND MESSAGE';
        btnArrow.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
      }
    });

    // Focus effects
    contactForm.querySelectorAll('.ff-input').forEach(input => {
      input.addEventListener('focus', () => {
        input.closest('.form-field')?.classList.add('focused');
      });
      input.addEventListener('blur', () => {
        input.closest('.form-field')?.classList.remove('focused');
      });
    });
  }

  function shakeForm() {
    contactForm.animate(
      [{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' },
       { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
       { transform: 'translateX(0)' }],
      { duration: 400, easing: 'ease' }
    );
  }

  /* ═══════════════════════════════════════════════════════════
     7. CUSTOM CURSOR
     ═══════════════════════════════════════════════════════════ */
  function initCursor() {
    if (window.innerWidth < 768) return;

    const cursor    = $('cursor');
    const cursorDot = $('cursorDot');
    if (!cursor || !cursorDot) return;

    let mx = -100, my = -100;
    let cx = -100, cy = -100;
    let raf;

    document.addEventListener('mousemove', e => {
      mx = e.clientX;
      my = e.clientY;
      cursorDot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    });

    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup',   () => cursor.classList.remove('clicking'));

    // Hover on interactive elements
    document.querySelectorAll('a, button, [data-nav], .svc-card, .why-card, .nav-link').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });

    // Smooth follow
    const follow = () => {
      cx += (mx - cx) * 0.12;
      cy += (my - cy) * 0.12;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(follow);
    };
    follow();
  }

  /* ═══════════════════════════════════════════════════════════
     8. CIRCUIT SVG INTERACTIONS
     ═══════════════════════════════════════════════════════════ */
  function initCircuit() {
    const nodes = $$('.node');
    nodes.forEach(node => {
      node.addEventListener('mouseenter', () => {
        node.style.r = '8';
        node.style.filter = 'url(#glow-strong)';
      });
      node.addEventListener('mouseleave', () => {
        node.style.r = '';
        node.style.filter = '';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     9. HOVER GLOW: re-bind cursor for dynamically shown pages
     ═══════════════════════════════════════════════════════════ */
  function rebindHover() {
    if (window.innerWidth < 768) return;
    const cursor = $('cursor');
    if (!cursor) return;
    $$('a, button, [data-nav], .svc-card').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });
  }

  /* ═══════════════════════════════════════════════════════════
     10. SERVICE CARD TILT EFFECT
     ═══════════════════════════════════════════════════════════ */
  function initCardTilt() {
    $$('.svc-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect   = card.getBoundingClientRect();
        const x      = e.clientX - rect.left;
        const y      = e.clientY - rect.top;
        const cx     = rect.width  / 2;
        const cy     = rect.height / 2;
        const tiltX  = ((y - cy) / cy) * -8;
        const tiltY  = ((x - cx) / cx) *  8;
        card.style.transform = `translateY(-6px) perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════ */
  function init() {
    // Hide app until intro is done
    app.style.opacity      = '0';
    app.style.pointerEvents = 'none';

    bindNavigation();
    bindHamburger();
    bindScroll();
    bindContactForm();
    initCursor();
    initCircuit();
    initCardTilt();

    // Start the intro particle show
    startIntro();

    // Re-bind hover when pages change
    const origNav = navigateTo;
    window.addEventListener('popstate', () => setTimeout(rebindHover, 400));
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
