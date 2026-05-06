/* ═══════════════════════════════════════════════════════════════
   CHEMALI DIGITAL — PARTICLE SYSTEM
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   INTRO SYSTEM
   Phase timeline:
     bang       — single point explosion, particles blast outward
     scatter    — particles fly wild across screen w/ trails
     assembling — spring-force toward text positions
     assembled  — electric arcs + glow pulse
     glitching  — violent jitter + color distortion
     dispersing — explosive burst then float away
     floating   — ambient drift with mouse repulsion
   ═══════════════════════════════════════════════════════════════ */
class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.particles    = [];
    this.mouse        = { x: -9999, y: -9999 };
    this.phase        = 'idle';
    this.frame        = 0;
    this.phaseFrame   = 0;  // frame counter within current phase
    this.onDone       = null;
    this.totalText    = 0;
    this.glitchOffset = [];  // per-particle glitch delta

    this._raf   = null;
    this._bound = this._tick.bind(this);

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    window.addEventListener('touchmove', e => {
      this.mouse.x = e.touches[0].clientX;
      this.mouse.y = e.touches[0].clientY;
    }, { passive: true });
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /* ── Public entry ───────────────────────────────────────────── */
  async start() {
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 180));

    const targets = this._sampleText();
    this._buildParticles(targets);

    this.phase      = 'bang';
    this.phaseFrame = 0;
    this._raf = requestAnimationFrame(this._bound);
  }

  /* ── Sample text pixels ─────────────────────────────────────── */
  _sampleText() {
    const W = this.canvas.width, H = this.canvas.height;
    const mob = W < 768;
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const ctx = tmp.getContext('2d');

    const fs1 = mob ? Math.min(W * 0.15, 70)  : Math.min(W * 0.085, 120);
    const fs2 = mob ? Math.min(W * 0.065, 30) : Math.min(W * 0.040, 56);
    const cy1 = H * 0.43;
    const cy2 = cy1 + fs1 * 0.76;

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${fs1}px "Orbitron", sans-serif`;
    ctx.fillText('CHEMALI', W / 2, cy1);
    ctx.font = `400 ${fs2}px "Orbitron", sans-serif`;
    ctx.fillText('DIGITAL', W / 2, cy2);

    const gap  = mob ? 7 : 5;
    const data = ctx.getImageData(0, 0, W, H).data;
    const pts  = [];
    for (let x = 0; x < W; x += gap)
      for (let y = 0; y < H; y += gap) {
        const i = (y * W + x) * 4;
        if (data[i + 3] > 128) pts.push({ x, y });
      }
    return pts.sort(() => Math.random() - 0.5).slice(0, 300);
  }

  /* ── Build particles ────────────────────────────────────────── */
  _buildParticles(targets) {
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;
    this.particles = [];
    this.totalText = targets.length;

    // Text particles — start at center (bang origin)
    targets.forEach(t => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 18;
      this.particles.push({
        x:   cx + (Math.random() - 0.5) * 8,
        y:   cy + (Math.random() - 0.5) * 8,
        px:  cx, py: cy,     // previous pos (for trails)
        vx:  Math.cos(angle) * speed,
        vy:  Math.sin(angle) * speed,
        tx:  t.x, ty: t.y,   // assembly target
        size:    Math.random() * 2.2 + 0.8,
        color:   Math.random() > 0.85 ? '#FF6B00' : '#00D4FF',
        baseColor: Math.random() > 0.85 ? '#FF6B00' : '#00D4FF',
        opacity: 0,
        text:    true,
        done:    false,
        gph:     Math.random() * Math.PI * 2,   // glow phase
        delay:   Math.floor(Math.random() * 20), // stagger
      });
    });

    // Ambient floaters
    const n = Math.min(Math.floor(W * H / 25000), 50);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * W, y: Math.random() * H,
        px: 0, py: 0,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 1.0 + 0.3,
        color: '#00D4FF', baseColor: '#00D4FF',
        opacity: Math.random() * 0.2 + 0.04,
        text: false, ambient: true, done: false, delay: 0, gph: 0,
      });
    }
  }

  /* ── Setphase helper ────────────────────────────────────────── */
  _setPhase(p) {
    this.phase = p;
    this.phaseFrame = 0;
  }

  /* ── Main tick ──────────────────────────────────────────────── */
  _tick() {
    this._raf = requestAnimationFrame(this._bound);
    this.frame++;
    this.phaseFrame++;

    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;

    // ── Clear strategy varies by phase ──
    if (this.phase === 'bang' || this.phase === 'scatter') {
      // Trail effect: dark fill instead of clear
      ctx.fillStyle = 'rgba(2, 10, 20, 0.18)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    // ── Draw connections (assembled / floating only) ──
    if (this.phase === 'assembled' || this.phase === 'glitching' ||
        this.phase === 'dispersing' || this.phase === 'floating') {
      this._drawConnections();
    }

    // ── Electric arcs during assembled ──
    if (this.phase === 'assembled') {
      this._drawElectricArcs();
    }

    // ── Big bang center flash ──
    if (this.phase === 'bang' && this.phaseFrame < 12) {
      const r = (12 - this.phaseFrame) / 12;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5 * (1 - r + 0.1));
      grad.addColorStop(0, `rgba(0, 212, 255, ${r * 0.9})`);
      grad.addColorStop(0.3, `rgba(0, 212, 255, ${r * 0.3})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Per-particle update ──
    let assembledCount = 0;

    this.particles.forEach(p => {
      if (p.ambient) { this._ambientUpdate(p, W, H); this._drawParticle(p, ctx); return; }
      if (this.frame < p.delay) return;
      if (p.opacity < 1) p.opacity = Math.min(1, p.opacity + 0.06);

      p.px = p.x; p.py = p.y; // save prev position

      switch (this.phase) {

        case 'bang': {
          // Blast outward
          p.vx *= 0.97; p.vy *= 0.97;
          p.x += p.vx; p.y += p.vy;
          // Draw trail
          ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = p.color === '#FF6B00'
            ? `rgba(255,107,0,${p.opacity * 0.5})`
            : `rgba(0,212,255,${p.opacity * 0.5})`;
          ctx.lineWidth = p.size * 0.6; ctx.stroke();
          break;
        }

        case 'scatter': {
          // Chaotic drift
          p.vx += (Math.random() - 0.5) * 0.4;
          p.vy += (Math.random() - 0.5) * 0.4;
          p.vx *= 0.97; p.vy *= 0.97;
          p.x += p.vx; p.y += p.vy;
          // Wrap edges
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
          // Draw trail
          ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = p.color === '#FF6B00'
            ? `rgba(255,107,0,${p.opacity * 0.35})`
            : `rgba(0,212,255,${p.opacity * 0.35})`;
          ctx.lineWidth = p.size * 0.5; ctx.stroke();
          break;
        }

        case 'assembling': {
          if (!p.done) {
            const dx = p.tx - p.x, dy = p.ty - p.y;
            const d  = Math.hypot(dx, dy);
            if (d < 1.5) {
              p.done = true; p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0;
            } else {
              const k = 0.07 + Math.min(this.phaseFrame / 2000, 0.05);
              p.vx = p.vx * 0.82 + dx * k;
              p.vy = p.vy * 0.82 + dy * k;
              p.x += p.vx; p.y += p.vy;
            }
          }
          if (p.done) { assembledCount++; ctx.shadowBlur = 8 + Math.sin(this.frame * 0.08 + p.gph) * 4; ctx.shadowColor = p.color; }
          break;
        }

        case 'assembled': {
          // Gentle shimmer in place
          p.x = p.tx + Math.sin(this.frame * 0.05 + p.gph) * 0.9;
          p.y = p.ty + Math.cos(this.frame * 0.04 + p.gph) * 0.9;
          ctx.shadowBlur  = 14 + Math.sin(this.frame * 0.06 + p.gph) * 8;
          ctx.shadowColor = p.color;
          break;
        }

        case 'glitching': {
          // Violent per-particle jitter
          const gf = this.phaseFrame;
          const intensity = Math.sin(gf * 0.4) * 10 + 6;
          p.x = p.tx + (Math.random() - 0.5) * intensity;
          p.y = p.ty + (Math.random() - 0.5) * intensity;
          // Color glitch
          const rand = Math.random();
          if (rand > 0.92)      p.color = '#FFFFFF';
          else if (rand > 0.85) p.color = '#FF003C';
          else if (rand > 0.78) p.color = '#00FFCC';
          else                   p.color = p.baseColor;
          ctx.shadowBlur  = 20;
          ctx.shadowColor = p.color;
          break;
        }

        case 'dispersing':
        case 'floating': {
          p.vx += (Math.random() - 0.5) * 0.2;
          p.vy += (Math.random() - 0.5) * 0.2;
          p.vx *= 0.98; p.vy *= 0.98;
          p.x += p.vx; p.y += p.vy;
          p.color = p.baseColor; // restore color

          // Mouse repulsion
          const mdx = p.x - this.mouse.x, mdy = p.y - this.mouse.y;
          const md  = Math.hypot(mdx, mdy);
          if (md < 130 && md > 0) {
            const f = ((130 - md) / 130) * 3;
            p.vx += (mdx / md) * f; p.vy += (mdy / md) * f;
          }
          // Edge wrap
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
          p.opacity = Math.max(0.08, p.opacity - 0.002);
          break;
        }
      }

      this._drawParticle(p, ctx);
      ctx.shadowBlur = 0;
    });

    // ── Phase transitions ──
    this._checkPhaseTransition(assembledCount, W, H, cx, cy);
  }

  /* ── Phase transition logic ─────────────────────────────────── */
  _checkPhaseTransition(assembledCount, W, H, cx, cy) {
    switch (this.phase) {

      case 'bang':
        if (this.phaseFrame >= 55) this._setPhase('scatter');
        break;

      case 'scatter':
        if (this.phaseFrame >= 60) this._setPhase('assembling');
        break;

      case 'assembling':
        if (assembledCount >= this.totalText * 0.93) {
          this._setPhase('assembled');
        }
        break;

      case 'assembled':
        if (this.phaseFrame >= 90) {   // ~1.5s hold
          this._setPhase('glitching');
        }
        break;

      case 'glitching':
        if (this.phaseFrame >= 45) {   // ~0.75s of glitch
          // Give text particles an outward burst velocity
          const textPts = this.particles.filter(p => p.text);
          textPts.forEach(p => {
            const angle = Math.atan2(p.y - H / 2, p.x - W / 2);
            const burst = 2 + Math.random() * 5;
            p.vx = Math.cos(angle) * burst;
            p.vy = Math.sin(angle) * burst;
          });
          this._setPhase('dispersing');
          setTimeout(() => {
            this.phase = 'floating';
            if (this.onDone) this.onDone();
          }, 1400);
        }
        break;
    }
  }

  /* ── Ambient floater update ─────────────────────────────────── */
  _ambientUpdate(p, W, H) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.99; p.vy *= 0.99;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
  }

  /* ── Draw single particle ───────────────────────────────────── */
  _drawParticle(p, ctx) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ── Connection lines ───────────────────────────────────────── */
  _drawConnections() {
    const ctx  = this.ctx;
    const pts  = this.particles.filter(p => p.opacity > 0.25);
    const maxD = (this.phase === 'assembled' || this.phase === 'glitching') ? 42 : 65;
    const aS   = this.phase === 'assembled' ? 0.55 : 0.2;
    const step = this.phase === 'floating' ? 2 : 1;

    for (let i = 0; i < pts.length; i += step) {
      for (let j = i + 1; j < pts.length; j += step) {
        const dx = pts[i].x - pts[j].x;
        if (Math.abs(dx) > maxD) continue;
        const d = Math.hypot(dx, pts[i].y - pts[j].y);
        if (d >= maxD) continue;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.strokeStyle = `rgba(0,212,255,${(1 - d / maxD) * aS})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  /* ── Electric arcs ──────────────────────────────────────────── */
  _drawElectricArcs() {
    if (this.frame % 6 !== 0) return;   // fire every 6 frames

    const ctx = this.ctx;
    const pts = this.particles.filter(p => p.text && p.done);
    if (pts.length < 4) return;

    // Draw 2–4 random arcs per call
    const arcCount = 2 + Math.floor(Math.random() * 3);

    for (let a = 0; a < arcCount; a++) {
      const i = Math.floor(Math.random() * pts.length);
      const p1 = pts[i];

      // Find a nearby particle within 55px
      let p2 = null, bestDist = Infinity;
      for (let k = 0; k < pts.length; k++) {
        if (k === i) continue;
        const d = Math.hypot(p1.x - pts[k].x, p1.y - pts[k].y);
        if (d < 55 && d < bestDist) { bestDist = d; p2 = pts[k]; }
      }
      if (!p2) continue;

      this._zapLine(ctx, p1.x, p1.y, p2.x, p2.y);
    }
  }

  /* ── Draw one jagged lightning arc ─────────────────────────── */
  _zapLine(ctx, x1, y1, x2, y2) {
    const segs = 5 + Math.floor(Math.random() * 4);
    const dx   = x2 - x1, dy = y2 - y1;
    const len  = Math.hypot(dx, dy);
    const nx   = -dy / len, ny = dx / len;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let s = 1; s < segs; s++) {
      const t   = s / segs;
      const mx  = x1 + dx * t + nx * (Math.random() - 0.5) * len * 0.4;
      const my  = y1 + dy * t + ny * (Math.random() - 0.5) * len * 0.4;
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(x2, y2);

    // Double pass: thick dim + thin bright
    ctx.shadowBlur  = 18; ctx.shadowColor = '#00D4FF';
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth   = 2.5; ctx.stroke();

    ctx.strokeStyle = 'rgba(180, 240, 255, 0.95)';
    ctx.lineWidth   = 0.7; ctx.stroke();
    ctx.shadowBlur  = 0;

    // Bright flash dot at both ends
    [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  stop() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
}


/* ═══════════════════════════════════════════════════════════════
   BACKGROUND: ELECTRIC CIRCUIT NETWORK
   Sparse node graph with traveling current pulses + parallax drift.
   Static topology computed once per resize -> heavy work is O(N+E)
   on init only. Per-frame cost is constant (~30 nodes, ~70 edges,
   ~6-12 active pulses) so it stays smooth on every device.
   ═══════════════════════════════════════════════════════════════ */
class BackgroundParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    this.frame    = 0;
    this.mouse    = { x: -9999, y: -9999 };
    this.parallax = { x: 0, y: 0 };

    this.nodes  = [];
    this.edges  = [];
    this.pulses = [];

    this._raf   = null;
    this._bound = this._tick.bind(this);
    this._reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._resize();
    this._buildNetwork();

    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { this._resize(); this._buildNetwork(); }, 150);
    });
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    }, { passive: true });
  }

  _resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width  = W * this.dpr;
    this.canvas.height = H * this.dpr;
    this.canvas.style.width  = W + 'px';
    this.canvas.style.height = H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = W; this.H = H;
  }

  _buildNetwork() {
    const W = this.W, H = this.H;
    const target = Math.max(14, Math.min(30, Math.floor((W * H) / 75000)));
    const minDist = Math.min(W, H) * 0.13;

    this.nodes = [];
    let tries = 0;
    while (this.nodes.length < target && tries < target * 60) {
      tries++;
      const x = 40 + Math.random() * (W - 80);
      const y = 40 + Math.random() * (H - 80);
      let ok = true;
      for (const n of this.nodes) {
        if (Math.hypot(n.x - x, n.y - y) < minDist) { ok = false; break; }
      }
      if (ok) {
        this.nodes.push({
          x, y,
          phase:  Math.random() * Math.PI * 2,
          accent: Math.random() > 0.85
        });
      }
    }

    // Connect each node to 2-3 nearest neighbors (deduped)
    this.edges = [];
    const seen = new Set();
    for (let i = 0; i < this.nodes.length; i++) {
      const dists = [];
      for (let j = 0; j < this.nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(this.nodes[i].x - this.nodes[j].x,
                             this.nodes[i].y - this.nodes[j].y);
        dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      const k = Math.random() > 0.55 ? 2 : 3;
      for (let n = 0; n < Math.min(k, dists.length); n++) {
        const j = dists[n].j;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        this.edges.push({ a: i, b: j, len: dists[n].d });
      }
    }

    this.pulses = [];
    for (let i = 0; i < 4; i++) this._spawnPulse(true);
  }

  _spawnPulse(stagger = false) {
    if (!this.edges.length) return;
    const e = this.edges[Math.floor(Math.random() * this.edges.length)];
    this.pulses.push({
      edge:    e,
      t:       stagger ? Math.random() : 0,
      speed:   0.005 + Math.random() * 0.008,
      reverse: Math.random() > 0.5,
      orange:  this.nodes[e.a].accent || this.nodes[e.b].accent || Math.random() > 0.82
    });
  }

  _burstFrom(idx) {
    for (const e of this.edges) {
      if (e.a === idx || e.b === idx) {
        this.pulses.push({
          edge:    e,
          t:       0,
          speed:   0.013,
          reverse: e.b === idx,
          orange:  true
        });
      }
    }
  }

  start() {
    if (this._reduceMotion) { this._renderStatic(); return; }
    this._raf = requestAnimationFrame(this._bound);
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }

  _renderStatic() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this._drawEdges(ctx);
    this._drawNodes(ctx, true);
  }

  _tick() {
    this._raf = requestAnimationFrame(this._bound);
    this.frame++;

    if (this.mouse.x > -9000) {
      const tx = (this.mouse.x - this.W / 2) * 0.012;
      const ty = (this.mouse.y - this.H / 2) * 0.012;
      this.parallax.x += (tx - this.parallax.x) * 0.04;
      this.parallax.y += (ty - this.parallax.y) * 0.04;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    ctx.save();
    ctx.translate(this.parallax.x, this.parallax.y);
    this._drawEdges(ctx);
    this._drawNodes(ctx, false);
    this._drawPulses(ctx);
    ctx.restore();

    if (this.frame % 22 === 0 && this.pulses.length < 14) this._spawnPulse();
    if (this.frame % 420 === 0 && this.nodes.length) {
      this._burstFrom(Math.floor(Math.random() * this.nodes.length));
    }
  }

  _drawEdges(ctx) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.09)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const e of this.edges) {
      const a = this.nodes[e.a], b = this.nodes[e.b];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  _drawNodes(ctx, isStatic) {
    for (const n of this.nodes) {
      const pulse = isStatic
        ? 0.5
        : 0.5 + 0.5 * Math.sin(this.frame * 0.022 + n.phase);
      const r = 1.2 + pulse * 0.7;
      const col = n.accent ? '255,107,0' : '0,212,255';

      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 7);
      grad.addColorStop(0,   `rgba(${col},${0.32 + pulse * 0.22})`);
      grad.addColorStop(0.4, `rgba(${col},0.06)`);
      grad.addColorStop(1,   `rgba(${col},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 7, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = n.accent ? '#FF6B00' : '#00D4FF';
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  _drawPulses(ctx) {
    const next = [];
    for (const p of this.pulses) {
      p.t += p.speed;
      if (p.t >= 1) continue;
      const a = this.nodes[p.edge.a], b = this.nodes[p.edge.b];
      const start = p.reverse ? b : a;
      const end   = p.reverse ? a : b;
      const x = start.x + (end.x - start.x) * p.t;
      const y = start.y + (end.y - start.y) * p.t;
      const trailT = Math.max(0, p.t - 0.20);
      const tx = start.x + (end.x - start.x) * trailT;
      const ty = start.y + (end.y - start.y) * trailT;

      const col = p.orange ? '255,107,0' : '0,212,255';
      const grad = ctx.createLinearGradient(tx, ty, x, y);
      grad.addColorStop(0, `rgba(${col},0)`);
      grad.addColorStop(1, `rgba(${col},0.85)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();

      ctx.shadowColor = p.orange ? '#FF6B00' : '#00D4FF';
      ctx.shadowBlur  = 10;
      ctx.fillStyle = p.orange ? '#FF6B00' : '#00D4FF';
      ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      next.push(p);
    }
    this.pulses = next;
  }
}

window.ParticleSystem      = ParticleSystem;
window.BackgroundParticles = BackgroundParticles;
