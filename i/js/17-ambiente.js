/* ============================================================
   (v0.74) AMBIENTE — a cama de son do mundo.

   Ata agora TUERCA só soaba cando pasaba algo: disparos, radio,
   voces. Entre medias, silencio. Isto pon a capa que falta: vento,
   maquinaria e metal distante, sempre por baixo.

   Procedural, sen un só ficheiro de audio — como o resto do SFX do
   xogo. Todo colga de masterGain, así que a tecla M segue apagando
   tamén isto.

   Dúas escenas distintas:
     hangar   nave pechada: motores, ventilación, golpes de taller
     batalla  campo aberto: vento, e metal moi ao lonxe

   E baixa soa cando hai leña (agachado reactivo): se non, o
   ambiente pelexa contra os disparos e non se entende nada.
   ============================================================ */

const AMB = {
  activo: (function(){ try{ return localStorage.getItem('tuerca_amb') !== '0'; }catch(e){ return true; } })(),
  vol: 0.5,            /* 0..1 sobre o volume xa reducido da cama */
  agachar: true,       /* baixar cando hai combate */
};

let _amb = null;   /* {escena, nodos:[], gan, ganVento, filtroVento, seguinteGolpe} */

/* Ruído en bucle: un búfer de 3 s abonda para que non se note a costura. */
function _ambRuidoBucle(){
  const n = Math.floor(audioCtx.sampleRate * 3);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  /* Ruído rosa por promediado: o branco puro sae sibilante e cansa. */
  let b0 = 0, b1 = 0, b2 = 0;
  for(let i = 0; i < n; i++){
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
  }
  const s = audioCtx.createBufferSource();
  s.buffer = buf; s.loop = true;
  return s;
}

/* Un oscilador lento que modula un parámetro: dálle vida ao que se non
   sería un zumbido morto. */
function _ambLfo(param, centro, amplitude, hz){
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.value = hz;
  g.gain.value = amplitude;
  param.value = centro;
  o.connect(g); g.connect(param);
  o.start();
  return [o, g];
}

function ambienteParar(){
  if(!_amb) return;
  try{
    _amb.gan.gain.cancelScheduledValues(audioCtx.currentTime);
    _amb.gan.gain.setTargetAtTime(0, audioCtx.currentTime, 0.25);
    const nodos = _amb.nodos, gan = _amb.gan;
    setTimeout(() => {
      for(const n of nodos){ try{ n.stop ? n.stop() : n.disconnect(); }catch(_){} }
      try{ gan.disconnect(); }catch(_){}
    }, 900);
  }catch(e){ console.error('[ambiente parar]', e); }
  _amb = null;
}

function ambienteIniciar(escena){
  if(!AMB.activo) return;
  if(_amb && _amb.escena === escena) return;
  if(_amb) ambienteParar();
  if(typeof initAudio === 'function') initAudio();
  if(!audioCtx || !masterGain) return;
  /* Coas políticas de autoplay, ata que non hai xesto do usuario o
     contexto está suspendido. Non forzamos nada: xa arrancará. */
  if(audioCtx.state === 'suspended') return;

  try{
    const nodos = [];
    const gan = audioCtx.createGain();
    gan.gain.value = 0;
    gan.connect(masterGain);

    const daBatalla = escena === 'batalla';

    /* ---- Vento (fóra) ou ventilación (dentro) ----
       O mesmo ruído con filtro distinto: aberto e ancho no campo,
       pechado e sordo na nave. */
    const ruido = _ambRuidoBucle();
    const filtro = audioCtx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = daBatalla ? 0.8 : 1.6;
    const ganVento = audioCtx.createGain();
    ganVento.gain.value = daBatalla ? 0.30 : 0.16;
    ruido.connect(filtro); filtro.connect(ganVento); ganVento.connect(gan);
    ruido.start();
    nodos.push(ruido);
    /* O corte respira: sen isto é unha mancha de ruído inmóbil. */
    nodos.push(..._ambLfo(filtro.frequency, daBatalla ? 520 : 300,
                          daBatalla ? 300 : 120, 0.055));
    nodos.push(..._ambLfo(ganVento.gain, ganVento.gain.value,
                          ganVento.gain.value * 0.45, 0.037));

    /* ---- Maquinaria: dous osciladores desafinados moi graves ----
       O batido entre 43 e 44.6 Hz é o que fai que soe a motor grande e
       non a nota. Na nave péchase máis e ponse máis forte. */
    for(const [hz, vol] of (daBatalla ? [[43, 0.05], [64.7, 0.03]]
                                      : [[43, 0.10], [44.6, 0.08], [86, 0.04]])){
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const lp = audioCtx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = hz;
      lp.type = 'lowpass'; lp.frequency.value = 190;
      g.gain.value = vol;
      o.connect(lp); lp.connect(g); g.connect(gan);
      o.start();
      nodos.push(o);
      nodos.push(..._ambLfo(g.gain, vol, vol * 0.35, 0.08 + Math.random() * 0.06));
    }

    _amb = {
      escena, nodos, gan,
      /* O primeiro golpe de metal non soa de inmediato: quedaría
         pegado ao cambio de pantalla e parecería un erro. */
      seguinteGolpe: audioCtx.currentTime + 6 + Math.random() * 8,
      nivel: 1,
    };
    gan.gain.setTargetAtTime(AMB.vol, audioCtx.currentTime, 1.2);   /* entra suave */
  }catch(e){ console.error('[ambiente]', e); _amb = null; }
}

/* Golpe de metal distante: alguén traballando lonxe. Ruído filtrado
   estreito cunha cola longa — non é un impacto, é un eco. */
function _ambGolpe(){
  try{
    const t = audioCtx.currentTime;
    const s = _noiseSrc(0.5);
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380 + Math.random() * 900;
    bp.Q.value = 5 + Math.random() * 9;
    const g = audioCtx.createGain();
    const v = 0.05 + Math.random() * 0.06;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 + Math.random() * 0.5);
    s.connect(bp); bp.connect(g); g.connect(_amb.gan);
    s.start(t); s.stop(t + 1.1);
  }catch(e){ /* un golpe perdido non importa */ }
}

/* Chámase unha vez por frame desde loop(). Barato: só mira reloxos. */
function ambienteTick(g){
  if(!AMB.activo || !_amb || !audioCtx) return;
  try{
    const t = audioCtx.currentTime;
    if(t >= _amb.seguinteGolpe){
      _ambGolpe();
      const dentro = _amb.escena === 'hangar';
      _amb.seguinteGolpe = t + (dentro ? 4 : 9) + Math.random() * (dentro ? 9 : 16);
    }

    /* AGACHADO REACTIVO: canto máis tiroteo, máis baixa a cama. Sen
       isto o ambiente pelexa contra os disparos e non se entende nada.
       O nivel de leña sae dos tracers vivos, que xa é o que mide o
       combate en curso sen ter que levar contas aparte. */
    if(AMB.agachar && g){
      const leña = Math.min(1, ((g.tracers && g.tracers.length) || 0) / 14);
      const obxectivo = AMB.vol * (1 - 0.55 * leña);
      if(Math.abs(obxectivo - _amb.nivel) > 0.01){
        _amb.gan.gain.setTargetAtTime(obxectivo, t, 0.35);
        _amb.nivel = obxectivo;
      }
    }
  }catch(e){ console.error('[ambiente tick]', e); }
}

/* A tecla A acende e apaga a cama (persistente). */
document.addEventListener('keydown', e => {
  if(e.key !== 'a' && e.key !== 'A') return;
  /* OLLO: 'a' tamén move a cámara á esquerda (05-mapa-camara-neboa.js).
     Por iso vai con Shift, para non pelexar co movemento. */
  if(!e.shiftKey) return;
  AMB.activo = !AMB.activo;
  try{ localStorage.setItem('tuerca_amb', AMB.activo ? '1' : '0'); }catch(_){}
  if(AMB.activo){
    const hg = document.getElementById('hangar');
    ambienteIniciar(hg && hg.style.display !== 'none' ? 'hangar' : 'batalla');
  } else ambienteParar();
  if(typeof radio === 'function') radio(AMB.activo ? '♪ Ambiente: aceso' : '♪ Ambiente: apagado', '#888');
});
