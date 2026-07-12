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
      <div class="interrupt-banner">⚠ TRANSMISIÓN DE EMERGENCIA ⚠</div>
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
        <div class="ph-sub">${u.cls} · Op ${opsTotal} · ${totalKills} bajas</div>
        <div style="margin-top:4px;">
          <div class="ph-bar"><div style="width:${(hpPct*100).toFixed(0)}%; background:${hpColor};"></div></div>
          <span style="font-size:10px; color:${hpColor};">${(hpPct*100).toFixed(0)}% INTEGRIDAD</span>
        </div>
      </div>
    </div>
  `;
  if(traits.length){
    html += `<div class="ph-section"><b>RASGOS</b>${traits.map(t=>`<span class="tag">${t}</span>`).join(' ')}</div>`;
  }
  if(medals.length){
    html += `<div class="ph-section"><b>MEDALLAS</b>`+
      medals.map(mid=>{
        const m = MEDAL_DEFS.find(x=>x.id===mid);
        const sub = (m && m.subtitle && persistedRec) ? m.subtitle(persistedRec) : null;
        return `<span class="medal">✪ ${m?m.label:mid}${sub?` <span class="small">(${sub})</span>`:''}</span>`;
      }).join(' ')+`</div>`;
  }
  html += `<div class="ph-section"><b>POSICIÓN</b><span class="ph-place">${placeLabel(place)}</span></div>`;
  if(lastEv){
    html += `<div class="ph-section"><b>ÚLTIMO EVENTO</b><div class="ph-event">${formatEvent(lastEv)}</div></div>`;
  }
  return html;
}

function squadPanelHTML(g, sel){
  let html = `<div class="ph-name">ESCUADRÓN</div>`;
  if(sel.length > 1){
    const totalHp = sel.reduce((a,u)=>a+u.hp/u.max,0);
    const avgHp = (totalHp/sel.length*100).toFixed(0);
    const vets = sel.filter(u=>u.persisted).length;
    html += `<div class="ph-sub">${sel.length} unidades · ${vets} veteranos</div>`;
    html += `<div class="ph-section"><b>INTEGRIDAD MEDIA</b><span>${avgHp}%</span></div>`;
    html += `<div class="ph-section"><b>UNIDADES</b><div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">`;
    sel.forEach((u, i) => {
      const pct = (u.hp/u.max*100).toFixed(0);
      html += `<div style="text-align:center;">
        ${portraitHTML(`squadPortrait${i}`, 56, 64)}
        <div style="font-size:9px; color:var(--phos); margin-top:2px;">${u.name}</div>
        <div style="font-size:9px; color:var(--phos-dim);">${pct}%</div>
      </div>`;
    });
    html += `</div></div>`;
  } else {
    const alive = g.units.filter(u=>u.team===PT && !u.dead);
    const sectorsOwn = g.sectors.filter(s=>s.owner===PT).length;
    html += `<div class="ph-sub">${alive.length} unidades vivas · Op nº ${DATA.opCount+1}</div>`;
    html += `<div class="ph-section"><b>SECTORES</b>${sectorsOwn} / ${g.sectors.length}</div>`;
    html += `<div class="ph-section"><b>BAJAS</b>${g.kills[PT]} enemigas · ${g.units.filter(u=>u.team===PT && u.dead).length} propias</div>`;
    if(g.remains.filter(r=>!r.expired).length){
      const open = g.remains.filter(r=>!r.expired && !r.secured).length;
      const sec = g.remains.filter(r=>!r.expired && r.secured).length;
      html += `<div class="ph-section"><b>RESTOS</b>${open} sin recuperar · ${sec} asegurados</div>`;
    }
  }
  return html;
}

function updateSidePanel(g){
  /* Si no hay batalla, salir */
  if(!g){ return; }
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
      panel.innerHTML = unitPanelHTML(panelInterrupt.unit, {
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
        <div style="font-size:10px; color:#7fb0e8; margin-bottom:4px;">— EN TORRETA ${tSel.id} —</div>
        <div style="font-size:11px; color:#aaa; margin-bottom:4px;">Estrutura: <b style="color:${hpPct>50?'#7fdc7f':(hpPct>25?'#ffd24a':'#ff5340')};">${tSel.hp}/${tSel.max} (${hpPct}%)</b></div>
        <button onclick="ejectFromTurret()" style="
          width:100%; padding:8px; margin-top:4px;
          background:#27406e; color:#cfe0ff; border:1px solid #4f8aff;
          font-family:'Courier New',monospace; font-size:11px;
          cursor:pointer; letter-spacing:1px;">
          ▼ BAIXAR DA TORRETA  (E)
        </button>
      </div>`;
    panel.innerHTML = unitPanelHTML(tSel.occupant) + extra;
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
        <div style="font-size:10px; color:#7fb0e8; margin-bottom:4px;">— NO JEEP ${vSel.id} ${moving?'(en marcha)':'(parado)'} —</div>
        <div style="font-size:11px; color:#aaa; margin-bottom:4px;">Estrutura: <b style="color:${hpPct>50?'#7fdc7f':(hpPct>25?'#ffd24a':'#ff5340')};">${vSel.hp}/${vSel.max} (${hpPct}%)</b></div>
        <div style="font-size:10px; color:#888; margin-bottom:6px;">Clic no chan para conducir</div>
        <button onclick="ejectFromTurret()" style="
          width:100%; padding:8px; margin-top:4px;
          background:#27406e; color:#cfe0ff; border:1px solid #4f8aff;
          font-family:'Courier New',monospace; font-size:11px;
          cursor:pointer; letter-spacing:1px;">
          ▼ BAIXAR DO JEEP  (E)
        </button>
      </div>`;
    panel.innerHTML = unitPanelHTML(vSel.occupant) + extra;
    paintPortrait('portraitSmall', vSel.occupant);
    return;
  }
  const sel = g.units.filter(u=>u.sel && !u.dead && u.team===PT && !u.inside);
  if(sel.length === 1){
    panel.innerHTML = unitPanelHTML(sel[0]);
    paintPortrait('portraitSmall', sel[0]);
  } else {
    panel.innerHTML = squadPanelHTML(g, sel);
    /* Si hay varias seleccionadas, pintar mini-retratos del escuadrón */
    sel.forEach((u, i) => {
      paintPortrait(`squadPortrait${i}`, u);
    });
  }
}

/* ---------- Bucle ---------- */
function loop(){
  if(!game) return;
  const g=game;
  g.t++;
  const _pvpGuest = g.modo === 'pvp' && window._pvp && window._pvp.rol === 'guest';
  if(_pvpGuest){
    try{
      pvpAplicarSnap(g);   /* (v0.31) o convidado NON simula: renderiza o estado do host */
      pvpInterpolar(g);    /* (v0.32) suavizado visual entre snaps */
      pvpFlushOrdes();
    }catch(e){ console.error('[pvp guest]', e); }   /* (v0.34.1) nada mata o loop */
  } else if(!g.over){
    tickProd(g); tickAI(g); tickUnits(g); tickTurrets(g); tickVehicles(g); tickSectors(g); tickRadar(g); tickBaseAlarm(g); tickEnd(g);
    if(g.modo === 'pvp' && window._pvp && window._pvp.rol === 'host'){
      try{ pvpHostFrame(g); }catch(e){ console.error('[pvp host]', e); }
    }
  }
  updateCamera();
  computeVision(g);   /* (v0.20) fontes de visión deste frame */
  /* (v0.25) JUICE: screen shake con decaemento */
  if(g.shake > 0.3){ g.shake *= 0.86; } else g.shake = 0;
  const _shx = g.shake ? (Math.random()*2-1)*g.shake : 0;
  const _shy = g.shake ? (Math.random()*2-1)*g.shake : 0;
  ctx.save();
  ctx.translate(-Math.round(cam.x + _shx), -Math.round(cam.y + _shy));
  draw(g);
  ctx.restore();
  /* (v0.26) tinta do clima (baixo o minimapa, que segue lexible) */
  if(g.clima && g.clima.tint){
    ctx.save();
    ctx.fillStyle = g.clima.tint;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();
  }
  drawMinimap(g);
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

/* ---------- Input ---------- */
function canvasPos(e){
  const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(cv.width/r.width) + cam.x,
          y:(e.clientY-r.top)*(cv.height/r.height) + cam.y};
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
    if(e.button === 2){ game.wallPlacing = null; radio('Encargo de muro cancelado.', '#888'); return; }
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
        radio(`⌂ ${eng.name} vai levantar un muro.`, '#c8a86a', {x:p.x, y:p.y});
      } else {
        radio('⌂ Posición inválida para o muro (territorio propio, chan libre).', '#ff8');
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
        radio('⌂ Torreta solicitada nesa posición.', '#c8a86a');
      } else placeTurret(p.x, p.y, game);
    } else {
      radio('⌂ Posición inválida: só en territorio propio (HQ ou sectores teus), en chan libre.', '#ff8');
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
        radio(`${u.name} → ocupar torreta.`, '#7fb0ff');
      } else if(turretHit.team===PT && turretHit.occupant){
        g.units.forEach(u=>u.sel=false);
        g.turrets.forEach(t=>t.sel=false);
        if(g.vehicles) g.vehicles.forEach(v=>v.sel=false);
        turretHit.sel = true;
        radio(`Torreta seleccionada (${turretHit.occupant.name} dentro). Tecla E para sair.`, '#7fb0ff');
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
        radio(`${u.name} → ocupar jeep.`, '#7fb0ff');
      } else if(vehicleHit.team===PT && vehicleHit.occupant){
        /* Jeep amigo ocupado: seleccionalo */
        g.units.forEach(u=>u.sel=false);
        g.turrets.forEach(t=>t.sel=false);
        g.vehicles.forEach(v=>v.sel=false);
        vehicleHit.sel = true;
        radio(`Jeep seleccionado (${vehicleHit.occupant.name} dentro). Clic no chan para mover, E para baixar.`, '#7fb0ff');
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
    radio(`Formación ${formacionAtiva?'ACTIVADA — HEAVY adiante, GRUNT flancos, ENGINEER atrás':'DESACTIVADA — control manual'}.`, '#7fb0ff');
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
      radio('Baixando…', '#7fb0ff');
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
    radio(`${u.name} saíu da torreta.`, '#ffd24a');
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
    radio(`${u.name} saíu do jeep.`, '#ffd24a');
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
    return entry ? `con ${entry[0]}` : null;
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

