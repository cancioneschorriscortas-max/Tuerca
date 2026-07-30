/* ============================================================
   (v0.83) EFECTOS DE LECTURA — o que pasa e non se ve.

   Tres cousas que o xogo xa fai e non conta:
     · o enxeñeiro reparando (soldadura + marca no paciente)
     · o sniper abatendo lonxe, moitas veces fóra de cámara
     · o bombardeiro rebentando algo (faltáballe a ONDA)

   Non son sprites: son capa de FX. Iso significa que non
   multiplican follas por oito direccións, non dependen do
   pipeline 3D, e —o mellor— a capa de luz da v0.66 le os focos
   que se declaran aquí, así que unha soldadura ACENDE o chan
   sen escribir nada máis.

   Todo axustable en vivo desde a consola: EFX é global.
   ============================================================ */

const EFX = {
  cura: true,        /* soldadura + cruz no que se repara */
  sniper: true,      /* marca de abate a distancia */
  onda: true,        /* anel de choque das explosións */
  curaCor: '#7fdc7f',    /* verde de curación; a cruz le ao instante */
  curaFrames: 20,        /* canto dura a marca tras o último tick de reparación */
};

/* Listas propias. Non se mesturan co _fx de partículas: estes teñen
   xeometría e duración distintas, e algúns queren dar luz. */
let _efxOndas = [];      /* {x,y,r,rMax,vida,max,big} */
let _efxMarcas = [];     /* {x,y,vida,max,tipo} */

/* ---------- Emisores (chámaos o motor) ---------- */

/* Soldadura no punto de contacto entre enxeñeiro e paciente. */
function efxCura(ux, uy, vx, vy){
  if(!EFX.cura) return;
  /* No medio dos dous: aí é onde está o arco. */
  const x = (ux + vx) / 2, y = (uy + vy) / 2;
  /* Reutilízase o sistema de chispas que xa existe; ademais, a capa de
     luz xa as le como focos, así que a soldadura ilumina soa. */
  if(typeof fxSparks === 'function' && Math.random() < 0.5) fxSparks(x, y, 0);
}

/* Marca de abate do sniper, no punto onde caeu o obxectivo. */
function efxSniper(x, y){
  if(!EFX.sniper) return;
  _efxMarcas.push({x, y, vida: 1.5, max: 1.5, tipo: 'sniper'});
  if(_efxMarcas.length > 24) _efxMarcas.shift();
}

/* Onda de choque dunha explosión. */
function efxOnda(x, y, big){
  if(!EFX.onda) return;
  _efxOndas.push({x, y, r: big ? 6 : 4, rMax: big ? 78 : 46,
                  vida: big ? 0.55 : 0.4, max: big ? 0.55 : 0.4, big: !!big});
  if(_efxOndas.length > 12) _efxOndas.shift();
}

/* ---------- Focos para a capa de luz ----------
   Devolve fontes en coordenadas de MUNDO, coma luzFontes(). O destello
   dunha explosión é o efecto máis barato e máis satisfactorio que hai:
   ilumina o mapa enteiro durante tres frames. */
function efxFocos(){
  const F = [];
  for(const o of _efxOndas){
    const t = o.vida / o.max;
    if(t < 0.55) continue;                 /* só o comezo: é un destello */
    F.push({x: o.x, y: o.y, r: o.big ? 150 : 90, c: '#ffcf7a',
            a: (t - 0.55) / 0.45 * (o.big ? 0.95 : 0.6)});
  }
  return F;
}

/* ---------- Debuxo (mundo) ----------
   Chámase ao final de draw(), por riba de todo. */
function efxDebuxar(g, dt){
  dt = Math.min(0.05, dt || 0.016);

  /* --- Ondas de choque --- */
  for(const o of _efxOndas){
    o.vida -= dt;
    const t = 1 - o.vida / o.max;              /* 0 -> 1 */
    o.r = 4 + (o.rMax - 4) * (1 - (1 - t) * (1 - t));   /* rápido e frea */
  }
  _efxOndas = _efxOndas.filter(o => o.vida > 0);
  for(const o of _efxOndas){
    const a = Math.max(0, o.vida / o.max);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,200,130,${a * 0.7})`;
    ctx.lineWidth = o.big ? 2.5 * a + 0.5 : 1.5 * a + 0.5;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.stroke();
    ctx.restore();
  }

  /* --- Marcas de sniper --- */
  for(const m of _efxMarcas) m.vida -= dt;
  _efxMarcas = _efxMarcas.filter(m => m.vida > 0);
  for(const m of _efxMarcas){
    const t = 1 - m.vida / m.max;
    const a = Math.min(1, m.vida / m.max * 2);
    /* O círculo DEBÚXASE, non aparece: dous arcos pechando. Léese como
       unha mira que se fixa, non como un adorno que parpadea. */
    const r = 13 - 5 * Math.min(1, t * 3);
    const ang = Math.min(1, t * 3) * Math.PI;
    ctx.save();
    ctx.strokeStyle = `rgba(255,240,200,${a})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(m.x, m.y, r, -Math.PI/2, -Math.PI/2 + ang); ctx.stroke();
    ctx.beginPath(); ctx.arc(m.x, m.y, r, Math.PI/2, Math.PI/2 + ang); ctx.stroke();
    if(t > 0.28){
      const c = Math.min(1, (t - 0.28) * 4) * r * 0.75;
      ctx.beginPath();
      ctx.moveTo(m.x - c, m.y); ctx.lineTo(m.x + c, m.y);
      ctx.moveTo(m.x, m.y - c); ctx.lineTo(m.x, m.y + c);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* --- Quen está a ser reparado ---
     A marca vai no PACIENTE, non no enxeñeiro: o dato que importa é
     "esta unidade estase a recuperar", non "aquel está a traballar". */
  if(EFX.cura && g.units){
    for(const v of g.units){
      if(v.dead || v.inside) continue;
      if(!v._curandoT || g.t - v._curandoT > EFX.curaFrames) continue;
      const pulso = 0.55 + 0.45 * Math.sin(g.t * 0.25);
      ctx.save();
      ctx.globalAlpha = pulso;
      ctx.fillStyle = EFX.curaCor;
      /* Cruz pequena por riba da cabeza. Tres píxeles de groso: a esta
         escala menos non se ve e máis tapa a unidade. */
      const cx = Math.round(v.x), cy = Math.round(v.y) - 17;
      ctx.fillRect(cx - 1, cy - 3, 3, 7);
      ctx.fillRect(cx - 3, cy - 1, 7, 3);
      ctx.restore();
    }
  }
}

/* ---------- Debuxo (pantalla) ----------
   Chámase DESPOIS de restaurar a cámara. Se un abate cae fóra da vista,
   unha frecha no bordo di cara a onde. Sen isto o efecto pérdese
   precisamente cando máis falta fai. */
function efxHUD(g){
  if(!EFX.sniper || !_efxMarcas.length) return;
  const z = (typeof camZoom === 'number' ? camZoom : 1);
  const cx0 = (typeof cam === 'object' && cam) ? cam.x : 0;
  const cy0 = (typeof cam === 'object' && cam) ? cam.y : 0;
  const W2 = cv.width, H2 = cv.height, M = 18;
  for(const m of _efxMarcas){
    const sx = (m.x - cx0) * z, sy = (m.y - cy0) * z;
    if(sx >= 0 && sx <= W2 && sy >= 0 && sy <= H2) continue;   /* xa se ve */
    const a = Math.max(0, Math.min(1, m.vida / m.max));
    const px = Math.max(M, Math.min(W2 - M, sx));
    const py = Math.max(M, Math.min(H2 - M, sy));
    const ang = Math.atan2(sy - H2/2, sx - W2/2);
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = `rgba(255,240,200,${a})`;
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/* Ao cambiar de batalla non se arrastran efectos da anterior. */
function efxLimpar(){ _efxOndas = []; _efxMarcas = []; }

/* ============================================================
   A PORTADA VIVA (v0.84)

   O fondo do menú é unha nave de montaxe onde xa hai xente soldando: a
   arte ten dous puntos de solda pintados, un no mech da esquerda e outro
   no operario da dereita. Isto non inventa nada novo — pon chispas
   ENCIMA deses dous puntos, que é o que fai que a imaxe deixe de
   parecer un cadro.

   O TRUCO QUE IMPORTA é como se atopan eses puntos. O fondo vai con
   `center/cover`, así que segundo a fiestra recórtase por arriba ou
   polos lados. Se as chispas fosen a unha posición fixa da pantalla,
   despegaríanse do soldador en canto alguén cambiase o tamaño. Gárdanse
   como FRACCIÓNS DA IMAXE e refaise a conta do `cover` en cada redimensión.

   Só corre na portada (body.no-hangar) e párase en canto se sae: unha
   animación que segue debuxando detrás dunha batalla é traballo tirado.
   ============================================================ */
const PORTADA = {
  /* Onde solda cada quen, en fraccións da imaxe de fondo. Sacadas
     mirando a propia imaxe, non a ollo sobre a pantalla. */
  puntos: [
    /* Os dous soldadores que a arte xa ten pintados. Con moita
       resolución vense; cunha fiestra normal quedan detrás do roster. */
    { x: 0.253, y: 0.680, forza: 1.0 },
    { x: 0.816, y: 0.760, forza: 0.8 },
    /* E dous nas MARXES, que é a parte do fondo que se ve sempre: o
       roster ocupa o centro. Sen estes, o efecto está pero non se ve, que
       é o mesmo que non estar. Tamén caen sobre maquinaria da imaxe. */
    { x: 0.055, y: 0.620, forza: 0.7 },
    { x: 0.945, y: 0.545, forza: 0.6 },
  ],
  chispas: [], cv: null, ctx: null, im: null, t: 0, ultimo: 0, corre: false,
};

function _portadaCaixa(){
  /* A mesma conta que fai `background-size: cover`. */
  const P = PORTADA, W = P.cv.width, H = P.cv.height;
  const iw = (P.im && P.im.naturalWidth) || 1672;
  const ih = (P.im && P.im.naturalHeight) || 941;
  const k = Math.max(W/iw, H/ih);
  return { x: (W - iw*k)/2, y: (H - ih*k)/2, w: iw*k, h: ih*k };
}

function _portadaChispa(p, caixa){
  const P = PORTADA;
  const x = caixa.x + p.x*caixa.w, y = caixa.y + p.y*caixa.h;
  /* As chispas de solda saen cara arriba e cara os lados e caen. Un cono
     estreito parecería unha fonte; o que se busca é metralla. */
  const ang = -Math.PI/2 + (Math.random() - 0.5) * 2.4;
  const v = 60 + Math.random()*190;
  P.chispas.push({
    x, y, px: x, py: y, vx: Math.cos(ang)*v, vy: Math.sin(ang)*v,
    vida: 0.35 + Math.random()*0.75, idade: 0,
    quente: Math.random() < 0.3,
  });
}

function efxPortadaPaso(ms){
  const P = PORTADA;
  if(!P.cv) return;
  const dt = Math.min(0.05, (ms - P.ultimo)/1000 || 0);
  P.ultimo = ms; P.t += dt;

  const cv = P.cv, ctx = P.ctx;
  if(cv.width !== cv.clientWidth || cv.height !== cv.clientHeight){
    cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  }
  const caixa = _portadaCaixa();
  ctx.clearRect(0, 0, cv.width, cv.height);

  /* Emisión a rachas: soldar non é un chorro continuo, son tiradas
     curtas con pausas. Sen as pausas parece unha fervenza. */
  for(const p of P.puntos){
    const fase = (P.t * 0.55 + p.x*7) % 1;
    const soldando = fase < 0.42;
    /* O son vai ao EMPEZAR a racha, non por chispa: soaría un rebumbio.
       O ambiente do hangar xa leva os golpes de metal; isto só engade a
       faísca eléctrica por riba. */
    if(soldando && !p._soaba && typeof sfx === 'function'){
      try{ sfx('solda'); }catch(e){}
    }
    p._soaba = soldando;
    /* Dúas ou tres por fotograma mentres solda. Con menos, nun instante
       calquera case non hai ningunha na pantalla e o efecto non se le. */
    if(soldando) for(let k = 0; k < 3; k++)
      if(Math.random() < p.forza * 0.8) _portadaChispa(p, caixa);
    if(soldando){
      /* fulgor da solda: o que de verdade vende que hai alguén traballando */
      const r = (10 + Math.random()*7) * p.forza;
      const g = ctx.createRadialGradient(
        caixa.x + p.x*caixa.w, caixa.y + p.y*caixa.h, 0,
        caixa.x + p.x*caixa.w, caixa.y + p.y*caixa.h, r*3);
      g.addColorStop(0, 'rgba(255,214,150,0.50)');
      g.addColorStop(0.4, 'rgba(255,150,60,0.16)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(caixa.x + p.x*caixa.w - r*3, caixa.y + p.y*caixa.h - r*3, r*6, r*6);
    }
  }

  for(let i = P.chispas.length - 1; i >= 0; i--){
    const c = P.chispas[i];
    c.idade += dt;
    if(c.idade >= c.vida){ P.chispas.splice(i, 1); continue; }
    c.px = c.x; c.py = c.y;
    c.vy += 420*dt;                 /* gravidade */
    c.vx *= (1 - 1.2*dt);           /* rozamento: as chispas frean axiña */
    c.x += c.vx*dt; c.y += c.vy*dt;
    const k = 1 - c.idade/c.vida;
    /* RISCO e non punto. Un píxel solto pérdese contra un fondo tan
       cargado como este; unha chispa real deixa rastro, e é o rastro o
       que a fai lexible. De branco a laranxa segundo arrefría. */
    ctx.strokeStyle = c.quente
      ? `rgba(255,${200 + 40*k|0},${150*k|0},${k})`
      : `rgba(255,${130 + 90*k|0},${50*k|0},${k*0.9})`;
    ctx.lineWidth = c.quente ? 1.6 : 1;
    /* O risco debúxase máis longo do que se moveu neste fotograma: a
       distancia dun cadro son dous píxeles e non se ve nada. Extrapólase
       cara atrás pola velocidade, que é o que dá a sensación de traza. */
    ctx.beginPath();
    ctx.moveTo(c.x - c.vx*0.045, c.y - c.vy*0.045);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }

  if(P.corre) requestAnimationFrame(efxPortadaPaso);
}

/* Acende ou apaga segundo se estea na portada. Chámase desde o mesmo
   observador de 99-boot.js que xa sabe cando se ve o hangar. */
function efxPortada(activa){
  const P = PORTADA;
  if(activa && !P.corre){
    P.cv = document.getElementById('portadaFx');
    if(!P.cv) return;
    P.ctx = P.cv.getContext('2d');
    if(!P.im){
      P.im = new Image();
      P.im.src = 'ui/fondo_menu.jpg';   /* só para saber o seu tamaño real */
    }
    P.corre = true; P.ultimo = performance.now();
    requestAnimationFrame(efxPortadaPaso);
  } else if(!activa && P.corre){
    P.corre = false; P.chispas.length = 0;
    if(P.ctx) P.ctx.clearRect(0, 0, P.cv.width, P.cv.height);
  }
}
