/* ============================================================
   RETRATOS PROCEDURALES (HITO C, retoque v0.3.2)
   Caras dibujadas en canvas con capas: base (forma por clase) +
   detalles + ojos (expresión) + boca + daños + marca de veterano.
   Sistema de fallback: si existe assets/portraits/<clase>_<expr>.png
   se usa esa imagen; si no, se dibuja procedural.
   Las imágenes se buscan por CLASE (grunt, heavy, engineer), no por
   nombre individual — la misma cara sirve para todos los robots
   de la misma clase, y la expresión cambia con el estado.
   ============================================================ */

/* Cache de assets reales: clase+expression → Image|null */
const PORTRAIT_CACHE = {};
function tryLoadPortrait(cls, expression){
  const key = `${cls.toLowerCase()}_${expression}`;
  if(key in PORTRAIT_CACHE) return PORTRAIT_CACHE[key];
  /* Intentar cargar; si falla, queda como null (procedural) */
  const img = new Image();
  img.onload = ()=>{ PORTRAIT_CACHE[key] = img; };
  img.onerror = ()=>{ PORTRAIT_CACHE[key] = null; };
  img.src = `assets/portraits/${key}.png`;
  PORTRAIT_CACHE[key] = null;  /* mientras carga, procedural */
  return null;
}

/* Determinar expresión según contexto de la unidad */
function expressionFor(u, ctx={}){
  if(u.dead) return 'muerto';
  const hpPct = u.hp / u.max;
  if(ctx.interrupted) {
    /* En interrupción: depende de veteranía y rasgos */
    if(u.traits.includes('SUPERVIVIENTE') && u.ops>=3) return 'determinado';
    if(u.ops>=5) return 'determinado';
    return 'asustado';
  }
  if(hpPct < 0.34){
    if(u.ops>=3 || u.traits.includes('SUPERVIVIENTE')) return 'determinado';
    return 'asustado';
  }
  if(hpPct < 0.7) return 'determinado';
  if(u.ops >= 5) return 'veterano';
  if(u.traits.includes('LETAL') || u.traits.includes('CONQUISTADOR')) return 'orgulloso';
  return 'normal';
}

/* ====== Dibujado procedural por capas ====== */
function drawPortrait(canvas, u, opts={}){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const expr = opts.expression || expressionFor(u, opts);
  const teamColor = u.team===0 ? '#4f8aff' : '#ff5340';
  const hpPct = u.hp/u.max;

  /* Si hay asset real cargado, dibujarlo y salir */
  const realKey = `${u.cls.toLowerCase()}_${expr}`;
  if(PORTRAIT_CACHE[realKey]){
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(PORTRAIT_CACHE[realKey], 0, 0, W, H);
    /* Marco de equipo */
    ctx.strokeStyle = teamColor; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W-2, H-2);
    return;
  } else {
    /* Intentar cargar para futuros frames (solo si no se ha intentado ya) */
    if(!(realKey in PORTRAIT_CACHE)){
      tryLoadPortrait(u.cls, expr);
    }
  }

  /* ============ Dibujado procedural ============ */
  ctx.imageSmoothingEnabled = false;

  /* Fondo */
  ctx.fillStyle = '#1a1612';
  ctx.fillRect(0, 0, W, H);

  /* Escala relativa al tamaño del canvas */
  const cx = W/2;
  const cy = H/2;
  const S = Math.min(W, H);  /* escala */

  /* === Capa 1: forma de cabeza por clase === */
  const headColor = '#8a7a6a';
  const headDark = '#5a4a3a';
  const headLight = '#a89888';

  ctx.fillStyle = headColor;
  if(u.cls==='HEAVY'){
    /* Cabeza ancha y baja, con "hombros" altos */
    ctx.fillRect(cx-S*0.32, cy-S*0.30, S*0.64, S*0.55);
    /* Pinchos arriba */
    ctx.fillRect(cx-S*0.28, cy-S*0.36, S*0.06, S*0.08);
    ctx.fillRect(cx+S*0.22, cy-S*0.36, S*0.06, S*0.08);
    /* Mandíbula reforzada */
    ctx.fillStyle = headDark;
    ctx.fillRect(cx-S*0.30, cy+S*0.14, S*0.60, S*0.10);
  } else if(u.cls==='ENGINEER'){
    /* Cabeza estrecha y alta con "cables/dreadlocks" a los lados */
    ctx.fillRect(cx-S*0.24, cy-S*0.34, S*0.48, S*0.62);
    /* Antenas/cables laterales */
    ctx.fillStyle = headDark;
    ctx.fillRect(cx-S*0.32, cy-S*0.10, S*0.06, S*0.30);
    ctx.fillRect(cx+S*0.26, cy-S*0.10, S*0.06, S*0.30);
    ctx.fillRect(cx-S*0.36, cy+S*0.10, S*0.04, S*0.16);
    ctx.fillRect(cx+S*0.30, cy+S*0.10, S*0.04, S*0.16);
  } else {
    /* GRUNT: cabeza cuadrada estándar */
    ctx.fillRect(cx-S*0.28, cy-S*0.32, S*0.56, S*0.60);
    /* Antena */
    ctx.fillStyle = headDark;
    ctx.fillRect(cx-S*0.02, cy-S*0.42, S*0.04, S*0.10);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(cx-S*0.025, cy-S*0.44, S*0.05, S*0.03);
  }

  /* === Capa 2: detalles de chasis (tornillos, placas) === */
  ctx.fillStyle = headDark;
  /* Tornillos en las esquinas de la cabeza */
  const screws = [
    [cx-S*0.24, cy-S*0.26], [cx+S*0.20, cy-S*0.26],
    [cx-S*0.24, cy+S*0.18], [cx+S*0.20, cy+S*0.18],
  ];
  screws.forEach(([sx,sy])=>{
    ctx.fillRect(sx, sy, S*0.04, S*0.04);
  });
  /* Línea horizontal de placa frontal */
  ctx.fillStyle = headLight;
  ctx.fillRect(cx-S*0.26, cy-S*0.10, S*0.52, S*0.02);

  /* === Capa 3: visor/zona de ojos === */
  /* Recuadro oscuro donde van los ojos */
  ctx.fillStyle = '#0d0d0a';
  ctx.fillRect(cx-S*0.22, cy-S*0.16, S*0.44, S*0.14);

  /* === Capa 4: ojos según expresión === */
  const eyeY = cy - S*0.09;
  const eyeL = cx - S*0.11;
  const eyeR = cx + S*0.11;
  const eyeBase = S*0.07;  /* tamaño base */

  /* Color de "vida" en los ojos */
  let eyeGlow = '#ffd24a';
  if(hpPct < 0.34) eyeGlow = '#ff5340';
  else if(hpPct < 0.7) eyeGlow = '#ffaa30';

  /* (v0.49) PARPADEO: cada robot pecha os ollos ~120ms cada 3-5s, con fase
     propia derivada do nome — o panel repíntase 10x/s, dabondo para velo. */
  let _blink = false;
  if(!opts.interrupted && expr !== 'dead'){
    let _h = 0; const _nm = u.name || u.id || 'X';
    for(let i = 0; i < _nm.length; i++) _h = (_h * 31 + _nm.charCodeAt(i)) | 0;
    const _per = 3000 + (Math.abs(_h) % 2200);
    _blink = ((Date.now() + Math.abs(_h)) % _per) < 120;
  }
  function drawEye(x, y, shape){
    /* shape:
       'normal'      -> círculo grande
       'narrow'      -> achatado horizontal (determinado)
       'wide'        -> grande y abierto (asustado/sorprendido)
       'angry'       -> diagonal hacia abajo-adentro (orgulloso/enfadado)
       'half'        -> párpado caído mitad (veterano)
       'cross'       -> X (muerto)
       'cracked'     -> medio cuarteado (herido grave)
    */
    ctx.fillStyle = '#000';
    /* base oscura del ojo */
    ctx.fillRect(x-eyeBase*0.7, y-eyeBase*0.5, eyeBase*1.4, eyeBase);
    if(_blink && shape !== 'cross'){
      /* pálpebra pechada: liña fina do ton do ollo */
      ctx.fillStyle = eyeGlow;
      ctx.fillRect(x-eyeBase*0.55, y-eyeBase*0.06, eyeBase*1.1, eyeBase*0.14);
      return;
    }

    if(shape === 'cross'){
      ctx.strokeStyle = '#7a4a44'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x-eyeBase*0.6, y-eyeBase*0.4);
      ctx.lineTo(x+eyeBase*0.6, y+eyeBase*0.4);
      ctx.moveTo(x+eyeBase*0.6, y-eyeBase*0.4);
      ctx.lineTo(x-eyeBase*0.6, y+eyeBase*0.4);
      ctx.stroke();
      return;
    }

    ctx.fillStyle = eyeGlow;
    if(shape === 'narrow'){
      /* Ojo determinado: línea horizontal con punto */
      ctx.fillRect(x-eyeBase*0.55, y-eyeBase*0.1, eyeBase*1.1, eyeBase*0.3);
      ctx.fillStyle = '#000';
      ctx.fillRect(x-eyeBase*0.1, y-eyeBase*0.05, eyeBase*0.2, eyeBase*0.2);
    } else if(shape === 'wide'){
      /* Ojo abierto */
      ctx.fillRect(x-eyeBase*0.5, y-eyeBase*0.4, eyeBase, eyeBase*0.8);
      ctx.fillStyle = '#000';
      ctx.fillRect(x-eyeBase*0.18, y-eyeBase*0.18, eyeBase*0.36, eyeBase*0.36);
    } else if(shape === 'angry'){
      /* Inclinado hacia abajo-dentro */
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(x < cx ? 0.2 : -0.2);
      ctx.fillRect(-eyeBase*0.5, -eyeBase*0.15, eyeBase, eyeBase*0.4);
      ctx.fillStyle = '#000';
      ctx.fillRect(-eyeBase*0.1, -eyeBase*0.08, eyeBase*0.2, eyeBase*0.18);
      ctx.restore();
    } else if(shape === 'half'){
      /* Párpado caído: mitad inferior visible */
      ctx.fillRect(x-eyeBase*0.45, y, eyeBase*0.9, eyeBase*0.4);
      ctx.fillStyle = '#000';
      ctx.fillRect(x-eyeBase*0.1, y+eyeBase*0.05, eyeBase*0.2, eyeBase*0.2);
    } else if(shape === 'cracked'){
      /* Ojo herido: cuarteado con líneas */
      ctx.fillRect(x-eyeBase*0.45, y-eyeBase*0.25, eyeBase*0.9, eyeBase*0.5);
      ctx.strokeStyle = '#5a3028';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x-eyeBase*0.4, y); ctx.lineTo(x+eyeBase*0.4, y-eyeBase*0.1);
      ctx.moveTo(x-eyeBase*0.2, y-eyeBase*0.2); ctx.lineTo(x+eyeBase*0.2, y+eyeBase*0.2);
      ctx.stroke();
    } else {
      /* normal */
      ctx.beginPath();
      ctx.arc(x, y, eyeBase*0.45, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, eyeBase*0.18, 0, Math.PI*2);
      ctx.fill();
    }
  }

  /* Mapeo de expresión → forma de ojos */
  const eyeShapes = {
    normal:      ['normal','normal'],
    determinado: ['narrow','narrow'],
    asustado:    ['wide','wide'],
    orgulloso:   ['angry','angry'],
    veterano:    ['half','narrow'],     /* asimétrico: ojo cansado + ojo despierto */
    herido:      ['cracked','wide'],
    muerto:      ['cross','cross'],
  };
  const [shL, shR] = eyeShapes[expr] || eyeShapes.normal;
  drawEye(eyeL, eyeY, shL);
  drawEye(eyeR, eyeY, shR);

  /* === Capa 5: boca/altavoz === */
  const mouthY = cy + S*0.12;
  ctx.fillStyle = '#0d0d0a';
  ctx.fillRect(cx-S*0.14, mouthY-S*0.03, S*0.28, S*0.08);
  /* Rejilla de altavoz */
  ctx.fillStyle = headDark;
  for(let i=0; i<5; i++){
    ctx.fillRect(cx-S*0.12 + i*S*0.06, mouthY-S*0.02, S*0.025, S*0.06);
  }

  /* === Capa 6: daños superpuestos === */
  if(hpPct < 0.7 && !u.dead){
    /* Arañazo diagonal en la mejilla derecha */
    ctx.strokeStyle = '#3a1a14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx+S*0.10, cy-S*0.02);
    ctx.lineTo(cx+S*0.22, cy+S*0.10);
    ctx.stroke();
  }
  if(hpPct < 0.34 && !u.dead){
    /* Placa rota en el otro lado */
    ctx.fillStyle = '#3a1a14';
    ctx.fillRect(cx-S*0.22, cy+S*0.02, S*0.08, S*0.04);
    /* Chispa de cortocircuito ocasional (no animada, marca fija) */
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(cx-S*0.20, cy+S*0.00, S*0.02, S*0.02);
  }

  /* === Capa 7: marca de veterano === */
  if(u.ops >= 5 && !u.dead){
    /* Estrella dorada en esquina superior derecha */
    ctx.fillStyle = '#ffd24a';
    const sx = W - S*0.14, sy = S*0.08;
    ctx.beginPath();
    for(let i=0; i<5; i++){
      const a = -Math.PI/2 + i*Math.PI*2/5;
      const r = S*0.05;
      if(i===0) ctx.moveTo(sx + Math.cos(a)*r, sy + Math.sin(a)*r);
      else      ctx.lineTo(sx + Math.cos(a)*r, sy + Math.sin(a)*r);
      const a2 = a + Math.PI/5;
      const r2 = S*0.02;
      ctx.lineTo(sx + Math.cos(a2)*r2, sy + Math.sin(a2)*r2);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* === Capa 8: marco de tinte de equipo === */
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W-2, H-2);

  /* === Capa 9 (solo interrupción): scanlines de interferencia === */
  if(opts.interrupted){
    ctx.fillStyle = 'rgba(255,80,60,0.10)';
    for(let y=0; y<H; y+=3){
      ctx.fillRect(0, y, W, 1);
    }
  }
}

/* Helper: insertar un canvas de retrato en HTML y luego dibujarlo */
function portraitHTML(id, w, h){
  return `<div class="portrait-frame"><canvas id="${id}" width="${w}" height="${h}"></canvas></div>`;
}
/* ============================================================
   IDENTIDADE VISUAL (v0.23.2) — cicatrices deterministas.
   O mesmo veterano SEMPRE coas mesmas marcas (semente = id +
   reconstrucións). Tras vinte partidas, cada cara é única.
   ============================================================ */
function seedFrom(str){
  let h = 0;
  for(let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function seededRand(seed){
  let s = seed || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function drawCicatrices(canvas, u){
  const rec = (typeof DATA !== 'undefined' && DATA.units && DATA.units.find(r => r.id === u.id)) || u;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const s = W / 96;
  const rnd = seededRand(seedFrom((u.id || '?') + ':' + (rec.recoveries || 0)));

  /* Riscaduras de veteranía: 1 por cada 2 ops (cap 8) */
  const nR = Math.min(8, Math.floor((rec.ops || 0) / 2));
  ctx.strokeStyle = 'rgba(15,12,10,0.6)';
  ctx.lineWidth = Math.max(1, s);
  for(let i = 0; i < nR; i++){
    const x = (16 + rnd() * 62) * s, y = (20 + rnd() * 56) * s;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() * 10 - 5) * s, y + (4 + rnd() * 9) * s);
    ctx.stroke();
  }
  /* Soldaduras laranxa: unha por doador (reensamblado) */
  if(rec.piezasDe && rec.piezasDe.length){
    ctx.strokeStyle = '#ff9a3c';
    ctx.lineWidth = Math.max(1, s);
    for(let i = 0; i < Math.min(3, rec.piezasDe.length); i++){
      const x = (14 + rnd() * 28) * s, y = (28 + rnd() * 44) * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      for(let k = 1; k <= 5; k++) ctx.lineTo(x + k * 7 * s, y + (k % 2 ? -2.5 : 2.5) * s);
      ctx.stroke();
    }
  }
  /* Antena torta: sobreviviu a explosións */
  if((rec.criticalSurvivals || 0) > 0){
    ctx.strokeStyle = '#98a0a8';
    ctx.lineWidth = Math.max(1, s);
    ctx.beginPath(); ctx.moveTo(70 * s, 14 * s); ctx.lineTo(77 * s, 6 * s); ctx.lineTo(84 * s, 9 * s);
    ctx.stroke();
    ctx.fillStyle = '#ff5340';
    ctx.fillRect(83 * s, 7 * s, 2 * s, 2 * s);
  }
  /* Placa de recambio: recuperado dos restos */
  if((rec.recoveries || 0) > 0){
    ctx.fillStyle = 'rgba(150,155,165,0.45)';
    ctx.fillRect(18 * s, 62 * s, 15 * s, 13 * s);
    ctx.strokeStyle = 'rgba(90,95,105,0.8)';
    ctx.strokeRect(18 * s, 62 * s, 15 * s, 13 * s);
    /* remaches novos */
    ctx.fillStyle = '#666';
    ctx.fillRect(20 * s, 64 * s, s, s); ctx.fillRect(30 * s, 64 * s, s, s);
    ctx.fillRect(20 * s, 72 * s, s, s); ctx.fillRect(30 * s, 72 * s, s, s);
  }
  /* Medallas: estrelas douradas na hombreira (abaixo-dereita) */
  const nM = Math.min(4, ((rec.medals || []).length));
  ctx.fillStyle = '#ffd700';
  for(let i = 0; i < nM; i++){
    const x = (86 - i * 10) * s, y = 87 * s;
    ctx.fillRect(x - s, y - 3 * s, 2 * s, 6 * s);
    ctx.fillRect(x - 3 * s, y - s, 6 * s, 2 * s);
  }
}

function paintPortrait(id, unit, opts){
  const c = document.getElementById(id);
  if(!c) return;
  drawPortrait(c, unit, opts);
  drawCicatrices(c, unit);
  /* (v0.49) ESTÁTICA: cando a confianza cae a AUTOPRESERVACIÓN, o sinal
     do retrato degrádase — ruído de píxeles + banda horizontal errante. */
  try{
    if(typeof estadoConfianza === 'function' && !unit.dead && estadoConfianza(unit) === 'AUTOPRESERVACION'){
      const ctx = c.getContext('2d');
      ctx.save();
      ctx.globalAlpha = 0.35;
      for(let i = 0; i < 46; i++){
        ctx.fillStyle = Math.random() < 0.6 ? '#000' : '#9ab89a';
        ctx.fillRect((Math.random() * c.width) | 0, (Math.random() * c.height) | 0, 2, 1);
      }
      const by = ((Date.now() * 0.06) % (c.height + 12)) - 6;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#cfe0cf';
      ctx.fillRect(0, by, c.width, 3);
      ctx.restore();
    }
  }catch(e){}
}

/* ============================================================
   PANEL LATERAL DE PERSONAJE (B.1 + C)
   Renderiza la ficha con retrato. En modo normal el retrato es
   pequeño junto a las stats; en interrupción ocupa casi todo
   el panel (estilo Z puro).
   ============================================================ */
function lastEventOf(unit){
  if(!unit.eventBuffer || unit.eventBuffer.length===0){
    /* Buscar en histórico persistido */
    const rec = DATA.units.find(r=>r.id===unit.id);
    if(rec && rec.events && rec.events.length) return rec.events[rec.events.length-1];
    return null;
  }
  return unit.eventBuffer[unit.eventBuffer.length-1];
}

function unitPanelHTML(u, ctx={}){
  const hpPct = Math.max(0, u.hp/u.max);
  const hpColor = hpPct>0.5?'var(--green)':(hpPct>0.25?'var(--gold)':'var(--red)');
  const place = placeAt(u.x, u.y);
  const opsTotal = u.persisted ? (DATA.units.find(r=>r.id===u.id)?.ops||u.ops) + 1 : 1;
  const totalKills = (u.pastKills||0) + u.kills;
  const lastEv = lastEventOf(u);
  const traits = [...new Set(u.traits)];
  const persistedRec = DATA.units.find(r=>r.id===u.id);
  const medals = persistedRec ? (persistedRec.medals||[]) : [];

  /* ============ MODO INTERRUPCIÓN: estilo Z puro ============ */
  if(ctx.interrupted){
    const interruptLine = ctx.interruptLine || `'${u.name}': ...`;
    return `
      <div class="interrupt-banner">${TXT('ui.emerxencia')}</div>
      <div class="interrupt-portrait">
        ${portraitHTML('portraitBig', 240, 280)}
        <div class="speaker">${u.id} '${u.name}'</div>
        <div class="line">${interruptLine}</div>
      </div>
    `;
  }

  /* ============ MODO NORMAL: retrato + stats ============ */
  let html = `
    <div class="portrait-row">
      ${portraitHTML('portraitSmall', 100, 120)}
      <div class="meta">
        <div class="ph-name">${u.id} '${u.name}'</div>
        <div class="ph-sub">${clsLabel(u.cls)}${u.personalidad ? ' · ' + u.personalidad : ''} · Op ${opsTotal} · ${totalKills} ${TXT('ui.bajas')}</div>
        <div style="margin-top:4px;">
          <div class="ph-bar"><div style="width:${(hpPct*100).toFixed(0)}%; background:${hpColor};"></div></div>
          <span style="font-size:10px; color:${hpColor};">${(hpPct*100).toFixed(0)}% ${TXT('ui.integridade')}</span>
        </div>
      </div>
    </div>
  `;
  if(traits.length){
    html += `<div class="ph-section"><b>${TXT('ui.rasgos')}</b>${traits.map(t=>`<span class="tag">${tagLabel(t)}</span>`).join(' ')}</div>`;
  }
  if(medals.length){
    html += `<div class="ph-section"><b>${TXT('ui.medallas')}</b>`+
      medals.map(mid=>{
        const m = MEDAL_DEFS.find(x=>x.id===mid);
        const sub = (m && m.subtitle && persistedRec) ? m.subtitle(persistedRec) : null;
        return `<span class="medal">✪ ${medalLabel(mid)}${sub?` <span class="small">(${sub})</span>`:''}</span>`;
      }).join(' ')+`</div>`;
  }
  /* (v0.57) FICHA COMPLETA ao seleccionar (pedido de Agarfal): confianza,
     atributos e a súa VOZ no panel */
  if(typeof estadoConfianza === 'function' && typeof u.confianza === 'number'){
    const est = estadoConfianza(u);
    const ecol = est === 'LEAL' ? '#7fdc7f' : est === 'SARCASTICO' ? '#cfe0ff'
               : est === 'DESCONFIADO' ? '#ffd24a' : '#ff5340';
    html += `<div class="ph-section"><b>${TXT('ui.confianza')}</b>
      <div class="ph-bar"><div style="width:${Math.max(0,Math.min(100,u.confianza)).toFixed(0)}%; background:${ecol};"></div></div>
      <span style="font-size:10px; color:${ecol};">${est} · ${Math.round(u.confianza)}/100</span></div>`;
  }
  if(typeof skillTagsHTML === 'function' && persistedRec){
    const st = skillTagsHTML(persistedRec);
    if(st) html += `<div class="ph-section"><b>${TXT('ui.atributos')}</b>${st}</div>`;
  }
  /* (v0.58.1) VÍNCULO de camaradas: con quen e en que estado */
  const _vs = (u.vinculos && u.vinculos.length ? u.vinculos : (persistedRec && persistedRec.vinculos) || []);
  if(_vs.length){
    const vid = _vs[0].con;
    const vRec = DATA.units.find(r => r.id === vid);
    const vUnit = (typeof game !== 'undefined' && game && game.units) ? game.units.find(o => o.id === vid) : null;
    const vName = (vUnit && vUnit.name) || (vRec && vRec.name) || vid;
    let vTxt, vCol;
    if(vUnit && !vUnit.dead){
      vTxt = u._vinculoActivo ? TXT('ui.vincXuntos') : TXT('ui.vincCampo');
      vCol = u._vinculoActivo ? '#ffd700' : '#7fdc7f';
    } else if(vRec){ vTxt = TXT('ui.vincHangar'); vCol = '#9aa0a8'; }
    else { vTxt = TXT('ui.vincCaido'); vCol = '#ff5340'; }
    html += `<div class="ph-section"><b>${TXT('ui.vinculo')}</b><span style="font-size:10px; color:${vCol};">⭐ ${vName} · ${vTxt}</span></div>`;
  }
  /* (v0.58.1) ORIXE: os reensamblados levan pezas doutros — o lore do salvage */
  if(persistedRec && persistedRec.piezasClases){
    const alleas = [...new Set(persistedRec.piezasClases.filter(c => c !== u.cls))];
    if(alleas.length){
      html += `<div class="ph-section"><b>${TXT('ui.orixe')}</b><span style="font-size:10px; color:#c8a86a;">☍ ${alleas.map(c => clsLabel(c)).join(', ')}</span></div>`;
    }
  }
  /* (v0.58) CONTRIBUCIÓN nesta operación: o que está a facer AGORA */
  if(u.act){
    const a = u.act;
    const bits = [];
    if(u.kills > 0) bits.push(`☠ ${u.kills} ${TXT('ui.bajas')}`);
    if(a.shots > 0) bits.push(`▸ ${a.shots} ${TXT('ui.disparos')}`);
    if(a.dist > 40) bits.push(`↦ ${Math.round(a.dist/10)}m`);
    if(a.dmgTaken > 0) bits.push(`⛨ ${Math.round(a.dmgTaken)} ${TXT('ui.encaixado')}`);
    if(a.caps > 0) bits.push(`⚑ ${a.caps}`);
    if(a.veh > 60) bits.push(`⛟ ${Math.round(a.veh/60)}s`);
    if(bits.length){
      html += `<div class="ph-section"><b>${TXT('ui.contribucion')}</b><span style="font-size:10px; color:#9fd0ff;">${bits.join(' · ')}</span></div>`;
    }
  }
  /* (v0.58) PROGRESO cara á seguinte skill: carreira + esta op, co limiar seguinte */
  if(typeof SKILLS !== 'undefined' && typeof skillLevel === 'function'){
    /* (v0.58) tamén para unidades novas sen ficha persistida: van cara á primeira skill */
    const actv = (persistedRec && persistedRec.activity) || {};
    let prog = '';
    for(const id of Object.keys(SKILLS)){
      const sk = SKILLS[id];
      const total = (actv[sk.track] || 0) + ((u.act && u.act[sk.track]) || 0) + (sk.track === 'kills' ? (u.kills||0) : 0);
      const lv = skillLevel(actv, id);
      if(lv >= sk.th.length) continue;         /* xa ao máximo */
      const next = sk.th[lv];
      if(total < next * 0.25) continue;        /* só as que van encamiñadas */
      const pct = Math.min(100, total / next * 100);
      prog += `<div style="margin:2px 0;"><span style="font-size:10px; color:#9fd0ff;">◆ ${skillLabel(id)} ${'I'.repeat(lv+1).replace(/I{3}/,'III')}</span>
        <div class="ph-bar" style="height:3px;"><div style="width:${pct.toFixed(0)}%; background:#5a80a8;"></div></div></div>`;
    }
    if(prog) html += `<div class="ph-section"><b>${TXT('ui.progreso')}</b>${prog}</div>`;
  }
  html += `<div class="ph-section"><b>${TXT('ui.posicion')}</b><span class="ph-place">${placeLabel(place)}</span></div>`;
  if(lastEv){
    html += `<div class="ph-section"><b>${TXT('ui.ultimoEvento')}</b><div class="ph-event">${formatEvent(lastEv)}</div></div>`;
  }
  /* (v0.58.1) HISTORIAL curto: dous ecos do pasado (a bio completa segue no hangar) */
  if(persistedRec && persistedRec.events && persistedRec.events.length > 1){
    const prev = persistedRec.events.slice(-3, -1);
    if(prev.length){
      html += `<div class="ph-section"><b>${TXT('ui.historial')}</b>` +
        prev.map(e => `<div class="ph-event" style="opacity:0.7;">Op ${e.op}: ${formatEvent(e)}</div>`).join('') + `</div>`;
    }
  }
  /* (v0.57) a VOZ da unidade: a última frase dita, no panel (non só na radio).
     Store externo por id — no convidado os obxectos recréanse a cada snap. */
  const _fl = (window._falaU && window._falaU[u.id]) || u._lastFrase;
  if(_fl && Date.now() - _fl.time < 12000){
    html += `<div class="ph-section" style="border-left:2px solid ${_fl.color||'#7fdc7f'}; padding-left:6px;">
      <span style="color:${_fl.color||'#7fdc7f'}; font-style:italic;">«${_fl.text}»</span></div>`;
  }
  return html;
}

function squadPanelHTML(g, sel){
  let html = `<div class="ph-name">${TXT('ui.escuadron')}</div>`;
  if(sel.length > 1){
    const totalHp = sel.reduce((a,u)=>a+u.hp/u.max,0);
    const avgHp = (totalHp/sel.length*100).toFixed(0);
    const vets = sel.filter(u=>u.persisted).length;
    html += `<div class="ph-sub">${TXT('ui.unidadesVets', {n: sel.length, v: vets})}</div>`;
    html += `<div class="ph-section"><b>${TXT('ui.integridadeMedia')}</b><span>${avgHp}%</span></div>`;
    html += `<div class="ph-section"><b>${TXT('ui.unidades')}</b><div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">`;
    sel.forEach((u, i) => {
      const pct = (u.hp/u.max*100).toFixed(0);
      /* (v0.59) clicable: ir ao membro e seleccionalo só (idea de Agarfal) */
      html += `<div data-uid="${u.id}" style="text-align:center; cursor:pointer;" title="${TXT('ui.irAUnidade')}">
        ${portraitHTML(`squadPortrait${i}`, 56, 64)}
        <div style="font-size:9px; color:var(--phos); margin-top:2px;">${u.id}·${u.name}</div>
        <div style="font-size:9px; color:var(--phos-dim);">${pct}%</div>
      </div>`;
    });
    html += `</div></div>`;
  } else {
    const alive = g.units.filter(u=>u.team===PT && !u.dead);
    const sectorsOwn = g.sectors.filter(s=>s.owner===PT).length;
    html += `<div class="ph-sub">${TXT('ui.vivasOp', {n: alive.length, op: DATA.opCount+1})}</div>`;
    html += `<div class="ph-section"><b>${TXT('ui.sectores')}</b>${sectorsOwn} / ${g.sectors.length}</div>`;
    html += `<div class="ph-section"><b>${TXT('ui.bajasHdr')}</b>${TXT('ui.bajasDet', {e: g.kills[PT], p: g.units.filter(u=>u.team===PT && u.dead).length})}</div>`;
    if(g.remains.filter(r=>!r.expired).length){
      const open = g.remains.filter(r=>!r.expired && !r.secured).length;
      const sec = g.remains.filter(r=>!r.expired && r.secured).length;
      html += `<div class="ph-section"><b>${TXT('ui.restos')}</b>${TXT('ui.restosDet', {o: open, s: sec})}</div>`;
    }
  }
  return html;
}

function updateSidePanel(g){
  /* Si no hay batalla, salir */
  if(!g){ return; }
  /* (v0.59) FIX RAÍZ do "escuadrón fantasma": lastPanelRender/panelInterrupt
     son estado de MÓDULO e sobrevivían entre batallas. A batalla nova empeza
     con g.t=0 e o throttle (g.t - lastPanelRender < 6) daba negativo → o panel
     quedaba CONXELADO mostrando o escuadrón da operación ANTERIOR durante
     minutos, e parecía que a selección non funcionaba. (Intuición de Agarfal:
     "algo que sobrevive entre misións e non debería".) */
  if(updateSidePanel._g !== g){
    updateSidePanel._g = g;
    lastPanelRender = -Infinity;
    panelInterrupt = null;
    lastClickUnit = null;
  }
  /* Throttle: actualizar cada 6 frames (10 veces/s) */
  if(g.t - lastPanelRender < 6 && !panelInterrupt) return;
  lastPanelRender = g.t;

  const panel = $('sidePanel');
  /* Interrupción activa: mostrar unidad en peligro con retrato grande */
  if(panelInterrupt){
    if(g.t >= panelInterrupt.until || panelInterrupt.unit.dead){
      panelInterrupt = null;
      panel.classList.remove('interrupted');
    } else {
      panel.classList.add('interrupted');
      panel._lastHTML = null; panel.innerHTML = unitPanelHTML(panelInterrupt.unit, {
        interrupted: true,
        interruptLine: panelInterrupt.line || '...',
      });
      paintPortrait('portraitBig', panelInterrupt.unit, {interrupted: true});
      return;
    }
  }
  panel.classList.remove('interrupted');
  /* Torreta seleccionada: mostrar piloto + botón baixar + HP torreta */
  const tSel = g.turrets.find(t=>t.sel && t.team===PT && t.occupant);
  if(tSel){
    const hpPct = Math.round(100*tSel.hp/tSel.max);
    const extra = `
      <div style="margin-top:10px; padding:8px; border-top:1px solid #444; background:#1a1a1a;">
        <div style="font-size:10px; color:#7fb0e8; margin-bottom:4px;">${TXT('ui.enTorreta', {id: tSel.id})}</div>
        <div style="font-size:11px; color:#aaa; margin-bottom:4px;">${TXT('ui.estrutura')}: <b style="color:${hpPct>50?'#7fdc7f':(hpPct>25?'#ffd24a':'#ff5340')};">${tSel.hp}/${tSel.max} (${hpPct}%)</b></div>
        <button onclick="ejectFromTurret()" style="
          width:100%; padding:8px; margin-top:4px;
          background:#27406e; color:#cfe0ff; border:1px solid #4f8aff;
          font-family:'Courier New',monospace; font-size:11px;
          cursor:pointer; letter-spacing:1px;">
          ${TXT('ui.baixarTorreta')}
        </button>
      </div>`;
    panel._lastHTML = null; panel.innerHTML = unitPanelHTML(tSel.occupant) + extra;
    paintPortrait('portraitSmall', tSel.occupant);
    return;
  }
  /* (v0.10) Jeep amigo seleccionado: igual con botón BAIXAR DO JEEP */
  const vSel = g.vehicles ? g.vehicles.find(v=>v.sel && v.team===PT && v.occupant) : null;
  if(vSel){
    const hpPct = Math.round(100*vSel.hp/vSel.max);
    const moving = Math.hypot(vSel.tx - vSel.x, vSel.ty - vSel.y) > 4;
    const extra = `
      <div style="margin-top:10px; padding:8px; border-top:1px solid #444; background:#1a1a1a;">
        <div style="font-size:10px; color:#7fb0e8; margin-bottom:4px;">${TXT('ui.noJeep', {id: vSel.id, m: moving?TXT('ui.enMarcha'):TXT('ui.parado')})}</div>
        <div style="font-size:11px; color:#aaa; margin-bottom:4px;">${TXT('ui.estrutura')}: <b style="color:${hpPct>50?'#7fdc7f':(hpPct>25?'#ffd24a':'#ff5340')};">${vSel.hp}/${vSel.max} (${hpPct}%)</b></div>
        <div style="font-size:10px; color:#888; margin-bottom:6px;">${TXT('ui.clicConducir')}</div>
        <button onclick="ejectFromTurret()" style="
          width:100%; padding:8px; margin-top:4px;
          background:#27406e; color:#cfe0ff; border:1px solid #4f8aff;
          font-family:'Courier New',monospace; font-size:11px;
          cursor:pointer; letter-spacing:1px;">
          ${TXT('ui.baixarJeep')}
        </button>
      </div>`;
    panel._lastHTML = null; panel.innerHTML = unitPanelHTML(vSel.occupant) + extra;
    paintPortrait('portraitSmall', vSel.occupant);
    return;
  }
  /* (v0.59.1) só substituír o DOM se o HTML cambiou: os canvases dos retratos
     persisten (o parpadeo segue vía paintPortrait) e os clics xa non compiten
     co repintado */
  const _setPanel = (h) => { if(panel._lastHTML !== h){ panel._lastHTML = h; panel._lastHTML = null; panel.innerHTML = h; } };
  const sel = g.units.filter(u=>u.sel && !u.dead && u.team===PT && !u.inside);
  if(sel.length === 1){
    /* (v0.57.1) blindado: se a ficha peta no navegador real, o erro sae no
       overlay en vez de deixar contido vello no panel en silencio */
    try{
      _setPanel(unitPanelHTML(sel[0]));
      paintPortrait('portraitSmall', sel[0]);
    }catch(err){
      if(typeof _tuercaOverlay === 'function') _tuercaOverlay('panel único: ' + (err && (err.stack || err.message) || err));
    }
  } else {
    _setPanel(squadPanelHTML(g, sel));
    /* Si hay varias seleccionadas, pintar mini-retratos del escuadrón */
    sel.forEach((u, i) => {
      paintPortrait(`squadPortrait${i}`, u);
    });
  }
}

/* ---------- Bucle ---------- */
/* (v0.48) TIMESTEP FIXO — a simulación avanza a 60Hz EXACTOS, independente
   dos Hz do monitor. Antes: g.t++ por frame de requestAnimationFrame, así
   que un monitor a 144Hz simulaba 2.4x máis rápido (unidades máis veloces,
   producían antes, disparaban máis a miúdo, néboa distinta) e rompía o PvP.
   Patrón acumulador (Gaffer "Fix Your Timestep"): depositamos o tempo real
   transcorrido e executamos pasos de dt fixo mentres sobre tempo, cun tope
   para non entrar en espiral da morte tras un pico de lag. */
const SIM_HZ = 60;
const SIM_DT = 1000 / SIM_HZ;      /* 16.667 ms — o ritmo para o que se deseñou o xogo */
const SIM_MAX_STEPS = 5;           /* nunca máis de 5 pasos/frame (clamp anti-espiral) */
let _simAccum = 0, _simLastT = 0, _simGame = null;

/* Un paso de SIMULACIÓN (o que antes facía o corpo do loop antes de debuxar) */
function simStep(g){
  g.t++;
  const _pvpGuest = g.modo === 'pvp' && window._pvp && window._pvp.rol === 'guest';
  if(_pvpGuest){
    try{
      pvpAplicarSnap(g);   /* (v0.31) o convidado NON simula: renderiza o estado do host */
      pvpInterpolar(g);    /* (v0.32) suavizado visual entre snaps */
      pvpFlushOrdes();
      /* (v0.51.1) WATCHDOG: host conxelado SEN desconectar (lapela suspendida,
         cuelgue) non dispara o onDisconnect de Firebase — o convidado quedaba
         pillado para sempre. 8s sen snap = aviso; 18s = fin por abandono. */
      if(!g.over){
        if(!window._pvpLastSnapMs) window._pvpLastSnapMs = Date.now();
        const _sen = Date.now() - window._pvpLastSnapMs;
        if(_sen > 8000 && !window._pvpSnapWarn){
          window._pvpSnapWarn = true;
          radio(TXT('pvp.senSinal'), '#ff5340');
        }
        if(_sen > 18000) pvpAbandono();
      }
    }catch(e){ console.error('[pvp guest]', e); }   /* (v0.34.1) nada mata o loop */
  } else if(!g.over){
    tickProd(g); tickAI(g); tickUnits(g); tickTurrets(g); tickVehicles(g); tickSectors(g); tickRadar(g); tickBaseAlarm(g); tickEnd(g);
    if(g.modo === 'pvp' && window._pvp && window._pvp.rol === 'host'){
      try{ pvpHostFrame(g); }catch(e){ console.error('[pvp host]', e); }
    }
  }
  computeVision(g);   /* (v0.20) fontes de visión deste paso (a IA/combate leen esta néboa) */
}

function loop(now){
  if(!game){ _simGame = null; return; }   /* (comportamento previo: o loop para sen game) */
  const g=game;
  now = now || (typeof performance!=='undefined' ? performance.now() : Date.now());
  /* Reinicio limpo ao cambiar de batalla: sen delta xigante no primeiro frame,
     e cun paso garantido antes do primeiro render (néboa lista). */
  if(g !== _simGame){ _simGame = g; _simLastT = now; _simAccum = SIM_DT; }
  let frameTime = now - _simLastT;
  _simLastT = now;
  if(frameTime > 250) frameTime = 250;     /* clamp: un pico de lag non "acelera" o xogo */
  _simAccum += frameTime;
  let steps = 0;
  while(_simAccum >= SIM_DT && steps < SIM_MAX_STEPS){
    simStep(g);
    _simAccum -= SIM_DT;
    steps++;
  }
  if(steps >= SIM_MAX_STEPS) _simAccum = 0;   /* tras carga pesada, tira o atraso acumulado */

  /* ---- RENDER (unha vez por frame, á taxa do monitor) ---- */
  updateCamera();
  /* (v0.25) JUICE: screen shake con decaemento */
  if(g.shake > 0.3){ g.shake *= 0.86; } else g.shake = 0;
  const _shx = g.shake ? (Math.random()*2-1)*g.shake : 0;
  const _shy = g.shake ? (Math.random()*2-1)*g.shake : 0;
  ctx.save();
  ctx.scale(camZoom, camZoom);   /* (v0.50.2) zoom lixeiro */
  ctx.translate(-Math.round(cam.x + _shx), -Math.round(cam.y + _shy));
  draw(g);
  ctx.restore();
  /* (v0.66) LUZ E ATMOSFERA: vai aquí, coa escena xa debuxada e a cámara
     xa restaurada (a capa é de pantalla), pero ANTES do HUD para que
     minimapa, reloxo e avisos non se apaguen. Nada disto pode matar o
     loop: se peta a luz, xógase sen ela. */
  try{
    if(typeof luzComporFrame === 'function') luzComporFrame(g, frameTime / 1000);
  }catch(e){ console.error('[luz]', e); }
  /* (v0.26) tinta do clima (baixo o minimapa, que segue lexible) */
  if(g.clima && g.clima.tint){
    ctx.save();
    ctx.fillStyle = g.clima.tint;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();
  }
  /* (v0.39) PvP: os comandantes teñen nome — nas esquinas do mapa */
  if(g.modo === 'pvp' && window._pvpNomes){
    ctx.save();
    ctx.font = 'bold 11px Courier New';
    ctx.fillStyle = '#6ea8ff';
    ctx.fillText('■ ' + window._pvpNomes.azul, 10, 16);
    const _tv = '■ ' + window._pvpNomes.vermello;
    ctx.fillStyle = '#ff7a5a';
    ctx.fillText(_tv, cv.width - ctx.measureText(_tv).width - 10, 16);
    ctx.restore();
  }
  drawMinimap(g);
  /* (v0.60) MARCADOR do Mundial: PAI g - r RIV · minuto' */
  if(g.modo === 'mundial' && window._mundial && typeof MDATA !== 'undefined' && MDATA){
    const M = window._mundial;
    const min = Math.min(90, (M.matchT / MUN_MIN_TICKS) | 0);
    const meuId = MDATA.pais, rivId = M.rival.id;
    const txt = `${meuId} ${M.goles[PT]} - ${M.goles[1-PT]} ${rivId} · ${min}'`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const tw = txt.length * 7 + 16;
    ctx.fillRect((cv.width - tw) / 2, 6, tw, 18);
    ctx.fillStyle = '#7fd0ff';
    ctx.font = 'bold 12px Courier New';
    ctx.fillText(txt, (cv.width - tw) / 2 + 8, 19);
    /* barra de progreso do gol do que domina */
    const lid = M.golProg[0] > 0 ? 0 : M.golProg[1] > 0 ? 1 : -1;
    if(lid >= 0){
      const pw = Math.round((M.golProg[lid] / MUN_GOL_TICKS) * (tw - 16));
      ctx.fillStyle = lid === PT ? '#7fdc7f' : '#ff5340';
      ctx.fillRect((cv.width - tw) / 2 + 8, 22, pw, 2);
    }
  }
  /* (v0.55) reloxo do mundo: a partida vive de 09:00 a ~19:00 */
  {
    const _wh = Math.min(19, 9 + g.t / 9000);
    const _hh = _wh | 0, _mm = ((_wh % 1) * 60) | 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(6, 6, 58, 16);
    ctx.fillStyle = '#ffd24a';
    ctx.font = '11px Courier New';
    ctx.fillText('☀ ' + String(_hh).padStart(2, '0') + ':' + String(_mm).padStart(2, '0'), 11, 18);
  }
  /* (v0.13) Flash de alarma: bordo vermello pulsante 3s tras dano ao HQ azul */
  if(g.hq[PT].lastDamageT && g.t - g.hq[PT].lastDamageT < 60*3){
    const a = 0.30 + 0.22 * Math.sin(g.t * 0.35);
    ctx.strokeStyle = `rgba(255,60,40,${a})`;
    ctx.lineWidth = 7;
    ctx.strokeRect(4, 4, cv.width - 8, cv.height - 8);
    ctx.fillStyle = `rgba(255,60,40,${0.55 + 0.3*Math.sin(g.t*0.35)})`;
    ctx.font = 'bold 13px Courier New';
    ctx.fillText('⚠ BASE BAJO ATAQUE', 14, 24);
  }
  updateSidePanel(g);
  requestAnimationFrame(loop);
}

/* (v0.59) Clic nun retrato do escuadrón: saltar a cámara a esa unidade e
   seleccionala individualmente. Delegación no contedor (o innerHTML múdase
   10 veces/segundo, os tiles non poden levar listener propio). */
(function(){
  const sp = document.getElementById('sidePanel');
  if(!sp) return;
  /* (v0.59.1) pointerdown, NON click: o innerHTML repíntase 10x/s e un 'click'
     só dispara se down e up caen no MESMO nodo — o repintado destruíao entre
     medias e había que premer 4-5 veces. pointerdown dispara ao premer. */
  sp.addEventListener('pointerdown', e => {
    const t = e.target && e.target.closest ? e.target.closest('[data-uid]') : null;
    if(!t || !game) return;
    const u = game.units.find(x => x.id === t.dataset.uid && !x.dead && !x.inside);
    if(!u) return;
    game.units.forEach(x => x.sel = false);
    if(game.turrets) game.turrets.forEach(x => x.sel = false);
    if(game.vehicles) game.vehicles.forEach(x => x.sel = false);
    u.sel = true;
    if(typeof camJumpTo === 'function') camJumpTo(u.x, u.y);
    lastPanelRender = -Infinity;   /* repintar xa */
  });
})();
/* ---------- Input ---------- */
cv.addEventListener('wheel', e => {
  if(!game) return;
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  const sx = (e.clientX - r.left) * (cv.width / r.width);
  const sy = (e.clientY - r.top) * (cv.height / r.height);
  const wx = sx / camZoom + cam.x, wy = sy / camZoom + cam.y;   /* punto do mundo baixo o rato */
  camZoom = Math.max(1, Math.min(1.8, camZoom * (e.deltaY < 0 ? 1.12 : 1/1.12)));
  cam.x = wx - sx / camZoom;   /* que ese punto quede fixo */
  cam.y = wy - sy / camZoom;
  camClamp();
}, {passive: false});
function canvasPos(e){
  const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(cv.width/r.width)/camZoom + cam.x,
          y:(e.clientY-r.top)*(cv.height/r.height)/camZoom + cam.y};
}
function screenPos(e){
  const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height)};
}
cv.addEventListener('mousedown', e=>{
  if(!game||game.over) return;
  /* (v0.13) Clic no minimapa: saltar a cámara alí */
  if(_mmRect && e.button === 0){
    const s = screenPos(e);
    if(s.x >= _mmRect.x && s.x <= _mmRect.x + _mmRect.w &&
       s.y >= _mmRect.y && s.y <= _mmRect.y + _mmRect.h){
      const mapX = (s.x - _mmRect.x) / _mmRect.w * W;
      const mapY = (s.y - _mmRect.y) / _mmRect.h * H;
      camJumpTo(mapX, mapY);
      return;  /* non iniciar drag */
    }
  }
  /* (v0.22) Modo colocación de muro (encargo ao Engineer) */
  if(game.wallPlacing){
    if(e.button === 2){ game.wallPlacing = null; radio(TXT('r.muroCancelado'), '#888'); return; }
    if(e.button === 0){
      const p = canvasPos(e);
      const eng = game.units.find(u => u.id === game.wallPlacing && !u.dead && !u.inside);
      if(!eng){ game.wallPlacing = null; return; }
      if(validWallSpot(p.x, p.y, game)){
        DATA.chatarra -= WALL_BUILD.cost;
        if(window._pvp && window._pvp.rol === 'guest'){
          saveData(DATA);
          window._pvp.net.push(`salas/${window._pvp.sala}/orden`, {tipo:'muro', id:eng.id, x:Math.round(p.x), y:Math.round(p.y), ts:Date.now()}).catch(()=>{});
        } else {
          eng.buildTask = {x: p.x, y: p.y, progress: 0};
          orderMove(eng, p.x + 14, p.y);
        }
        game.wallPlacing = null;
        radio(TXT('r.vaiMuro', {n:eng.name}), '#c8a86a', {x:p.x, y:p.y});
      } else {
        radio(TXT('r.muroInvalido'), '#ff8');
      }
      return;
    }
  }
  /* (v0.20) Modo colocación de torreta — (v0.32) tamén para o convidado */
  const _pvpG = window._pvp && window._pvp.rol === 'guest';
  const _tPend = _pvpG ? (game._turretPendingET || 0) : game.turretPending;
  if(_tPend > 0 && e.button === 0){
    const p = canvasPos(e);
    if(validTurretSpot(p.x, p.y, game)){
      if(_pvpG){
        window._pvp.net.push(`salas/${window._pvp.sala}/orden`, {tipo:'torreta', x:Math.round(p.x), y:Math.round(p.y), ts:Date.now()}).catch(()=>{});
        radio(TXT('r.torretaSolicitada'), '#c8a86a');
      } else placeTurret(p.x, p.y, game);
    } else {
      radio(TXT('r.torretaInvalida'), '#ff8');
    }
    return;
  }
  /* Botón dereito: deseleccionar todo */
  if(e.button === 2){
    e.preventDefault();
    game.units.forEach(u=>u.sel=false);
    game.turrets.forEach(t=>t.sel=false);
    if(game.vehicles) game.vehicles.forEach(v=>v.sel=false);
    return;
  }
  const p=canvasPos(e);
  game.drag={x:p.x,y:p.y,x2:p.x,y2:p.y};
});
/* Suprimir o menú contextual nativo */
cv.addEventListener('contextmenu', e=>e.preventDefault());
cv.addEventListener('mousemove', e=>{
  const s = screenPos(e);
  _mouseScr.x = s.x; _mouseScr.y = s.y; _mouseScr.inside = true;
  if(!game||!game.drag) return;
  const p=canvasPos(e);
  game.drag.x2=p.x; game.drag.y2=p.y;
});
cv.addEventListener('mouseleave', ()=>{ _mouseScr.inside = false; });
cv.addEventListener('mouseup', e=>{
  const g=game; if(!g) return;
  const p=canvasPos(e);
  const d=g.drag; g.drag=null;
  if(!d) return;
  const w=Math.abs(d.x2-d.x), h=Math.abs(d.y2-d.y);
  if(w>8||h>8){
    const x1=Math.min(d.x,d.x2),x2=Math.max(d.x,d.x2),y1=Math.min(d.y,d.y2),y2=Math.max(d.y,d.y2);
    g.units.forEach(u=>{ u.sel = (u.team===PT && !u.dead && !u.inside && u.x>x1&&u.x<x2&&u.y>y1&&u.y<y2); });
    /* (v0.21) Cháchara de grupo: falan entre elas, non contigo */
    const _selGrupo = g.units.filter(u=>u.sel);
    if(_selGrupo.length >= 2 && Math.random() < 0.30 && (!g._lastChachara || g.t - g._lastChachara > 720)){
      playChachara(g, _selGrupo);
    }
  } else {
    /* Hit-test de torretas (radio ~22 para torreta de 32px) */
    const turretHit = g.turrets.find(t=>!t.destroyed && Math.hypot(t.x-p.x, t.y-p.y) < 22);
    /* (v0.10) Hit-test de vehículos (radio ~24 para jeep de 44x36) */
    const vehicleHit = g.vehicles ? g.vehicles.find(v=>!v.destroyed && Math.hypot(v.x-p.x, v.y-p.y) < 24) : null;
    /* Selección actual de jeep aliado, se hai */
    const selVehicle = g.vehicles ? g.vehicles.find(v=>v.sel && v.team===PT && v.occupant && !v.destroyed) : null;
    const sel = g.units.filter(u=>u.sel && !u.dead);
    if(turretHit){
      if(sel.length>0 && !turretHit.occupant && !turretHit.destroyed){
        /* Ordenar a primeira unidade seleccionada a ocupar a torreta */
        const u = sel[0];
        u.intentEnterTurret = turretHit;
        u.intentEnterVehicle = null;
        orderMove(u, turretHit.x, turretHit.y);
        if(window._pvp && window._pvp.rol === 'guest') window._pvp.net.push(`salas/${window._pvp.sala}/orden`, {tipo:'entrar', id:u.id, kind:'torreta', tid:turretHit.id, ts:Date.now()}).catch(()=>{});
        if(typeof sfx==='function') sfx('order_confirm');
        radio(TXT('r.irTorreta', {n:u.name}), '#7fb0ff');
      } else if(turretHit.team===PT && turretHit.occupant){
        g.units.forEach(u=>u.sel=false);
        g.turrets.forEach(t=>t.sel=false);
        if(g.vehicles) g.vehicles.forEach(v=>v.sel=false);
        turretHit.sel = true;
        radio(TXT('r.torretaSel', {n:turretHit.occupant.name}), '#7fb0ff');
      }
      lastClickUnit = null;
    } else if(vehicleHit){
      if(sel.length>0 && !vehicleHit.occupant && !vehicleHit.destroyed){
        /* Ordenar a unidade a ocupar o jeep */
        const u = sel[0];
        u.intentEnterVehicle = vehicleHit;
        u.intentEnterTurret = null;
        orderMove(u, vehicleHit.x, vehicleHit.y);
        if(window._pvp && window._pvp.rol === 'guest') window._pvp.net.push(`salas/${window._pvp.sala}/orden`, {tipo:'entrar', id:u.id, kind:'jeep', tid:vehicleHit.id, ts:Date.now()}).catch(()=>{});
        if(typeof sfx==='function') sfx('order_confirm');
        radio(TXT('r.irJeep', {n:u.name}), '#7fb0ff');
      } else if(vehicleHit.team===PT && vehicleHit.occupant){
        /* Jeep amigo ocupado: seleccionalo */
        g.units.forEach(u=>u.sel=false);
        g.turrets.forEach(t=>t.sel=false);
        g.vehicles.forEach(v=>v.sel=false);
        vehicleHit.sel = true;
        radio(TXT('r.jeepSel', {n:vehicleHit.occupant.name}), '#7fb0ff');
      }
      lastClickUnit = null;
    } else {
      const hit = g.units.find(u=>u.team===PT&&!u.dead&&!u.inside&&Math.abs(u.x-p.x)<10&&Math.abs(u.y-p.y)<12);
      if(hit){
      const now = Date.now();
      const isDouble = (now - lastClickTime < DBL_CLICK_MS) && (lastClickUnit === hit);
      if(isDouble){
        g.units.forEach(u=>{
          u.sel = (u.team===PT && !u.dead && u.cls===hit.cls && dist(u, hit) <= DBL_SELECT_RADIUS);
        });
        sfx('order_confirm');
        playVoice(hit.cls, 'sel');
        emitSelectionFrase(hit);
      } else {
        g.units.forEach(u=>u.sel=false);
        g.turrets.forEach(t=>t.sel=false);
        if(g.vehicles) g.vehicles.forEach(v=>v.sel=false);
        hit.sel = true;
        playVoice(hit.cls, 'sel');
        emitSelectionFrase(hit);
      }
      lastClickTime = now;
      lastClickUnit = hit;
    }
    else {
      /* Clic no chan: prioridade ao jeep seleccionado se hai un */
      if(selVehicle){
        /* Se a orde cruza o río, ir primero á ponte (como o HEAVY) */
        if(crossesRiver(selVehicle.x, p.x)){
          selVehicle.waypoints = [{x:BRIDGE_CENTER.x, y:BRIDGE_CENTER.y}, {x:p.x, y:p.y}];
          selVehicle.tx = BRIDGE_CENTER.x;
          selVehicle.ty = BRIDGE_CENTER.y;
        } else {
          selVehicle.waypoints = [];
          selVehicle.tx = p.x; selVehicle.ty = p.y;
        }
        if(window._pvp && window._pvp.rol === 'guest') window._pvp.net.push(`salas/${window._pvp.sala}/orden`, {tipo:'movJeep', tid:selVehicle.id, x:Math.round(p.x), y:Math.round(p.y), ts:Date.now()}).catch(()=>{});
        if(typeof sfx==='function') sfx('order_confirm');
        radio(`${selVehicle.occupant.name} (jeep) → ${Math.floor(p.x)},${Math.floor(p.y)}`, '#7fb0ff');
      } else {
        const sel=g.units.filter(u=>u.sel&&!u.dead&&!u.inside);
        if(sel.length>0){
          sfx('order_confirm');
          playVoice(sel[0].cls, 'move');
        }
        /* Cancelar intents previos */
        sel.forEach(u => {
          u.intentEnterTurret = null;
          u.intentEnterVehicle = null;
          /* (v0.12.1) Orde suicida: unidade con HP<25% mandada cara ao HQ inimigo */
          checkSuicideOrder(u, p.x, p.y, g);
        });
        /* Formación por clase só se está activada; sen ela, grella simple */
        if(formacionAtiva){
          orderMoveGroup(sel, p.x, p.y);
        } else {
          sel.forEach((u, i) => {
            orderMove(u, p.x + (i%3)*16 - 16, p.y + Math.floor(i/3)*16 - 8);
          });
        }
      }
      lastClickUnit = null;
    }
    }
  }
});
document.addEventListener('keydown', e=>{
  if(!game) return;
  if(e.key==='1') queueUnit(PT,'GRUNT');
  if(e.key==='2') queueUnit(PT,'HEAVY');
  if(e.key==='3') queueUnit(PT,'ENGINEER');
  if(e.key==='4') queueUnit(PT,'SNIPER');
  if(e.key==='5') queueUnit(PT,'TANQUE');
  if(e.key==='6') queueUnit(PT,'BOMBARDERO');
  if(e.key==='7') queueUnit(PT,'TORRETA');
  if(e.key==='8') startWallPlacing();
  if(e.key==='e' || e.key==='E'){
    ejectFromTurret();
  }
  /* (v0.18) Silenciar/activar son */
  if(e.key==='m' || e.key==='M'){
    if(masterGain){
      masterGain.gain.value = masterGain.gain.value > 0 ? 0 : 0.35;
      if(_music && _music !== 'none') _music.muted = masterGain.gain.value === 0;
      radio(masterGain.gain.value > 0 ? '♪ Son activado' : '♪ Son silenciado', '#888');
    }
  }
  /* (v0.11) Alternar formación ON/OFF */
  if(e.key==='f' || e.key==='F'){
    formacionAtiva = !formacionAtiva;
    if(typeof sfx==='function') sfx('order_confirm');
    radio((formacionAtiva ? TXT('r.formacionOn') : TXT('r.formacionOff')) + '.', '#7fb0ff');
  }
});

/* Función global para o botón BAIXAR do panel lateral */
function ejectFromTurret(){
  if(!game) return;
  /* (v0.32) no duelo, a orde de baixar viaxa ao host */
  if(window._pvp && window._pvp.rol === 'guest'){
    const tu = game.turrets.find(t => t.sel && t.team === PT && t.occupant && !t.destroyed);
    const veh = !tu && game.vehicles ? game.vehicles.find(v => v.sel && v.team === PT && v.occupant && !v.destroyed) : null;
    const alvo = tu || veh;
    if(alvo){
      window._pvp.net.push(`salas/${window._pvp.sala}/orden`, {tipo:'sair', tid:alvo.id, ts:Date.now()}).catch(()=>{});
      radio(TXT('r.baixando'), '#7fb0ff');
    }
    return;
  }
  /* Primeiro probar torretas */
  const tu = game.turrets.find(t=>t.sel && t.team===PT && t.occupant && !t.destroyed);
  if(tu){
    const u = tu.occupant;
    u.inside = null;
    u.x = tu.x + 22;
    u.y = tu.y + 22;
    tu.occupant = null;
    tu.sel = false;
    u.sel = true;
    radio(TXT('r.saiuTorreta', {n:u.name}), '#ffd24a');
    if(typeof sfx==='function') sfx('order_confirm');
    return;
  }
  /* Despois vehículos */
  const veh = game.vehicles ? game.vehicles.find(v=>v.sel && v.team===PT && v.occupant && !v.destroyed) : null;
  if(veh){
    const u = veh.occupant;
    u.inside = null;
    u.x = veh.x + 24;
    u.y = veh.y + 24;
    veh.occupant = null;
    veh.sel = false;
    veh.tx = veh.x; veh.ty = veh.y;  /* parar movemento */
    u.sel = true;
    radio(TXT('r.saiuJeep', {n:u.name}), '#ffd24a');
    if(typeof sfx==='function') sfx('order_confirm');
  }
}
$('p0').onclick=()=>queueUnit(PT,'GRUNT');
$('p1').onclick=()=>queueUnit(PT,'HEAVY');
$('p2').onclick=()=>queueUnit(PT,'ENGINEER');
$('p3').onclick=()=>queueUnit(PT,'SNIPER');
$('p4').onclick=()=>queueUnit(PT,'TANQUE');
$('p5').onclick=()=>queueUnit(PT,'BOMBARDERO');
$('p6').onclick=()=>queueUnit(PT,'TORRETA');
$('pMuro').onclick=()=>startWallPlacing();
$('btnAbort').onclick=()=>{ if(game){ game.over=true; game.result='defeat'; endBattle(game); } };

/* ============================================================
   MEDALLAS (A.4)
   Queries sobre el array de eventos completo.
   ============================================================ */
const MEDAL_DEFS = [
  {id:'CRUZ_DEL_PUENTE', label:'Cruz del Puente', test: u =>
    u.events.some(e => e.type==='DEFENDIO' && e.place==='PUENTE_CENTRAL' && e.duration>=180)},
  {id:'SUPERVIVIENTE', label:'Superviviente', test: (u, ctx) =>
    ctx && ctx.endIntegrity!=null && ctx.endIntegrity < 0.10},
  {id:'CONQUISTADOR', label:'Conquistador', test: u =>
    u.events.filter(e=>e.type==='CAPTURO_SECTOR').length >= 10},
  {id:'EL_QUE_VUELVE', label:'El que vuelve', test: u =>
    u.events.filter(e=>e.type==='RECUPERADO_EN').length >= 3},
  {id:'MARTILLO_DE_HIERRO', label:'Martillo de hierro', test: u => u.kills >= 25},
  {id:'EXPLORADOR', label:'Explorador', test: u => (u.crossings||0) >= 20},
  /* Medallas específicas del Engineer */
  {id:'ANGEL_DE_LA_CHATARRA', label:'Ángel de la chatarra', test: u =>
    (u.unitsRecovered||0) >= 10},
  {id:'VIDA_POR_VIDA', label:'Vida por vida', test: u => {
    const rf = u.recoveredFrom || {};
    return Object.values(rf).some(v => v >= 3);
  }, /* Para mostrar con quién: */
   subtitle: u => {
    const rf = u.recoveredFrom || {};
    const entry = Object.entries(rf).find(([n,v]) => v >= 3);
    return entry ? TXT('medal.con', {n: entry[0]}) : null;
  }},
];
function checkMedals(unit, ctx){
  const earned = new Set(unit.medals || []);
  const newOnes = [];
  for(const m of MEDAL_DEFS){
    if(earned.has(m.id)) continue;
    if(m.test(unit, ctx)){ earned.add(m.id); newOnes.push(m); }
  }
  unit.medals = [...earned];
  return newOnes;
}

