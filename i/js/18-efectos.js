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
