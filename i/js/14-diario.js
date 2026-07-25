/* ============================================================
   O DIARIO DE TUERCA (v0.64, Sesión A) — o arquiveiro que ninguén viu.
   Canon: TUERCA_LORE_canon.md v2 · Spec: TUERCA_DIARIO_spec.md.
   Sesión A: gatillo da PRIMEIRA BAIXA · snapshot conxelado · compositor
   (papel/informe/prosa) · picker determinista · lector-libro · aviso.
   Regra de ouro editorial: a bio lista feitos; o diario INTERPRÉTAOS.
   ============================================================ */

/* ---------- estado en DATA (por campaña) ---------- */
function diarioEnsure(){
  if(!DATA.diario){
    DATA.diario = {
      capitulos: [],
      eixos: {piedade: 0, pragmatismo: 0, apego: 0},
      flags: {primeiraBaixa: false, primeiroReensamblado: false, actos: {}},
      caidos: [],
    };
  }
  return DATA.diario;
}

/* ---------- utilidades deterministas ---------- */
function _diaSeed(s){
  let h = 2166136261;
  for(const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
function _diaRng(seed){
  let s = seed || 1;
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/* ---------- GATILLO: primeira baixa (vixía por tick, barato tras o flag) ---------- */
let _diaSnapPendente = null;   /* snapshot capturado AO MORRER; capítulo péchase no endBattle */

function diarioVixiarBaixa(g){
  try{
    const D = diarioEnsure();
    if(!g || g.modo === 'pvp' || g.modo === 'mundial') return;
    const morto = g.units.find(u => u.team === PT && u.dead && !u._diaVisto);
    if(!morto) return;
    morto._diaVisto = true;
    /* (Sesión B) rexistro lixeiro de TODOS os caídos — alimento do fin de acto */
    if(!D.caidos) D.caidos = [];
    D.caidos.push({name: morto.name, op: (DATA.opCount || 0) + 1});
    if(D.caidos.length > 60) D.caidos.shift();
    if(D.flags.primeiraBaixa || _diaSnapPendente) return;
    /* SNAPSHOT: conxelado no tick da morte — nunca se re-deriva */
    const veciños = g.units
      .filter(o => o.team === PT && !o.dead && o !== morto && Math.hypot(o.x - morto.x, o.y - morto.y) < 180)
      .slice(0, 3).map(o => ({name: o.name, cls: o.cls}));
    /* mini-mapa: grid real reducido (1 de cada 4 celas) — silueta fiel do terreo */
    let grid = null, gW = 0, gH = 0;
    if(window._terrainGrid && typeof COLS !== 'undefined'){
      gW = Math.ceil(COLS / 4); gH = Math.ceil(ROWS / 4);
      grid = [];
      for(let y = 0; y < gH; y++){
        let fila = '';
        for(let x = 0; x < gW; x++) fila += String(window._terrainGrid[Math.min(ROWS-1, y*4)][Math.min(COLS-1, x*4)]);
        grid.push(fila);
      }
    }
    _diaSnapPendente = {
      gatillo: 'primeiraBaixa',
      u: {id: morto.id, name: morto.name, cls: morto.cls, ops: (morto.ops || 0) + 1,
          kills: (morto.pastKills || 0) + (morto.kills || 0), personalidad: morto.personalidad || 'ESTOICO'},
      causa: morto.deathCause || null,
      horaMundo: g.t,
      lugar: (typeof placeAt === 'function') ? placeAt(morto.x, morto.y) : null,
      x: Math.round(morto.x), y: Math.round(morto.y),
      veciños,
      vinculos: (morto.vinculos || []).slice(0, 2).map(v => {
        const o = g.units.find(z => z.id === v.con) || (DATA.units || []).find(z => z.id === v.con);
        return {name: o ? o.name : v.con};
      }),
      ultimaTransmision: (morto._lastFrase && morto._lastFrase.text) || null,
      mapa: {W, H, gW, gH, grid,
             hq0: {x: g.hq[0].x, y: g.hq[0].y}, hq1: {x: g.hq[1].x, y: g.hq[1].y}},
      op: (DATA.opCount || 0) + 1,
      restos: null,
    };
  }catch(e){}
}

/* Peche do capítulo no fin de batalla (chámao endBattle) */
function diarioPecharBatalla(g){
  try{
    const D = diarioEnsure();
    if(!_diaSnapPendente) return;
    const snap = _diaSnapPendente; _diaSnapPendente = null;
    if(D.flags.primeiraBaixa) return;
    D.flags.primeiraBaixa = true;
    snap.restos = (g && g.result === 'victory') ? 'recuperados' : 'abandonados';   /* M1; afinar en M2 */
    const seed = _diaSeed(snap.u.name + '·' + snap.op + '·' + (DATA.seedCampaña || ''));
    const cap = {
      id: 'cap' + (D.capitulos.length + 1),
      gatillo: snap.gatillo, op: snap.op, seed,
      snapshot: snap,
      tituloIdx: Math.floor(_diaRng(seed + 7)() * 3),
      lido: false,
    };
    D.capitulos.push(cap);
    if(typeof saveData === 'function') saveData();
    setTimeout(() => diarioAviso(cap), 900);
  }catch(e){}
}

/* ---------- GATILLO: primeiro reensamblado (chámao a montaxe) ---------- */
function diarioReensamblado(rec, doadores, desdeCero){
  try{
    const D = diarioEnsure();
    if(desdeCero || !doadores || !doadores.length) return;   /* precisa pezas ALLEAS */
    if(D.flags.primeiroReensamblado) return;
    D.flags.primeiroReensamblado = true;
    const snap = {
      gatillo: 'reensamblado',
      u: {id: rec.id, name: rec.name, cls: rec.cls, confianza: rec.confianza},
      doadores: [...doadores].slice(0, 3),
      op: (DATA.opCount || 0),
    };
    const seed = _diaSeed('re·' + rec.name + '·' + snap.op);
    const cap = {id: 'cap' + (D.capitulos.length + 1), gatillo: 'reensamblado', op: snap.op,
                 seed, snapshot: snap, tituloIdx: Math.floor(_diaRng(seed + 7)() * 3), lido: false};
    D.capitulos.push(cap);
    if(typeof saveData === 'function') saveData();
    setTimeout(() => diarioAviso(cap), 600);
  }catch(e){}
}

/* ---------- GATILLO: fin de acto (chámao o debrief tras opCount++) ---------- */
function diarioFinActo(){
  try{
    const D = diarioEnsure();
    const op = DATA.opCount || 0;
    const actN = op === 4 ? 'I' : op === 8 ? 'II' : op === 12 ? 'III' : null;
    if(!actN || (D.flags.actos && D.flags.actos[actN])) return;
    if(!D.flags.actos) D.flags.actos = {};
    D.flags.actos[actN] = true;
    const ini = actN === 'I' ? 1 : actN === 'II' ? 5 : 9;
    const caidosActo = (D.caidos || []).filter(c => c.op >= ini && c.op <= op);
    const snap = {
      gatillo: 'finActo', actN, op,
      caidos: caidosActo.slice(-3).map(c => c.name),
      caidosN: caidosActo.length,
      reensamblou: !!D.flags.primeiroReensamblado,
      eixos: {...D.eixos},               /* CONXELADOS: os eixos daquel momento */
    };
    const seed = _diaSeed('fa·' + actN + '·' + op);
    const cap = {id: 'cap' + (D.capitulos.length + 1), gatillo: 'finActo', op,
                 seed, snapshot: snap, tituloIdx: Math.floor(_diaRng(seed + 7)() * 3), lido: false};
    D.capitulos.push(cap);
    if(typeof saveData === 'function') saveData();
    setTimeout(() => diarioAviso(cap), 1400);
  }catch(e){}
}

/* ---------- destino real dos restos (doazón/requisa) — resolución de feito, non reescritura ---------- */
function diarioDestinoRestos(recId, doazon){
  try{
    const D = diarioEnsure();
    const cap = D.capitulos.find(c => c.gatillo === 'primeiraBaixa' && c.snapshot.u.id === recId);
    if(cap && !cap.snapshot.destino){ cap.snapshot.destino = doazon ? 'doazon' : 'requisa'; if(typeof saveData === 'function') saveData(); }
  }catch(e){}
}

/* ---------- eixos (acumulación silenciosa no debrief) ---------- */
function diarioEixos(delta){
  try{
    const D = diarioEnsure();
    for(const k of ['piedade', 'pragmatismo', 'apego']){
      if(typeof delta[k] === 'number') D.eixos[k] = Math.max(-10, Math.min(10, D.eixos[k] + delta[k]));
    }
  }catch(e){}
}

/* ============================================================
   COMPOSITOR — canvas, mesma técnica de rects, TODO determinista
   ============================================================ */
const DIA_W = 620, DIA_H = 880;
const DIA_INK = '#2e2821', DIA_PENCIL = '#736958', DIA_RED = '#a32a1e', DIA_PAPEL = '#d6c7a1';

function diaPapel(ctx, seed){
  const r = _diaRng(seed);
  ctx.fillStyle = DIA_PAPEL; ctx.fillRect(0, 0, DIA_W, DIA_H);
  for(let i = 0; i < 4200; i++){
    const v = Math.floor(r() * 22) - 13;
    ctx.fillStyle = `rgb(${214+v},${199+v},${161+v-2})`;
    ctx.fillRect(Math.floor(r() * DIA_W), Math.floor(r() * DIA_H), 1, 1);
  }
  /* beiras esvaecidas */
  ctx.strokeStyle = 'rgba(120,105,75,0.25)';
  for(let i = 0; i < 18; i++){ ctx.strokeRect(i + 0.5, i + 0.5, DIA_W - 1 - 2*i, DIA_H - 1 - 2*i); }
  /* roda de cunca */
  const cx = 80 + r() * (DIA_W - 160), cy = 80 + r() * (DIA_H - 160);
  ctx.strokeStyle = 'rgba(150,128,90,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, 34 + r()*14, 30 + r()*12, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  /* esquina dobrada */
  ctx.fillStyle = '#c2b28a';
  ctx.beginPath(); ctx.moveTo(DIA_W, DIA_H - 40); ctx.lineTo(DIA_W, DIA_H); ctx.lineTo(DIA_W - 40, DIA_H); ctx.closePath(); ctx.fill();
}

function _diaCampo(ctx, x, y, etiqueta, valor, wl, vcol){
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(etiqueta, x, y);
  const lx = x + ctx.measureText(etiqueta).width + 8;
  ctx.fillStyle = vcol || DIA_INK; ctx.font = '13px "Courier New", monospace';
  ctx.fillText(valor || '—', lx, y);
  ctx.fillStyle = 'rgba(120,108,80,0.6)'; ctx.fillRect(lx - 2, y + 4, (x + wl) - lx, 1);
}

function _diaSelo(ctx, x, y, w, h, texto, cor, angulo){
  ctx.save(); ctx.translate(x + w/2, y + h/2); ctx.rotate(angulo || -0.06);
  ctx.strokeStyle = cor; ctx.lineWidth = 3; ctx.strokeRect(-w/2, -h/2, w, h);
  ctx.fillStyle = cor; ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'center'; ctx.fillText(texto, 0, 6); ctx.textAlign = 'left';
  ctx.restore(); ctx.lineWidth = 1;
}

/* Páxina 1: INFORME DE BAIXAS (a estrutura roubada, a pel nosa) */
function diaPaxInforme(ctx, cap){
  const s = cap.snapshot, r = _diaRng(cap.seed + 1);
  diaPapel(ctx, cap.seed);
  /* cabeceira */
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(TXT('dia.informeTitulo'), 36, 52);
  ctx.fillRect(36, 60, 250, 3);
  _diaSelo(ctx, 300, 30, 168, 34, TXT('dia.confidencial'), DIA_RED, -0.05);
  /* engrenaxe ÓPTIMA */
  ctx.strokeStyle = DIA_INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(520, 44, 17, 0, Math.PI * 2); ctx.stroke();
  for(let a = 0; a < 8; a++){
    ctx.fillStyle = DIA_INK;
    ctx.fillRect(520 + Math.cos(a * 0.785) * 21 - 4, 44 + Math.sin(a * 0.785) * 21 - 4, 8, 8);
  }
  ctx.fillStyle = DIA_PAPEL; ctx.beginPath(); ctx.arc(520, 44, 7, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1;
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('ÓPTIMA', 545, 40);
  ctx.fillStyle = DIA_PENCIL; ctx.font = '9px "Courier New", monospace';
  ctx.fillText(TXT('dia.optimaLema'), 505, 62);
  /* campos superiores */
  _diaCampo(ctx, 36, 92,  TXT('dia.operacion') + ':', String(s.op).padStart(2, '0') + (s.lugar ? ' — ' + s.lugar.toUpperCase() : ''), 300);
  _diaCampo(ctx, 36, 116, TXT('dia.expediente') + ':', String(s.op).padStart(3, '0') + '-' + cap.id.slice(3) + '-A', 300);
  /* rexistro + barras */
  ctx.strokeStyle = DIA_INK; ctx.lineWidth = 2; ctx.strokeRect(360, 78, 226, 72); ctx.lineWidth = 1;
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(TXT('dia.rexistro'), 380, 96);
  ctx.fillStyle = DIA_RED; ctx.font = 'bold 20px "Courier New", monospace';
  const serie = (s.u.cls || 'UNI').slice(0, 3).toUpperCase() + '-' + String((_diaSeed(s.u.id) % 90) + 10) + '-' + String((_diaSeed(s.u.name) % 900) + 100);
  ctx.fillText(serie, 388, 120);
  let bx = 372;
  while(bx < 574){ const bw = 1 + Math.floor(r() * 3); ctx.fillStyle = DIA_INK; ctx.fillRect(bx, 128, bw, 16); bx += bw + 1 + Math.floor(r() * 2); }
  /* FOTO: retrato real coa pel de foto */
  ctx.save(); ctx.translate(126, 288); ctx.rotate(0.035);
  ctx.fillStyle = '#ded6bc'; ctx.fillRect(-93, -108, 186, 216);
  ctx.fillStyle = '#3a352b'; ctx.fillRect(-85, -100, 170, 176);
  /* (v0.70) O retiro vai en `finally`: estaba dentro do try, así que se
     drawPortrait petaba, o catch baleiro tragaba o erro E o canvas
     quedaba pendurado do body para sempre. */
  {
    const tmp = document.createElement('canvas'); tmp.width = 100; tmp.height = 120; tmp.id = '_diaTmpPortrait';
    tmp.style.cssText = 'position:absolute; left:-9999px; top:0;';
    document.body.appendChild(tmp);
    try{
      if(typeof drawPortrait === 'function') drawPortrait(tmp, {name: s.u.name, cls: s.u.cls, ops: s.u.ops, hp: 1, max: 1});
      ctx.filter = 'grayscale(0.3) sepia(0.25) contrast(1.05)';
      ctx.drawImage(tmp, -70, -92, 140, 160);
      ctx.filter = 'none';
    }catch(e){ console.error('[diario retrato]', e); }
    finally{ tmp.remove(); }
  }
  ctx.restore();
  /* clip */
  ctx.strokeStyle = '#787060'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(48, 190, 14, 1.6, 5.9); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillText(s.u.name, 58, 424);
  ctx.fillStyle = DIA_PENCIL; ctx.font = '10px "Courier New", monospace';
  ctx.fillText(serie, 58 + ctx.measureText(s.u.name).width * 2 + 14, 424);
  /* RESUMO */
  const rx = 250;
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText(TXT('dia.resumo'), rx, 196);
  ctx.fillRect(rx, 202, 336, 2);
  _diaCampo(ctx, rx, 224, TXT('dia.causa') + ':', s.causa ? TXT('dia.causa.' + s.causa, {}, true) || s.causa : TXT('dia.causaDesc'), 336);
  _diaCampo(ctx, rx, 250, TXT('dia.lugar') + ':', (s.lugar || '—').toUpperCase(), 336);
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(TXT('dia.compañeiros') + ':', rx, 278);
  ctx.font = '13px "Courier New", monospace';
  const vec = s.veciños && s.veciños.length ? s.veciños : null;
  if(vec) vec.forEach((v, i) => ctx.fillText('— ' + v.name + ' (' + clsLabel(v.cls) + ')', rx + 12, 298 + i * 19));
  else { ctx.fillStyle = DIA_PENCIL; ctx.fillText(TXT('dia.soLugar'), rx + 12, 298); ctx.fillStyle = DIA_INK; }
  const vy = 298 + Math.max(1, (vec || [1]).length) * 19 + 8;
  _diaCampo(ctx, rx, vy, TXT('dia.vinculos') + ':', s.vinculos && s.vinculos.length ? s.vinculos.map(v => v.name).join(' · ') : '—', 336);
  _diaCampo(ctx, rx, vy + 26, TXT('dia.opsCompletadas') + ':', String(s.u.ops), 336);
  _diaCampo(ctx, rx, vy + 52, TXT('dia.restos') + ':', TXT('dia.restos.' + s.restos), 336, s.restos === 'recuperados' ? DIA_INK : DIA_RED);
  /* ÚLTIMA TRANSMISIÓN */
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(TXT('dia.ultimaTransmision') + ':', rx, vy + 86);
  ctx.fillStyle = DIA_RED; ctx.font = 'italic bold 19px Georgia, serif';
  ctx.fillText(s.ultimaTransmision ? '« ' + s.ultimaTransmision + ' »' : TXT('dia.senTransmision'), rx + 6, vy + 112);
  /* MAPA TÁCTICO (silueta real do terreo) */
  const my0 = 500;
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(TXT('dia.mapaTactico'), 36, my0 - 8);
  ctx.fillStyle = DIA_INK; ctx.fillRect(34, my0 - 2, 254, 184);
  const M = s.mapa, mw = 244, mh = 174;
  const COR_T = {0:'#5d6b3c', 1:'#6d5b3c', 2:'#3f6274', 3:'#5d5a4a', 4:'#7d6844', 5:'#8a8578'};
  if(M && M.grid){
    const cw = mw / M.gW, ch = mh / M.gH;
    for(let y = 0; y < M.gH; y++) for(let x = 0; x < M.gW; x++){
      ctx.fillStyle = COR_T[+M.grid[y][x]] || '#5d6b3c';
      ctx.fillRect(39 + x * cw, my0 + 3 + y * ch, Math.ceil(cw), Math.ceil(ch));
    }
  } else { ctx.fillStyle = '#5d6b3c'; ctx.fillRect(39, my0 + 3, mw, mh); }
  const px = (wx) => 39 + (wx / (M ? M.W : 2000)) * mw;
  const py = (wy) => my0 + 3 + (wy / (M ? M.H : 1200)) * mh;
  const cruz = (X, Y, cor) => {
    ctx.strokeStyle = cor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X-6, Y-6); ctx.lineTo(X+6, Y+6); ctx.moveTo(X-6, Y+6); ctx.lineTo(X+6, Y-6); ctx.stroke();
    ctx.lineWidth = 1;
  };
  if(M){
    cruz(px(M.hq0.x), py(M.hq0.y), '#4a8ad8');
    cruz(px(M.hq1.x), py(M.hq1.y), DIA_RED);
    (s.veciños || []).forEach((v, i) => cruz(px(s.x) - 14 - i * 10, py(s.y) + 10, '#4a8ad8'));
    ctx.strokeStyle = DIA_RED; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px(s.x), py(s.y), 13, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
  }
  ctx.fillStyle = DIA_PENCIL; ctx.font = '10px "Courier New", monospace';
  ctx.fillText(TXT('dia.lenda'), 36, my0 + 198);
  /* NOTAS DO ARQUIVEIRO — texto REAL do picker */
  const nx = 320;
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText(TXT('dia.notas'), nx, my0 - 8);
  ctx.fillRect(nx, my0 - 2, 266, 2);
  const nota = diaEscollerNota(cap);
  ctx.font = 'italic 15px Georgia, serif';
  let ny = my0 + 22;
  for(const lin of _diaQuebrar(ctx, nota.corpo, 262)){
    ctx.fillStyle = DIA_INK; ctx.fillText(lin, nx + 2, ny); ny += 21;
  }
  ctx.fillStyle = DIA_RED;
  for(const lin of _diaQuebrar(ctx, nota.remate, 262)){
    ctx.fillText(lin, nx + 2, ny); ny += 21;
  }
  ctx.font = 'italic bold 16px Georgia, serif';
  ctx.fillText('— Tuerca', 500, Math.min(ny + 14, 806));
  /* pé: verificado, data, selo */
  _diaCampo(ctx, 36, 776, TXT('dia.verificado') + ':', '', 220);
  ctx.strokeStyle = DIA_INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(150, 774); ctx.lineTo(190, 762); ctx.lineTo(226, 776); ctx.lineTo(252, 764); ctx.stroke(); ctx.lineWidth = 1;
  _diaCampo(ctx, 36, 804, TXT('dia.data') + ':', TXT('dia.arquivadoDespois'), 300, DIA_PENCIL);
  _diaSelo(ctx, 380, 764, 190, 56, 'TUERCA · ' + TXT('dia.arquivo'), DIA_INK, 0.04);
  ctx.fillStyle = DIA_PENCIL; ctx.font = '10px "Courier New", monospace';
  ctx.fillText(TXT('dia.paxina', {n: 1, de: 2}), 500, 862);
}

/* Páxina 1 do reensamblado: PARTE DE MANTEMENTO */
function diaPaxFicha(ctx, cap){
  const s = cap.snapshot, r = _diaRng(cap.seed + 3);
  diaPapel(ctx, cap.seed);
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(TXT('dia.fichaTitulo'), 36, 52);
  ctx.fillRect(36, 60, 290, 3);
  _diaSelo(ctx, 340, 30, 150, 34, TXT('dia.rutina'), DIA_PENCIL, 0.04);
  /* engrenaxe ÓPTIMA compacta */
  ctx.strokeStyle = DIA_INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(540, 44, 15, 0, Math.PI * 2); ctx.stroke();
  for(let a = 0; a < 8; a++) ctx.fillRect(540 + Math.cos(a*0.785)*19 - 3, 44 + Math.sin(a*0.785)*19 - 3, 6, 6);
  ctx.fillStyle = DIA_PAPEL; ctx.beginPath(); ctx.arc(540, 44, 6, 0, Math.PI*2); ctx.fill();
  ctx.lineWidth = 1;
  _diaCampo(ctx, 36, 100, TXT('dia.operacion') + ':', String(s.op).padStart(2, '0'), 280);
  _diaCampo(ctx, 36, 126, TXT('dia.unidade') + ':', s.u.name + ' (' + (typeof clsLabel === 'function' ? clsLabel(s.u.cls) : s.u.cls) + ')', 280);
  _diaCampo(ctx, 36, 152, TXT('dia.estadoFicha') + ':', TXT('dia.operativa'), 280);
  /* FOTO pequena */
  ctx.save(); ctx.translate(500, 190); ctx.rotate(-0.03);
  ctx.fillStyle = '#ded6bc'; ctx.fillRect(-64, -74, 128, 148);
  ctx.fillStyle = '#3a352b'; ctx.fillRect(-58, -68, 116, 122);
  {
    const tmp = document.createElement('canvas'); tmp.width = 100; tmp.height = 120;
    tmp.style.cssText = 'position:absolute; left:-9999px; top:0;';
    document.body.appendChild(tmp);
    try{
      if(typeof drawPortrait === 'function') drawPortrait(tmp, {name: s.u.name, cls: s.u.cls, ops: 0, hp: 1, max: 1});
      ctx.filter = 'grayscale(0.3) sepia(0.25)';
      ctx.drawImage(tmp, -50, -62, 100, 112);
      ctx.filter = 'none';
    }catch(e){ console.error('[diario retrato]', e); }
    finally{ tmp.remove(); }
  }
  ctx.restore();
  /* PEZAS DE ORIXE — os nomes dos mortos, en vermello, nun impreso oficial */
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText(TXT('dia.pezasOrixe') + ':', 36, 210);
  ctx.fillRect(36, 216, 250, 2);
  ctx.font = 'bold 17px "Courier New", monospace';
  (s.doadores || []).forEach((d, i) => {
    ctx.fillStyle = DIA_RED;
    ctx.fillText('— ' + d, 52, 244 + i * 28);
    ctx.fillStyle = DIA_PENCIL; ctx.font = '11px "Courier New", monospace';
    ctx.fillText(TXT('dia.exUnidade'), 200, 244 + i * 28);
    ctx.font = 'bold 17px "Courier New", monospace';
  });
  const py0 = 244 + Math.max(1, (s.doadores || []).length) * 28 + 16;
  _diaCampo(ctx, 36, py0, TXT('dia.confianzaSaida') + ':', String(s.u.confianza ?? '—'), 280);
  ctx.fillStyle = DIA_PENCIL; ctx.font = 'italic 12px Georgia, serif';
  ctx.fillText(TXT('dia.avisoOptima'), 36, py0 + 28);
  /* NOTAS DO ARQUIVEIRO */
  const ny0 = py0 + 70;
  ctx.fillStyle = DIA_INK; ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText(TXT('dia.notas'), 36, ny0);
  ctx.fillRect(36, ny0 + 6, 266, 2);
  const rN = _diaRng(cap.seed + 29);
  const corpo = TXT('dia.notaRe.corpo.' + Math.floor(rN() * 3), {n: s.u.name, d: (s.doadores && s.doadores[0]) || ''});
  const remate = TXT('dia.notaRe.remate.' + Math.floor(rN() * 3), {n: s.u.name});
  ctx.font = 'italic 15px Georgia, serif';
  let ny = ny0 + 30;
  for(const lin of _diaQuebrar(ctx, corpo, 520)){ ctx.fillStyle = DIA_INK; ctx.fillText(lin, 40, ny); ny += 21; }
  for(const lin of _diaQuebrar(ctx, remate, 520)){ ctx.fillStyle = DIA_RED; ctx.fillText(lin, 40, ny); ny += 21; }
  ctx.font = 'italic bold 16px Georgia, serif';
  ctx.fillStyle = DIA_RED; ctx.fillText('— Tuerca', 480, ny + 12);
  _diaSelo(ctx, 380, 780, 190, 56, 'TUERCA · ' + TXT('dia.arquivo'), DIA_INK, -0.03);
  ctx.fillStyle = DIA_PENCIL; ctx.font = '10px "Courier New", monospace';
  ctx.fillText(TXT('dia.paxina', {n: 1, de: 2}), 500, 862);
}

/* Páxina 2: PROSA */
function diaPaxProsa(ctx, cap, parte){
  const s = cap.snapshot;
  diaPapel(ctx, cap.seed + 99 + (parte || 0));
  /* cabeceira de expediente datada */
  ctx.fillStyle = DIA_PENCIL; ctx.font = '12px "Courier New", monospace';
  ctx.fillText(TXT('dia.arquivoTuerca'), 40, 46);
  ctx.fillText(TXT('dia.operacionN', {n: String(s.op).padStart(4, '0')}), 40, 64);
  ctx.fillText(TXT('dia.estado') + ': ' + TXT('dia.estadoRecuperado'), 40, 82);
  ctx.fillStyle = 'rgba(120,108,80,0.5)'; ctx.fillRect(40, 92, 540, 1);
  /* TÍTULO manuscrito (na parte 2 do fin de acto, só unha liña a lapis) */
  if((parte || 0) === 0){
    const titulos = [TXT('dia.tit.' + cap.gatillo + '.0'), TXT('dia.tit.' + cap.gatillo + '.1'), TXT('dia.tit.' + cap.gatillo + '.2')];
    ctx.fillStyle = DIA_INK; ctx.font = 'italic bold 30px Georgia, serif';
    ctx.fillText(titulos[cap.tituloIdx % titulos.length], 44, 138);
  } else {
    ctx.fillStyle = DIA_PENCIL; ctx.font = 'italic 16px Georgia, serif';
    ctx.fillText(TXT('dia.continuacion'), 44, 130);
  }
  /* fragmentos */
  const frs = diaEscollerFragmentos(cap, parte || 0);
  ctx.font = 'italic 16px Georgia, serif';
  let y = 182;
  for(const f of frs){
    for(const lin of _diaQuebrar(ctx, f, 500)){
      ctx.fillStyle = DIA_INK; ctx.fillText(lin, 60, y); y += 24;
    }
    y += 14;
  }
  /* panel de imaxe: a cruz no mapa, soa — o bodegón mínimo */
  ctx.fillStyle = DIA_INK; ctx.fillRect(200, y + 6, 220, 130);
  const rr = _diaRng(cap.seed + 41);
  ctx.fillStyle = '#5d6b3c'; ctx.fillRect(204, y + 10, 212, 122);
  for(let i = 0; i < 90; i++){
    ctx.fillStyle = ['#556236', '#667542', '#4d5a30'][Math.floor(rr() * 3)];
    ctx.fillRect(204 + Math.floor(rr() * 212), y + 10 + Math.floor(rr() * 122), 2, 2);
  }
  ctx.strokeStyle = DIA_RED; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(300, y + 58); ctx.lineTo(320, y + 78); ctx.moveTo(300, y + 78); ctx.lineTo(320, y + 58); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = DIA_PENCIL; ctx.font = '11px "Courier New", monospace';
  ctx.fillText(TXT('dia.lendaLugar', {lugar: s.lugar || '—'}), 204, y + 152);
  ctx.fillStyle = DIA_PENCIL; ctx.font = '10px "Courier New", monospace';
  ctx.fillText(TXT('dia.paxina', {n: 2, de: 2}), 500, 862);
}

function _diaQuebrar(ctx, texto, ancho){
  const palabras = String(texto || '').split(' ');
  const out = []; let lin = '';
  for(const p of palabras){
    const proba = lin ? lin + ' ' + p : p;
    if(ctx.measureText(proba).width > ancho && lin){ out.push(lin); lin = p; }
    else lin = proba;
  }
  if(lin) out.push(lin);
  return out;
}

/* ---------- PICKER de textos (determinista, por condicións) ---------- */
function diaEscollerFragmentos(cap, parte){
  const s = cap.snapshot, r = _diaRng(cap.seed + 13 + (parte || 0) * 17);
  const pick = (base, n, extra) => TXT(base + '.' + Math.floor(r() * n),
    Object.assign({n: s.u && s.u.name || '', lugar: s.lugar || '',
      v: (s.vinculos && s.vinculos[0] && s.vinculos[0].name) || (s.veciños && s.veciños[0] && s.veciños[0].name) || '',
      d: (s.doadores && s.doadores[0]) || ''}, extra || {}));
  const frs = [];

  if(cap.gatillo === 'primeiraBaixa'){
    const reflexivo = s.op >= 6;
    frs.push(pick(reflexivo ? 'dia.pb.aper.r' : 'dia.pb.aper.s', 3));
    if(s.u.ops >= 3) frs.push(pick('dia.pb.vet', 3));
    else frs.push(pick('dia.pb.novato', 2));
    if(s.ultimaTransmision) frs.push(TXT('dia.pb.falou', {frase: s.ultimaTransmision}));
    if(s.vinculos && s.vinculos.length) frs.push(pick('dia.pb.vinculo', 2));
    frs.push(pick(s.restos === 'recuperados' ? 'dia.pb.restosSi' : 'dia.pb.restosNon', 2));
    /* destino real, se xa se resolveu (doazón/requisa) */
    if(s.destino === 'requisa') frs.push(pick('dia.pb.requisa', 2));
    frs.push(pick(reflexivo ? 'dia.pb.peche.r' : 'dia.pb.peche.s', 3));
    return frs;
  }

  if(cap.gatillo === 'reensamblado'){
    frs.push(pick('dia.re.aper', 3));
    frs.push(TXT('dia.re.doador', {n: s.u.name, d: (s.doadores || []).join(', ')}));
    frs.push(pick('dia.re.identidade', 3));
    frs.push(pick('dia.re.peche', 3));
    return frs;
  }

  if(cap.gatillo === 'finActo'){
    const E = s.eixos || {piedade: 0, pragmatismo: 0, apego: 0};
    if((parte || 0) === 0){
      frs.push(TXT('dia.fa.aper.' + s.actN));
      if(s.caidosN > 0) frs.push(TXT('dia.fa.caidos', {lista: (s.caidos || []).join(', '), total: s.caidosN}));
      else frs.push(TXT('dia.fa.senCaidos'));
      if(s.reensamblou) frs.push(pick('dia.fa.re', 2));
      frs.push(pick('dia.fa.ponte', 2));
    } else {
      /* A REFLEXIÓN: os eixos falan — Tuerca non xulga, pero as súas palabras cambian */
      const dominante = Math.abs(E.piedade) >= Math.abs(E.pragmatismo) && Math.abs(E.piedade) >= Math.abs(E.apego) ? 'piedade'
                      : Math.abs(E.pragmatismo) >= Math.abs(E.apego) ? 'pragmatismo' : 'apego';
      if(Math.abs(E[dominante]) >= 2){
        frs.push(TXT('dia.fa.' + dominante + '.' + (E[dominante] > 0 ? 'pos' : 'neg')));
      } else {
        frs.push(pick('dia.fa.neutro', 2));
      }
      frs.push(pick('dia.fa.memoria', 2));
      frs.push(TXT('dia.fa.peche.' + s.actN));
    }
    return frs;
  }
  return frs;
}
function diaEscollerNota(cap){
  const s = cap.snapshot, r = _diaRng(cap.seed + 29);
  return {
    corpo: TXT('dia.nota.corpo.' + Math.floor(r() * 3), {n: s.u.name}),
    remate: TXT('dia.nota.remate.' + Math.floor(r() * 3), {n: s.u.name}),
  };
}

/* ---------- LECTOR ---------- */
let _diaPax = 0, _diaCapAberto = null;
function diarioAbrir(){
  const D = diarioEnsure();
  if(!D.capitulos.length){ $('bioModal').style.display = 'none'; return; }
  let body = `<div class="small" style="margin-bottom:8px; color:var(--phos-dim);">${TXT('dia.subtitulo')}</div>`;
  D.capitulos.forEach((c, i) => {
    body += `<div class="dia-cap" data-i="${i}" style="cursor:pointer; padding:6px 4px; border-bottom:1px dotted #2a2200;">
      <span style="color:var(--gold);">${TXT('dia.operacionN', {n: String(c.snapshot.op).padStart(4, '0')})}</span>
      <i style="margin-left:10px;">${TXT('dia.tit.' + c.gatillo + '.' + (c.tituloIdx % 3))}</i>
      ${c.lido ? '' : '<span style="color:#ff5340; margin-left:8px;">●</span>'}
    </div>`;
  });
  $('bioTitle').innerHTML = '📖 ' + TXT('dia.arquivoTuerca');
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'block';
  $('bioBody').querySelectorAll('.dia-cap').forEach(el => el.onclick = () => diarioLerCapitulo(+el.dataset.i));
}
function diarioLerCapitulo(i){
  const D = diarioEnsure();
  const cap = D.capitulos[i];
  if(!cap) return;
  _diaCapAberto = cap; _diaPax = 0;
  cap.lido = true;
  if(typeof saveData === 'function') saveData();
  diarioBadge();
  $('bioBody').innerHTML = `
    <div style="text-align:center;">
      <canvas id="diaCanvas" width="${DIA_W}" height="${DIA_H}" style="max-width:100%; max-height:68vh; image-rendering:auto; border:1px solid #3a3520;"></canvas>
    </div>
    <div class="row" style="margin-top:8px; justify-content:center;">
      <button id="diaPrev">←</button>
      <span id="diaPaxLbl" class="small" style="align-self:center; margin:0 12px;"></span>
      <button id="diaNext">→</button>
      <button id="diaVolver" style="margin-left:20px;">${TXT('dia.volver')}</button>
    </div>`;
  const pintar = () => {
    const ctx = document.getElementById('diaCanvas').getContext('2d');
    if(_diaPax === 0 && cap.gatillo === 'primeiraBaixa') diaPaxInforme(ctx, cap);
    else if(_diaPax === 0 && cap.gatillo === 'reensamblado') diaPaxFicha(ctx, cap);
    else if(cap.gatillo === 'finActo') diaPaxProsa(ctx, cap, _diaPax);
    else diaPaxProsa(ctx, cap, 0);
    const l = document.getElementById('diaPaxLbl');
    if(l) l.textContent = TXT('dia.paxina', {n: _diaPax + 1, de: 2});
  };
  $('diaPrev').onclick = () => { if(_diaPax > 0){ _diaPax--; pintar(); } };
  $('diaNext').onclick = () => { if(_diaPax < 1){ _diaPax++; pintar(); } };
  $('diaVolver').onclick = diarioAbrir;
  pintar();
}

/* ---------- botón + insignia + aviso de dous botóns ---------- */
function diarioBadge(){
  const b = document.getElementById('btnDiario');
  if(!b) return;
  const D = DATA.diario;
  if(!D || !D.capitulos.length){ b.style.display = 'none'; return; }
  b.style.display = '';
  const novos = D.capitulos.filter(c => !c.lido).length;
  b.textContent = '📖 ' + TXT('dia.arquivo') + (novos ? ' ●' : '');
  b.style.color = novos ? '#ff5340' : '#c8a86a';
}
function diarioAviso(cap){
  diarioBadge();
  let t = document.getElementById('diaToast');
  if(!t){
    t = document.createElement('div');
    t.id = 'diaToast';
    t.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#12100a; border:1px solid #5a5230; padding:12px 16px; z-index:99; font-family:Courier New,monospace; color:#d8d0b8; max-width:320px;';
    document.body.appendChild(t);
  }
  t.innerHTML = `<div style="margin-bottom:8px;">${TXT('dia.avisoNovo')}</div>
    <button id="diaLer" style="color:#7fdc7f;">${TXT('dia.ler')}</button>
    <button id="diaDespois">${TXT('dia.maisTarde')}</button>`;
  t.style.display = 'block';
  document.getElementById('diaLer').onclick = () => { t.style.display = 'none'; diarioAbrir(); diarioLerCapitulo(DATA.diario.capitulos.length - 1); };
  document.getElementById('diaDespois').onclick = () => { t.style.display = 'none'; };
}
(function(){
  const b = document.getElementById('btnDiario');
  if(b) b.onclick = diarioAbrir;
  setTimeout(() => { try{ diarioBadge(); }catch(e){} }, 400);
})();
