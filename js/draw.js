/* ==========================================================================
   ПОМИДОРЫ ПОД МИНСКОМ — отрисовка и главный цикл
   ========================================================================== */
'use strict';

const F = (s, w) => (w || 700) + ' ' + s + "px 'Nunito','Trebuchet MS',sans-serif";

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function txt(s, x, y, size, color, align, weight) {
  ctx.font = F(size, weight);
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
function shadowText(s, x, y, size, color, align, weight) {
  ctx.font = F(size, weight);
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillText(s, x + 1.5, y + 1.5);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/* ------------------------------------------------------------------ фон */
function drawGreenhouse() {
  const dayP = G ? clamp(1 - G.left / RUN_TIME, 0, 1) : 0.2;

  /* небо и участок за стеклом */
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#7cc3f2');
  sky.addColorStop(1, lerpColorHex('#dff0ff', '#ffd9a8', clamp((dayP - 0.6) * 2, 0, 1)));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 200);

  /* солнце ползёт по небу */
  const sx = 90 + dayP * 780, sy = 120 - Math.sin(Math.PI * dayP) * 74;
  ctx.save();
  ctx.globalAlpha = 0.85;
  const gl = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
  gl.addColorStop(0, 'rgba(255,246,190,.95)');
  gl.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, 90, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff6bd'; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.fill();
  ctx.restore();

  /* соседское поле картошки — источник всех бед */
  ctx.fillStyle = '#7fa855'; ctx.fillRect(0, 150, W, 50);
  ctx.fillStyle = '#5f8a3c';
  for (let i = 0; i < 26; i++) {
    const x = (i * 41 + (G ? Math.sin(G.t * 0.1 + i) * 3 : 0));
    ctx.beginPath(); ctx.ellipse(x, 170 + (i % 3) * 9, 16, 7, 0, 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(60,90,40,.35)'; ctx.fillRect(0, 186, W, 14);

  /* стекло дальней стены */
  ctx.fillStyle = 'rgba(210,240,255,.20)'; ctx.fillRect(0, 34, W, 166);
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  for (let x = 40; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x, 200); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, 108); ctx.lineTo(W, 108); ctx.stroke();

  /* конденсат на стекле — тем гуще, чем выше влажность */
  if (G) {
    const drops = Math.floor(clamp((G.hum - 45) / 55, 0, 1) * 90);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < drops; i++) {
      const x = ((i * 137) % W), y = 40 + ((i * 89) % 150);
      ctx.beginPath(); ctx.ellipse(x, y + Math.sin(G.t + i) * 2, 2.2, 3.6, 0, 0, 7); ctx.fill();
    }
  }

  /* каркас и балка */
  ctx.fillStyle = '#cdd6c6'; ctx.fillRect(0, 26, W, 12);
  ctx.fillStyle = '#aab5a2'; ctx.fillRect(0, 194, W, 14);
  ctx.fillStyle = '#b9c3b1'; ctx.fillRect(0, 34, 14, 166); ctx.fillRect(W - 14, 34, 14, 166);

  drawVents();

  /* пол парника */
  const gr = ctx.createLinearGradient(0, 200, 0, 600);
  gr.addColorStop(0, '#5b4630'); gr.addColorStop(1, '#3b2c1d');
  ctx.fillStyle = gr; ctx.fillRect(0, 200, W, 400);

  /* дорожка между грядками */
  ctx.fillStyle = 'rgba(120,104,80,.35)';
  ctx.fillRect(0, 200, W, 400);
  ctx.fillStyle = 'rgba(30,22,14,.25)';
  for (const y of ROWS) { rr(110, y - 6, 640, 62, 26); ctx.fill(); }

  /* грядки */
  for (const y of ROWS) {
    ctx.fillStyle = '#4a3626';
    rr(112, y - 14, 636, 58, 24); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    rr(112, y - 14, 636, 14, 10); ctx.fill();
  }

  /* лучи света с крыши */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.10;
  for (let i = 0; i < 5; i++) {
    const off = ((G ? G.t * 8 : 0) + i * 210) % 1300 - 200;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(off, 200); ctx.lineTo(off + 90, 200);
    ctx.lineTo(off + 240, 600); ctx.lineTo(off + 110, 600);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function lerpColorHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return 'rgb(' + pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',') + ')';
}

function drawVents() {
  for (const s of STATIONS) {
    if (s.id !== 'vent') continue;
    const open = G && G.vents[s.idx];
    ctx.save();
    ctx.translate(s.x, 150);
    ctx.fillStyle = '#9aa392';
    rr(-46, -44, 92, 66, 6); ctx.fill();
    ctx.fillStyle = open ? '#7ec8ff' : 'rgba(220,245,255,.55)';
    rr(-40, -38, 80, 54, 4); ctx.fill();
    ctx.save();
    ctx.translate(0, -38);
    ctx.rotate(open ? -0.85 : -0.06);
    ctx.fillStyle = 'rgba(230,250,255,.85)';
    ctx.strokeStyle = '#8b9585'; ctx.lineWidth = 2;
    rr(-40, 0, 80, 54, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (open && G) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const ph = (G.t * 60 + i * 22) % 60;
        ctx.beginPath();
        ctx.moveTo(-26 + i * 22, 20 + ph * 0.5);
        ctx.lineTo(-16 + i * 22, 34 + ph * 0.5);
        ctx.stroke();
      }
    }
    txt(open ? 'ОТКРЫТА' : 'ЗАКРЫТА', 0, 32, 11, open ? '#8fe36b' : '#c9d6c2', 'center', 900);
    ctx.restore();
  }
}

/* --------------------------------------------------------- станции */
function drawStations() {
  const p = G.p;
  for (const s of STATIONS) {
    if (s.id === 'vent') continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(0, 34, 44, 13, 0, 0, 7); ctx.fill();

    if (s.id === 'barrel') {
      ctx.fillStyle = '#5e6b4e'; rr(-36, -46, 72, 82, 10); ctx.fill();
      ctx.fillStyle = '#48543b'; rr(-36, -46, 72, 12, 6); ctx.fill();
      ctx.fillStyle = '#6b4a1f'; ctx.beginPath(); ctx.ellipse(0, -42, 32, 11, 0, 0, 7); ctx.fill();
      /* пузыри в жиже */
      for (let i = 0; i < 3; i++) {
        const ph = (G.t * 0.8 + i * 0.4) % 1;
        ctx.fillStyle = 'rgba(140,110,60,' + (1 - ph) * 0.8 + ')';
        ctx.beginPath(); ctx.arc(-14 + i * 14, -42 - ph * 4, 2 + ph * 4, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = '#3f4936'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-36, -8); ctx.lineTo(36, -8); ctx.stroke();
      txt('ЖИЖА', 0, 12, 13, '#dbe6d2', 'center', 900);
      /* вонь */
      ctx.strokeStyle = 'rgba(160,190,120,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const o = (G.t * 26 + i * 30) % 60;
        ctx.beginPath();
        ctx.arc(-16 + i * 16, -54 - o, 5 + o * 0.12, Math.PI * 0.15, Math.PI * 0.95);
        ctx.stroke();
      }
    } else if (s.id === 'kupor') {
      ctx.fillStyle = '#7c6a52'; rr(-42, -10, 84, 12, 4); ctx.fill();
      ctx.fillStyle = '#6a5a45'; ctx.fillRect(-34, 2, 8, 30); ctx.fillRect(26, 2, 8, 30);
      ctx.fillStyle = '#2b7fc4'; rr(-24, -44, 30, 34, 5); ctx.fill();
      ctx.fillStyle = '#4aa3e0'; rr(-20, -40, 22, 12, 3); ctx.fill();
      ctx.fillStyle = '#d9d2c4'; rr(6, -36, 18, 26, 4); ctx.fill();
      txt('КУПОРОС', 0, 20, 12, '#bfe3ff', 'center', 900);
    } else if (s.id === 'vodka') {
      ctx.fillStyle = '#7c6a52'; rr(-40, -12, 80, 46, 6); ctx.fill();
      ctx.fillStyle = '#8d7a5e'; rr(-40, -12, 80, 8, 4); ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.translate(-20 + i * 20, -14);
        ctx.fillStyle = '#cfe8d8'; rr(-7, -34, 14, 34, 3); ctx.fill();
        ctx.fillStyle = '#cfe8d8'; ctx.fillRect(-3, -46, 6, 14);
        ctx.fillStyle = '#d94a3d'; ctx.fillRect(-3.5, -48, 7, 5);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-5, -30, 2, 24);
        ctx.restore();
      }
      txt('НЗ', 0, 12, 13, '#ffd93d', 'center', 900);
    } else if (s.id === 'crate') {
      ctx.fillStyle = '#8a6a3f'; rr(-40, -26, 80, 62, 6); ctx.fill();
      ctx.fillStyle = '#a07d4c'; rr(-40, -26, 80, 10, 4); ctx.fill();
      ctx.strokeStyle = '#6d5230'; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 26, -18); ctx.lineTo(i * 26, 34); ctx.stroke(); }
      const n = Math.min(14, G.crate);
      for (let i = 0; i < n; i++) {
        const cx = -28 + (i % 5) * 14, cy = -18 - Math.floor(i / 5) * 11;
        ctx.fillStyle = '#d64027'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx - 2, cy - 2.5, 2.2, 0, 7); ctx.fill();
      }
      txt(G.crate + '/' + GOAL, 0, 46, 15, '#ffd93d', 'center', 900);
    }
    ctx.restore();
  }

  /* мухи над бочкой */
  ctx.fillStyle = '#1b1b16';
  for (const f of G.flies) {
    const x = f.hx + Math.cos(f.a) * f.r * 1.5, y = f.hy + Math.sin(f.a * 1.3 + f.ph) * f.r * 0.6;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
  }
}

/* --------------------------------------------------------- растения */
function drawPlant(pl) {
  const wet = clamp(pl.moist, 0, 1);
  ctx.save();
  ctx.translate(pl.x, pl.y);

  /* земля под кустом */
  ctx.fillStyle = lerpColorHex('#7a6042', '#2b1f13', wet);
  ctx.beginPath(); ctx.ellipse(0, 14, 40, 15, 0, 0, 7); ctx.fill();
  if (wet > 0.88) {
    ctx.fillStyle = 'rgba(120,150,90,.35)';
    ctx.beginPath(); ctx.ellipse(0, 14, 32 * wet, 11 * wet, 0, 0, 7); ctx.fill();
  }
  if (wet < 0.2) {
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-24 + i * 18, 8); ctx.lineTo(-16 + i * 18, 22); ctx.stroke();
    }
  }

  if (!pl.alive) {
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(0, 8);
      ctx.quadraticCurveTo(i * 16, -16, i * 26 + Math.sin(pl.deadT + i) * 3, -30 - Math.abs(i) * 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a2c1c';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(-22 + i * 11, -8 - (i % 2) * 8, 7, 3.4, i * 0.7, 0, 7); ctx.fill();
    }
    txt('☠', 0, -52, 22, 'rgba(210,120,110,.9)', 'center', 900);
    ctx.restore();
    return;
  }

  const g = clamp(pl.growth, 0.05, 1);
  const scale = 0.45 + g * 0.75 + pl.pop * 0.12;
  const sick = clamp(pl.infect, 0, 1);
  const sway = Math.sin(pl.sway * 1.4) * (2 + g * 3);
  const leafC = lerpColorHex('#4b9c2f', '#6b5a26', sick * 0.85);
  const leafD = lerpColorHex('#2f6b20', '#4a3a18', sick * 0.85);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(sway * 0.4, 0);

  /* стебель */
  ctx.strokeStyle = leafD; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.quadraticCurveTo(sway * 0.3, -20, sway, -52); ctx.stroke();

  /* листва */
  const leaves = [[-30, -18, 20, 11, -0.5], [30, -20, 20, 11, 0.5], [-22, -40, 17, 9, -0.7],
                  [24, -42, 17, 9, 0.7], [0, -58, 18, 10, 0], [-12, -6, 15, 8, -0.3], [14, -4, 15, 8, 0.3]];
  for (let i = 0; i < leaves.length; i++) {
    const L = leaves[i];
    const wob = Math.sin(pl.sway * 1.6 + i) * 2.2;
    ctx.fillStyle = i % 2 ? leafC : leafD;
    ctx.beginPath();
    ctx.ellipse(L[0] + wob + sway * 0.2, L[1] + wob * 0.4, L[2], L[3], L[4] + wob * 0.02, 0, 7);
    ctx.fill();
  }
  /* пятна фитофторы */
  if (sick > 0.18) {
    ctx.fillStyle = 'rgba(45,32,12,.85)';
    const n = Math.floor(sick * 12);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, r = 12 + (i % 4) * 9;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 1.6, -26 + Math.sin(a) * r * 0.8, 3 + (i % 3), 2.4 + (i % 3) * 0.7, a, 0, 7);
      ctx.fill();
    }
  }
  ctx.restore();

  /* плоды */
  for (const f of pl.fruits) {
    const t = clamp(f.t, 0, 1);
    const rad = (5 + t * 6.5) * (0.85 + pl.growth * 0.3) * (1 + f.pop * 0.35);
    const col = t < 0.5 ? lerpColorHex('#69a83a', '#d9c33a', t / 0.5)
                        : lerpColorHex('#d9c33a', '#d64027', (t - 0.5) / 0.5);
    const x = f.dx + Math.sin(f.sw * 1.2 + f.dx) * 1.8 * (f.t >= 1 ? 1.6 : 1);
    const y = f.dy + (f.t > 1 ? (f.t - 1) * 8 : 0);
    if (f.t >= 1) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(G.t * 5 + f.dx) * 0.15;
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(x, y, rad + 5, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.arc(x - rad * 0.3, y - rad * 0.35, rad * 0.28, 0, 7); ctx.fill();
    /* гниль */
    if (f.rot > 0.06) {
      ctx.fillStyle = 'rgba(40,28,10,' + clamp(f.rot * 1.4, 0, 0.9) + ')';
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + f.dx;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * rad * 0.4, y + Math.sin(a) * rad * 0.4, rad * 0.3 * f.rot + 1.2, rad * 0.26 * f.rot + 1, a, 0, 7);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#3f7a26';
    ctx.beginPath(); ctx.ellipse(x, y - rad * 0.95, rad * 0.5, rad * 0.22, 0, 0, 7); ctx.fill();
  }

  /* иммунитет после купороса */
  if (pl.immune > 0) {
    ctx.save();
    ctx.globalAlpha = 0.16 + Math.sin(G.t * 3) * 0.05;
    ctx.fillStyle = '#7ec8ff';
    ctx.beginPath(); ctx.ellipse(0, -30, 46, 50, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  /* попадание споры */
  if (pl.hit > 0) {
    ctx.save(); ctx.globalAlpha = pl.hit;
    ctx.strokeStyle = '#c9a34a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -30, 40 + (0.5 - pl.hit) * 40, 0, 7); ctx.stroke();
    ctx.restore();
  }

  /* значки состояния */
  let icon = '', ic = '#fff';
  if (ripeCount(pl) > 0) { icon = pl.wait > 0 ? '⏳' : '🍅'; }
  else if (pl.infect > 0.35) { icon = '🦠'; }
  else if (pl.moist < 0.18) { icon = '🥵'; }
  if (icon) {
    const by = -78 - Math.abs(Math.sin(G.t * 3)) * 5;
    ctx.font = F(20);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ic;
    ctx.fillText(icon, 0, by);
  }
  ctx.restore();
}

/* --------------------------------------------------------- огородник */
function drawFarmer() {
  const p = G.p;
  const bob = Math.sin(p.walk * 6) * ((p.vx || p.vy) ? 3 : 0);
  const legA = Math.sin(p.walk * 6) * ((p.vx || p.vy) ? 0.9 : 0);
  const bend = p.exhausted ? 0.35 : (p.busyKind === 'replant' ? 0.55 : 0);
  const tilt = p.wobble > 0 ? Math.sin(G.t * 3.3) * 0.09 * p.wobble : 0;
  const hot = clamp((G.temp - 28) / 14, 0, 1);

  ctx.save();
  ctx.translate(p.x, p.y);

  /* тень */
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 6, 30, 11, 0, 0, 7); ctx.fill();

  ctx.rotate(tilt);
  ctx.scale(p.face, 1);
  ctx.translate(0, bob - 2);

  /* ноги: треники с лампасами + кирзачи */
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 9, -34);
    ctx.rotate(legA * s * 0.8);
    ctx.fillStyle = '#5c6470'; rr(-9, 0, 18, 30, 6); ctx.fill();
    ctx.fillStyle = '#8d96a3'; ctx.fillRect(-8 + (s > 0 ? 12 : 0), 2, 3, 26);
    ctx.fillStyle = '#2b241c'; rr(-10, 26, 21, 12, 4); ctx.fill();
    ctx.restore();
  }

  ctx.rotate(bend);

  /* торс: майка-алкоголичка на пузе */
  ctx.fillStyle = '#c9a07a';                    /* загорелое пузо */
  rr(-22, -70, 44, 40, 16); ctx.fill();
  ctx.fillStyle = '#dfe7ef';                    /* майка */
  rr(-23, -74, 46, 28, 12); ctx.fill();
  ctx.fillStyle = '#c6d2dd';
  rr(-23, -74, 46, 8, 6); ctx.fill();
  ctx.fillStyle = '#dfe7ef';
  rr(-19, -84, 8, 14, 4); ctx.fill(); rr(11, -84, 8, 14, 4); ctx.fill();
  /* пятна пота на майке */
  if (hot > 0.2) {
    ctx.fillStyle = 'rgba(150,175,195,' + (0.25 + hot * 0.4) + ')';
    ctx.beginPath(); ctx.ellipse(-14, -62, 8, 10, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(14, -62, 8, 10, 0, 0, 7); ctx.fill();
  }

  /* руки */
  const armSwing = legA * 0.6;
  const skin = lerpColorHex('#c9a07a', '#d9694f', hot * 0.6);
  ctx.strokeStyle = skin; ctx.lineWidth = 9; ctx.lineCap = 'round';
  /* дальняя рука */
  ctx.beginPath(); ctx.moveTo(-16, -74);
  ctx.lineTo(-24 - armSwing * 8, -48); ctx.stroke();
  /* ближняя рука зависит от занятия */
  let hx = 26, hy = -50;
  if (p.busyKind === 'water')   { hx = 30; hy = -62; }
  if (p.busyKind === 'harvest') { hx = 34; hy = -58; }
  if (p.busyKind === 'vodka' || p.swig > 0) { hx = 10; hy = -96; }
  if (p.busyKind === 'kupor')   { hx = 28 + Math.sin(G.t * 14) * 6; hy = -58; }
  ctx.beginPath(); ctx.moveTo(16, -74);
  ctx.quadraticCurveTo(24, -64, hx, hy); ctx.stroke();

  /* инвентарь в руке */
  if (p.busyKind !== 'vodka' && p.swig <= 0) drawBucket(hx, hy, p);

  /* помидоры в охапке */
  for (let i = 0; i < p.hands; i++) {
    const cx = -14 + (i % 3) * 13, cy = -56 - Math.floor(i / 3) * 11;
    ctx.fillStyle = '#d64027'; ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 2, 0, 7); ctx.fill();
  }

  /* опрыскиватель за спиной */
  ctx.fillStyle = p.spray > 0 ? '#2b7fc4' : '#5a6470';
  rr(-34, -76, 14, 26, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(-32, -74 + (1 - p.spray / SPRAY_MAX) * 22, 10, 2);

  /* голова */
  ctx.save();
  ctx.translate(0, -92);
  const drink = p.busyKind === 'vodka' || p.swig > 0;
  if (drink) ctx.rotate(-0.42);
  const face = lerpColorHex('#d9b48d', '#e0715a', Math.max(hot * 0.75, clamp((p.energy - 95) / 35, 0, 1) * 0.8));
  /* уши */
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(-17, 2, 5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(17, 2, 5, 0, 7); ctx.fill();
  /* лысый череп */
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 20, 0, 0, 7); ctx.fill();
  /* блик на лысине */
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath(); ctx.ellipse(-6, -11, 6.5, 4, -0.5, 0, 7); ctx.fill();
  /* остатки шевелюры по бокам */
  ctx.fillStyle = '#8a8378';
  ctx.beginPath(); ctx.ellipse(-15, 4, 5, 7, 0.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(15, 4, 5, 7, -0.4, 0, 7); ctx.fill();
  /* брови и глаза */
  ctx.fillStyle = '#5b5348';
  ctx.fillRect(2, -7, 11, 3); ctx.fillRect(-12, -7, 9, 3);
  ctx.fillStyle = '#26201a';
  if (p.exhausted) { ctx.fillRect(3, -1, 9, 2); ctx.fillRect(-11, -1, 8, 2); }
  else { ctx.beginPath(); ctx.arc(7, 0, 2.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(-7, 0, 2.4, 0, 7); ctx.fill(); }
  /* нос картошкой */
  ctx.fillStyle = lerpColorHex('#c98f6a', '#c8503e', clamp(hot * 0.5 + (p.energy - 90) / 60, 0, 1));
  ctx.beginPath(); ctx.ellipse(4, 6, 6, 5, 0.2, 0, 7); ctx.fill();
  /* усы */
  ctx.fillStyle = '#6b6156';
  ctx.beginPath(); ctx.ellipse(0, 12, 12, 4, 0, 0, 7); ctx.fill();
  /* рот */
  ctx.fillStyle = '#3a2a22';
  if (drink) { ctx.beginPath(); ctx.arc(2, 17, 3.4, 0, 7); ctx.fill(); }
  else if (p.exhausted || hot > 0.5) { ctx.beginPath(); ctx.ellipse(2, 18, 5, 3.4, 0, 0, 7); ctx.fill(); }
  else { ctx.fillRect(-3, 17, 10, 2); }
  /* румянец */
  if (p.energy > 90 || hot > 0.4) {
    ctx.fillStyle = 'rgba(210,90,70,.35)';
    ctx.beginPath(); ctx.arc(-11, 8, 5.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(13, 8, 5.5, 0, 7); ctx.fill();
  }
  /* бутылка у рта */
  if (drink) {
    ctx.save();
    ctx.translate(12, 6); ctx.rotate(-0.9);
    ctx.fillStyle = '#cfe8d8'; rr(-6, -34, 12, 30, 3); ctx.fill();
    ctx.fillStyle = '#cfe8d8'; ctx.fillRect(-3, -8, 6, 10);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-4, -30, 2, 20);
    ctx.restore();
  }
  ctx.restore();

  ctx.restore();

  /* кольцо прогресса действия */
  if (p.busy > 0) {
    const pr = 1 - p.busy / p.busyMax;
    ctx.save();
    ctx.translate(p.x, p.y - 128);
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); ctx.stroke();
    ctx.restore();
  }
}

function drawBucket(hx, hy, p) {
  ctx.save();
  ctx.translate(hx + 6, hy + 8);
  if (p.busyKind === 'water') ctx.rotate(-0.9);
  ctx.fillStyle = '#8d96a3';
  ctx.beginPath();
  ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineTo(8, 18); ctx.lineTo(-8, 18);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6c757f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI, 0); ctx.stroke();
  const lvl = p.bucket / BUCKET_MAX;
  if (lvl > 0) {
    ctx.fillStyle = '#6b4a1f';
    ctx.fillRect(-10 + (1 - lvl) * 2, 3 + (1 - lvl) * 12, 20 - (1 - lvl) * 4, 14 * lvl + 1);
  }
  ctx.restore();
}

/* --------------------------------------------------------- эффекты */
function drawSporesAndParts() {
  for (const s of G.spores) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#c0b062';
    ctx.beginPath(); ctx.arc(0, 0, s.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(90,80,30,.8)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const a = s.a + i * 1.256;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (s.r + 4), Math.sin(a) * (s.r + 4)); ctx.stroke();
    }
    ctx.restore();
  }
  for (const q of G.parts) {
    const a = clamp(q.life / q.max, 0, 1);
    if (q.kind === 'text') {
      ctx.save(); ctx.globalAlpha = a;
      shadowText(q.txt, q.x, q.y, 17, q.c, 'center', 900);
      ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = q.c;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
}

function drawHeat() {
  const hot = clamp((G.temp - 30) / 16, 0, 1);
  if (hot > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = hot * 0.08;
    ctx.fillStyle = '#ffb45c';
    for (let i = 0; i < 16; i++) {
      const y = 210 + i * 24;
      const off = Math.sin(G.t * 2.2 + i * 0.7) * 12 * hot;
      ctx.fillRect(off, y, W, 11);
    }
    ctx.restore();
    ctx.save();
    const vg = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 620);
    vg.addColorStop(0, 'rgba(255,80,20,0)');
    vg.addColorStop(1, 'rgba(255,60,10,' + hot * 0.45 + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (G.p.exhausted) {
    ctx.fillStyle = 'rgba(20,25,40,.32)'; ctx.fillRect(0, 0, W, H);
    const pulse = 0.5 + Math.sin(G.t * 6) * 0.5;
    shadowText('ГРАДУС НА НУЛЕ — К ЯЩИКУ ПОД СТОЛОМ!', W / 2, H - 44, 26,
      'rgba(255,' + Math.floor(120 + pulse * 100) + ',90,1)', 'center', 900);
  }
  if (G.flash > 0) {
    ctx.save(); ctx.globalAlpha = G.flash * 0.25;
    ctx.fillStyle = G.flashC; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

/* --------------------------------------------------------- интерфейс */
function bar(x, y, w, h, v, col, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,.45)'; rr(x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = col; rr(x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); ctx.fill();
}

function drawHUD() {
  const p = G.p;

  ctx.fillStyle = 'rgba(12,20,14,.82)';
  ctx.fillRect(0, 0, W, 30);

  /* время */
  const m = Math.floor(Math.max(0, G.left) / 60), s = Math.floor(Math.max(0, G.left) % 60);
  const timeLow = G.left < 45;
  shadowText('⏱ ' + m + ':' + String(s).padStart(2, '0'), 12, 15, 17,
    timeLow && Math.sin(G.t * 8) > 0 ? '#ff8a5c' : '#eafbe6', 'left', 900);

  /* урожай */
  shadowText('🍅 ' + G.crate + '/' + GOAL, 96, 15, 17, '#ffd93d', 'left', 900);
  bar(176, 10, 110, 10, G.crate / GOAL, '#d64027');

  /* руки */
  shadowText('✋ ' + p.hands + '/' + HANDS_MAX, 300, 15, 16, p.hands >= HANDS_MAX ? '#ffb45c' : '#eafbe6', 'left', 900);

  /* ведро и купорос */
  shadowText('🪣', 378, 15, 15, '#eafbe6', 'left', 900);
  for (let i = 0; i < BUCKET_MAX; i++) {
    ctx.fillStyle = i < p.bucket ? '#9c6f2f' : 'rgba(255,255,255,.18)';
    rr(398 + i * 13, 9, 10, 12, 3); ctx.fill();
  }
  shadowText('💧', 462, 15, 15, '#eafbe6', 'left', 900);
  for (let i = 0; i < SPRAY_MAX; i++) {
    ctx.fillStyle = i < p.spray ? '#3ea6e0' : 'rgba(255,255,255,.18)';
    rr(482 + i * 13, 9, 10, 12, 3); ctx.fill();
  }

  /* климат */
  const hotV = clamp((G.temp - 20) / 24, 0, 1);
  shadowText('🌡 ' + Math.round(G.temp) + '°', 540, 15, 16, hotV > 0.65 ? '#ff8a5c' : '#eafbe6', 'left', 900);
  bar(590, 10, 72, 10, hotV, hotV > 0.65 ? '#ff5c3c' : '#ffb45c');
  const humV = clamp(G.hum / 100, 0, 1);
  shadowText('💦 ' + Math.round(G.hum) + '%', 674, 15, 16, humV > 0.7 ? '#8fd8ff' : '#eafbe6', 'left', 900);
  bar(732, 10, 72, 10, humV, humV > 0.7 ? '#4ab3e8' : '#7ec8ff');

  /* градус в организме */
  const e = clamp(p.energy / 100, 0, 1.3);
  const ec = p.energy > 96 ? '#c07ae0' : p.energy > 55 ? '#8fe36b' : p.energy > 25 ? '#ffd93d' : '#ff5c3c';
  shadowText('🥃', 818, 15, 16, '#eafbe6', 'left', 900);
  bar(840, 9, 108, 12, e / 1.3, ec);
  ctx.save();
  ctx.globalAlpha = 0.6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(840 + 108 / 1.3, 9); ctx.lineTo(840 + 108 / 1.3, 21); ctx.stroke();
  ctx.restore();
  if (p.energy < 25) shadowText('ГРАДУС!', 894, 34, 13, '#ff8a5c', 'center', 900);
  else if (p.energy > 100) shadowText('перебор', 894, 34, 13, '#c07ae0', 'center', 900);

  /* подсказка действия */
  const tg = nearestTarget();
  if (tg && p.busy <= 0) {
    const label = actionLabel(tg);
    if (label) {
      const key = (tg.type === 'plant' && ripeCount(tg.pl) === 0 && tg.pl.alive && p.spray > 0) ? 'E · F — купорос' : 'E';
      ctx.font = F(15, 900);
      const wdt = ctx.measureText(label).width + 62;
      const bx = clamp(p.x - wdt / 2, 8, W - wdt - 8), by = p.y - 158;
      ctx.fillStyle = 'rgba(12,20,14,.85)'; rr(bx, by, wdt, 28, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(143,227,107,.5)'; ctx.lineWidth = 1.5; rr(bx, by, wdt, 28, 8); ctx.stroke();
      ctx.fillStyle = '#ffd93d'; rr(bx + 7, by + 6, 20, 16, 4); ctx.fill();
      txt('E', bx + 17, by + 15, 13, '#2b1a04', 'center', 900);
      txt(label, bx + 34, by + 15, 15, '#eafbe6', 'left', 700);
      if (key !== 'E') txt('F — купорос', bx + wdt / 2, by + 40, 12, 'rgba(126,200,255,.85)', 'center', 700);
    }
  }
  if (p.busy > 0 && p.busyKind) {
    const names = { water: 'Поливаю жижей…', harvest: 'Рву…', barrel: 'Черпаю жижу…', kupor: 'Развожу купорос…', vodka: 'Буль-буль-буль…', crate: 'Ссыпаю в ящик…', replant: 'Выдираю и сажаю…' };
    shadowText(names[p.busyKind] || '', p.x, p.y - 150, 15, '#ffd93d', 'center', 900);
  }

  /* тосты */
  let ty = 46;
  for (const t of G.toasts) {
    const a = clamp(t.life / 0.6, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = F(15, 900);
    const wdt = ctx.measureText(t.txt).width + 26;
    ctx.fillStyle = 'rgba(10,16,12,.8)'; rr(W / 2 - wdt / 2, ty, wdt, 26, 8); ctx.fill();
    txt(t.txt, W / 2, ty + 13, 15, t.c, 'center', 900);
    ctx.restore();
    ty += 30;
  }
}

/* --------------------------------------------------------- кадр */
function render() {
  ctx.setTransform(Math.min(devicePixelRatio || 1, 2), 0, 0, Math.min(devicePixelRatio || 1, 2), 0, 0);
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  if (G && G.shake > 0) ctx.translate(rnd(-4, 4) * G.shake, rnd(-4, 4) * G.shake);
  if (G && G.p.wobble > 0) {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.sin(G.t * 1.7) * 0.012 * G.p.wobble);
    ctx.translate(-W / 2, -H / 2);
  }

  drawGreenhouse();
  if (G) {
    drawStations();
    const order = G.plants.slice().sort((a, b) => a.y - b.y);
    let drawn = false;
    for (const pl of order) {
      if (!drawn && G.p.y < pl.y - 6) { drawFarmer(); drawn = true; }
      drawPlant(pl);
    }
    if (!drawn) drawFarmer();
    drawSporesAndParts();
    drawHeat();
  }
  ctx.restore();

  if (G) drawHUD();
}

/* --------------------------------------------------------- цикл */
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.06) dt = 0.06;
  if (G && G.phase === 'play') update(dt);
  else if (G) { G.t += dt; updateParts(dt); for (const pl of G.plants) pl.sway += dt; clearPressed(); }
  render();
  requestAnimationFrame(frame);
}

newGame();
G.phase = 'menu';
requestAnimationFrame(frame);
