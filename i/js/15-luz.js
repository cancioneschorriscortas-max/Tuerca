/* ============================================================
   (v0.66) LUZ E ATMOSFERA — pasada de composición sobre a escena.

   Non toca nin un só sprite. O mundo debúxase exactamente igual que
   antes; o que cambia é o que pasa DESPOIS de debuxalo:

     1. mapa de luz  → ambiente segundo a hora + focos aditivos
     2. multiply     → o mundo apágase onde non chega a luz
     3. bloom        → os focos derraman un halo suave
     4. po           → dúas capas de motas con parallaxe
     5. viñeta       → peche escuro nas beiras

   Todo en espazo de PANTALLA, despois do ctx.restore() da cámara, así
   que os focos hai que convertelos de mundo a pantalla a man
   (a mesma transformación que fai canvasPos: (w - cam) * camZoom).

   Teclas en batalla:  L  acende/apaga a capa    K  ciclo de hora
   ============================================================ */

const LUZ = {
  activa: (function(){ try{ return localStorage.getItem('tuerca_luz') !== '0'; }catch(e){ return true; } })(),
  horaForzada: null,   /* null = segue o reloxo do mundo; 9..19 para probar */
  forza: 1,            /* 0 = sen efecto, 1 = ambiente pleno */
  tropas: 0.55,        /* luz propia das unidades; 0 = apágaas co resto */
  bloom: true,
  po: true,
  vineta: true,
};

/* ---------- Ambiente por hora ----------
   Cores de MULTIPLICACIÓN: branco = non escurece nada; canto máis
   escura e saturada, máis pesa. A partida vai de 09:00 a ~19:00
   (o mesmo reloxo que pinta o HUD), así que a batalla empeza fresca,
   pasa por un mediodía case neutro e acaba en solpor ámbar. */
const LUZ_RAMPA = [
  { h: 9,  c: [0xa6, 0xae, 0xc2] },   /* mañá: azul frío, sol baixo */
  { h: 11, c: [0xcc, 0xcc, 0xc6] },
  { h: 13, c: [0xe0, 0xdc, 0xd0] },   /* mediodía: case neutro */
  { h: 16, c: [0xd2, 0xba, 0x9c] },   /* tarde: quéntase */
  { h: 18, c: [0x9c, 0x76, 0x5e] },   /* solpor: ámbar forte */
  { h: 19, c: [0x56, 0x50, 0x78] },   /* lusco-fusco: azul profundo */
];

function luzHora(g){
  if(LUZ.horaForzada != null) return LUZ.horaForzada;
  /* MESMA fórmula que o reloxo do HUD en 11-retratos-ui.js. Se unha
     cambia, a outra tamén: o ceo e o reloxo teñen que contar o mesmo. */
  return Math.min(19, 9 + (g.t || 0) / 9000);
}

function luzAmbiente(h){
  const R = LUZ_RAMPA;
  let a = R[0], b = R[R.length - 1];
  for(let i = 0; i < R.length - 1; i++){
    if(h >= R[i].h && h <= R[i+1].h){ a = R[i]; b = R[i+1]; break; }
  }
  if(h <= R[0].h){ a = b = R[0]; }
  else if(h >= R[R.length-1].h){ a = b = R[R.length-1]; }
  const k = (b.h === a.h) ? 0 : (h - a.h) / (b.h - a.h);
  const mix = (i) => Math.round(a.c[i] + (b.c[i] - a.c[i]) * k);
  /* LUZ.forza mestura cara ao branco: 0 deixa a escena intacta. */
  const f = Math.max(0, Math.min(1, LUZ.forza));
  const cara = (v) => Math.round(255 + (v - 255) * f);
  return [cara(mix(0)), cara(mix(1)), cara(mix(2))];
}

/* ============================================================
   SOMBRAS PROXECTADAS

   O indicador de profundidade máis barato que existe: sen elas todo
   flota sobre o chan e delátase que é 2D. Non van na capa de
   composición senón DENTRO de draw(), en coordenadas de mundo, xusto
   despois do chan (terreo e plataformas de sector) e antes de todo o
   sólido — así unha sombra pousa sobre a plataforma e o sprite que a
   proxecta debúxase enriba.

   O sol vai do leste ao oeste ao longo da partida: ás 09:00 está baixo
   e as sombras son longas cara a un lado, ao mediodía acurtan e case
   caen a plomo, e ao solpor alónganse cara ao outro. A dirección sae
   da MESMA hora que alimenta o ambiente.
   ============================================================ */
const SOMBRA = {
  activa: true,
  alfa: 0.32,      /* opacidade base */
  longa: 13,       /* estirón extra co sol baixo, en píxeles de mundo */
};

/* Desprazamento da sombra para a hora actual. */
function sombraVector(g){
  const h = luzHora(g);
  const t = Math.max(0, Math.min(1, (h - 9) / 10));   /* 0 ás 9, 1 ás 19 */
  const k = Math.abs(1 - 2*t);                        /* 1 co sol baixo, 0 no cénit */
  const lonx = 3 + SOMBRA.longa * k;
  return {
    dx: (1 - 2*t) * lonx,        /* cambia de lado ao pasar o mediodía */
    dy: 2 + 0.42 * lonx,         /* sempre algo cara abaixo: vista case cenital */
    k,
  };
}

/* Chámase desde draw() (10-estructuras.js). Coordenadas de MUNDO. */
function sombrasDebuxar(g){
  if(!LUZ.activa || !SOMBRA.activa || !g) return;
  const { dx, dy, k } = sombraVector(g);
  ctx.save();
  ctx.fillStyle = '#000';
  /* Co sol alto a sombra é máis pechada e curta; co sol baixo, longa
     pero máis lavada. */
  ctx.globalAlpha = SOMBRA.alfa * (1 - 0.28 * k);

  const elipse = (x, y, rx, ry) => {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, rx, ry, 0, 0, 7);
    ctx.fill();
  };

  for(const u of g.units){
    if(u.dead || u.inside) continue;
    elipse(u.x, u.y + 4, u.heavy ? 9 : 7, u.heavy ? 5 : 4);
  }
  for(const t of (g.turrets || [])){
    if(t.destroyed) continue;
    elipse(t.x, t.y + 3, 10, 5);
  }
  for(const v of (g.vehicles || [])){
    if(v.destroyed) continue;
    elipse(v.x, v.y + 3, 12, 5);
  }
  /* Os HQ son caixas: sombra rectangular, non elipse. */
  for(const h of g.hq){
    ctx.fillRect(h.x + dx, h.y + dy, h.w, h.h);
  }
  /* Os muros tamén proxectan: son a cobertura do campo. Ollo, gárdanse
     polo CENTRO e sen tamaño (buildWallsFromMap), non pola esquina. */
  for(const w of (g.walls || [])){
    if(w.destroyed) continue;
    ctx.fillRect(w.x - 8 + dx, w.y - 8 + dy, 16, 16);
  }
  ctx.restore();
}

/* ---------- Focos ----------
   Devolve fontes en coordenadas de MUNDO. `r` en píxeles de mundo,
   `a` alfa 0..1, `c` cor css. */
function luzFontes(g){
  const F = [];
  /* Portas de fábrica acesas mentres producen */
  for(const h of g.hq){
    if(g.prod && g.prod[h.team]){
      const dx = h.team === 0 ? h.x + h.w : h.x;
      F.push({x: dx, y: h.y + h.h/2, r: 96, c: '#ff9a3c',
              a: 0.55 + 0.18 * Math.sin(g.t * 0.11)});
    }
  }
  /* Luces de perímetro dos sectores ocupados */
  for(const s of g.sectors){
    if(s.owner !== 0 && s.owner !== 1) continue;
    const c = s.owner === 0 ? '#4f8aff' : '#ff5340';
    for(let i = 0; i < 4; i++){
      const ang = i*Math.PI/2 + Math.PI/4;
      F.push({x: s.x + Math.cos(ang)*(s.r-4), y: s.y + Math.sin(ang)*(s.r-4),
              r: 46, c, a: 0.34 + 0.16 * Math.sin(g.t*0.06 + i*1.7)});
    }
  }
  /* Fogonazos: cada tracer vivo ilumina a boca do canón */
  if(g.tracers) for(const t of g.tracers){
    F.push({x: t.x1, y: t.y1, r: 40, c: t.team === 0 ? '#cfe0ff' : '#ffd0b0',
            a: 0.5 * Math.max(0, t.t / 7)});
  }
  /* LUZ PROPIA DAS TROPAS.
     Sen isto, o multiply apaga por igual chan e unidades — pero as
     unidades son pequenas, detalladas e é o que hai que ler. Cada unha
     leva un pouso de luz cálida e neutra: non brilla, só non se afoga.
     Neutra a propósito: tinguila por bando empeoraría a lexibilidade
     de quen non distingue azul de vermello. Escala co zoom porque de
     preto convén un pouso máis amplo. */
  if(LUZ.tropas > 0){
    for(const u of g.units){
      if(u.dead || u.inside) continue;
      F.push({x: u.x, y: u.y - 2, r: u.heavy ? 30 : 24, c: '#ffe6c0',
              a: 0.42 * LUZ.tropas, senBloom: true});
    }
    /* Os vehículos e torretas ocupados tamén: son unidades de feito. */
    const tripulados = [].concat(g.vehicles || [], g.turrets || []);
    for(const s of tripulados){
      if(!s.occupant || s.destroyed) continue;
      F.push({x: s.x, y: s.y, r: 34, c: '#ffe6c0', a: 0.38 * LUZ.tropas, senBloom: true});
    }
  }
  /* Chispas e cascallos ardendo (as partículas do sistema de FX) */
  if(typeof _fx !== 'undefined') for(const p of _fx){
    if(p.t !== 'spark') continue;
    F.push({x: p.x, y: p.y, r: 26, c: p.col || '#ffd24a',
            a: 0.42 * Math.max(0, p.life / (p.max || 1))});
  }
  return F;
}

/* ---------- Lenzos auxiliares ---------- */
let _luzCv = null, _luzCtx = null;
let _vinCv = null;

function _luzLenzo(w, h){
  if(!_luzCv || _luzCv.width !== w || _luzCv.height !== h){
    _luzCv = document.createElement('canvas');
    _luzCv.width = w; _luzCv.height = h;
    _luzCtx = _luzCv.getContext('2d');
  }
  return _luzCtx;
}

/* A viñeta é fixa: xérase unha vez por tamaño. */
function _vineta(w, h){
  if(_vinCv && _vinCv.width === w && _vinCv.height === h) return _vinCv;
  _vinCv = document.createElement('canvas');
  _vinCv.width = w; _vinCv.height = h;
  const v = _vinCv.getContext('2d');
  const g2 = v.createRadialGradient(w/2, h/2, Math.min(w, h) * 0.34,
                                    w/2, h/2, Math.max(w, h) * 0.76);
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(0,0,0,0.46)');
  v.fillStyle = g2; v.fillRect(0, 0, w, h);
  return _vinCv;
}

/* ---------- Po en suspensión ----------
   Dúas capas con parallaxe: a de diante móvese máis. Viven en espazo
   de pantalla e reciclan ao saír, así que non custan nada. */
let _po = null;
function _poInit(w, h){
  _po = [];
  for(let i = 0; i < 90; i++){
    const capa = i < 30 ? 1 : 0;   /* 1 = diante (máis grande e rápida) */
    _po.push({
      x: Math.random()*w, y: Math.random()*h,
      vx: (capa ? -14 : -6) - Math.random()*8,
      vy: (Math.random()*2-1) * (capa ? 5 : 2),
      r: capa ? 1.4 : 0.8,
      a: capa ? 0.16 : 0.09,
    });
  }
}
function _poDebuxar(dt, w, h){
  if(!_po) _poInit(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const p of _po){
    p.x += p.vx * dt; p.y += p.vy * dt;
    if(p.x < -4){ p.x = w + 4; p.y = Math.random()*h; }
    if(p.y < -4) p.y = h + 4; else if(p.y > h + 4) p.y = -4;
    ctx.globalAlpha = p.a;
    ctx.fillStyle = '#d8cbb0';
    ctx.fillRect(p.x, p.y, p.r * 2, p.r * 2);
  }
  ctx.restore();
}

/* ---------- Composición ----------
   Chámase desde loop() xusto despois do ctx.restore() da cámara e
   ANTES do HUD, para que minimapa, reloxo e avisos queden lexibles. */
function luzComporFrame(g, dt){
  if(!LUZ.activa || !g) return;
  const w = cv.width, h = cv.height;
  const hora = luzHora(g);
  const [ar, ag, ab] = luzAmbiente(hora);

  /* Conversión mundo -> pantalla (a inversa de canvasPos) */
  const z = (typeof camZoom === 'number' ? camZoom : 1);
  const cx = (typeof cam === 'object' && cam) ? cam.x : 0;
  const cy = (typeof cam === 'object' && cam) ? cam.y : 0;
  const aPantalla = (f) => ({ x: (f.x - cx) * z, y: (f.y - cy) * z, r: f.r * z,
                              c: f.c, a: f.a, senBloom: f.senBloom });

  const fontes = luzFontes(g).map(aPantalla).filter(f =>
    f.x > -f.r && f.x < w + f.r && f.y > -f.r && f.y < h + f.r && f.a > 0.01);

  /* 1) Mapa de luz */
  const L = _luzLenzo(w, h);
  L.globalCompositeOperation = 'source-over';
  L.fillStyle = `rgb(${ar},${ag},${ab})`;
  L.fillRect(0, 0, w, h);
  L.globalCompositeOperation = 'lighter';
  for(const f of fontes){
    const grd = L.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    grd.addColorStop(0, f.c);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    L.globalAlpha = f.a;
    L.fillStyle = grd;
    L.fillRect(f.x - f.r, f.y - f.r, f.r*2, f.r*2);
  }
  L.globalAlpha = 1;

  /* 2) Aplicar: onde o mapa é escuro, a escena apágase */
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(_luzCv, 0, 0);
  ctx.restore();

  /* 3) Bloom barato: os focos derraman por riba do que xa está apagado */
  if(LUZ.bloom){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(const f of fontes){
      /* A luz propia das tropas non derrama: só evita que se afoguen.
         Se fixese halo, as unidades parecerían farois andando. */
      if(f.senBloom) continue;
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 1.5);
      grd.addColorStop(0, f.c);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = f.a * 0.30;
      ctx.fillStyle = grd;
      ctx.fillRect(f.x - f.r*1.5, f.y - f.r*1.5, f.r*3, f.r*3);
    }
    ctx.restore();
  }

  /* 4) Po */
  if(LUZ.po) _poDebuxar(Math.min(0.05, dt || 0.016), w, h);

  /* 5) Viñeta */
  if(LUZ.vineta){
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(_vineta(w, h), 0, 0);
    ctx.restore();
  }
}

/* ---------- Controis de proba ----------
   L acende/apaga (persistente). K percorre as horas do día para ver o
   solpor sen agardar 10 minutos; volve ao reloxo real ao dar a volta. */
document.addEventListener('keydown', e => {
  if(!window.game) return;
  if(e.key === 'l' || e.key === 'L'){
    LUZ.activa = !LUZ.activa;
    try{ localStorage.setItem('tuerca_luz', LUZ.activa ? '1' : '0'); }catch(_){}
    if(typeof radio === 'function') radio(LUZ.activa ? '☀ Luz: acesa' : '☀ Luz: apagada', '#c8a86a');
  }
  if(e.key === 'k' || e.key === 'K'){
    const ciclo = [null, 9, 11, 13, 16, 18, 19];
    const i = ciclo.indexOf(LUZ.horaForzada);
    LUZ.horaForzada = ciclo[(i + 1) % ciclo.length];
    if(typeof radio === 'function'){
      radio(LUZ.horaForzada == null
        ? '☀ Hora: reloxo do mundo'
        : '☀ Hora forzada: ' + String(LUZ.horaForzada).padStart(2, '0') + ':00', '#c8a86a');
    }
  }
});
