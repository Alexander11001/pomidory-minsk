/* ==========================================================================
   ПОМИДОРЫ ПОД МИНСКОМ — логика игры
   Парник, жижа, фитофтора, жара и градус в организме.
   ========================================================================== */
'use strict';

/* ---------------- базовые размеры сцены ---------------- */
const W = 960, H = 600;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');

/* ---------------- настройки баланса ---------------- */
const RUN_TIME   = 300;   // смена, секунд
const GOAL        = 24;   // сколько сдать в ящик
const BUCKET_MAX  = 5;    // порций жижи в ведре
const SPRAY_MAX   = 3;    // зарядов купороса
const HANDS_MAX   = 5;    // помидоров в руках
const SPEED       = 196;  // px/сек

const COLS = [155, 290, 425, 560, 695];
const ROWS = [258, 378, 498];
const FLOOR_TOP = 200, FLOOR_BOT = 566, FLOOR_L = 40, FLOOR_R = 926;

const ACT = {          // длительности действий, сек
  water: 0.45, harvest: 0.35, barrel: 1.3, kupor: 1.8,
  vodka: 1.0, crate: 0.5, replant: 1.5, rest: 2.6, beetles: 0.8
};

const ARTHRITIS_EVERY = 10;   // помидоров до передышки
const INV_SIZE = 4;

/* ---------------- инвентарь: что можно найти ---------------- */
const ITEMS = {
  lucky:  { icon: '🍅', name: 'Удачный помидор', hint: 'В ящик пойдёт за три' },
  chirik: { icon: '💵', name: 'Чирик', hint: 'Петрович сгоняет в сельпо' },
  cuke:   { icon: '🥒', name: 'Солёный огурец', hint: 'Закусить: градус и от изжоги' },
  balm:   { icon: '🧴', name: 'Растирка', hint: 'Снимает артрит и радикулит' },
  gloves: { icon: '🧤', name: 'Верхонки', hint: '40 секунд рвёшь мгновенно' }
};
const FLOOR_ITEMS = ['cuke', 'balm', 'gloves', 'chirik'];

document.getElementById('goal-txt').textContent = GOAL;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

/* ---------------- мелкая математика ---------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rnd   = (a, b) => a + Math.random() * (b - a);
const dist  = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---------------- звук (синтез, без файлов) ---------------- */
const Snd = {
  ac: null, on: true,
  wake() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } },
  blip(freq, dur, type, vol, slide) {
    if (!this.on || !this.ac) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ac.destination);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol, freq) {
    if (!this.on || !this.ac) return;
    const n = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, n, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ac.createBufferSource(); s.buffer = buf;
    const g = this.ac.createGain(); g.gain.value = vol || 0.05;
    const f = this.ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1500;
    s.connect(f); f.connect(g); g.connect(this.ac.destination); s.start();
  },
  water()  { this.noise(0.4, 0.05, 700); this.blip(200, 0.2, 'sine', 0.04, 110); },
  spray()  { this.noise(0.55, 0.045, 3000); },
  pick_()  { this.blip(540, 0.09, 'triangle', 0.07, 800); },
  crate()  { this.blip(300, 0.1, 'square', 0.06, 640); setTimeout(() => this.blip(760, 0.13, 'square', 0.06, 980), 95); },
  glug()   { [0, 130, 260].forEach((d, i) => setTimeout(() => this.blip(150 + i * 25, 0.11, 'sine', 0.1, 85), d)); },
  bad()    { this.blip(200, 0.28, 'sawtooth', 0.05, 70); },
  ouch()   { this.blip(400, 0.5, 'sawtooth', 0.055, 55); },
  refill() { this.blip(280, 0.15, 'sine', 0.05, 480); },
  dig()    { this.noise(0.25, 0.06, 400); },
  win()    { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.24, 'triangle', 0.07), i * 130)); },
  lose()   { [400, 330, 260, 180].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.06), i * 170)); }
};

/* ---------------- станции парника ---------------- */
const STATIONS = [
  { id: 'barrel', x: 884, y: 258, r: 88, name: 'Бочка с жижей' },
  { id: 'kupor',  x: 884, y: 400, r: 82, name: 'Стол с купоросом' },
  { id: 'vodka',  x: 876, y: 524, r: 82, name: 'Ящик под столом' },
  { id: 'stool',  x: 800, y: 320, r: 66, name: 'Табуретка' },
  { id: 'crate',  x: 66,  y: 378, r: 92, name: 'Ящик под урожай' },
  { id: 'vent',   x: 300, y: 182, r: 96, name: 'Форточка', idx: 0 },
  { id: 'vent',   x: 660, y: 182, r: 96, name: 'Форточка', idx: 1 }
];

/* ---------------- что мужик приговаривает ---------------- */
const SAY = {
  idle: [
    'Зато своё', 'Зато не магазинное', 'Эх, помидоры-помидорчики…',
    'Магазинный — он же ватный', 'Это тебе не турецкий', 'Свой, с грядки, с любовью',
    'В нём витамин, а не химия', 'Тут тебе не Тенерифе', 'Земля — она труд любит',
    'У Петровича хуже растут', 'Хозяйство требует присутствия',
    'Соседи спрашивают секрет. А секрет — в бочке'
  ],
  water: [
    'Кушай, родимый', 'На натуральном — оно вкуснее', 'Не морщься, оно полезное',
    'Вот тебе витаминка', 'Экологически чистое, между прочим',
    'Пахнет? Значит, настоящее', 'Химией не травим, у нас всё своё'
  ],
  harvest: [
    'Вот это боец!', 'Красавец, в салат пойдёшь', 'Тяжёленький, зараза',
    'Такой в магазине не купишь', 'Мясистый! Не то что резиновые',
    'Тёща обзавидуется', 'Один такой — и уже обед'
  ],
  vodka: [
    'За урожай!', 'Не пьянства ради, а тонуса для', 'Первая пошла',
    'Между первой и второй — грядка', 'Врач сказал — для сосудов',
    'Огурца бы… ну ладно', 'Ну, помидоры, будем!'
  ],
  hot: [
    'Ну и парилка', 'В Африке и то прохладнее', 'Сорок в тени, а тут все сто',
    'Голова печётся, как бульба', 'Я тут скоро сам законсервируюсь',
    'Лысина — это солнечная панель'
  ],
  sick: [
    'Фитофтора, зараза!', 'Опять с картошки нанесло', 'Петрович, картошку убери!',
    'Не отдам! Она моя!', 'Химия против химии', 'Вот она, вражина, пятнами пошла'
  ],
  spray: [
    'Пшикнем, для здоровья', 'Дыши, родная, лечим', 'Медный купорос — наше всё',
    'Дед так делал, и я так делаю'
  ],
  low: [
    'Что-то ноги не идут…', 'Надо бы… для тонуса', 'В горле пересохло, беда',
    'Организм требует', 'Без градуса работа не идёт'
  ],
  dead: [
    'Отвоевался, бедолага', 'Земля тебе пухом, куст', 'А ведь я в него верил',
    'Ничего, посадим нового'
  ],
  crate: [
    'Ящик — не резиновый', 'Вот это я понимаю — урожай', 'На зиму закатаем',
    'Тёще покажу — пусть молчит'
  ],
  brak: [
    'Это свиньям', 'Ну куда ж ты гнилой', 'Обидно, слушай',
    'Половину черви, половину фитофтора'
  ],
  drunk: [
    'Я трезв как стёклышко!', 'Грядка… она… вон там', 'Помидор, стой ровно!',
    'Эт-та не я шатаюсь, эт-та парник'
  ],
  arth: [
    'Ой, руки-то… к дождю', 'Суставы крутит, зараза', 'Пальцы не разгибаются',
    'Полсотни лет как не бывало… а руки помнят', 'Пять минут посижу — и снова в бой'
  ],
  radic: [
    'Ой, спину прострелило!', 'Поясница, родимая…', 'Разогнуться бы',
    'Вот тебе и рассада'
  ],
  burn: [
    'Изжога, а закусить нечем', 'Печёт в груди — не то что в парнике',
    'Огурчика бы солёного…'
  ],
  find: [
    'О! Чирик в земле!', 'Гляди-ка, повезло', 'В хозяйстве всё сгодится',
    'Не зря копал'
  ],
  lucky: [
    'Вот это гигант! На выставку!', 'Кило потянет, не меньше',
    'Такой один — уже полведра', 'Соседям покажу и не отдам'
  ],
  rest: [
    'Пять минут — и как новый', 'Сидим, отдыхаем, трудодни идут',
    'Перекур — дело святое'
  ],
  beetle: [
    'Колорад, зараза полосатая!', 'Опять эти в тельняшках',
    'Руками их, руками — надёжнее'
  ]
};

/* ---------------- состояние ---------------- */
let G = null;

function say(kind, chance) {
  if (!G || (chance !== undefined && Math.random() > chance)) return;
  const pool = SAY[kind] || SAY.idle;
  G.p.say = { txt: pick(pool), life: 2.9 };
  G.p.sayCd = rnd(7, 13);
}

function makePlant(x, y, i) {
  return {
    x, y, i, col: i % COLS.length, row: Math.floor(i / COLS.length),
    alive: true, growth: 0.05, moist: 0.55, infect: 0, immune: 0, wait: 0,
    mildew: 0, beetles: 0, beetleT: rnd(20, 70), dryT: 0,
    fruits: [], spawnT: rnd(2, 7), sway: rnd(0, 6.3), pop: 0, hit: 0, deadT: 0
  };
}

function newGame() {
  const plants = [];
  let k = 0;
  for (let r = 0; r < ROWS.length; r++)
    for (let c = 0; c < COLS.length; c++) plants.push(makePlant(COLS[c], ROWS[r], k++));

  G = {
    phase: 'play', t: 0, left: RUN_TIME, won: false,
    temp: 25, hum: 46, vents: [false, false],
    plants, spores: [], parts: [], flies: [], toasts: [],
    crate: 0, spoiled: 0, lost: 0, died: 0, drinks: 0, watered: 0, sprayed: 0,
    ev: null, evT: 0, nextEv: 24, tempBoost: 0, boostT: 0,
    shake: 0, flash: 0, flashC: '#fff', spawnAcc: 0, warnedDry: 0,
    p: {
      x: 770, y: 440, vx: 0, vy: 0, face: -1, walk: 0,
      energy: 70, exhausted: false, wobble: 0,
      hands: 0, bucket: BUCKET_MAX, spray: SPRAY_MAX,
      busy: 0, busyMax: 0, busyKind: '', busyTarget: null,
      swig: 0, hic: 0, sweat: 0, spillT: 1,
      say: { txt: '', life: 0 }, sayCd: 4,
      /* инвентарь и хвори */
      inv: new Array(INV_SIZE).fill(null),
      picked: 0, nextArth: ARTHRITIS_EVERY, drinksRow: 0, gloves: 0,
      ail: { arth: false, radic: 0, burn: 0 }, sit: 0
    },
    drops: [], dropCd: rnd(12, 22),
    rests: 0, found: 0, luckies: 0,
    /* колхозная массовка */
    hen: { x: 420, y: 470, tx: 420, ty: 470, t: 0, peck: 0, face: 1, cd: rnd(4, 9), panic: 0 },
    goat: { t: 0, vent: 0, chew: 0 },
    tractor: { x: -260, cd: rnd(18, 34) },
    petrovich: { wave: 0, cd: rnd(8, 18), x: 150 }
  };
  for (let i = 0; i < 8; i++)
    G.flies.push({ a: rnd(0, 6.3), sp: rnd(1.6, 3.6), r: rnd(10, 30), hx: 884, hy: 250, ph: rnd(0, 6.3) });
}

/* ---------------- частицы / текст / тосты ---------------- */
function part(o) {
  G.parts.push(Object.assign({ kind: 'dot', life: 0.7, max: 0.7, vx: 0, vy: 0, g: 0, r: 3, c: '#fff' }, o));
}
function popText(x, y, txt, c) {
  G.parts.push({ kind: 'text', x, y, vx: rnd(-10, 10), vy: -48, g: 26, txt, c: c || '#fff', life: 1.3, max: 1.3, r: 0 });
}
function toast(txt, c) {
  G.toasts.push({ txt, c: c || '#ffd93d', life: 3.4, max: 3.4 });
  if (G.toasts.length > 4) G.toasts.shift();
}
function splash(x, y, n, c, spd, g) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.283), s = rnd(0.3, 1) * (spd || 90);
    part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25, g: g === undefined ? 300 : g, r: rnd(1.6, 3.8), c, life: rnd(0.35, 0.8), max: 0.8 });
  }
}

/* ---------------- ввод ---------------- */
const keys = {};
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) keys[e.code + '_p'] = true;
  keys[e.code] = true;
  Snd.wake();
  if (e.code === 'KeyM' && G) { Snd.on = !Snd.on; toast(Snd.on ? '🔊 Звук включён' : '🔇 Тишина', '#8fe36b'); }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

if (matchMedia('(hover:none)').matches || 'ontouchstart' in window)
  document.getElementById('touch').classList.add('on');

document.querySelectorAll('#touch button[data-k]').forEach(b => {
  const k = b.dataset.k;
  const down = e => { e.preventDefault(); if (!keys[k]) keys[k + '_p'] = true; keys[k] = true; Snd.wake(); };
  const up   = e => { e.preventDefault(); keys[k] = false; };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
});
const pressed = c => !!keys[c + '_p'];
function clearPressed() { for (const k in keys) if (k.endsWith('_p')) keys[k] = false; }

/* ---------------- цель под руками ---------------- */
function nearestTarget() {
  const p = G.p;
  let best = null, bd = 1e9;
  for (const s of STATIONS) {
    const d = dist(p.x, p.y, s.x, s.y);
    if (d < s.r && d < bd) { bd = d; best = { type: 'station', s, d }; }
  }
  for (const pl of G.plants) {
    const d = dist(p.x, p.y + 10, pl.x, pl.y + 8);
    if (d < 74 && d < bd * 1.15) { bd = d; best = { type: 'plant', pl, d }; }
  }
  return best;
}

/* подпись действия для подсказки над головой */
function actionLabel(tg) {
  const p = G.p;
  if (!tg) return '';
  if (tg.type === 'station') {
    switch (tg.s.id) {
      case 'barrel': return p.bucket >= BUCKET_MAX ? 'Ведро полное' : 'Набрать жижи';
      case 'kupor':  return p.spray >= SPRAY_MAX ? 'Купорос разведён' : 'Развести купорос';
      case 'vodka':  return 'Поднять градус';
      case 'crate':  return p.hands > 0 ? 'Сдать ' + p.hands + ' шт.' : 'Ящик пустует';
      case 'vent':   return G.vents[tg.s.idx] ? 'Закрыть форточку' : 'Открыть форточку';
      case 'stool':  return p.ail.arth || p.ail.radic > 0 ? 'Посидеть, передохнуть' : 'Присесть на минутку';
    }
  }
  const pl = tg.pl;
  if (!pl.alive) return 'Выдрать и посадить';
  if (pl.beetles > 0.25) return 'Собрать колорадов';
  if (pl.wait > 0 && ripeCount(pl) > 0) return 'Срок ожидания ' + Math.ceil(pl.wait) + 'с';
  if (ripeCount(pl) > 0) return p.ail.arth ? 'Рвать (руки крутит)' : 'Собрать помидоры';
  if (p.bucket > 0 && pl.moist < 0.85) return 'Полить жижей';
  if (pl.moist >= 0.85) return 'Земля мокрая';
  return 'Ведро пустое';
}

const ripeCount = pl => pl.fruits.reduce((n, f) => n + (f.t >= 1 ? 1 : 0), 0);

/* ---------------- действия ---------------- */
function startBusy(kind, dur, target) {
  const p = G.p;
  let k = 1;
  if (p.exhausted) k *= 1.9;
  if (p.ail.arth && kind !== 'rest' && kind !== 'vodka') k *= 1.8;   /* артрит: всё медленнее */
  if (p.gloves > 0 && (kind === 'harvest' || kind === 'beetles')) k *= 0.25;
  p.busyKind = kind;
  p.busyMax = dur * k;
  p.busy = p.busyMax;
  p.busyTarget = target || null;
}

function interact() {
  const p = G.p;
  if (p.busy > 0) return;
  const tg = nearestTarget();
  if (!tg) { return; }

  if (tg.type === 'station') {
    const s = tg.s;
    if (s.id === 'barrel') {
      if (p.bucket >= BUCKET_MAX) { toast('Ведро и так полное', '#c9d6c2'); return; }
      startBusy('barrel', ACT.barrel, s);
    } else if (s.id === 'kupor') {
      if (p.spray >= SPRAY_MAX) { toast('Купороса полный опрыскиватель', '#c9d6c2'); return; }
      startBusy('kupor', ACT.kupor, s);
    } else if (s.id === 'vodka') {
      startBusy('vodka', ACT.vodka, s);
    } else if (s.id === 'crate') {
      if (p.hands <= 0) { toast('В руках пусто — иди собирай', '#c9d6c2'); return; }
      startBusy('crate', ACT.crate, s);
    } else if (s.id === 'stool') {
      startBusy('rest', ACT.rest, s);
    } else if (s.id === 'vent') {
      G.vents[s.idx] = !G.vents[s.idx];
      Snd.blip(G.vents[s.idx] ? 380 : 260, 0.12, 'square', 0.05, G.vents[s.idx] ? 520 : 180);
      toast(G.vents[s.idx] ? '🪟 Форточка открыта — тянет прохладой и спорами' : '🪟 Форточка закрыта — сейчас запарит',
            G.vents[s.idx] ? '#8fe36b' : '#ffb45c');
    }
    return;
  }

  const pl = tg.pl;
  if (!pl.alive) { startBusy('replant', ACT.replant, pl); Snd.dig(); return; }
  if (pl.beetles > 0.25) { startBusy('beetles', ACT.beetles, pl); return; }
  if (ripeCount(pl) > 0) {
    if (p.ail.arth) { toast('🦴 Руки свело — надо посидеть на табуретке', '#ffb45c'); Snd.bad(); say('arth', 0.6); }
    if (pl.wait > 0) { toast('Купорос не обсох — ' + Math.ceil(pl.wait) + ' сек нельзя трогать', '#7ec8ff'); Snd.bad(); return; }
    if (p.hands >= HANDS_MAX) { toast('Руки полные — неси в ящик!', '#ffb45c'); Snd.bad(); return; }
    startBusy('harvest', ACT.harvest, pl);
    return;
  }
  if (p.bucket <= 0) { toast('Ведро пустое — к бочке', '#ffb45c'); Snd.bad(); return; }
  if (pl.moist >= 0.85) { toast('Тут уже болото, зальёшь — сгниёт', '#7ec8ff'); return; }
  startBusy('water', ACT.water, pl);
}

function finishBusy() {
  const p = G.p, k = p.busyKind, tg = p.busyTarget;
  p.busy = 0; p.busyKind = ''; p.busyTarget = null;

  if (k === 'barrel') {
    p.bucket = BUCKET_MAX;
    Snd.refill(); popText(p.x, p.y - 92, 'Ведро полное', '#a0763a');
    splash(884, 268, 10, '#6b4a1f', 70);
  } else if (k === 'kupor') {
    p.spray = SPRAY_MAX;
    Snd.refill(); popText(p.x, p.y - 92, 'Купорос разведён', '#7ec8ff');
    splash(884, 396, 10, '#3ea6e0', 60);
  } else if (k === 'vodka') {
    p.energy = clamp(p.energy + 55, 0, 130);
    G.drinks++;
    p.hic = 1.6; p.swig = 0.6;
    p.drinksRow++;
    if (p.drinksRow >= 3 && p.ail.burn <= 0) {
      p.ail.burn = 22;
      toast('🔥 Изжога — пил без закуски. Градус тает быстрее', '#ff8a5c');
      say('burn');
    }
    Snd.glug();
    popText(p.x, p.y - 96, 'Хорошо пошла!', '#ffd93d');
    say(p.energy > 100 ? 'drunk' : 'vodka');
    if (p.exhausted) { p.exhausted = false; toast('💪 Ноги пошли! Градус вернулся', '#8fe36b'); }
    if (p.energy > 105) toast('🥴 Перебор — держи равновесие', '#ffb45c');
  } else if (k === 'crate') {
    G.crate += p.hands;
    popText(66, 340, '+' + p.hands + ' в ящик', '#8fe36b');
    Snd.crate(); say('crate', 0.8);
    for (let i = 0; i < p.hands * 3; i++) splash(66, 366, 1, '#d1341f', 60);
    p.hands = 0;
    if (G.crate >= GOAL && G.phase === 'play') endGame(true);
  } else if (k === 'water') {
    const pl = tg;
    p.bucket--;
    G.watered++;
    pl.moist = clamp(pl.moist + 0.55, 0, 1.15);
    pl.growth = clamp(pl.growth + 0.03, 0, 1);
    pl.pop = 0.5;
    G.hum = clamp(G.hum + 3.4, 20, 100);
    Snd.water();
    for (let i = 0; i < 16; i++)
      part({ x: pl.x + rnd(-16, 16), y: pl.y - 40, vx: rnd(-16, 16), vy: rnd(20, 90), g: 340, r: rnd(2, 4.2), c: pick(['#6b4a1f', '#7d5a26', '#54391a']), life: rnd(0.3, 0.55), max: 0.55 });
    popText(pl.x, pl.y - 70, 'плюх', '#a0763a');
    say('water', 0.45);
  } else if (k === 'harvest') {
    const pl = tg;
    let good = 0, brak = 0, slip = 0;
    const limit = p.ail.arth ? 2 : 99;             /* с артритом много не нарвёшь */
    for (let i = pl.fruits.length - 1; i >= 0; i--) {
      const f = pl.fruits[i];
      if (f.t < 1) continue;
      if (p.hands + good >= HANDS_MAX || good + brak >= limit) break;
      pl.fruits.splice(i, 1);
      if (f.rot > 0.3) { brak++; G.spoiled++; }
      else if (p.ail.arth && Math.random() < 0.3) {  /* пальцы не держат */
        slip++; G.lost++;
        splash(pl.x, pl.y - 20, 10, '#d64027', 80);
      } else good++;
    }
    p.hands += good;
    if (slip) { popText(pl.x - 16, pl.y - 96, 'выронил!', '#ff8a5c'); Snd.bad(); }

    /* удачный помидор — гигант на выставку */
    if (good && Math.random() < 0.13 && invAdd('lucky')) {
      G.luckies++;
      popText(pl.x, pl.y - 108, '🍅 УДАЧНЫЙ!', '#ffd93d');
      toast('🍅 Удачный помидор! В ящик пойдёт за три — жми цифру слота', '#ffd93d');
      say('lucky'); Snd.win();
    }

    /* артрит: каждые ARTHRITIS_EVERY сорванных руки сводит */
    p.picked += good;
    if (p.picked >= p.nextArth && !p.ail.arth) {
      p.nextArth = p.picked + ARTHRITIS_EVERY;
      p.ail.arth = true;
      toast('🦴 Артрит разыгрался — на табуретку, передохнуть!', '#ffb45c');
      say('arth'); Snd.ouch(); G.shake = 0.4;
    }
    pl.pop = 0.6;
    if (good) { Snd.pick_(); popText(pl.x, pl.y - 66, '+' + good + ' 🍅', '#8fe36b'); say('harvest', 0.55); }
    if (brak) { Snd.bad(); popText(pl.x + 14, pl.y - 86, 'брак ×' + brak, '#c96b6b'); splash(pl.x, pl.y - 40, 8, '#5e4a2a', 60); say('brak', 0.8); }
    if (!good && !brak) toast('Нечего рвать', '#c9d6c2');
    if (p.hands >= HANDS_MAX) toast('Руки полные (' + HANDS_MAX + ') — в ящик!', '#ffb45c');
  } else if (k === 'replant') {
    const pl = tg;
    Object.assign(pl, makePlant(pl.x, pl.y, pl.i));
    pl.growth = 0.05; pl.moist = 0.5; pl.pop = 0.8;
    Snd.dig(); popText(pl.x, pl.y - 50, 'рассада', '#8fe36b');
    splash(pl.x, pl.y + 6, 10, '#4a3520', 60);
    /* в земле иногда лежит чирик */
    if (Math.random() < 0.22 && invAdd('chirik')) {
      G.found++;
      popText(pl.x, pl.y - 76, '💵 чирик!', '#8fe36b');
      toast('💵 Нашёл чирик в земле. Петрович за него сгоняет в сельпо', '#8fe36b');
      say('find'); Snd.pick_();
    }
    /* но чаще прихватывает поясницу */
    if (Math.random() < 0.28) {
      p.ail.radic = 15;
      toast('🌀 Радикулит — разогнулся неудачно. Ноги не бегут', '#ff8a5c');
      say('radic'); Snd.ouch(); G.shake = 0.5;
    }
  } else if (k === 'beetles') {
    const pl = tg;
    pl.beetles = 0;
    pl.pop = 0.5;
    Snd.dig(); say('beetle', 0.7);
    popText(pl.x, pl.y - 60, 'собрал в банку', '#8fe36b');
    splash(pl.x, pl.y - 30, 8, '#c9a24a', 60);
  } else if (k === 'rest') {
    G.rests++;
    p.ail.arth = false;
    p.ail.radic = 0;
    p.energy = clamp(p.energy + 6, 0, 130);
    say('rest'); Snd.refill();
    popText(p.x, p.y - 100, 'ух, полегчало', '#8fe36b');
    toast('🪑 Посидел, руки отпустило', '#8fe36b');
  }
}

/* ---------------- инвентарь ---------------- */
function invAdd(type) {
  const inv = G.p.inv;
  const i = inv.indexOf(null);
  if (i < 0) return false;
  inv[i] = type;
  return true;
}

function useItem(slot) {
  const p = G.p, type = p.inv[slot];
  if (!type) return;
  const it = ITEMS[type];
  p.inv[slot] = null;

  if (type === 'lucky') {
    G.crate += 3;
    popText(p.x, p.y - 100, '+3 в ящик', '#8fe36b');
    toast('🍅 Удачный помидор пошёл в ящик за три', '#ffd93d');
    Snd.crate();
    if (G.crate >= GOAL && G.phase === 'play') endGame(true);
  } else if (type === 'chirik') {
    p.bucket = BUCKET_MAX; p.spray = SPRAY_MAX;
    p.energy = clamp(p.energy + 18, 0, 130);
    G.petrovich.wave = 3; G.petrovich.x = rnd(150, 800);
    toast('💵 Петрович сгонял в сельпо: ведро, купорос и стопка', '#8fe36b');
    Snd.crate();
  } else if (type === 'cuke') {
    p.energy = clamp(p.energy + 22, 0, 130);
    p.ail.burn = 0; p.drinksRow = 0;
    popText(p.x, p.y - 100, 'хрум!', '#8fe36b');
    toast('🥒 Закусил. Изжога отступила', '#8fe36b');
    Snd.pick_();
  } else if (type === 'balm') {
    p.ail.arth = false; p.ail.radic = 0;
    popText(p.x, p.y - 100, 'растёр', '#8fe36b');
    toast('🧴 Растёрся — суставы отпустили', '#8fe36b');
    Snd.refill();
  } else if (type === 'gloves') {
    p.gloves = 40;
    toast('🧤 Верхонки надеты — 40 секунд рвёшь мгновенно', '#8fe36b');
    Snd.refill();
  }
  popText(p.x + 20, p.y - 120, it.icon, '#fff');
}

/* ---------------- находки на полу ---------------- */
function updateDrops(dt) {
  G.dropCd -= dt;
  if (G.dropCd <= 0 && G.drops.length < 3) {
    G.dropCd = rnd(16, 28);
    G.drops.push({
      x: rnd(120, 780), y: rnd(230, 545),
      type: pick(FLOOR_ITEMS), t: 0, life: 26
    });
  }
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.t += dt; d.life -= dt;
    if (d.life <= 0) { G.drops.splice(i, 1); continue; }
    if (dist(d.x, d.y, G.p.x, G.p.y - 20) < 42) {
      if (invAdd(d.type)) {
        G.found++;
        popText(d.x, d.y - 30, ITEMS[d.type].icon + ' ' + ITEMS[d.type].name, '#8fe36b');
        Snd.pick_();
        if (d.type === 'chirik') say('find', 0.8);
        G.drops.splice(i, 1);
      } else if (!G.invFullWarn || G.invFullWarn < G.t - 4) {
        G.invFullWarn = G.t;
        toast('Карманы полные — пусти что-нибудь в дело (1–4)', '#ffb45c');
      }
    }
  }
}

function doSpray() {
  const p = G.p;
  if (p.busy > 0) return;
  if (p.spray <= 0) { toast('Купорос кончился — разводи новый у стола', '#ffb45c'); Snd.bad(); return; }
  const tg = nearestTarget();
  const cx = tg && tg.type === 'plant' ? tg.pl.x : p.x;
  const cy = tg && tg.type === 'plant' ? tg.pl.y : p.y;
  let n = 0;
  for (const pl of G.plants) {
    if (dist(cx, cy, pl.x, pl.y) > 132 || !pl.alive) continue;
    pl.infect = 0; pl.mildew = 0; pl.beetles = 0; pl.immune = 16; pl.wait = 4; n++;
    for (let i = 0; i < 14; i++)
      part({ x: pl.x + rnd(-30, 30), y: pl.y - rnd(10, 70), vx: rnd(-24, 24), vy: rnd(-38, -6), g: 30, r: rnd(2, 5), c: '#8fd8ff', life: rnd(0.5, 1), max: 1 });
  }
  if (!n) { toast('Мимо — подойди к кусту', '#c9d6c2'); return; }
  p.spray--; G.sprayed++;
  Snd.spray(); say('spray', 0.6);
  popText(cx, cy - 80, 'пшш! ×' + n, '#7ec8ff');
}

/* ---------------- обновление ---------------- */
function updatePlayer(dt) {
  const p = G.p;

  /* усталость / градус: на жаре выветривается быстрее */
  const heatDrain = Math.max(0, G.temp - 26) * 0.075;
  const moving = (p.vx || p.vy) ? 1 : 0;
  const burnK = p.ail.burn > 0 ? 1.7 : 1;          /* изжога жжёт градус */
  p.energy -= (0.7 + heatDrain + moving * 0.3 + (p.busy > 0 ? 0.2 : 0)) * burnK * dt;
  p.energy = clamp(p.energy, 0, 130);

  /* хвори и верхонки тикают */
  if (p.ail.radic > 0) {
    p.ail.radic -= dt;
    if (p.ail.radic <= 0) toast('🌀 Поясницу отпустило', '#8fe36b');
  }
  if (p.ail.burn > 0) {
    p.ail.burn -= dt;
    if (p.ail.burn <= 0) toast('🔥 Изжога прошла сама', '#8fe36b');
  }
  if (p.gloves > 0) {
    p.gloves -= dt;
    if (p.gloves <= 0) toast('🧤 Верхонки сносились', '#c9d6c2');
  }
  if (p.ail.arth && Math.random() < dt * 0.35) say('arth', 0.3);

  /* инвентарь: 1–4 */
  for (let i = 0; i < INV_SIZE; i++)
    if (pressed('Digit' + (i + 1)) || pressed('Numpad' + (i + 1))) useItem(i);

  if (p.energy <= 0 && !p.exhausted) {
    p.exhausted = true;
    Snd.ouch(); G.shake = 0.5;
    toast('🥵 Градус на нуле — ноги не идут. К ящику под столом!', '#ff8a5c');
  }
  if (p.energy > 15) p.exhausted = false;

  if (p.energy < 24 && p.energy > 0 && Math.random() < dt * 0.9)
    popText(p.x + rnd(-12, 12), p.y - 100, pick(['надо бы...', 'в горле сухо', 'ох...']), '#ffb45c');

  /* приговаривает по ситуации */
  p.say.life -= dt;
  p.sayCd -= dt;
  if (p.sayCd <= 0 && p.say.life <= 0) {
    if (p.energy > 100) say('drunk');
    else if (p.energy < 28) say('low');
    else if (G.temp > 34) say('hot');
    else if (G.plants.some(q => q.alive && q.infect > 0.4)) say('sick');
    else say('idle');
  }

  /* перебор: пошатывает и можно расплескать */
  p.wobble = p.energy > 96 ? (p.energy - 96) / 34 : 0;
  if (p.wobble > 0) {
    p.hic -= dt;
    if (p.hic <= 0) { p.hic = rnd(2.5, 5); popText(p.x + 18, p.y - 88, 'Ик!', '#ffd93d'); Snd.blip(300, 0.1, 'sine', 0.05, 520); }
    p.spillT -= dt;
    if (p.spillT <= 0) {
      p.spillT = rnd(3.5, 6);
      if (p.hands > 0 && Math.random() < 0.55) {
        p.hands--; G.lost++;
        splash(p.x, p.y - 20, 12, '#d1341f', 90);
        popText(p.x, p.y - 100, 'уронил!', '#ff8a5c'); Snd.bad();
      } else if (p.bucket > 0) {
        p.bucket--;
        splash(p.x + 20 * p.face, p.y - 10, 12, '#6b4a1f', 80);
        popText(p.x, p.y - 100, 'расплескал', '#a0763a'); Snd.bad();
      }
    }
  }

  /* пот */
  p.sweat -= dt;
  if (G.temp > 30 && p.sweat <= 0) {
    p.sweat = clamp(1.6 - (G.temp - 30) * 0.09, 0.25, 1.6);
    part({ x: p.x + rnd(-14, 14), y: p.y - 92, vx: rnd(-18, 18), vy: rnd(10, 40), g: 260, r: 2.6, c: '#bfe9ff', life: 0.7, max: 0.7 });
  }

  /* действие в процессе */
  if (p.busy > 0) {
    p.busy -= dt;
    if (p.busyKind === 'water' && Math.random() < dt * 22)
      part({ x: p.x + 26 * p.face, y: p.y - 34, vx: rnd(-10, 10) + 40 * p.face, vy: rnd(20, 70), g: 340, r: rnd(1.8, 3.4), c: '#6b4a1f', life: 0.4, max: 0.4 });
    if (p.busyKind === 'vodka') p.swig = 1;
    if (p.busy <= 0) finishBusy();
    p.vx = p.vy = 0;
    return;
  }
  p.swig = Math.max(0, p.swig - dt * 1.6);

  /* движение */
  let dx = 0, dy = 0;
  if (keys.KeyA || keys.ArrowLeft)  dx -= 1;
  if (keys.KeyD || keys.ArrowRight) dx += 1;
  if (keys.KeyW || keys.ArrowUp)    dy -= 1;
  if (keys.KeyS || keys.ArrowDown)  dy += 1;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  if (p.wobble > 0 && (dx || dy)) {
    const a = Math.sin(G.t * 4.4) * p.wobble * 0.75;
    const nx = dx * Math.cos(a) - dy * Math.sin(a);
    const ny = dx * Math.sin(a) + dy * Math.cos(a);
    dx = nx; dy = ny;
  }

  let sp = SPEED;
  if (p.exhausted) sp *= 0.42;
  else if (p.energy < 25) sp *= 0.72;
  if (G.temp > 36) sp *= 0.9;
  if (p.ail.radic > 0) sp *= 0.58;      /* радикулит */
  if (p.ail.arth) sp *= 0.88;

  p.vx = dx * sp; p.vy = dy * sp;
  p.x = clamp(p.x + p.vx * dt, FLOOR_L, FLOOR_R);
  p.y = clamp(p.y + p.vy * dt, FLOOR_TOP, FLOOR_BOT);
  if (dx) p.face = dx > 0 ? 1 : -1;
  p.walk += (Math.abs(p.vx) + Math.abs(p.vy)) * dt * 0.045;

  if (pressed('KeyE') || pressed('Space') || pressed('Enter')) interact();
  if (pressed('KeyF') || pressed('ShiftLeft')) doSpray();
}

function updateClimate(dt) {
  const prog = 1 - G.left / RUN_TIME;
  const open = (G.vents[0] ? 1 : 0) + (G.vents[1] ? 1 : 0);
  if (G.boostT > 0) { G.boostT -= dt; if (G.boostT <= 0) G.tempBoost = 0; }

  const target = 21 + 19 * Math.sin(Math.PI * clamp(prog * 0.9 + 0.1, 0, 1)) + G.tempBoost - open * 4.6;
  G.temp = lerp(G.temp, target, dt * 0.4);
  G.hum = clamp(G.hum + (Math.max(0, G.temp - 24) * 0.10 - open * 3.3 - 0.3) * dt, 20, 100);

  /* споры фитофторы */
  G.spawnAcc += dt * (Math.max(0, G.hum - 45) / 70 + open * 0.22);
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    spawnSpore(open ? 'vent' : 'air');
  }
}

function spawnSpore(from) {
  let x, y;
  if (from === 'vent') {
    const idx = G.vents[0] && G.vents[1] ? (Math.random() < 0.5 ? 0 : 1) : (G.vents[0] ? 0 : 1);
    const s = STATIONS.filter(s => s.id === 'vent')[idx] || STATIONS[4];
    x = s.x + rnd(-30, 30); y = 168;
  } else {
    x = rnd(60, 900); y = rnd(150, 200);
  }
  const tgt = pick(G.plants.filter(p => p.alive)) || G.plants[0];
  G.spores.push({ x, y, tx: tgt.x + rnd(-18, 18), ty: tgt.y - rnd(10, 45), vx: rnd(-20, 20), vy: rnd(4, 16), a: rnd(0, 6.3), r: rnd(3, 5.5), life: 22 });
}

function updateSpores(dt) {
  for (let i = G.spores.length - 1; i >= 0; i--) {
    const s = G.spores[i];
    s.life -= dt;
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1;
    s.vx = lerp(s.vx, dx / d * 34, dt * 1.2);
    s.vy = lerp(s.vy, dy / d * 34, dt * 1.2);
    s.x += (s.vx + Math.sin(G.t * 2 + s.a) * 16) * dt;
    s.y += s.vy * dt;
    s.a += dt * 2;
    if (d < 16 || s.life <= 0) {
      const pl = G.plants.reduce((b, p) => dist(p.x, p.y - 26, s.x, s.y) < dist(b.x, b.y - 26, s.x, s.y) ? p : b, G.plants[0]);
      if (dist(pl.x, pl.y - 26, s.x, s.y) < 60 && pl.alive) {
        if (pl.immune > 0) {
          splash(s.x, s.y, 5, '#8fd8ff', 45, 0);
        } else {
          pl.infect = clamp(pl.infect + 0.22, 0, 1);
          pl.hit = 0.5;
          splash(s.x, s.y, 6, '#6f5a2a', 40, 0);
        }
      }
      G.spores.splice(i, 1);
    }
  }
}

function updatePlants(dt) {
  const heatF = clamp((G.temp - 16) / 14, 0.4, 1.55);
  for (const pl of G.plants) {
    pl.sway += dt;
    pl.pop = Math.max(0, pl.pop - dt * 2);
    pl.hit = Math.max(0, pl.hit - dt);
    pl.immune = Math.max(0, pl.immune - dt);
    pl.wait = Math.max(0, pl.wait - dt);

    if (!pl.alive) { pl.deadT += dt; continue; }

    pl.moist = clamp(pl.moist - (0.0045 + Math.max(0, G.temp - 22) * 0.00055) * dt, 0, 1.2);
    const moistF = pl.moist > 0.25 ? 1 : (pl.moist > 0.05 ? 0.3 : 0.05);

    /* мучнистая роса: сыро и не жарко — куст покрывается налётом */
    if (pl.immune > 0) pl.mildew = 0;
    else if (G.hum > 74 && G.temp < 29) pl.mildew = clamp(pl.mildew + 0.02 * dt, 0, 1);
    else pl.mildew = clamp(pl.mildew - 0.012 * dt, 0, 1);

    /* колорадский жук приходит сам и жуёт листву */
    pl.beetleT -= dt;
    if (pl.beetleT <= 0 && pl.beetles <= 0 && pl.growth > 0.35) {
      pl.beetleT = rnd(45, 110);
      if (Math.random() < 0.55) {
        pl.beetles = 0.4;
        if (Math.random() < 0.4) toast('🐛 Колорадский жук на кусте — собери руками (E) или пшикни', '#ffb45c');
      }
    }
    if (pl.beetles > 0) {
      if (pl.immune > 0) pl.beetles = 0;
      else pl.beetles = clamp(pl.beetles + 0.035 * dt, 0, 1);
    }

    /* вершинная гниль: пересушил — плодам чёрное донце */
    if (pl.moist < 0.14) pl.dryT += dt; else pl.dryT = Math.max(0, pl.dryT - dt * 2);

    /* рост куста */
    const sickK = (1 - pl.mildew * 0.55) * (1 - pl.beetles * 0.7);
    if (pl.growth < 1) pl.growth = clamp(pl.growth + 0.043 * heatF * moistF * sickK * dt, 0, 1);

    /* завязь */
    pl.spawnT -= dt * moistF;
    if (pl.growth > 0.5 && pl.fruits.length < 3 && pl.spawnT <= 0) {
      pl.spawnT = rnd(7, 11);
      pl.fruits.push({ dx: rnd(-30, 30), dy: rnd(-46, 4), t: 0, rot: 0, pop: 1, sw: rnd(0, 6.3) });
      pl.pop = 0.4;
    }

    /* фитофтора */
    if (pl.immune > 0) pl.infect = 0;
    else if (pl.infect > 0) {
      pl.infect = clamp(pl.infect + (0.008 + G.hum * 0.00012) * dt, 0, 1);
      if (pl.infect > 0.7 && Math.random() < dt * 0.06) {
        for (const nb of G.plants) {
          if (!nb.alive || nb.immune > 0 || nb === pl) continue;
          if (Math.abs(nb.col - pl.col) + Math.abs(nb.row - pl.row) === 1) {
            nb.infect = clamp(nb.infect + 0.18, 0, 1); nb.hit = 0.4;
            break;
          }
        }
      }
      if (pl.infect >= 1) {
        pl.alive = false; G.died++;
        G.lost += pl.fruits.filter(f => f.t >= 1).length;
        pl.fruits.length = 0;
        splash(pl.x, pl.y - 30, 18, '#3d2f16', 90);
        toast('☠️ Куст сгорел от фитофторы — выдирай и сажай новый', '#ff8a5c');
        Snd.ouch(); say('dead');
      }
    }

    /* плоды */
    for (let i = pl.fruits.length - 1; i >= 0; i--) {
      const f = pl.fruits[i];
      f.pop = Math.max(0, f.pop - dt * 1.6);
      f.sw += dt;
      const rate = 0.052 * heatF * moistF * (1 - pl.beetles * 0.8) * (1 - pl.mildew * 0.4);
      f.t += (f.t < 1 ? rate : rate * 0.75) * dt;
      if (pl.infect > 0.3) f.rot = clamp(f.rot + 0.06 * pl.infect * dt, 0, 1);
      if (pl.dryT > 4) { f.rot = clamp(f.rot + 0.05 * dt, 0, 1); f.blossom = true; }
      if (f.t > 1.15) f.rot = clamp(f.rot + 0.11 * dt, 0, 1);
      if (f.t >= 1.6) {
        pl.fruits.splice(i, 1);
        G.lost++;
        splash(pl.x + f.dx, pl.y + f.dy + 14, 12, f.rot > 0.3 ? '#6b5228' : '#d1341f', 70);
        popText(pl.x + f.dx, pl.y + f.dy, 'упал', '#c96b6b');
      }
    }
  }
}

function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const q = G.parts[i];
    q.life -= dt;
    q.vy += q.g * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.life <= 0) G.parts.splice(i, 1);
  }
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    G.toasts[i].life -= dt;
    if (G.toasts[i].life <= 0) G.toasts.splice(i, 1);
  }
  for (const f of G.flies) f.a += f.sp * dt;
}

/* ---------------- колхозная массовка ---------------- */
function updateExtras(dt) {
  /* курица бродит по парнику и разгребает грядки */
  const h = G.hen;
  h.t += dt; h.cd -= dt;
  if (h.panic > 0) h.panic -= dt;
  if (h.cd <= 0) {
    h.cd = rnd(3, 8);
    h.tx = rnd(120, 780); h.ty = rnd(230, 540);
    if (Math.random() < 0.25) { h.peck = 1.4; popText(h.x, h.y - 34, pick(['Ко-ко!', 'Ко-ко-ко', 'Куд-кудах!']), '#fff'); }
  }
  const hd = dist(h.x, h.y, h.tx, h.ty);
  if (hd > 6) {
    const sp = (h.panic > 0 ? 190 : 46) * dt;
    h.face = h.tx > h.x ? 1 : -1;
    h.x += (h.tx - h.x) / hd * sp;
    h.y += (h.ty - h.y) / hd * sp;
  }
  h.peck = Math.max(0, h.peck - dt);
  /* курицу пугает подошедший хозяин */
  if (dist(h.x, h.y, G.p.x, G.p.y) < 70 && h.panic <= 0) {
    h.panic = 1.4; h.cd = 0.1;
    h.tx = clamp(h.x + (h.x - G.p.x) * 3, 120, 800);
    h.ty = clamp(h.y + (h.y - G.p.y) * 3, 230, 540);
  }

  /* коза Зорька в форточке */
  if (G.goat.t > 0) { G.goat.t -= dt; G.goat.chew += dt; }

  /* трактор Петровича проезжает по полю */
  const tr = G.tractor;
  if (tr.x > -250) {
    tr.x += 62 * dt;
    if (Math.random() < dt * 3) part({ x: tr.x + 6, y: 152, vx: rnd(-6, 6), vy: -22, g: -6, r: rnd(3, 7), c: 'rgba(60,60,60,.5)', life: 1.4, max: 1.4 });
    if (tr.x > W + 260) { tr.x = -260; tr.cd = rnd(30, 55); }
  } else {
    tr.cd -= dt;
    if (tr.cd <= 0) { tr.x = -249; Snd.blip(140, 0.35, 'square', 0.04, 110); }
  }

  /* сам Петрович машет из-за стекла */
  const pv = G.petrovich;
  pv.cd -= dt;
  if (pv.wave > 0) pv.wave -= dt;
  else if (pv.cd <= 0) {
    pv.cd = rnd(14, 26); pv.wave = 3;
    pv.x = rnd(120, 820);
    toast(pick([
      '👋 Петрович из-за стекла: «Ну как, взошли?»',
      '👋 Петрович: «У меня в этом годе кабачок — во!»',
      '👋 Петрович: «Дай закурить!»',
      '👋 Петрович: «А я говорил — надо было в мае сажать»'
    ]), '#c9d6c2');
  }
}

const EVENTS = [
  { txt: '☀️ Солнце вошло в раж — печёт!', c: '#ffb45c', go: () => { G.tempBoost = 7.5; G.boostT = 22; } },
  { txt: '🌧️ Дождь по крыше — влажность полезла вверх', c: '#7ec8ff', go: () => { G.hum = clamp(G.hum + 22, 20, 100); } },
  { txt: '🥔 Сосед копает картошку — споры полетели!', c: '#c96b6b', go: () => { for (let i = 0; i < 16; i++) spawnSpore('air'); } },
  { txt: '💨 Сквозняк с поля — подсушило', c: '#8fe36b', go: () => { G.hum = clamp(G.hum - 16, 20, 100); G.tempBoost = -5; G.boostT = 16; } },
  {
    txt: '🐐 Коза Зорька лезет в форточку!', c: '#ffd93d',
    go: () => {
      const open = [0, 1].filter(i => G.vents[i]);
      if (!open.length) { toast('🐐 Коза Зорька подёргала форточки и ушла — закрыто', '#8fe36b'); return; }
      const v = pick(open);
      G.goat.t = 5; G.goat.vent = v; G.goat.chew = 0;
      const vx = STATIONS.filter(s => s.id === 'vent')[v].x;
      const near = G.plants.filter(q => q.alive && q.fruits.length)
        .sort((a, b) => Math.abs(a.x - vx) - Math.abs(b.x - vx))[0];
      if (near) {
        const f = near.fruits.sort((a, b) => b.t - a.t)[0];
        near.fruits.splice(near.fruits.indexOf(f), 1);
        G.lost++;
        splash(near.x + f.dx, near.y + f.dy, 10, '#d64027', 70);
        popText(near.x, near.y - 60, 'схрумкала!', '#ffd93d');
        toast('🐐 Зорька сожрала помидор через форточку. Зато своё — теперь в козе', '#ffb45c');
      }
    }
  },
  {
    txt: '🐔 Курица прорвалась в парник и разгребает грядку!', c: '#ffb45c',
    go: () => {
      const q = pick(G.plants.filter(p => p.alive)) || G.plants[0];
      G.hen.x = q.x; G.hen.y = q.y + 20; G.hen.peck = 2.5; G.hen.cd = 2;
      q.moist = clamp(q.moist - 0.3, 0, 1.2);
      splash(q.x, q.y + 10, 14, '#5b4630', 70);
    }
  },
  {
    txt: '📻 По радио передали прогноз. Соврали, конечно', c: '#c9d6c2',
    go: () => { say(Math.random() < 0.5 ? 'idle' : 'hot'); }
  },
  {
    txt: '🐛 Колорады перебрались с картошки — держись!', c: '#ffb45c',
    go: () => {
      const alive = G.plants.filter(q => q.alive);
      for (let i = 0; i < 3 && alive.length; i++) {
        const q = pick(alive);
        q.beetles = Math.max(q.beetles, 0.45);
      }
    }
  },
  {
    txt: '🍀 В старых трениках нашёлся чирик!', c: '#8fe36b',
    go: () => {
      if (invAdd('chirik')) { G.found++; say('find'); }
      else toast('…но карманы забиты, чирик выпал обратно', '#ffb45c');
    }
  }
];

function updateEvents(dt) {
  G.nextEv -= dt;
  if (G.nextEv <= 0) {
    G.nextEv = rnd(26, 38);
    const e = pick(EVENTS);
    e.go();
    toast(e.txt, e.c);
    G.flash = 0.35; G.flashC = e.c;
    Snd.blip(520, 0.18, 'triangle', 0.05, 300);
  }
}

function update(dt) {
  if (!G || G.phase !== 'play') { clearPressed(); return; }
  G.t += dt;
  G.left -= dt;
  G.shake = Math.max(0, G.shake - dt);
  G.flash = Math.max(0, G.flash - dt);

  updateClimate(dt);
  updatePlants(dt);
  updateSpores(dt);
  updatePlayer(dt);
  updateParts(dt);
  updateExtras(dt);
  updateDrops(dt);
  updateEvents(dt);

  if (G.left <= 0) endGame(false);
  clearPressed();
}

/* ---------------- старт / пауза / финиш ---------------- */
const elMenu  = document.getElementById('menu');
const elEnd   = document.getElementById('end');
const elPause = document.getElementById('pause');

const PAUSE_LINES = [
  'Помидоры без присмотра не разбегутся. Наверное.',
  'Фитофтора тоже присела передохнуть.',
  'Коза Зорька ждёт за форточкой. Терпеливо.',
  'Петрович сказал, что так и знал.',
  'Градус на паузе не выветривается. Единственная поблажка.'
];

function togglePause() {
  if (!G) return;
  if (G.phase === 'play') {
    G.phase = 'pause';
    document.getElementById('pause-line').textContent = pick(PAUSE_LINES);
    elPause.classList.remove('hidden');
  } else if (G.phase === 'pause') {
    G.phase = 'play';
    elPause.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
}

function startGame() {
  newGame();
  elMenu.classList.add('hidden');
  elEnd.classList.add('hidden');
  elPause.classList.add('hidden');
  Snd.wake();
  /* иначе пробел/Enter будут жать кнопку, а не работать в игре */
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function endGame(won) {
  G.phase = 'over';
  G.won = won;
  won ? Snd.win() : Snd.lose();

  const ranks = [
    [GOAL,      '🏆 Пан агроном! Ящик полный, фитофтора посрамлена, градус выдержан. Петрович молча закрыл форточку и ушёл.'],
    [GOAL * 0.7,'👍 Крепкий хозяин. На рынке в Ждановичах за такие дали бы цену. Зато своё, зато не магазинное.'],
    [GOAL * 0.4,'😐 На салат хватит, на зиму — уже разговор. Три банки, и те тёще.'],
    [1,         '😬 Пару штук есть. Остальное поделили фитофтора, коза и жажда.'],
    [0,         '💀 Пустой ящик. Зато градус держал ровно и с козой подружился.']
  ];
  const r = ranks.find(r => G.crate >= r[0]) || ranks[ranks.length - 1];

  document.getElementById('end-title').textContent =
    won ? '🍅 План выполнен досрочно!' : '🌇 Смена окончена';
  document.getElementById('end-rank').textContent = r[1];
  document.getElementById('end-stats').innerHTML = [
    ['Сдано в ящик', G.crate + ' / ' + GOAL],
    ['Брак', G.spoiled],
    ['Потеряно', G.lost],
    ['Кустов сгорело', G.died],
    ['Выпито', G.drinks + ' 🥃'],
    ['Полито', G.watered + ' 💩'],
    ['Перекуров', G.rests + ' 🪑'],
    ['Находок', G.found + ' 💵']
  ].map(s => '<div>' + s[0] + '<b>' + s[1] + '</b></div>').join('');
  elPause.classList.add('hidden');
  elEnd.classList.remove('hidden');
}

document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-again').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-pause-touch').addEventListener('click', togglePause);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-menu').addEventListener('click', () => {
  elEnd.classList.add('hidden');
  elMenu.classList.remove('hidden');
});
