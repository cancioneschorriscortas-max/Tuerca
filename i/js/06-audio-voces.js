/* ============================================================
   AUDIO PROCEDURAL (Web Audio API)
   Sonidos generados sin archivos. Se inicializa con el primer
   click del usuario (los navegadores exigen interacción).
   ============================================================ */
let audioCtx = null;
let masterGain = null;
let audioReady = false;

function initAudio(){
  if(audioReady) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(audioCtx.destination);
    audioReady = true;
  }catch(e){ /* sin audio si el navegador no soporta */ }
}

function envelope(node, vol, attack, hold, release, startT){
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, startT);
  g.gain.linearRampToValueAtTime(vol, startT + attack);
  g.gain.setValueAtTime(vol, startT + attack + hold);
  g.gain.linearRampToValueAtTime(0, startT + attack + hold + release);
  node.connect(g);
  g.connect(masterGain);
  return g;
}

/* Ruído branco reutilizable */
function _noiseSrc(durSec){
  const n = Math.floor(audioCtx.sampleRate * durSec);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i] = Math.random()*2 - 1;
  const s = audioCtx.createBufferSource();
  s.buffer = buf;
  return s;
}

/* Catálogo de sonidos generados */
const SFX = {
  /* ================= TALLER (v0.84) =================
     Solda: ruído branco filtrado en paso alto e cortado a rachas. É
     deliberadamente cru — o que se busca é a chispa eléctrica, non un
     arco realista. Vai coa portada, así que ten que poder soar moitas
     veces sen cansar: por iso é curto e queda por debaixo da cama de
     ambiente en volume. */
  solda(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const dur = 0.10 + Math.random()*0.16;
    const n = audioCtx.createBufferSource();
    const buf = audioCtx.createBuffer(1, Math.ceil(audioCtx.sampleRate*dur), audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = (Math.random()*2 - 1);
    n.buffer = buf;
    const f = audioCtx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800 + Math.random()*1200;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(masterGain);
    n.start(t); n.stop(t + dur);
  },

  /* ================= COMBATE (v0.18) ================= */
  shot_grunt(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type='square'; o.frequency.setValueAtTime(340, t);
    o.frequency.exponentialRampToValueAtTime(180, t+0.05);
    envelope(o, 0.10, 0.002, 0.01, 0.045, t);
    o.start(t); o.stop(t+0.06);
  },
  shot_heavy(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type='sawtooth'; o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(70, t+0.08);
    envelope(o, 0.13, 0.002, 0.02, 0.07, t);
    o.start(t); o.stop(t+0.10);
    const n = _noiseSrc(0.06);
    const f = audioCtx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900;
    n.connect(f); envelope(f, 0.06, 0.001, 0.01, 0.05, t);
    n.start(t);
  },
  shot_engineer(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type='triangle'; o.frequency.value=720;
    envelope(o, 0.06, 0.001, 0.008, 0.025, t);
    o.start(t); o.stop(t+0.04);
  },
  shot_sniper(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    /* Chasquido seco: ruído highpass + caída de ton rápida */
    const n = _noiseSrc(0.08);
    const f = audioCtx.createBiquadFilter(); f.type='highpass'; f.frequency.value=1600;
    n.connect(f); envelope(f, 0.16, 0.001, 0.015, 0.06, t);
    n.start(t);
    const o = audioCtx.createOscillator();
    o.type='square'; o.frequency.setValueAtTime(1300, t);
    o.frequency.exponentialRampToValueAtTime(190, t+0.1);
    envelope(o, 0.09, 0.001, 0.01, 0.09, t);
    o.start(t); o.stop(t+0.11);
  },
  shot_bomb(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    /* Thump grave do lanzacohetes */
    const o = audioCtx.createOscillator();
    o.type='sine'; o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(42, t+0.16);
    envelope(o, 0.24, 0.004, 0.03, 0.14, t);
    o.start(t); o.stop(t+0.19);
  },
  shot_tank(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    /* Boom pesado: sub + ruído lowpass */
    const o = audioCtx.createOscillator();
    o.type='sine'; o.frequency.setValueAtTime(72, t);
    o.frequency.exponentialRampToValueAtTime(30, t+0.3);
    envelope(o, 0.32, 0.004, 0.05, 0.28, t);
    o.start(t); o.stop(t+0.36);
    const n = _noiseSrc(0.2);
    const f = audioCtx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=380;
    n.connect(f); envelope(f, 0.14, 0.002, 0.03, 0.16, t);
    n.start(t);
  },
  shot_jeep(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    for(let i=0;i<2;i++){
      const o = audioCtx.createOscillator();
      o.type='square'; o.frequency.value = 300 - i*40;
      envelope(o, 0.07, 0.001, 0.01, 0.03, t + i*0.045);
      o.start(t + i*0.045); o.stop(t + i*0.045 + 0.045);
    }
  },
  shot_turret(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type='square'; o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(140, t+0.05);
    envelope(o, 0.09, 0.002, 0.012, 0.045, t);
    o.start(t); o.stop(t+0.06);
  },
  expl_unit(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const n = _noiseSrc(0.18);
    const f = audioCtx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(180, t+0.16);
    n.connect(f); envelope(f, 0.16, 0.002, 0.03, 0.14, t);
    n.start(t);
    const o = audioCtx.createOscillator();
    o.type='sine'; o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t+0.15);
    envelope(o, 0.12, 0.002, 0.02, 0.13, t);
    o.start(t); o.stop(t+0.17);
  },
  expl_struct(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const n = _noiseSrc(0.55);
    const f = audioCtx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(90, t+0.5);
    n.connect(f); envelope(f, 0.30, 0.004, 0.08, 0.45, t);
    n.start(t);
    const o = audioCtx.createOscillator();
    o.type='sine'; o.frequency.setValueAtTime(85, t);
    o.frequency.exponentialRampToValueAtTime(28, t+0.5);
    envelope(o, 0.26, 0.004, 0.08, 0.44, t);
    o.start(t); o.stop(t+0.58);
  },
  wall_hit(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type='triangle'; o.frequency.value=170;
    envelope(o, 0.09, 0.001, 0.01, 0.04, t);
    o.start(t); o.stop(t+0.055);
  },
  wall_break(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const n = _noiseSrc(0.3);
    const f = audioCtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=420; f.Q.value=0.8;
    n.connect(f); envelope(f, 0.20, 0.003, 0.06, 0.24, t);
    n.start(t);
  },
  /* ================= ECONOMÍA / EVENTOS ================= */
  scrap_pick(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    o.type='triangle'; o.frequency.setValueAtTime(660, t);
    o.frequency.setValueAtTime(880, t+0.05);
    envelope(o, 0.11, 0.003, 0.03, 0.06, t);
    o.start(t); o.stop(t+0.12);
  },
  loot_pick(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    [660, 880, 1175].forEach((fr, i) => {
      const o = audioCtx.createOscillator();
      o.type='triangle'; o.frequency.value=fr;
      envelope(o, 0.12, 0.004, 0.04, 0.07, t + i*0.07);
      o.start(t + i*0.07); o.stop(t + i*0.07 + 0.13);
    });
  },
  capture(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    [440, 587].forEach((fr, i) => {
      const o = audioCtx.createOscillator();
      o.type='square'; o.frequency.value=fr;
      const flt = audioCtx.createBiquadFilter(); flt.type='lowpass'; flt.frequency.value=1400;
      o.connect(flt);
      envelope(flt, 0.10, 0.004, 0.05, 0.07, t + i*0.09);
      o.start(t + i*0.09); o.stop(t + i*0.09 + 0.14);
    });
  },
  levelup(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    [523, 659, 784, 1047].forEach((fr, i) => {
      const o = audioCtx.createOscillator();
      o.type='triangle'; o.frequency.value=fr;
      envelope(o, 0.10, 0.004, 0.05, 0.09, t + i*0.08);
      o.start(t + i*0.08); o.stop(t + i*0.08 + 0.16);
    });
  },
  /* ================= BLIPS DE VOZ POR CLASE ================= */
  voice_blip(cls){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const mk = (fr, type, dur, vol, delay=0) => {
      const o = audioCtx.createOscillator();
      o.type = type; o.frequency.value = fr;
      const f = audioCtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=fr*1.6; f.Q.value=2.5;
      o.connect(f);
      envelope(f, vol, 0.004, dur*0.4, dur*0.6, t + delay);
      o.start(t + delay); o.stop(t + delay + dur + 0.02);
    };
    switch(cls){
      case 'HEAVY':      mk(210, 'square', 0.10, 0.16); break;                       /* grave e rudo */
      case 'ENGINEER':   mk(820, 'triangle', 0.06, 0.13); mk(980, 'triangle', 0.05, 0.11, 0.07); break; /* limpo, dobre */
      case 'SNIPER':     mk(950, 'square', 0.035, 0.11); break;                       /* seco, mínimo */
      case 'BOMBARDERO': mk(390, 'sawtooth', 0.09, 0.13); mk(340, 'sawtooth', 0.07, 0.10, 0.08); break; /* rascado */
      case 'OPTIMA':     mk(300, 'square', 0.09, 0.12); mk(300, 'square', 0.09, 0.12, 0.12); break;    /* burocrático plano */
      case 'HQ':         mk(240, 'square', 0.13, 0.11); break;
      case 'VOLT':       mk(175, 'sawtooth', 0.14, 0.15); break;                                        /* áspero e grave */                                          /* máquina seca, un só ton */
      default:           mk(520, 'square', 0.06, 0.13); mk(600, 'square', 0.045, 0.10, 0.06); break;   /* GRUNT */
    }
  },
  radio_open(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'square'; osc.frequency.value = 920;
    const filt = audioCtx.createBiquadFilter();
    filt.type='bandpass'; filt.frequency.value=1200; filt.Q.value=4;
    osc.connect(filt);
    envelope(filt, 0.5, 0.005, 0.02, 0.04, t);
    osc.start(t); osc.stop(t + 0.08);
  },
  radio_close(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'square'; osc.frequency.value = 380;
    const filt = audioCtx.createBiquadFilter();
    filt.type='bandpass'; filt.frequency.value=600; filt.Q.value=3;
    osc.connect(filt);
    envelope(filt, 0.4, 0.005, 0.02, 0.05, t);
    osc.start(t); osc.stop(t + 0.09);
  },
  radio_static(durSec = 0.35){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    /* Ruido blanco corto con filtro pasa-banda */
    const bufLen = Math.floor(audioCtx.sampleRate * durSec);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufLen;i++) data[i] = (Math.random()*2 - 1) * 0.6;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type='bandpass'; filt.frequency.value=1800; filt.Q.value=1.2;
    src.connect(filt);
    envelope(filt, 0.18, 0.01, durSec*0.7, durSec*0.3, t);
    src.start(t);
  },
  order_confirm(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 880;
    envelope(osc, 0.22, 0.005, 0.03, 0.05, t);
    osc.start(t); osc.stop(t + 0.1);
  },
  signal_lost(){
    if(!audioReady) return;
    const t = audioCtx.currentTime;
    /* Bzzt descendente: square wave que cae de 600Hz a 180Hz + ruido al final */
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.55);
    const filt = audioCtx.createBiquadFilter();
    filt.type='lowpass'; filt.frequency.value=2000; filt.Q.value=2;
    osc.connect(filt);
    envelope(filt, 0.45, 0.01, 0.35, 0.25, t);
    osc.start(t); osc.stop(t + 0.62);
    /* Cola de estática para reforzar el "señal perdida" */
    setTimeout(()=>SFX.radio_static(0.25), 350);
  },
  unit_fire(){
    if(!audioReady) return;
    /* Sonido cortito y discreto — solo en disparos del jugador, sin saturar */
    const t = audioCtx.currentTime;
    const bufLen = Math.floor(audioCtx.sampleRate * 0.04);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufLen;i++) data[i] = (Math.random()*2 - 1) * 0.5;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type='highpass'; filt.frequency.value=1200;
    src.connect(filt);
    envelope(filt, 0.12, 0.001, 0.01, 0.03, t);
    src.start(t);
  },
};
/* ============================================================
   MÚSICA (v0.25.1) — pon un ficheiro chamado tuerca_music.mp3
   (ou .ogg) NA MESMA CARPETA có HTML e soará en bucle ao
   empezar cada batalla. Se non existe, silencio sen queixas.
   ============================================================ */
let _music = null, _musicTried = false;
function startMusic(){
  /* (v0.36) BLINDADA: nada do audio pode lanzar cara a fóra. play() pode
     devolver undefined (webviews vellas) ou lanzar (políticas de autoplay);
     antes iso MATABA newBattle enteiro → pantalla negra en PvP. */
  try{
    if(_music === 'none') return;
    if(_music){ try{ const p = _music.play(); if(p && p.catch) p.catch(()=>{}); }catch(e){} return; }
    if(_musicTried) return;
    _musicTried = true;
    const tryFile = (files, i) => {
      try{
        if(i >= files.length){ _music = 'none'; return; }
        const a = new Audio(files[i]);
        a.loop = true;
        a.volume = 0.32;
        a.onerror = () => tryFile(files, i + 1);
        const p = a.play();
        if(p && p.then){
          p.then(() => {
            _music = a;
            radio(TXT('r.musica', {f: files[i]}), '#888');
          }).catch(() => tryFile(files, i + 1));
        } else {
          /* sen promesa: asumir que soa (implementacións antigas) */
          _music = a;
        }
      }catch(e){ _music = 'none'; }
    };
    tryFile(['tuerca_music.mp3', 'tuerca_music.ogg'], 0);
  }catch(e){ _music = 'none'; }
}
function stopMusic(){
  if(_music && _music !== 'none') _music.pause();
}

function sfx(name, ...args){ if(SFX[name]) SFX[name](...args); }
/* (v0.18) Anti-spam: mesmo son como moito cada N ms */
const _sfxLast = {};
function sfxT(name, ms, ...args){
  const now = performance.now();
  if(_sfxLast[name] && now - _sfxLast[name] < ms) return;
  _sfxLast[name] = now;
  sfx(name, ...args);
}

/* ============================================================
   SISTEMA DE VOCES (v0.3.2)
   Carga archivos de audio reales desde assets/voices/ y los
   reproduce cuando ocurren eventos. Si el archivo no existe,
   no pasa nada — el beep procedural existente sigue funcionando.

   Convención: <clase>_<evento><n>.<ext>
     ej: grunt_sel1.wav, heavy_kill2.mp3, engineer_repair1.wav

   Eventos definidos: sel (selección), move, kill, critical,
   recover (engineer asegura restos), repair (engineer reparando).
   Cada uno con N variantes; el código prueba 1..N y carga las
   que existan.
   ============================================================ */

/* ============================================================
   (v0.79) CARGADOR DE VOCES VELLO — RETIRADO.

   Buscaba os ficheiros en `assets/voices/grunt_sel1.wav`. Esa
   carpeta NON EXISTE nin existiu: as voces viven en `voces/<lingua>/`
   coa clave de i18n por nome (`op.inicio.ogg`), como define
   README_VOCES.md e xestiona o manifesto desde a v0.63.

   Non era só código morto: preloadVoices() disparaba 3 clases × 6
   eventos × 6 variantes × 3 extensións + 6 de sistema = 342 peticións
   HTTP que fallaban TODAS en cada arranque de batalla. E playVoice() e
   playSysVoice() devolvían false sempre, así que os oito sitios que as
   chamaban non facían absolutamente nada.

   O sistema bo é o de 06b-voz.js: vozRobot / vozMando / vozComentarista,
   con manifesto e fallback de idioma. As chamadas que aquí morrían
   reencamiñáronse alí.
   ============================================================ */
function preloadVoices(){ /* retirado: ver a nota de arriba */ }

/* ---------- Estado global ---------- */
let DATA = freshData();
/* (v0.65) exposición sincronizada: 00b xa lía window.DATA (era no-op silencioso)
   e o arnés precisa mutar o estado real. Getter/setter → nunca desincroniza. */
try{ Object.defineProperty(window, 'DATA', {get: () => DATA, set: (v) => { DATA = v; }, configurable: true}); }catch(e){}
let game = null;
const $ = id => document.getElementById(id);

/* Sistema de interrupción del panel lateral */
let panelInterrupt = null;  /* {unit, until: frame} */
let lastPanelRender = 0;

/* Tracking de doble click para selección masiva */
let lastClickTime = 0;
let lastClickUnit = null;
const DBL_CLICK_MS = 350;
const DBL_SELECT_RADIUS = 160;

/* ============================================================
   EVENTOS PERSISTENTES (A.2)
   ============================================================ */
function logEvent(u, ev){
  if(u.team!==PT && !(game && game.modo==='pvp' && u.team===ET)) return;   /* (v0.33) memorias do rival humano */
  u.eventBuffer = u.eventBuffer || [];
  u.eventBuffer.push({op: DATA.opCount+1, ...ev});
}

/* ============================================================
   BANCO DE FRASES CONTEXTUALES (B.2)
   Cada tipo de evento tiene varias frases con condiciones.
   Se elige la primera que matchea. Permite personalidad
   automática por clase, rasgos y veteranía.
   ============================================================ */
const RADIO_LINES = {
  /* Cuando una unidad propia entra en estado crítico bajo fuego */
  under_fire: [
    {cond:(u)=>u.traits.includes('SUPERVIVIENTE') && u.ops>=3,
     text:(u)=>`'${u.name}': He visto cosas peores. Aguantando.`},
    {cond:(u)=>u.traits.includes('PROTECTOR'),
     text:(u)=>`'${u.name}': No pienso dejarles atrás.`},
    {cond:(u)=>u.cls==='HEAVY' && u.ops>=3,
     text:(u)=>`'${u.name}': Es solo metal. Aguanto.`},
    {cond:(u)=>u.cls==='ENGINEER',
     text:(u)=>`'${u.name}': ¡Estoy expuesto! ¡Cubridme!`},
    {cond:(u)=>u.ops>=3,
     text:(u)=>`'${u.name}': Contacto. Múltiples hostiles.`},
    {cond:(u)=>true,
     text:(u)=>`'${u.name}': ¡Bajo fuego! ¡Necesito apoyo!`},
  ],
  /* Al producir/desplegar una unidad nueva en la operación */
  produced: [
    {cond:(u)=>u.cls==='HEAVY', text:(u)=>`'${u.name}' (HEAVY) listo para servir.`},
    {cond:(u)=>u.cls==='ENGINEER', text:(u)=>`'${u.name}' (ENGINEER) reportando. Listo para reparar.`},
    {cond:(u)=>true, text:(u)=>`${u.id} '${u.name}' (${u.cls}) sale de fábrica.`},
  ],
  /* Al eliminar a un enemigo */
  killed_enemy: [
    {cond:(u,ctx)=>ctx.targetName && ctx.targetName.length>3,
     text:(u,ctx)=>`'${u.name}' eliminó a ${ctx.targetName}.`},
    {cond:()=>true,
     text:(u,ctx)=>`'${u.name}' eliminó a ${ctx.targetName||'un hostil'}.`},
  ],
  /* Cuando una unidad propia cae */
  fallen: [
    {cond:(u)=>u.ops>=5,
     text:(u,ctx)=>`${u.id} '${u.name}' HA CAÍDO en ${placeLabel(ctx.place)}.`},
    {cond:()=>true,
     text:(u,ctx)=>`${u.id} '${u.name}' HA CAÍDO.`},
  ],
  /* Recuperación de restos */
  remains_secured: [
    {cond:(u)=>u.traits.includes('PROTECTOR'),
     text:(u,ctx)=>`'${u.name}': Tengo a '${ctx.targetName}'. Aguanta.`},
    {cond:()=>true,
     text:(u,ctx)=>`'${u.name}' asegura los restos de '${ctx.targetName}' en ${placeLabel(ctx.place)}.`},
  ],
  /* Captura de sector */
  captured_sector: [
    {cond:(u)=>u.cls==='ENGINEER',
     text:(u,ctx)=>`'${u.name}': Posición asegurada. ${placeLabel(ctx.place)}.`},
    {cond:(u)=>u.ops>=3,
     text:(u,ctx)=>`'${u.name}': ${placeLabel(ctx.place)} bajo control.`},
    {cond:()=>true,
     text:(u,ctx)=>`SECTOR ${ctx.sectorId} ASEGURADO. Producción acelerada.`},
  ],
  /* Sector perdido */
  sector_lost: [
    {cond:()=>true,
     text:(u,ctx)=>`Sector ${ctx.sectorId} perdido.`},
  ],
  /* Primer contacto con enemigo veterano */
  enemy_veteran_warning: [
    {cond:(u,ctx)=>ctx.count>1,
     text:(u,ctx)=>`PRECAUCIÓN: ${ctx.count} unidades enemigas veteranas en el campo.`},
    {cond:()=>true,
     text:(u,ctx)=>`PRECAUCIÓN: unidad enemiga veterana detectada.`},
  ],
  /* Anuncio de enemigos recurrentes al inicio (solo si jugador tiene radar) */
  recurring_announce: [
    {cond:(u,ctx)=>ctx.appearances>=3,
     text:(u,ctx)=>`Detección: ${ctx.name} ha vuelto. ${ctx.appearances}º encuentro.`},
    {cond:(u,ctx)=>ctx.appearances===2,
     text:(u,ctx)=>`Detectado en el área: ${ctx.name}. Otra vez.`},
    {cond:()=>true,
     text:(u,ctx)=>`Confirmado: ${ctx.name} sigue ahí afuera.`},
  ],
  /* Captura del radar central */
  radar_captured_blue: [
    {cond:()=>true, text:()=>`Radar Central bajo nuestro control. Detección activa.`},
  ],
  radar_captured_red: [
    {cond:()=>true, text:()=>`Radar Central perdido. Detección comprometida.`},
  ],
  radar_neutral: [
    {cond:()=>true, text:()=>`Radar Central neutralizado.`},
  ],
};

/* (v0.41) RADIO_LINES en galego — mesma estrutura e condicións que a castelá */
const RADIO_LINES_GL = {
  under_fire: [
    {cond:(u)=>u.traits.includes('SUPERVIVIENTE') && u.ops>=3,
     text:(u)=>`'${u.name}': Vin cousas peores. Aguantando.`},
    {cond:(u)=>u.traits.includes('PROTECTOR'),
     text:(u)=>`'${u.name}': Non penso deixalos atrás.`},
    {cond:(u)=>u.cls==='HEAVY' && u.ops>=3,
     text:(u)=>`'${u.name}': É só metal. Aguanto.`},
    {cond:(u)=>u.cls==='ENGINEER',
     text:(u)=>`'${u.name}': Estou exposto! Cubrídeme!`},
    {cond:(u)=>u.ops>=3,
     text:(u)=>`'${u.name}': Contacto. Múltiples hostís.`},
    {cond:(u)=>true,
     text:(u)=>`'${u.name}': Baixo lume! Necesito apoio!`},
  ],
  produced: [
    {cond:(u)=>u.cls==='HEAVY', text:(u)=>`'${u.name}' (HEAVY) disposto a servir.`},
    {cond:(u)=>u.cls==='ENGINEER', text:(u)=>`'${u.name}' (ENGINEER) reportando. Disposto a reparar.`},
    {cond:(u)=>true, text:(u)=>`${u.id} '${u.name}' (${u.cls}) sae de fábrica.`},
  ],
  killed_enemy: [
    {cond:(u,ctx)=>ctx.targetName && ctx.targetName.length>3,
     text:(u,ctx)=>`'${u.name}' eliminou a ${ctx.targetName}.`},
    {cond:()=>true,
     text:(u,ctx)=>`'${u.name}' eliminou a ${ctx.targetName||'un hostil'}.`},
  ],
  fallen: [
    {cond:(u)=>u.ops>=5,
     text:(u,ctx)=>`${u.id} '${u.name}' CAEU en ${placeLabel(ctx.place)}.`},
    {cond:()=>true,
     text:(u,ctx)=>`${u.id} '${u.name}' CAEU.`},
  ],
  remains_secured: [
    {cond:(u)=>u.traits.includes('PROTECTOR'),
     text:(u,ctx)=>`'${u.name}': Teño a '${ctx.targetName}'. Aguanta.`},
    {cond:()=>true,
     text:(u,ctx)=>`'${u.name}' asegura os restos de '${ctx.targetName}' en ${placeLabel(ctx.place)}.`},
  ],
  captured_sector: [
    {cond:(u)=>u.cls==='ENGINEER',
     text:(u,ctx)=>`'${u.name}': Posición asegurada. ${placeLabel(ctx.place)}.`},
    {cond:(u)=>u.ops>=3,
     text:(u,ctx)=>`'${u.name}': ${placeLabel(ctx.place)} baixo control.`},
    {cond:()=>true,
     text:(u,ctx)=>`SECTOR ${ctx.sectorId} ASEGURADO. Produción acelerada.`},
  ],
  sector_lost: [
    {cond:()=>true,
     text:(u,ctx)=>`Sector ${ctx.sectorId} perdido.`},
  ],
  enemy_veteran_warning: [
    {cond:(u,ctx)=>ctx.count>1,
     text:(u,ctx)=>`PRECAUCIÓN: ${ctx.count} unidades inimigas veteranas no campo.`},
    {cond:()=>true,
     text:(u,ctx)=>`PRECAUCIÓN: unidade inimiga veterana detectada.`},
  ],
  recurring_announce: [
    {cond:(u,ctx)=>ctx.appearances>=3,
     text:(u,ctx)=>`Detección: ${ctx.name} volveu. ${ctx.appearances}º encontro.`},
    {cond:(u,ctx)=>ctx.appearances===2,
     text:(u,ctx)=>`Detectado na zona: ${ctx.name}. Outra vez.`},
    {cond:()=>true,
     text:(u,ctx)=>`Confirmado: ${ctx.name} segue aí fóra.`},
  ],
  radar_captured_blue: [
    {cond:()=>true, text:()=>`Radar Central baixo o noso control. Detección activa.`},
  ],
  radar_captured_red: [
    {cond:()=>true, text:()=>`Radar Central perdido. Detección comprometida.`},
  ],
  radar_neutral: [
    {cond:()=>true, text:()=>`Radar Central neutralizado.`},
  ],
};

/* (v0.41) RADIO_LINES en inglés — telegrama militar, mesmo carácter */
const RADIO_LINES_EN = {
  under_fire: [
    {cond:(u)=>u.traits.includes('SUPERVIVIENTE') && u.ops>=3,
     text:(u)=>`'${u.name}': I've seen worse. Holding.`},
    {cond:(u)=>u.traits.includes('PROTECTOR'),
     text:(u)=>`'${u.name}': I'm not leaving them behind.`},
    {cond:(u)=>u.cls==='HEAVY' && u.ops>=3,
     text:(u)=>`'${u.name}': It's just metal. I can take it.`},
    {cond:(u)=>u.cls==='ENGINEER',
     text:(u)=>`'${u.name}': I'm exposed! Cover me!`},
    {cond:(u)=>u.ops>=3,
     text:(u)=>`'${u.name}': Contact. Multiple hostiles.`},
    {cond:(u)=>true,
     text:(u)=>`'${u.name}': Under fire! Need support!`},
  ],
  produced: [
    {cond:(u)=>u.cls==='HEAVY', text:(u)=>`'${u.name}' (HEAVY) ready to serve.`},
    {cond:(u)=>u.cls==='ENGINEER', text:(u)=>`'${u.name}' (ENGINEER) reporting. Ready to repair.`},
    {cond:(u)=>true, text:(u)=>`${u.id} '${u.name}' (${clsLabel(u.cls)}) rolls off the line.`},
  ],
  killed_enemy: [
    {cond:(u,ctx)=>ctx.targetName && ctx.targetName.length>3,
     text:(u,ctx)=>`'${u.name}' took down ${ctx.targetName}.`},
    {cond:()=>true,
     text:(u,ctx)=>`'${u.name}' took down ${ctx.targetName||'a hostile'}.`},
  ],
  fallen: [
    {cond:(u)=>u.ops>=5,
     text:(u,ctx)=>`${u.id} '${u.name}' IS DOWN at ${placeLabel(ctx.place)}.`},
    {cond:()=>true,
     text:(u,ctx)=>`${u.id} '${u.name}' IS DOWN.`},
  ],
  remains_secured: [
    {cond:(u)=>u.traits.includes('PROTECTOR'),
     text:(u,ctx)=>`'${u.name}': I've got '${ctx.targetName}'. Hold on.`},
    {cond:()=>true,
     text:(u,ctx)=>`'${u.name}' secures the remains of '${ctx.targetName}' at ${placeLabel(ctx.place)}.`},
  ],
  captured_sector: [
    {cond:(u)=>u.cls==='ENGINEER',
     text:(u,ctx)=>`'${u.name}': Position secured. ${placeLabel(ctx.place)}.`},
    {cond:(u)=>u.ops>=3,
     text:(u,ctx)=>`'${u.name}': ${placeLabel(ctx.place)} under control.`},
    {cond:()=>true,
     text:(u,ctx)=>`SECTOR ${ctx.sectorId} SECURED. Production accelerated.`},
  ],
  sector_lost: [
    {cond:()=>true,
     text:(u,ctx)=>`Sector ${ctx.sectorId} lost.`},
  ],
  enemy_veteran_warning: [
    {cond:(u,ctx)=>ctx.count>1,
     text:(u,ctx)=>`CAUTION: ${ctx.count} enemy veteran units on the field.`},
    {cond:()=>true,
     text:(u,ctx)=>`CAUTION: enemy veteran unit detected.`},
  ],
  recurring_announce: [
    {cond:(u,ctx)=>ctx.appearances>=3,
     text:(u,ctx)=>`Detection: ${ctx.name} is back. Encounter no. ${ctx.appearances}.`},
    {cond:(u,ctx)=>ctx.appearances===2,
     text:(u,ctx)=>`Detected in the area: ${ctx.name}. Again.`},
    {cond:()=>true,
     text:(u,ctx)=>`Confirmed: ${ctx.name} is still out there.`},
  ],
  radar_captured_blue: [
    {cond:()=>true, text:()=>`Central Radar under our control. Detection active.`},
  ],
  radar_captured_red: [
    {cond:()=>true, text:()=>`Central Radar lost. Detection compromised.`},
  ],
  radar_neutral: [
    {cond:()=>true, text:()=>`Central Radar neutralized.`},
  ],
};

/* (v0.41) Táboa de radio segundo o idioma activo, con fallback á castelá */
function radioTable(){
  if(I18N.lang === 'gl' && typeof RADIO_LINES_GL !== 'undefined') return RADIO_LINES_GL;
  if(I18N.lang === 'en' && typeof RADIO_LINES_EN !== 'undefined') return RADIO_LINES_EN;
  return RADIO_LINES;
}
function pickLine(eventType, unit, ctx={}){
  const lines = radioTable()[eventType] || RADIO_LINES[eventType];
  if(!lines) return null;
  for(const l of lines){
    if(l.cond(unit, ctx)) return l.text(unit, ctx);
  }
  return null;
}
/* radio() ampliada: si recibe segundo arg como objeto (no color),
   interpreta como {eventType, unit, ctx, color}. */
function radioSay(eventType, unit, ctx={}, color){
  const text = pickLine(eventType, unit, ctx);
  if(text){
    radio(text, color, unit && typeof unit.x==='number' ? {x:unit.x, y:unit.y} : undefined);
    /* (v0.63) chío do robot en vez do blip xenérico (se a voz está activa) */
    if(typeof vozRobot === 'function' && typeof vozModo === 'function' && vozModo() !== 'off'){
      vozRobot(unit, text, 2, eventType);
    } else if(unit && unit.cls) sfxT('voice_blip', 260, unit.cls);
  }
}

