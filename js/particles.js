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
   BACKGROUND: WARP VORTEX TUNNEL
   Rotating perspective rectangles + hyperspace streaks
   Speed + rotation ramp on scroll
   ═══════════════════════════════════════════════════════════════ */
class BackgroundParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.frame     = 0;
    this.scrollY   = 0;
    this.scrollVel = 0;
    this.lastSY    = 0;
    this.mouse     = { x: -9999, y: -9999 };
    this.warpers   = [];
    this.floaters  = [];

    this._raf   = null;
    this._bound = this._tick.bind(this);

    this._resize();
    window.addEventListener('resize', () => { this._resize(); this._initFloaters(); });
    window.addEventListener('scroll', () => {
      const dy = window.scrollY - this.lastSY;
      this.scrollVel = Math.min(Math.abs(dy) * 0.9, 35);
      this.lastSY = this.scrollY = window.scrollY;
    }, { passive: true });
    window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
  }

  _resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }

  start() { this._initFloaters(); this._initWarpers(); this._raf = requestAnimationFrame(this._bound); }

  _initFloaters() {
    const W = this.canvas.width, H = this.canvas.height;
    const n = Math.min(Math.floor(W * H / 22000), 70);
    this.floaters = [];
    for (let i = 0; i < n; i++) {
      this.floaters.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.4,
        a: Math.random() * 0.18 + 0.04,
        ph: Math.random() * Math.PI * 2,
      });
    }
  }

  _initWarpers() {
    this.warpers = [];
    for (let i = 0; i < 95; i++) this._spawnWarper(true);
  }

  _spawnWarper(rand = false) {
    const W = this.canvas.width, H = this.canvas.height;
    const maxR  = Math.hypot(W, H) * 0.6;
    const angle = Math.random() * Math.PI * 2;
    const dist  = rand ? Math.random() * maxR : 3;
    this.warpers.push({
      angle, dist,
      baseSpeed: 0.8 + Math.random() * 2.4,
      r: Math.random() * 1.2 + 0.4,
      maxR,
      px: W / 2 + Math.cos(angle) * dist,
      py: H / 2 + Math.sin(angle) * dist,
      color:   Math.random() > 0.88 ? 'orange' : 'cyan',
      opacity: rand ? Math.random() * 0.5 : 0,
    });
  }

  _tick() {
    this._raf = requestAnimationFrame(this._bound);
    this.frame++;
    this.scrollVel *= 0.92;

    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    this._drawTunnel(ctx, W, H, cx, cy);
    this._drawSpokes(ctx, W, H, cx, cy);
    this._updateWarpers(ctx, cx, cy);
    this._updateFloaters(ctx, W, H);
    this._drawFloaterLinks(ctx);
  }

  _drawTunnel(ctx, W, H, cx, cy) {
    const sv    = this.scrollVel;
    const tSpd  = 0.0015 + sv * 0.006;
    const t     = this.frame * tSpd;
    const rotB  = this.frame * 0.0003;
    const rot   = rotB + sv * 0.0015;
    const asp   = H / W;
    const LAYER = 28;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    for (let i = 0; i < LAYER; i++) {
      const raw = (i / LAYER + t * 0.3) % 1;
      const maxS = Math.max(W, H) * 1.6;
      const hw   = raw * maxS * 0.5;
      const hh   = hw * asp;

      let alpha;
      if      (raw < 0.06) alpha = (raw / 0.06) * 0.22;
      else if (raw > 0.65) alpha = ((1 - raw) / 0.35) * 0.22;
      else                  alpha = 0.22;

      const gb = Math.floor(180 + raw * 75);
      ctx.strokeStyle = `rgba(0,${gb},255,${alpha})`;
      ctx.lineWidth   = raw < 0.12 ? 0.3 : 0.4 + raw * 1.2;
      ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);

      if (i % 4 === 0 && raw > 0.1 && raw < 0.9) {
        ctx.strokeStyle = `rgba(0,212,255,${alpha * 1.8})`;
        ctx.lineWidth = 0.2;
        ctx.strokeRect(-hw + 1, -hh + 1, hw * 2 - 2, hh * 2 - 2);
      }
    }
    ctx.restore();

    // Periodic flash
    if (this.frame % 240 < 4) {
      const fa = (4 - this.frame % 240) / 4 * 0.07;
      ctx.fillStyle = `rgba(0,212,255,${fa})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Scroll burst
    if (sv > 8) {
      ctx.fillStyle = `rgba(0,212,255,${Math.min(sv / 180, 0.09)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawSpokes(ctx, W, H, cx, cy) {
    const rot = this.frame * 0.0003 + this.scrollVel * 0.0015;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + rot;
      const ex    = cx + Math.cos(angle) * Math.hypot(W, H);
      const ey    = cy + Math.sin(angle) * Math.hypot(W, H);
      const g     = ctx.createLinearGradient(cx, cy, ex, ey);
      g.addColorStop(0,   'rgba(0,212,255,0.0)');
      g.addColorStop(0.05,'rgba(0,212,255,0.12)');
      g.addColorStop(0.4, 'rgba(0,212,255,0.04)');
      g.addColorStop(1,   'rgba(0,212,255,0.0)');
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = g; ctx.lineWidth = 0.6; ctx.stroke();
    }
  }

  _updateWarpers(ctx, cx, cy) {
    while (this.warpers.length < 95) this._spawnWarper(false);
    const sm = 1 + this.scrollVel * 0.25;

    this.warpers = this.warpers.filter(p => {
      if (p.opacity < 0.8) p.opacity = Math.min(0.8, p.opacity + 0.015);
      const prevX = p.px, prevY = p.py;
      p.dist += p.baseSpeed * sm;
      p.px = cx + Math.cos(p.angle) * p.dist;
      p.py = cy + Math.sin(p.angle) * p.dist;
      if (p.dist > p.maxR) return false;

      // Streak trail
      const tx = cx + Math.cos(p.angle) * Math.max(2, p.dist - 22 * sm);
      const ty = cy + Math.sin(p.angle) * Math.max(2, p.dist - 22 * sm);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(p.px, p.py);
      const pct = p.dist / p.maxR;
      const gb  = Math.floor(180 + pct * 75);
      ctx.strokeStyle = p.color === 'orange'
        ? `rgba(255,107,0,${p.opacity * 0.6})`
        : `rgba(0,${gb},255,${p.opacity * 0.6})`;
      ctx.lineWidth = p.r * (0.5 + pct * 1.5); ctx.stroke();

      // Head dot
      ctx.beginPath(); ctx.arc(p.px, p.py, p.r * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = p.color === 'orange'
        ? `rgba(255,107,0,${p.opacity})`
        : `rgba(0,212,255,${p.opacity})`;
      ctx.fill();
      return true;
    });
  }

  _updateFloaters(ctx, W, H) {
    this.floaters.forEach(p => {
      const mdx = p.x - this.mouse.x, mdy = p.y - this.mouse.y;
      const md  = Math.hypot(mdx, mdy);
      if (md < 180 && md > 0) { const f = ((180 - md) / 180) * 0.04; p.vx += (mdx / md) * f; p.vy += (mdy / md) * f; }
      p.vx *= 0.99; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.018 + p.ph);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = '#00D4FF';
      ctx.globalAlpha = p.a * pulse; ctx.fill(); ctx.globalAlpha = 1;
    });
  }

  _drawFloaterLinks(ctx) {
    for (let i = 0; i < this.floaters.length; i++) {
      for (let j = i + 1; j < this.floaters.length; j++) {
        const dx = this.floaters[i].x - this.floaters[j].x;
        if (Math.abs(dx) > 100) continue;
        const d = Math.hypot(dx, this.floaters[i].y - this.floaters[j].y);
        if (d > 100) continue;
        ctx.beginPath();
        ctx.moveTo(this.floaters[i].x, this.floaters[i].y);
        ctx.lineTo(this.floaters[j].x, this.floaters[j].y);
        ctx.strokeStyle = `rgba(0,212,255,${(1 - d / 100) * 0.07})`;
        ctx.lineWidth = 0.4; ctx.stroke();
      }
    }
  }
}

window.ParticleSystem      = ParticleSystem;
window.BackgroundParticles = BackgroundParticles;
