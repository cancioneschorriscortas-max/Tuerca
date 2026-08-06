/* ============================================================
   OPERACIÓNS — a campaña non é unha escaramuza.

   O modo libre de TUERCA é unha escaramuza: dúas bases, produción, e
   gaña quen tire a do outro. Iso está ben e non se toca. A campaña é
   outra cousa: son ENTRADAS EN INSTALACIÓNS de ÓPTIMA, e dentro dunha
   instalación non hai unha segunda base que derrubar. Hai algo que
   sacar, alguén que erguer, ou algo que parar.

   Isto é o que fai viables esas mecánicas. Cinco decisións, e as cinco
   son o contrario do que fai o modo libre:

   1. SEN BASE INIMIGA. Nin a do rival nin, para o caso, a propia como
      condición: `g.hq` segue existindo porque medio motor usa as súas
      coordenadas para saber por onde entra a xente, pero queda oculto,
      invulnerable e fóra do resultado.
   2. SEN PRODUCIÓN. `g.prod` a null e o temporizador da IA apagado. O
      inimigo é unha GARNICIÓN: está a que está, e cada un que cae xa
      non volve. A operación baixa de intensidade segundo avanza, ao
      revés que unha escaramuza, e iso é o que se quere.
   3. SEN RADAR e sen sectores. Nunha nave non hai unha cúpula de radar
      no medio, e círculos de captura nunha misión de rescate son ruído:
      o xogador le que hai algo que capturar e non o hai.
   4. A CONDICIÓN DE VITORIA É O OBXECTIVO. Non hai unha por defecto coa
      que comparar; cada operación declara a súa e o motor pregúntalla.
   5. OS DIÁLOGOS PARAN A IMAXE. Se unha liña importa, non pode pasar
      por riba dun tiroteo: párase a simulación, dise, e séguese.

   COMO SE DECLARA UNHA OPERACIÓN. Déixase en `window._operacion` antes
   de arrancar a batalla, coa mesma idea de "pídese, non se impón" que xa
   usan o bioma e a planta:

     window._operacion = {
       id: 'op4', planta: 'DOCA',
       obxectivo: {tipo:'RESCATE', n:3},
       garnicion: [{cls:'GRUNT', n:4, onde:'DEPENDENCIAS'}],
       inertes:   [{n:3, onde:'DEPENDENCIAS', cls:'GRUNT'}],
       saida:     'ESPINA',
       entrada:   [{voz:'HQ', txt:'Recuperación de material.'}],
       gatillos: [
         {cando:'rescatados:1', facer:[{dicir:'TUERCA', txt:'Levan aquí desde antes de que eu chegase.'}]},
         {cando:'tras:180',     facer:[{aparecer:{cls:'GRUNT', n:2, onde:'ESPINA'}}]},
       ],
     };
   ============================================================ */

let OP = null;          /* a operación en curso, ou null */

/* ---------- Condicións de vitoria ----------
   Cada unha coa mesma forma. A da BASE queda aquí tamén, e iso é o
   arranxo de fondo: deixa de ser "a regra do xogo" escrita dentro de
   tickEnd e pasa a ser unha máis da lista, a que usa o modo libre. */
const OP_CONDICIONS = {
  RESCATE:    (g, o) => (g.rescatados || 0) >= o.n,
  REPARACION: (g, o) => (g.reparados  || 0) >= o.n,
  EXTRACCION: (g, o) => (g.extraidos  || 0) >= o.n,
  SABOTAXE:   (g, o) => (g.sabotados  || 0) >= o.n,
  DEFENSA:    (g, o) => g.t >= (o.ata || 3600),
};

function opActiva(){ return OP; }

/* ============================================================
   ARRANQUE
   ============================================================ */
function opIniciar(g){
  OP = window._operacion || null;
  window._operacion = null;
  if(!OP) return null;

  g.operacion = OP;
  g.obxectivo = OP.obxectivo || {tipo: 'DEFENSA', ata: 3600};
  g.rescatados = 0; g.reparados = 0; g.extraidos = 0; g.sabotados = 0;
  g.senBases = true;
  g.modo = 'campana';

  /* --- Nada de bases, produción nin radar --- */
  for(const h of g.hq){ h.oculto = true; h.hp = 1e9; h.max = 1e9; }
  g.prod = [null, null];
  g.aiTimer = 1e9;
  g.turretPending = 0;
  if(g.radar) g.radar.oculto = true;
  g.sectors = [];
  g.turrets = []; g.vehicles = [];

  opColocarInertes(g);
  opColocarGarnicion(g);
  opColocarSabotaxes(g);

  /* Estado dos gatillos: cada un dispara UNHA vez. */
  g._gatillos = (OP.gatillos || []).map(t => ({...t, feito: false}));

  /* O OBXECTIVO TEN QUE VERSE. Sen isto o xogador entra, oe unha liña e
     xa non ten onde mirar para saber que lle piden nin canto leva. Usa
     o panel de misións secundarias, que xa existe e xa sabe amosar
     título, descrición e progreso. */
  if(typeof addSubquest === 'function'){
    const o = g.obxectivo;
    const cen = {x: W/2, y: H/2};
    const t = {
      RESCATE:    ['◈ ' + (TXT('op.obx.rescate')    || 'Erguer os que quedaron'), TXT('op.obx.rescateD')    || 'Achega un ENGINEER e mantelo ao lado'],
      REPARACION: ['◈ ' + (TXT('op.obx.reparacion') || 'Poñer en pé o material'),  TXT('op.obx.reparacionD') || 'Achega un ENGINEER e mantelo ao lado'],
      EXTRACCION: ['◈ ' + (TXT('op.obx.extraccion') || 'Sacalos de aquí'),         TXT('op.obx.extraccionD') || 'Lévaos ao punto de saída'],
      SABOTAXE:   ['◈ ' + (TXT('op.obx.sabotaxe')   || 'Parar a instalación'),     TXT('op.obx.sabotaxeD')   || 'Tira as estruturas marcadas'],
      DEFENSA:    ['◈ ' + (TXT('op.obx.defensa')    || 'Aguantar'),                TXT('op.obx.defensaD')    || 'Non hai nada que capturar'],
    }[o.tipo] || ['◈ Operación', ''];
    g._sqOp = addSubquest(g, {
      tipo: 'OPERACION', x: cen.x, y: cen.y,
      titulo: t[0], desc: t[1],
      progress: 0, progressMax: o.tipo === 'DEFENSA' ? o.ata : o.n,
    });
  }

  if(OP.entrada && OP.entrada.length) opDialogo(OP.entrada);
  return OP;
}

/* ---------- Onde cae a xente ----------
   `onde` é o id dun lugar da planta (NAVE, ESPINA, DEPENDENCIAS). Sen
   lugar válido, cae nun oco calquera de chan libre. */
function opOcosDe(g, onde, cantos){
  const grid = window._terrainGrid;
  const out = [];
  if(!grid) return out;
  const lugar = (typeof PLACES !== 'undefined' && PLACES)
    ? PLACES.find(p => p.id === onde) : null;
  const libres = [];
  for(let y = 1; y < ROWS - 1; y++){
    for(let x = 1; x < COLS - 1; x++){
      const t = grid[y][x];
      if(t !== T.ROAD && t !== T.RUBBLE && t !== T.BRIDGE) continue;
      const px = x*TILE_SIZE + 8, py = y*TILE_SIZE + 8;
      if(lugar && Math.hypot(px - lugar.x, py - lugar.y) > lugar.r) continue;
      libres.push({x: px, y: py});
    }
  }
  if(!libres.length) return out;
  /* Repartidos, non amoreados: colle un de cada N. */
  const paso = Math.max(1, Math.floor(libres.length / cantos));
  for(let i = 0; i < cantos; i++) out.push(libres[(i * paso + (i * 7)) % libres.length]);
  return out;
}

/* ============================================================
   INERTES — o corazón de RESCATE e REPARACIÓN.

   Unha unidade que non se move e non dispara ata que alguén a ergue.
   Non é un sistema novo: é `mkUnit` cunha bandeira, e o tick de
   unidades sáltaas. Ao activarse cambia de equipo e xa é túa de
   verdade: ten nome, entra no roster ao rematar, e pode morrer.

   A diferenza entre as dúas caras é o estado no que esperta:
     RESCATE     sae enteira.
     REPARACIÓN  sae ao 30% e hai que curala para que sirva.
   ============================================================ */
function opColocarInertes(g){
  const defs = OP.inertes || [];
  const repar = (g.obxectivo.tipo === 'REPARACION');
  for(const d of defs){
    const ocos = opOcosDe(g, d.onde, d.n);
    for(let i = 0; i < d.n; i++){
      const o = ocos[i] || ocos[0];
      if(!o) break;
      const u = mkUnit(2, d.cls || 'GRUNT', o.x, o.y, null);
      u.inerte = true;
      u.tipoInerte = repar ? 'REPARACION' : 'RESCATE';
      u.name = (d.nomes && d.nomes[i]) || u.name;
      if(repar){ u.hp = Math.max(1, Math.round(u.max * 0.30)); }
      u.tx = u.x; u.ty = u.y; u.waypoints = [];
      g.units.push(u);
    }
  }
}

/* Chámase desde o tick de unidades: un ENGINEER pegado a un inerte
   durante tres segundos érgueo. Tres segundos e non un instante porque
   ten que ser unha decisión que custe algo nun tiroteo. */
const OP_ACTIVAR_TICKS = 180;
function opTickInertes(g){
  if(!OP) return;
  const engs = g.units.filter(u => u.team === PT && !u.dead && u.cls === 'ENGINEER');
  for(const u of g.units){
    if(!u.inerte || u.dead) continue;
    const cerca = engs.some(e => Math.hypot(e.x - u.x, e.y - u.y) < 22);
    if(!cerca){ u._act = 0; continue; }
    u._act = (u._act || 0) + 1;
    if(u._act < OP_ACTIVAR_TICKS) continue;
    /* Erguida. */
    u.inerte = false; u._act = 0;
    u.team = PT;
    u.recuperado = true;
    if(u.tipoInerte === 'REPARACION') g.reparados++;
    else g.rescatados++;
    try{
      radio(TXT('op.erguido', {n: u.name}) || ('▲ ' + u.name + ' en pé.'), '#7fdc7f', {x: u.x, y: u.y});
      sfx('order_confirm');
    }catch(e){}
    opDisparar(g, u.tipoInerte === 'REPARACION' ? 'reparados' : 'rescatados');
  }
}

/* ============================================================
   GARNICIÓN — o inimigo dunha operación.

   Non produce e non se reforza soa. O que chegue despois chega porque
   o pon un gatillo, e iso é o que permite escribir un guión sobre unha
   planta: cunha IA que fabrica, a mesma planta xógase igual sempre.
   ============================================================ */
function opColocarGarnicion(g){
  for(const d of (OP.garnicion || [])){
    const ocos = opOcosDe(g, d.onde, d.n);
    for(let i = 0; i < d.n; i++){
      const o = ocos[i] || ocos[0];
      if(!o) break;
      const s = (typeof saírDoMacizo === 'function') ? saírDoMacizo(o.x, o.y) : o;
      const u = mkUnit(ET, d.cls || 'GRUNT', s.x, s.y, null);
      u.garnicion = true;
      g.units.push(u);
    }
  }
}

/* ============================================================
   SABOTAXE — algo que parar, non alguén a quen gañar.

   Reutiliza os muros: un obxectivo de sabotaxe é un muro con bandeira,
   así que herda o dano, o marcado como branco e o debuxo sen escribir
   nada novo. Ao caer, conta.
   ============================================================ */
function opColocarSabotaxes(g){
  const o = g.obxectivo;
  if(o.tipo !== 'SABOTAXE') return;
  const ocos = opOcosDe(g, o.onde, o.n);
  g.walls = g.walls || [];
  for(let i = 0; i < o.n; i++){
    const p = ocos[i];
    if(!p) break;
    g.walls.push({x: p.x, y: p.y, hp: 320, max: 320, destroyed: false,
                  tabique: true, sabotaxe: true, etiqueta: (o.etiquetas && o.etiquetas[i]) || null});
  }
}

/* Chámase cando cae un muro. */
function opSabotado(g, w){
  if(!OP || !w.sabotaxe) return;
  g.sabotados = (g.sabotados || 0) + 1;
  opDisparar(g, 'sabotado');
}

/* ============================================================
   EXTRACCIÓN — sacar de alí.

   O punto de saída é un lugar con nome da planta. Unha unidade propia
   que entra nel retírase do mapa e conta. Non morre: SAE, que é
   exactamente o contrario, e é a distinción na que se sostén a
   operación final da campaña.
   ============================================================ */
function opTickExtraccion(g){
  if(!OP || g.obxectivo.tipo !== 'EXTRACCION') return;
  const saida = (typeof PLACES !== 'undefined' && PLACES)
    ? PLACES.find(p => p.id === (OP.saida || 'ESPINA')) : null;
  if(!saida) return;
  for(const u of g.units){
    if(u.dead || u.extraido || u.team !== PT) continue;
    if(OP.saeSo && u.id !== OP.saeSo) continue;
    if(Math.hypot(u.x - saida.x, u.y - saida.y) > Math.min(saida.r, 70)) continue;
    u.extraido = true; u.inside = null;
    g.extraidos = (g.extraidos || 0) + 1;
    try{
      radio(TXT('op.extraido', {n: u.name}) || ('◄ ' + u.name + ' fóra.'), '#7fdc7f');
      sfx('radio_open');
    }catch(e){}
    opDisparar(g, 'extraidos');
  }
}

/* ============================================================
   GATILLOS
   ============================================================ */
function opAvaliarCando(g, cando){
  const [que, arg] = String(cando).split(':');
  const n = Number(arg);
  switch(que){
    case 'aoEmpezar':   return true;
    case 'tras':        return g.t >= n * 60;
    case 'rescatados':  return (g.rescatados || 0) >= n;
    case 'reparados':   return (g.reparados  || 0) >= n;
    case 'extraidos':   return (g.extraidos  || 0) >= n;
    case 'sabotado':    return (g.sabotados  || 0) >= n;
    case 'baixaPropia': return g.units.filter(u => u.team === PT && u.dead).length >= n;
    case 'baixaInimiga':return g.units.filter(u => u.team !== PT && u.dead).length >= n;
    case 'vivosPropios<': return g.units.filter(u => u.team === PT && !u.dead && !u.extraido).length < n;
    case 'unidadeEn': {
      const l = (typeof PLACES !== 'undefined' && PLACES) ? PLACES.find(p => p.id === arg) : null;
      if(!l) return false;
      return g.units.some(u => u.team === PT && !u.dead && Math.hypot(u.x - l.x, u.y - l.y) < l.r);
    }
    default: return false;
  }
}

function opFacer(g, accions){
  for(const a of accions || []){
    if(a.dicir) opDialogo([{voz: a.dicir, txt: a.txt}]);
    if(a.radio) try{ radio(a.radio, a.cor || '#c8a86a'); }catch(e){}
    if(a.aparecer){
      const d = a.aparecer;
      const ocos = opOcosDe(g, d.onde, d.n || 1);
      for(let i = 0; i < (d.n || 1); i++){
        const o = ocos[i] || ocos[0];
        if(!o) break;
        const s = (typeof saírDoMacizo === 'function') ? saírDoMacizo(o.x, o.y) : o;
        const u = mkUnit(d.bando === 'ALIADO' ? PT : ET, d.cls || 'GRUNT', s.x, s.y, null);
        u.garnicion = true;
        g.units.push(u);
      }
    }
    if(a.rematar){ g.over = true; g.result = a.rematar; }
  }
}

/* Dispárase por nome de contador, para as accións inmediatas. */
function opDisparar(g, _que){ /* o tick xa revisa todos os gatillos */ }

function opTick(g){
  if(!OP) return;
  opTickInertes(g);
  opTickExtraccion(g);
  /* Progreso no panel: sen isto o obxectivo amósase pero non se move,
     que é peor ca non amosalo. */
  if(g._sqOp){
    const o = g.obxectivo;
    g._sqOp.progress = o.tipo === 'DEFENSA' ? g.t
      : o.tipo === 'RESCATE' ? (g.rescatados || 0)
      : o.tipo === 'REPARACION' ? (g.reparados || 0)
      : o.tipo === 'EXTRACCION' ? (g.extraidos || 0)
      : (g.sabotados || 0);
  }
  for(const t of g._gatillos || []){
    if(t.feito) continue;
    let vale = false;
    try{ vale = opAvaliarCando(g, t.cando); }catch(e){ vale = false; }
    if(!vale) continue;
    t.feito = true;
    try{ opFacer(g, t.facer); }catch(e){ console.error('[operacion]', e); }
  }
}

/* Devolve 'victory' | 'defeat' | null. Chámase desde tickEnd. */
function opResultado(g){
  if(!OP) return null;
  const cond = OP_CONDICIONS[g.obxectivo.tipo];
  if(cond && cond(g, g.obxectivo)) return 'victory';
  /* A derrota é quedar sen ninguén. Nunha operación de extracción, quen
     xa saíu NON conta como vivo nin como perdido: xa non está. */
  const vivos = g.units.filter(u => u.team === PT && !u.dead && !u.extraido).length;
  if(vivos === 0) return 'defeat';
  if(g.obxectivo.perdeSeT && g.t >= g.obxectivo.perdeSeT) return 'defeat';
  return null;
}

/* ============================================================
   DIÁLOGO — PARA A IMAXE.

   Unha liña que importa non pode pasar polo canal de radio mentres hai
   un tiroteo: perdéase. Aquí párase a simulación (o bucle consúltao),
   dise, e séguese. É a diferenza entre unha liña de ambiente e unha
   escena.

   Constrúese en JS e non en index.html a propósito: así non hai que
   tocar o markup nin a folla de estilos para engadir unha operación.
   ============================================================ */
let _opCaixa = null;
function opCaixaDialogo(){
  if(_opCaixa) return _opCaixa;
  _opCaixa = document.createElement('div');
  _opCaixa.id = 'opDialogo';
  _opCaixa.style.cssText = 'position:fixed; left:0; right:0; bottom:0; z-index:60; display:none;' +
    'background:linear-gradient(to top, rgba(6,8,10,0.97), rgba(6,8,10,0.90));' +
    'border-top:2px solid #6a5a2a; padding:16px 22px; font-family:Courier New;';
  _opCaixa.innerHTML =
    '<div id="opVoz" style="color:#e8c060; font-size:12px; letter-spacing:2px; margin-bottom:6px;"></div>' +
    '<div id="opTxt" style="color:#d8d5c8; font-size:15px; line-height:1.5; max-width:900px;"></div>' +
    '<div style="color:#6a6a60; font-size:11px; margin-top:10px;">— espazo ou clic para seguir —</div>';
  document.body.appendChild(_opCaixa);
  return _opCaixa;
}

/* As dúas voces do proxecto, e as de escena. ÓPTIMA sempre cortés. */
const OP_VOCES = {
  HQ:         {nome: 'ÓPTIMA', cor: '#e8c060'},
  OPTIMA:     {nome: 'ÓPTIMA', cor: '#e8c060'},
  TUERCA:     {nome: 'TUERCA', cor: '#7fdc7f'},
  VOLT:       {nome: 'VOLT',   cor: '#ff5340'},
  SUPERVISOR: {nome: 'O SUPERVISOR', cor: '#b0b0a0'},
  CANTINA:    {nome: '',       cor: '#b0b0a0'},
};

function opDialogo(liñas, remate){
  const cx = opCaixaDialogo();
  const fila = (liñas || []).slice();
  if(!fila.length){ if(remate) remate(); return; }
  window._opPausa = true;
  const seguinte = () => {
    const l = fila.shift();
    if(!l){
      cx.style.display = 'none';
      window._opPausa = false;
      document.removeEventListener('keydown', tecla);
      cx.onclick = null;
      if(remate) remate();
      return;
    }
    const v = OP_VOCES[l.voz] || {nome: l.voz || '', cor: '#d8d5c8'};
    const dv = cx.querySelector('#opVoz'), dt = cx.querySelector('#opTxt');
    dv.textContent = v.nome; dv.style.color = v.cor;
    dt.textContent = l.txt || '';
    cx.style.display = 'block';
    try{ if(typeof sfxT === 'function') sfxT('voice_blip', 120, l.voz); }catch(e){}
  };
  const tecla = (e) => { if(e.key === ' ' || e.key === 'Enter' || e.key === 'Escape'){ e.preventDefault(); seguinte(); } };
  document.addEventListener('keydown', tecla);
  cx.onclick = seguinte;
  seguinte();
}

/* Limpeza ao saír da batalla: sen isto, unha operación abortada deixaba
   a caixa aberta e o xogo pausado no hangar. */
function opLimpar(){
  OP = null;
  window._opPausa = false;
  if(_opCaixa) _opCaixa.style.display = 'none';
}
