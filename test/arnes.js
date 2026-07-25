/* ============================================================
   ARNÉS HEADLESS — executa a simulación de TUERCA en Node, sen
   navegador, sen canvas e sen Firebase.

   Os módulos de js/ son scripts clásicos que comparten ámbito
   global. Aquí cárganse na mesma orde que en index.html dentro
   dun contexto de `vm`, cun DOM falso abondo para que non peten.
   Nada disto toca o xogo: é só andamio de probas.

   Cero dependencias, coma o resto do proxecto.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', 'i');

/* Mesma orde que build.py. Se aquí falta un módulo, o arnés
   diverxe do xogo real: manter as dúas listas en sintonía. */
const FICHEIROS = [
  'config.js', '00-preambulo.js', '00b-i18n.js', '01-nucleo-datos.js',
  '01b-assets.js', '02-pvp-lobby.js', '03-pvp-sync.js', '04-progresion.js',
  '05-mapa-camara-neboa.js', '06-audio-voces.js', '06b-voz.js',
  '07-terreo-batalla.js', '08-social-narrativa.js', '09-economia-combate.js',
  '10-estructuras.js', '11-retratos-ui.js', '12-debrief-hangar.js',
  '13-mundial.js', '14-diario.js', '15-luz.js', '16-estado.js', '17-ambiente.js', '18-efectos.js', '99-boot.js',
];

/* ---------- Canvas 2D de mentira ----------
   Un Proxy que engule calquera método e devolve algo inofensivo.
   Así non hai que ir enumerando a API de canvas a man. */
function ctxFalso() {
  const devolucions = {
    measureText: () => ({ width: 0 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    isPointInPath: () => false,
    canvas: null,
  };
  return new Proxy({}, {
    get(_, prop) {
      if (prop in devolucions) return devolucions[prop];
      return () => {};        /* calquera outro método: non-op */
    },
    set() { return true; },   /* fillStyle, font, globalAlpha… ignóranse */
  });
}

function canvasFalso(w = 960, h = 540) {
  const c = {
    width: w, height: h,
    getContext: () => c._ctx,
    toDataURL: () => 'data:,',
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h }),
    addEventListener() {}, removeEventListener() {},
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  };
  c._ctx = ctxFalso();
  c._ctx.canvas = c;
  return c;
}

function elementoFalso(id) {
  const el = {
    id, textContent: '', innerHTML: '', value: '', title: '', disabled: false,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
    remove() {}, focus() {}, blur() {}, click() {},
    /* Devolve un elemento, non null: o motor mestura simulación e DOM
       (p.ex. tickUnits -> renderSqPanel) e un null aquí peta a sim. */
    querySelector: (sel) => elementoFalso('q' + sel), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
    setAttribute() {}, getAttribute: () => null,
    scrollIntoView() {},
  };
  Object.defineProperty(el, 'children', { get: () => [] });
  return el;
}

/* ---------- "Nada" encadeable ----------
   Un proxy chamable no que toda propiedade devolve outro coma el. Serve
   para APIs de profundidade arbitraria como a Web Audio, onde o código
   fai ctx.createOscillator().frequency.setValueAtTime(600, t). */
function nadaProfundo() {
  const f = function () { return nadaProfundo(); };
  return new Proxy(f, {
    get(_, p) {
      if (p === 'then') return undefined;              /* que non pase por Promise */
      if (p === Symbol.toPrimitive) return () => 0;    /* usos numéricos */
      if (p === 'state') return 'running';
      if (p === 'value' || p === 'currentTime' || p === 'sampleRate') return 0;
      return nadaProfundo();
    },
    set() { return true; },
    apply() { return nadaProfundo(); },
    construct() { return nadaProfundo(); },
  });
}

/* ---------- Contorno completo ---------- */
function crearContorno({ silencioso = true } = {}) {
  const elementos = new Map();
  const obterEl = (id) => {
    if (!elementos.has(id)) {
      elementos.set(id, id === 'cv' ? canvasFalso() : elementoFalso(id));
    }
    return elementos.get(id);
  };

  const almacen = {};
  const localStorage = {
    getItem: (k) => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = String(v); },
    removeItem: (k) => { delete almacen[k]; },
    clear: () => { for (const k of Object.keys(almacen)) delete almacen[k]; },
  };

  const consolaMuda = { log() {}, warn() {}, error() {}, info() {}, debug() {} };

  const document = {
    title: '',
    documentElement: elementoFalso('html'),
    body: Object.assign(elementoFalso('body'), { appendChild() {}, removeChild() {} }),
    getElementById: obterEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => (tag === 'canvas' ? canvasFalso() : elementoFalso('novo-' + tag)),
    addEventListener() {}, removeEventListener() {},
    createTextNode: () => ({}),
    hidden: false,
  };

  const sandbox = {
    document,
    localStorage,
    console: silencioso ? consolaMuda : console,
    performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
    requestAnimationFrame: () => 0,   /* o arnés move a sim a man, sen bucle */
    cancelAnimationFrame: () => {},
    setTimeout: () => 0,              /* nada de traballo diferido nas probas */
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { language: 'gl', userAgent: 'node', onLine: true },
    location: { href: 'http://localhost/', protocol: 'http:', search: '' },
    Image: function () { this.onload = null; this.src = ''; },
    AudioContext: function () { return nadaProfundo(); },
    Audio: function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {}, load() {}, volume: 1 }; },
    fetch: () => Promise.reject(new Error('sen rede nas probas')),
    alert() {}, confirm: () => false, prompt: () => null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    /* Nada muta nun DOM falso, así que observar non ten que facer nada;
       pero a clase ten que existir ou peta a carga do módulo. */
    MutationObserver: function () {
      return { observe() {}, disconnect() {}, takeRecords: () => [] };
    },
    ResizeObserver: function () {
      return { observe() {}, unobserve() {}, disconnect() {} };
    },
    /* Firebase non existe: o código xa se protexe con typeof/guardas. */
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.webkitAudioContext = sandbox.AudioContext;
  vm.createContext(sandbox);
  return sandbox;
}

/* ---------- Carga dos módulos ---------- */
function cargarXogo(opcions = {}) {
  const sandbox = crearContorno(opcions);
  const fallos = [];
  for (const f of FICHEIROS) {
    const ruta = path.join(RAIZ, 'js', f);
    if (!fs.existsSync(ruta)) { fallos.push(`${f}: non existe`); continue; }
    try {
      vm.runInContext(fs.readFileSync(ruta, 'utf8'), sandbox, { filename: f });
    } catch (e) {
      fallos.push(`${f}: ${e.message}`);
    }
  }
  if (fallos.length) {
    const err = new Error('non se puideron cargar todos os módulos:\n  ' + fallos.join('\n  '));
    err.fallos = fallos;
    throw err;
  }
  /* `const`/`let` de nivel superior son ligazóns léxicas de script, non
     propiedades do global: hai que avaliar para lelas. */
  sandbox.aval = (expr) => vm.runInContext(expr, sandbox);
  return sandbox;
}

/* ---------- API de probas ---------- */

/* AGARDA POLO ARRANQUE antes de tocar DATA.
   12-debrief-hangar.js remata chamando a showHangar(), que é async e fai
   `DATA = await loadData()`. Ao cargar os módulos esa promesa queda
   PENDENTE: se unha proba muta DATA de xeito síncrono xusto despois, a
   microtarefa resume máis tarde e písalle os cambios cun freshData().
   Toda proba que manipule DATA ten que asentar primeiro. */
function asentar(){
  return new Promise((r) => setImmediate(r));
}

/* Un escuadrón de recrutas en branco, coa mesma forma que fabrica o
   hangar (12-debrief-hangar.js) e usando as funcións do propio xogo
   para o nome e a personalidade — así non inventamos datos aquí. */
function crearRoster(S, n = 3, clases = ['GRUNT', 'HEAVY', 'ENGINEER']) {
  const pickName = S.aval('pickName');
  const pickPersonalidad = S.aval('pickPersonalidad');
  const DATA = S.aval('DATA');
  const roster = [];
  for (let i = 0; i < n; i++) {
    const cls = clases[i % clases.length];
    roster.push({
      id: 'T-' + String(i + 1).padStart(2, '0'),
      name: pickName(DATA, roster), cls,
      ops: 0, kills: 0, traits: [], events: [], medals: [],
      crossings: 0, recoveries: 0, criticalSurvivals: 0, captures: 0,
      personalidad: pickPersonalidad(cls),
      confianza: 40,
      activity: { dist: 0, shots: 0, kills: 0, dmgTaken: 0, caps: 0, veh: 0 },
    });
  }
  return roster;
}

/* Arranca unha batalla de campaña. `op` simula cantas operacións leva a
   partida: newBattle escolle mapa segundo iso (0 -> MAP1, 1 -> MAP2,
   >=2 -> procedural). */
function novaBatalla(S, { roster = null, op = 0, semente = null } = {}) {
  const escuadron = roster || crearRoster(S);
  S.aval('DATA').opCount = op;
  /* (v0.78) A semente faise explícita: sen ela, un fallo do fuzz non se
     pode repetir. Se non se pasa, xérase unha e queda en g.semente para
     que as probas a poidan citar no erro. */
  S.aval('(function(s){ window._semente = s; })')(
    semente == null ? (Math.random() * 0x100000000) >>> 0 : (semente >>> 0));
  /* `game` é unha ligazón léxica de script: só se pode asignar avaliando
     código dentro do sandbox. O motor usa o global en varios sitios. */
  const arrancar = S.aval('(function(r){ game = newBattle(r); return game; })');
  return arrancar(escuadron.map((r) => ({ ...r })));
}

/* Avanza N pasos de simulación (ou ata que a batalla remate).
   Devolve os pasos realmente executados. */
function avanzar(S, g, pasos) {
  const simStep = S.aval('simStep');
  let feitos = 0;
  for (let i = 0; i < pasos && !g.over; i++) { simStep(g); feitos++; }
  return feitos;
}

module.exports = { cargarXogo, novaBatalla, avanzar, crearRoster, crearContorno, asentar, FICHEIROS };
