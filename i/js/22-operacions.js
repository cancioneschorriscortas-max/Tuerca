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
  opColocarEscenario(g);

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
    /* Unha operación pode dicilo á súa maneira. Fai falla: o texto por
       defecto do RESCATE fala de achegar un ENGINEER, e na primeira
       misión da campaña non hai ENGINEER ningún — vas cun GRUNT só. */
    if(o.titulo) t[0] = o.titulo;
    if(o.desc !== undefined) t[1] = o.desc;
    g._sqOp = addSubquest(g, {
      tipo: 'OPERACION', x: cen.x, y: cen.y,
      titulo: t[0], desc: t[1],
      progress: 0, progressMax: o.tipo === 'DEFENSA' ? o.ata : o.n,
    });
  }

  /* (v1.06) SEN BARRA DE PRODUCIÓN.

     Isto era a queixa de fondo: a primeira pantalla da campaña ofrecía
     GRUNT, HEAVY, ENGINEER, SNIPER, TANQUE, BOMBARDERO e TORRETA. Nunha
     campaña iso contradí a idea mesma de campaña —as clases preséntanse
     unha por misión— e ademais aquí nin sequera fan nada, porque
     `g.prod` está a null. Sete botóns que non responden é peor ca non
     telos.

     Escóndese a barra enteira, non se desactivan os botóns: un botón
     apagado segue dicindo "isto existe e non podes", e o que hai que
     dicir é que non existe aínda. */
  try{
    const bar = document.getElementById('prodbar');
    if(bar){
      bar.dataset.gardado = bar.style.display || '';
      bar.style.display = 'none';
    }
  }catch(e){}

  if(OP.entrada && OP.entrada.length) opDialogo(OP.entrada);
  return OP;
}

/* Devólvea ao saír: o modo libre non se toca. */
function opRestaurarHUD(){
  try{
    const bar = document.getElementById('prodbar');
    if(bar && bar.dataset.gardado !== undefined){
      bar.style.display = bar.dataset.gardado || 'flex';
      delete bar.dataset.gardado;
    }
  }catch(e){}
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
      /* PERDIDA | ASUSTADA | ATRAPADA. Se non se di nada, quietas. */
      u.estadoInerte = (d.estados && d.estados[i]) || d.estado || 'PERDIDA';
      /* A que estaba intentando liberar a outra non ten arma: por iso
         non podía, e por iso levaba alí desde a explosión. */
      if(u.estadoInerte === 'AXUDANDO'){ u.senArma = true; u.estadoInerte = 'PERDIDA'; }
      u.name = (d.nomes && d.nomes[i]) || u.name;
      if(repar){ u.hp = Math.max(1, Math.round(u.max * 0.30)); }
      u.tx = u.x; u.ty = u.y; u.waypoints = [];
      g.units.push(u);
    }
  }
}

/* ============================================================
   OS TRES ESTADOS DUN DESCONECTADO.

   Un inerte que só agarda é unha caixa. Tres estados fan que pareza
   alguén, e cada un pide unha cousa distinta ao xogador:

     PERDIDA    quieta, mirando ao baleiro. Chegas e xa está.
     ASUSTADA   aléxase cando te achegas. NON SABE QUEN ES: leva sen
                conexión desde a explosión e todo o que ve é un
                descoñecido. Non abonda con atopala, hai que
                interceptala.
     ATRAPADA   non se move porque non pode. Hai que quitar o que ten
                enriba.

   E a regra que fai que a misión sexa unha bóla de neve: unha asustada
   DEIXA DE FUXIR se quen se achega é alguén que xa recuperaches. Ese
   xa é azul e móvese con intención. Os recuperados son os que
   recuperan, e iso é o tema do xogo dito só con movemento.
   ============================================================ */
const OP_MEDO_RADIO = 74;      /* a que distancia empeza a afastarse */
const OP_MEDO_PASO = 0.55;     /* devagar: fuxir non pode ser imposible */

function opTickMedo(g){
  if(!OP) return;
  const meus = g.units.filter(u => u.team === PT && !u.dead && !u.extraido);
  if(!meus.length) return;
  for(const u of g.units){
    if(!u.inerte || u.dead || u.estadoInerte !== 'ASUSTADA') continue;
    /* Quen se achega máis, e se é un recuperado non conta como ameaza. */
    let ameaza = null, dd = Infinity;
    for(const m of meus){
      if(m.recuperado) continue;               /* un dos seus: non asusta */
      const d = Math.hypot(m.x - u.x, m.y - u.y);
      if(d < dd){ dd = d; ameaza = m; }
    }
    if(!ameaza || dd > OP_MEDO_RADIO){ u._fuxindo = false; continue; }
    u._fuxindo = true;
    const dx = u.x - ameaza.x, dy = u.y - ameaza.y, d = Math.hypot(dx, dy) || 1;
    const nx = u.x + (dx/d) * OP_MEDO_PASO, ny = u.y + (dy/d) * OP_MEDO_PASO;
    /* Contra a parede non se atravesa nada: se non pode recuar, queda
       acurralada, que é exactamente como se colle. */
    if(typeof macizoEn === 'function' && macizoEn(nx, ny)){
      if(!macizoEn(nx, u.y)) u.x = nx;
      else if(!macizoEn(u.x, ny)) u.y = ny;
    } else { u.x = nx; u.y = ny; }
    u.x = clamp(u.x, 8, W-8); u.y = clamp(u.y, 8, H-8);
    u.tx = u.x; u.ty = u.y;
  }
}

/* Chámase desde o tick de unidades: un ENGINEER pegado a un inerte
   durante tres segundos érgueo. Tres segundos e non un instante porque
   ten que ser unha decisión que custe algo nun tiroteo.

   (v1.06) Nunha operación cunha soa unidade —a primeira da campaña— non
   hai ENGINEER, así que vale calquera: o que fai falla é chegar. Se hai
   enxeñeiros no campo, son eles e só eles. */
const OP_ACTIVAR_TICKS = 180;
function opTickInertes(g){
  if(!OP) return;
  const vivos = g.units.filter(u => u.team === PT && !u.dead && !u.extraido);
  const conEng = vivos.some(u => u.cls === 'ENGINEER');
  const engs = conEng ? vivos.filter(u => u.cls === 'ENGINEER') : vivos;
  for(const u of g.units){
    if(!u.inerte || u.dead) continue;
    /* Atrapada: mentres teña cascallos enriba non se pode erguer, por
       moito que esteas ao lado. Primeiro quítase o de riba. */
    if(u.estadoInerte === 'ATRAPADA' && typeof inWall === 'function' && inWall(g, u.x, u.y)){
      u._act = 0; continue;
    }
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

/* ============================================================
   ESCENARIO — restos que xa estaban aí.

   Un campo de restos non é un obxectivo: é unha resposta a unha
   pregunta que o xogador aínda non fixo. Non teñen reloxo, non teñen
   nome e non se recuperan. O único que fan é estar.

   Van na lista de `remains`, que xa sabe debuxar corpos renderizados,
   coa bandeira `escenario` para que non entren no reconto nin na conta
   atrás. Reutilizar iso é o que fai que non custe nada.
   ============================================================ */
function opColocarEscenario(g){
  const e = OP.escenario;
  if(!e || !e.restos) return;
  const ocos = opOcosDe(g, e.onde, e.restos);
  for(let i = 0; i < e.restos; i++){
    const p = ocos[i];
    if(!p) break;
    /* Sen unidade de verdade detrás: só o que fai falla para debuxalo.
       O equipo é o gris dos desconectados, non o teu nin o do rival —
       o xogador non sabe de quen eran, e ese é o punto. */
    g.remains.push({
      x: p.x + (i % 3) * 5 - 5, y: p.y + (i % 2) * 6 - 3,
      unit: {id: 'X-' + i, name: '', cls: (i % 3 === 0) ? 'HEAVY' : 'GRUNT', team: 2},
      timer: 1e9, secured: false, escenario: true, place: e.onde,
    });
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
  opTickMedo(g);
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

/* ============================================================
   A ORDE DE TRABALLO — a pantalla de antes de entrar.

   POR QUE NON É UN PANEL DE OBXECTIVOS. Unha pantalla que diga
   "OBXECTIVO: RESCATE — erguer 3 unidades" é a mecánica espida, e
   ademais non a di ninguén: ninguén fala así dentro do mundo. ÓPTIMA
   comunícase en formularios corteses e numerados, e ese é o disfrace
   que a mecánica precisa.

   Todo o que o xogador ten que saber para xogar está aquí, pero dito
   como o diría a empresa:

     · o que hai que facer     → o parágrafo da orde
     · a clase que fai falla   → "REQUISITO DE DOTACIÓN"
     · onde                    → "INSTALACIÓN"

   E debaixo, na marxe, unha liña escrita a man que di o mesmo desde o
   outro lado. As dúas voces do proxecto na mesma folla: iso é o que
   converte un panel de misión nunha escena.

   O TEXTO NON SE INVENTA AQUÍ. Cada operación trae o seu; se non o
   trae, sae un por defecto a partir do tipo de obxectivo para que
   ningunha quede sen orde.
   ============================================================ */
function opOrdePorDefecto(op){
  const o = op.obxectivo || {};
  const n = o.n || 0;
  const base = {
    RESCATE: {
      clase: TXT('op.cl.rescate'),
      corpo: TXT('op.or.rescate', {n}),
      requisito: 'ENGINEER',
      nota: TXT('op.no.rescate'),
    },
    REPARACION: {
      clase: TXT('op.cl.reparacion'),
      corpo: TXT('op.or.reparacion', {n}),
      requisito: 'ENGINEER',
      nota: TXT('op.no.reparacion'),
    },
    EXTRACCION: {
      clase: TXT('op.cl.extraccion'),
      corpo: TXT('op.or.extraccion', {n}),
      requisito: null,
      nota: TXT('op.no.extraccion'),
    },
    SABOTAXE: {
      clase: TXT('op.cl.sabotaxe'),
      corpo: TXT('op.or.sabotaxe', {n}),
      requisito: null,
      nota: TXT('op.no.sabotaxe'),
    },
    DEFENSA: {
      clase: TXT('op.cl.defensa'),
      corpo: TXT('op.or.defensa', {m: Math.round((o.ata || 3600) / 60)}),
      requisito: null,
      nota: TXT('op.no.defensa'),
    },
  }[o.tipo];
  return base || {clase: '—', corpo: '', requisito: null, nota: null};
}

/* Referencia do expediente. Non é aleatoria: sae do id da operación, así
   que a mesma operación leva sempre o mesmo número e o xogador pode
   recoñecelo se volve aparecer nun informe. */
function opReferencia(op){
  let h = 0;
  for(const c of String(op.id || 'op')) h = ((h << 5) - h + c.charCodeAt(0)) >>> 0;
  return 'T-' + (1000 + (h % 8999)) + '/' + 'ABCDEFGH'[h % 8];
}

let _opOrde = null;
function opCaixaOrde(){
  if(_opOrde) return _opOrde;
  _opOrde = document.createElement('div');
  _opOrde.id = 'opOrde';
  _opOrde.style.cssText = 'position:fixed; inset:0; z-index:70; display:none;' +
    'background:rgba(4,5,7,0.94); align-items:center; justify-content:center; font-family:Courier New;';
  document.body.appendChild(_opOrde);
  return _opOrde;
}

function opOrdeDeTraballo(op, remate){
  const cx = opCaixaOrde();
  const d = Object.assign(opOrdePorDefecto(op), op.orde || {});
  const planta = (typeof PLANTAS !== 'undefined' && PLANTAS[op.planta]) ? PLANTAS[op.planta] : null;
  /* Sen artigo: un campo de formulario leva o NOME, non a frase. En
     radio dise "caeu na Nave Principal"; nun impreso pon "Nave
     Principal", e a diferenza nótase. */
  const senArtigo = (t) => String(t || '').replace(/^(a|o|as|os|el|la|los|las|the)\s+/i, '');
  const lugar = senArtigo(planta && planta.lugares && planta.lugares[0]
    ? planta.lugares[0].label : (op.planta || ''));
  const fila = (k, v) => v ? `<div style="display:flex; gap:14px; margin:3px 0;">
      <span style="color:#6a6a60; min-width:170px;">${k}</span>
      <span style="color:#d8d5c8;">${v}</span></div>` : '';

  cx.innerHTML = `
   <div style="max-width:720px; width:88%; border:1px solid #6a5a2a; background:rgba(12,12,10,0.96); padding:26px 30px;">
     <div style="color:#8a7a40; font-size:10px; letter-spacing:3px;">${TXT('op.or.cabeceira')}</div>
     <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #3a3428; padding-bottom:10px; margin-bottom:14px;">
       <span style="color:#e8c060; font-size:17px; letter-spacing:2px;">${TXT('op.or.titulo')}</span>
       <span style="color:#8a7a40; font-size:12px;">${opReferencia(op)}</span>
     </div>
     ${fila(TXT('op.or.instalacion'), lugar)}
     ${fila(TXT('op.or.clasificacion'), d.clase)}
     ${fila(TXT('op.or.dotacion'), d.dotacion || TXT('op.or.dotacionLibre'))}
     <div style="color:#d8d5c8; font-size:15px; line-height:1.65; margin:18px 0 14px; padding-left:14px; border-left:2px solid #3a3428;">
       ${String(d.corpo || '').split('\n').filter(l => l.trim()).map(l => `<p style="margin:0 0 8px;">${l.trim()}</p>`).join('')}
     </div>
     ${d.requisito ? fila(TXT('op.or.requisito'), d.requisito) : ''}
     <div style="color:#6a6a60; font-size:12px; margin-top:12px;">${TXT('op.or.peche')}</div>
     ${d.nota ? `<div style="margin-top:20px; padding-top:14px; border-top:1px dashed #3a3428;
        color:#7fdc7f; font-size:14px; font-style:italic;">${d.nota}</div>` : ''}
     <div class="row" style="margin-top:24px; justify-content:flex-end;">
       <button id="opOrdeOk" class="bio-btn" style="color:#e8c060; border-color:#e8c060;">${TXT('op.or.aceptar')}</button>
     </div>
   </div>`;
  cx.style.display = 'flex';

  const pechar = () => {
    cx.style.display = 'none';
    document.removeEventListener('keydown', tecla);
    if(remate) remate();
  };
  const tecla = (e) => { if(e.key === 'Enter' || e.key === ' ' || e.key === 'Escape'){ e.preventDefault(); pechar(); } };
  document.addEventListener('keydown', tecla);
  const b = cx.querySelector('#opOrdeOk');
  if(b) b.onclick = pechar;
  try{ if(typeof sfx === 'function') sfx('radio_open'); }catch(e){}
}

/* Limpeza ao saír da batalla: sen isto, unha operación abortada deixaba
   a caixa aberta e o xogo pausado no hangar. */
function opLimpar(){
  OP = null;
  window._opPausa = false;
  opRestaurarHUD();
  if(_opCaixa) _opCaixa.style.display = 'none';
  if(_opOrde) _opOrde.style.display = 'none';
}
