/* ============================================================
   VOZ (v0.63) — chíos procedurais + voces humanas por manifesto.
   Canon (Agarfal): robots entre eles = CHÍOS (timbre por nome,
   coma os retratos); voz dirixida AO COMANDANTE (HQ/mando/
   comunicados/comentarista) = HUMANA se hai ficheiro no manifesto.
   O manifesto (voces/manifest.json) é O REGULADOR: clave con .ogg
   → clip; sen el → chío ou só texto. Xestor de canle: UNHA voz á
   vez, prioridades, dedupe, ducking da música.
   Modos (btnVoz / localStorage 'tuerca-voz'): off | chios | full.
   ============================================================ */

/* ---------- modo ---------- */
function vozModo(){
  try{ return localStorage.getItem('tuerca-voz') || 'chios'; }catch(e){ return 'chios'; }
}
function vozCiclarModo(){
  const orde = ['off', 'chios', 'full'];
  const novo = orde[(orde.indexOf(vozModo()) + 1) % orde.length];
  try{ localStorage.setItem('tuerca-voz', novo); }catch(e){}
  vozActualizarBoton();
  return novo;
}
function vozActualizarBoton(){
  const b = document.getElementById('btnVoz');
  if(!b) return;
  const m = vozModo();
  /* (v0.68) sen emoji e traducido: a icona vai en CSS e as tres etiquetas
     xa existen no dicionario. */
  b.textContent = (typeof TXT === 'function')
    ? TXT(m === 'off' ? 'voz.off' : m === 'chios' ? 'voz.chios' : 'voz.toda')
    : (m === 'off' ? 'VOZ: OFF' : m === 'chios' ? 'VOZ: CHÍOS' : 'VOZ: TODA');
}

/* ---------- síntese de chíos (timbre por nome, coma os retratos) ---------- */
function _vozSeed(nome){
  let h = 2166136261;
  for(const c of String(nome||'ROBOT')){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
function _vozRng(seed){
  let s = seed || 1;
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
const VOZ_PERSOAS = {
  ESTOICO:  {pitch:0.72, rate:0.85, jitter:0.03, glide:-0.02, wave:'square'},
  IRONICO:  {pitch:0.95, rate:0.95, jitter:0.05, glide:-0.12, wave:'sawtooth'},
  LEAL:     {pitch:1.05, rate:1.00, jitter:0.05, glide:+0.06, wave:'triangle'},
  NERVIOSO: {pitch:1.25, rate:1.32, jitter:0.16, glide:+0.04, wave:'square'},
  CINICO:   {pitch:0.66, rate:0.82, jitter:0.02, glide:-0.06, wave:'sawtooth'},
  COMENTARISTA: {pitch:1.15, rate:1.25, jitter:0.07, glide:+0.10, wave:'sawtooth'},
};
const VOZ_VOGAIS = {a:1.00, e:1.12, i:1.30, o:0.85, u:0.74, 'á':1.0, 'é':1.12, 'í':1.3, 'ó':0.85, 'ú':0.74, 'ü':0.74};

function _vozSilabas(texto){
  const out = []; let cur = '';
  for(const ch of String(texto||'').toLowerCase()){
    if(VOZ_VOGAIS[ch]){ out.push(cur + ch); cur = ''; }
    else if(/[a-zñç]/.test(ch)) cur += ch;
    else { if(cur){ out.push(cur); cur = ''; } if(/[.,;:!?…»]/.test(ch)) out.push('|'); }
  }
  if(cur) out.push(cur);
  return out;
}

/* Devolve a duración total en segundos; nunca lanza (cada sílaba vai blindada). */
function falarChio(nome, persona, conf, texto, ganancia){
  const P = VOZ_PERSOAS[persona] || VOZ_PERSOAS.ESTOICO;
  const sils = _vozSilabas(texto);
  const durEstimada = sils.length * 0.085 / P.rate + 0.1;
  try{
    if(!audioCtx) initAudio();
    if(!audioCtx || !masterGain) return durEstimada;
    const r = _vozRng(_vozSeed(nome));
    const base = 90 + r() * 80;                     /* 90–170 Hz: identidade do robot */
    const kConf = 0.85 + (Math.max(0, Math.min(100, conf ?? 55)) / 100) * 0.35;
    const g0 = audioCtx.createGain();
    g0.gain.value = ganancia ?? 0.34;
    g0.connect(masterGain);
    let t = audioCtx.currentTime + 0.02;
    for(const s of sils){
      if(s === '|'){ t += 0.11 / P.rate; continue; }
      try{
        const vog = [...s].find(c => VOZ_VOGAIS[c]) || 'a';
        const dur = (0.055 + r() * 0.03 + (s.length > 3 ? 0.02 : 0)) / P.rate;
        const jit = 1 + (r() * 2 - 1) * P.jitter;
        const f0 = Math.max(45, base * P.pitch * VOZ_VOGAIS[vog] * jit * kConf);
        const o = audioCtx.createOscillator(); o.type = P.wave;
        o.frequency.setValueAtTime(f0, t);
        if(o.frequency.exponentialRampToValueAtTime)
          o.frequency.exponentialRampToValueAtTime(Math.max(40, f0 * (1 + P.glide)), t + dur);
        const o2 = audioCtx.createOscillator(); o2.type = 'sine';
        o2.frequency.setValueAtTime(f0 * 2.02, t);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const g2 = audioCtx.createGain(); g2.gain.value = 0.18;
        o.connect(g); o2.connect(g2); g2.connect(g); g.connect(g0);
        o.start(t); o.stop(t + dur + 0.01);
        o2.start(t); o2.stop(t + dur + 0.01);
        t += dur + 0.024 / P.rate;
      }catch(e){ t += 0.08 / P.rate; }
    }
    return Math.max(durEstimada, t - audioCtx.currentTime);
  }catch(e){ return durEstimada; }
}

/* ---------- clips humanos por manifesto ---------- */
let _vozManifest = null, _vozManifestPedido = false;
function vozCargarManifest(){
  if(_vozManifestPedido) return;
  _vozManifestPedido = true;
  try{
    fetch('voces/manifest.json').then(r => r.ok ? r.json() : null)
      .then(m => { _vozManifest = m; })
      .catch(() => { _vozManifest = null; });
  }catch(e){ _vozManifest = null; }
}
function _vozClipDe(clave){
  if(!_vozManifest || !_vozManifest[clave]) return null;
  const l = (typeof I18N !== 'undefined' && I18N.lang) ? I18N.lang : 'gl';
  return _vozManifest[clave][l] || _vozManifest[clave].gl || _vozManifest[clave].es || null;
}

/* ---------- xestor de canle: UNHA voz á vez ---------- */
const canleVoz = {
  falando: null,       /* {id, prio, timer|audio} */
  cola: [],            /* máx 2 */
  ultimas: {},         /* id → timestamp (dedupe) */
  _musicVolPrevio: null,
  pedir(p){
    try{
      if(vozModo() === 'off') return;
      const agora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if(p.id && this.ultimas[p.id] && agora - this.ultimas[p.id] < 6000) return;   /* dedupe */
      if(this.falando){
        if(p.prio > this.falando.prio){ this._cortar(); this._emitir(p); }
        else if(this.cola.length < 2){ this.cola.push(p); this.cola.sort((a, b) => b.prio - a.prio); }
        /* cola chea → refugada en silencio; o texto xa está na radio */
      } else this._emitir(p);
    }catch(e){}
  },
  _emitir(p){
    const agora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if(p.id) this.ultimas[p.id] = agora;
    this._duck(true);
    /* clip humano se: modo full + hai ficheiro; senón chío */
    const ruta = (vozModo() === 'full' && p.clave) ? _vozClipDe(p.clave) : null;
    if(ruta){
      try{
        const a = new Audio(ruta);
        a.volume = 0.85;
        a.onended = () => { this._liberar(); };
        a.onerror = () => { this._liberar(); };
        const pr = a.play(); if(pr && pr.catch) pr.catch(() => this._liberar());
        this.falando = {...p, audio: a};
        /* rede de seguridade se ended non chega */
        this.falando.timer = setTimeout(() => this._liberar(), 12000);
        return;
      }catch(e){ /* cae ao chío */ }
    }
    const dur = falarChio(p.quen, p.persona, p.conf, p.texto, p.prio >= 5 ? 0.5 : 0.34);
    this.falando = {...p, timer: setTimeout(() => this._liberar(), dur * 1000 + 120)};
  },
  _cortar(){
    if(!this.falando) return;
    try{
      if(this.falando.timer) clearTimeout(this.falando.timer);
      if(this.falando.audio){ this.falando.audio.onended = null; this.falando.audio.pause(); }
      /* os chíos xa programados morren sós en <1s; o corte perceptivo chega */
    }catch(e){}
    this.falando = null;
  },
  _liberar(){
    if(this.falando && this.falando.timer) clearTimeout(this.falando.timer);
    this.falando = null;
    const p = this.cola.shift();
    if(p) this._emitir(p);
    else this._duck(false);
  },
  _duck(on){
    try{
      if(typeof _music === 'undefined' || !_music || _music === 'none' || !_music.volume) return;
      if(on){
        if(this._musicVolPrevio === null){ this._musicVolPrevio = _music.volume; _music.volume = Math.max(0.05, _music.volume * 0.45); }
      } else if(this._musicVolPrevio !== null){
        _music.volume = this._musicVolPrevio; this._musicVolPrevio = null;
      }
    }catch(e){}
  },
};

window.canleVoz = canleVoz;   /* depuración e arnés */

/* ---------- API de alto nivel ---------- */
/* Robot fala (chío): selección prio 4, evento con dono prio 2 */
function vozRobot(u, texto, prio, tag){
  if(!u || !texto) return;
  canleVoz.pedir({
    quen: u.name, persona: u.personalidad, conf: u.confianza,
    texto, prio: prio || 2,
    id: (tag || 'r') + ':' + (u.id || u.name) + ':' + String(texto).slice(0, 24),
  });
}
/* Mando/HQ ao comandante: clip humano se o hai (modo full), senón chío grave de "mando" */
function vozMando(clave, texto){
  vozCargarManifest();
  canleVoz.pedir({
    quen: 'HQ', persona: 'ESTOICO', conf: 90,
    texto: texto || clave, clave, prio: 5, id: 'mando:' + clave,
  });
}
/* Comentarista do Mundial: clip se o hai, senón chío entusiasta con "compresión" */
function vozComentarista(clave, texto){
  vozCargarManifest();
  canleVoz.pedir({
    quen: 'COMENTARISTA', persona: 'COMENTARISTA', conf: 95,
    texto: texto || clave, clave, prio: 5, id: 'com:' + clave + ':' + String(texto).slice(0, 16),
  });
}

/* ---------- botón de modo ---------- */
(function(){
  const b = document.getElementById('btnVoz');
  if(b){ b.onclick = vozCiclarModo; vozActualizarBoton(); }
})();
