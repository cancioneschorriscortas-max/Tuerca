/* ============================================================
   ECONOMÍA DE CHATARRA (v0.12) — "Todo é chatarra"
   ============================================================ */
const CHATARRA_VALUES = {
  GRUNT: 5, HEAVY: 10, ENGINEER: 8,   /* unidades */
  torreta: 15, jeep: 12,               /* estructuras */
  HQ: 60,                              /* o premio gordo, ao gañar */
};

/* Catálogo de melloras (v0.12) — tipo TALLER, recomprables */
const EQUIPOS = {
  mochila:  {label:'Mochila lixeira',      grupo:'MOBILIDADE', prezo:45, desc:'+15% velocidade'},
  blindaxe: {label:'Blindaxe reforzada',   grupo:'DEFENSA',    prezo:60, desc:'+20% HP máximo'},
  kit:      {label:'Kit autorreparación',  grupo:'ENXEÑERÍA',  prezo:55, desc:'Rexenera fóra de combate'},
  mira:     {label:'Mira telescópica',     grupo:'SENSORES',   prezo:50, desc:'+20% rango'},
  gancho:   {label:'Gancho de remolque',   grupo:'ENXEÑERÍA',  prezo:40, desc:'Recollida a máis distancia', soCls:'ENGINEER'},
};

function addShake(g, n){ g.shake = Math.min(9, (g.shake || 0) + n); }

function dropScrap(g, x, y, amount){
  if(!g.scrap) g.scrap = [];
  if(amount >= 5 && amount < 12) sfxT('expl_unit', 120);   /* morte de unidade */
  /* (v0.25) explosión visible */
  if(amount >= 3){
    g.booms = g.booms || [];
    g.booms.push({x, y, t: 14, big: amount >= 12});
    if(amount >= 12){
      addShake(g, 4);
      if(!inWater(x, y)){
        g.craters = g.craters || [];
        g.craters.push({x, y, r: 12});
        if(g.craters.length > 40) g.craters.shift();
      }
    }
  }
  g.scrap.push({x: x + (rnd()*16-8), y: y + (rnd()*16-8),
                amount, timer: 90*60, collected: false});
}

/* ============================================================
   MUROS DESTRUÍBLES (v0.13) — portas, non labirintos
   ============================================================ */
const WALL_HP = 150;
function buildWallsFromMap(){
  const out = [];
  const defs = (CURRENT_MAP && CURRENT_MAP.WALLS) || [];
  for(const w of defs){
    for(let y = w.yStart; y < w.yEnd; y += 16){
      out.push({x: w.x + 8, y: y + 8, hp: WALL_HP, max: WALL_HP, destroyed: false});
    }
  }
  return out;
}
/* (v1.01) MUROS DUNHA PLANTA DE INTERIOR — SÓ OS QUE SE PODEN ABRIR.

   Ata v1.00 aquí xerábase a CORTIZA do formigón: todos os bloques
   macizos que tocan chan, 419 na NAVE. Parecía un aforro fronte aos
   1.236 bloques, e traía tres problemas á vez:

   · O FORMIGÓN ERA DESTRUÍBLE. E aquí non hai pathfinding: unha unidade
     cun muro diante párase e dispáralle ata tiralo (o `_blockingWall`
     de máis abaixo). Así que o escuadrón non rodeaba o edificio,
     perforábao. Medido nunha corrida de proba: aos 4000 pasos, 7 de 13
     unidades vivas estaban DENTRO do formigón.
   · A cortiza é só a pel: unha vez dentro da masa xa non había
     colisión ningunha e camiñaban por onde quixesen.
   · inWall percorre a lista enteira, por unidade e por paso.

   Agora o formigón non é unha lista de obxectos: é a grella, e
   pregúntaselle con macizoEn() en O(1). Non se derruba, porque é a
   estrutura do edificio. Esta lista queda para o que SI se abre —o
   TABIQUE—, que se pinta noutro material precisamente para que se vexa
   cal é cal. */
function buildInteriorWalls(grid){
  if(!grid || !grid.length) return [];
  const out = [];
  for(let y = 0; y < grid.length; y++){
    for(let x = 0; x < grid[y].length; x++){
      if(grid[y][x] !== T.DIRT) continue;
      out.push({x: x*TILE_SIZE + 8, y: y*TILE_SIZE + 8, tabique: true,
                hp: WALL_HP, max: WALL_HP, destroyed: false});
    }
  }
  return out;
}

/* ============================================================
   COBERTURA (v0.22) — parapeto real: un muro entre ti e o tirador
   = -25% de dano. O BOMBARDERO ignóraa (explosivos).
   ============================================================ */
function enCobertura(alvo, tirador, g){
  if(!tirador || tirador.cls === 'BOMBARDERO') return false;
  const dx = tirador.x - alvo.x, dy = tirador.y - alvo.y;
  const d = Math.hypot(dx, dy) || 1;
  const px = alvo.x + (dx/d)*14, py = alvo.y + (dy/d)*14;
  if(inWall(g, px, py)) return true;
  /* (v1.01) Nun interior o parapeto normal non é un tabique: é a
     esquina do formigón. Sen isto, cubrirse detrás dun machón non
     contaba e a cobertura só existía onde había tabique. */
  if(typeof macizoEn === 'function' && macizoEn(px, py)) return true;
  /* (v0.26) parapetado no bordo dun cráter */
  if(g.craters){
    for(const cr of g.craters){
      if(Math.hypot(alvo.x - cr.x, alvo.y - cr.y) < cr.r + 4) return true;
    }
  }
  return false;
}

function inWall(g, x, y){
  if(!g || !g.walls) return null;
  for(const w of g.walls){
    if(w.destroyed) continue;
    if(Math.abs(x - w.x) < 10 && Math.abs(y - w.y) < 10) return w;
  }
  return null;
}
function damageWall(g, w, dmg){
  if(w.destroyed) return;
  w.hp -= dmg;
  sfxT('wall_hit', 120);
  if(w.hp <= 0){
    w.destroyed = true;
    sfxT('wall_break', 200); addShake(g, 1.8);
    /* (v1.01) Nun interior o tabique tamén está pintado na caché do
       terreo: sen abrilo alí, quitábase a colisión e quedaba a parede
       debuxada. Un paso invisible é peor ca non ter paso. */
    if(w.tabique && typeof abrirTabique === 'function') abrirTabique(w);
    if(w.sabotaxe && typeof opSabotado === 'function') opSabotado(g, w);
    dropScrap(g, w.x, w.y, 3);
    if(!g._wallMsgT || g.t - g._wallMsgT > 120){
      radio(TXT('r.muroDerribado'), '#c8a86a', {x:w.x, y:w.y});
      g._wallMsgT = g.t;
    }
  }
}

/* ============================================================
   ALARMA DE BASE (v0.13) — aviso claro cando atacan o HQ azul
   ============================================================ */
function playAlarm(){
  try{
    if(typeof audioCtx === 'undefined' || !audioCtx) return;
    if(audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    for(let i=0; i<3; i++){
      const o = audioCtx.createOscillator(), ga = audioCtx.createGain();
      o.type = 'square';
      const t0 = audioCtx.currentTime + i*0.38;
      o.frequency.setValueAtTime(880, t0);
      o.frequency.setValueAtTime(590, t0 + 0.18);
      ga.gain.setValueAtTime(0.10, t0);
      ga.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
      o.connect(ga); ga.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + 0.36);
    }
  }catch(e){}
}
function tickBaseAlarm(g){
  const hq = g.hq[PT];
  if(!hq.lastDamageT) return;
  const recente = g.t - hq.lastDamageT < 60*3;
  if(recente && (!g._alarmT || g.t - g._alarmT > 60*6)){
    g._alarmT = g.t;
    radio(TXT('r.baseAtaque'), '#ff5340', {x: hq.x + hq.w/2, y: hq.y + hq.h/2});
    if(typeof vozMando === 'function') vozMando('r.baseAtaque', TXT('r.baseAtaque'));   /* (v0.63) */
    playAlarm();
    /* (v0.79) o aviso xa vai pola liña de arriba con vozMando('r.baseAtaque') */
  }
}

/* (v0.11) Estado da formación: tecla F alterna ON/OFF */
let formacionAtiva = true;

/* ============================================================
   CHÁCHARA DE GRUPO (v0.21) — as unidades falan ENTRE ELAS.
   Intercambios de 2-3 liñas con roles por personalidade/estado.
   O motor é o contido: engadir liñas aquí é engadir vida.
   f = filtro do rol: {p:personalidade, e:estado, cls:clase}
   ============================================================ */
const CHACHARA = [
  [{f:{p:'NERVIOSO'}, t:'Munición revisada. Dos veces.'},
   {f:{p:'ESTOICO'}, t:'Perfecto.'},
   {f:{p:'IRONICO'}, t:'Yo habría traído otro cargador.'}],
  [{f:{p:'LEAL'}, t:'Listos para lo que ordenen.'},
   {f:{p:'CINICO'}, t:'Habla por ti.'}],
  [{f:{p:'IRONICO'}, t:'¿Alguien ha leído el plan?'},
   {f:{p:'ESTOICO'}, t:'Avanzar.'},
   {f:{p:'IRONICO'}, t:'Buen plan. Corto. Directo.'}],
  [{f:{p:'NERVIOSO'}, t:'¿Habéis oído eso?'},
   {f:{p:'CINICO'}, t:'Es tu ventilador, novato.'}],
  [{f:{cls:'ENGINEER'}, t:'Si alguien explota, que sea cerca. Odio caminar.'},
   {f:{}, t:'Tomo nota.'}],
  [{f:{cls:'SNIPER'}, t:'Os veo mejor de lejos.'},
   {f:{p:'IRONICO'}, t:'Todos ganamos.'}],
  [{f:{e:'SARCASTICO'}, t:'Otra carretera...'},
   {f:{e:'LEAL'}, t:'Esta vez cruzamos.'},
   {f:{e:'DESCONFIADO'}, t:'Eso dijiste la última vez.'}],
  [{f:{e:'AUTOPRESERVACION'}, t:'Yo voy detrás.'},
   {f:{e:'LEAL'}, t:'Vas donde te toque.'},
   {f:{e:'AUTOPRESERVACION'}, t:'Detrás, entonces.'}],
  [{f:{cls:'HEAVY'}, t:'Peso, munición, dudas. Todo cargado.'},
   {f:{p:'ESTOICO'}, t:'Deja las dudas.'}],
  [{f:{p:'CINICO'}, t:'¿Sabéis lo que ÓPTIMA cobra por hora?'},
   {f:{p:'LEAL'}, t:'No empieces.'},
   {f:{p:'CINICO'}, t:'Nosotros tampoco cobramos. Solo digo.'}],
  [{f:{recoveries:true}, t:'Este chasis no es el mío. Lo sé.'},
   {f:{}, t:'Funciona. Camina.'}],
  [{f:{cls:'BOMBARDERO'}, t:'¿Muros? ¿Alguien ha visto muros?'},
   {f:{p:'NERVIOSO'}, t:'Por favor, apunta lejos de mí.'}],
];

/* (v0.40 F3b) A cháchara de campo en galego e inglés (REESCRITA). */
const CHACHARA_GL = [
  [{f:{p:'NERVIOSO'}, t:'Munición revisada. Dúas veces.'},
   {f:{p:'ESTOICO'}, t:'Perfecto.'},
   {f:{p:'IRONICO'}, t:'Eu traería outro cargador.'}],
  [{f:{p:'LEAL'}, t:'Listos para o que ordenen.'},
   {f:{p:'CINICO'}, t:'Fala por ti.'}],
  [{f:{p:'IRONICO'}, t:'¿Alguén leu o plan?'},
   {f:{p:'ESTOICO'}, t:'Avanzar.'},
   {f:{p:'IRONICO'}, t:'Bo plan. Curto. Directo.'}],
  [{f:{p:'NERVIOSO'}, t:'¿Oístes iso?'},
   {f:{p:'CINICO'}, t:'É o teu ventilador, novato.'}],
  [{f:{cls:'ENGINEER'}, t:'Se alguén estoupa, que sexa preto. Odio camiñar.'},
   {f:{}, t:'Tomo nota.'}],
  [{f:{cls:'SNIPER'}, t:'Véxovos mellor de lonxe.'},
   {f:{p:'IRONICO'}, t:'Gañamos todos.'}],
  [{f:{e:'SARCASTICO'}, t:'Outra estrada...'},
   {f:{e:'LEAL'}, t:'Esta vez cruzamos.'},
   {f:{e:'DESCONFIADO'}, t:'Iso dixeches a última vez.'}],
  [{f:{e:'AUTOPRESERVACION'}, t:'Eu vou detrás.'},
   {f:{e:'LEAL'}, t:'Vas onde che toque.'},
   {f:{e:'AUTOPRESERVACION'}, t:'Detrás, entón.'}],
  [{f:{cls:'HEAVY'}, t:'Peso, munición, dúbidas. Todo cargado.'},
   {f:{p:'ESTOICO'}, t:'Deixa as dúbidas.'}],
  [{f:{p:'CINICO'}, t:'¿Sabedes o que cobra ÓPTIMA por hora?'},
   {f:{p:'LEAL'}, t:'Non empeces.'},
   {f:{p:'CINICO'}, t:'Nós tampouco cobramos. Só digo.'}],
  [{f:{recoveries:true}, t:'Este chasis non é o meu. Seino.'},
   {f:{}, t:'Funciona. Camiña.'}],
  [{f:{cls:'BOMBARDERO'}, t:'¿Muros? ¿Alguén viu muros?'},
   {f:{p:'NERVIOSO'}, t:'Por favor, apunta lonxe de min.'}],
];
const CHACHARA_EN = [
  [{f:{p:'NERVIOSO'}, t:'Ammo checked. Twice.'},
   {f:{p:'ESTOICO'}, t:'Good.'},
   {f:{p:'IRONICO'}, t:'I\u2019d have brought another magazine.'}],
  [{f:{p:'LEAL'}, t:'Ready for whatever they order.'},
   {f:{p:'CINICO'}, t:'Speak for yourself.'}],
  [{f:{p:'IRONICO'}, t:'Has anyone read the plan?'},
   {f:{p:'ESTOICO'}, t:'Advance.'},
   {f:{p:'IRONICO'}, t:'Good plan. Short. Direct.'}],
  [{f:{p:'NERVIOSO'}, t:'Did you hear that?'},
   {f:{p:'CINICO'}, t:'That\u2019s your fan, rookie.'}],
  [{f:{cls:'ENGINEER'}, t:'If anyone explodes, do it nearby. I hate walking.'},
   {f:{}, t:'Noted.'}],
  [{f:{cls:'SNIPER'}, t:'You all look better from a distance.'},
   {f:{p:'IRONICO'}, t:'Everybody wins.'}],
  [{f:{e:'SARCASTICO'}, t:'Another road...'},
   {f:{e:'LEAL'}, t:'This time we cross it.'},
   {f:{e:'DESCONFIADO'}, t:'You said that last time.'}],
  [{f:{e:'AUTOPRESERVACION'}, t:'I\u2019ll take the rear.'},
   {f:{e:'LEAL'}, t:'You go where you\u2019re told.'},
   {f:{e:'AUTOPRESERVACION'}, t:'The rear, then.'}],
  [{f:{cls:'HEAVY'}, t:'Weight, ammo, doubts. All loaded.'},
   {f:{p:'ESTOICO'}, t:'Drop the doubts.'}],
  [{f:{p:'CINICO'}, t:'Do you know what OPTIMA bills per hour?'},
   {f:{p:'LEAL'}, t:'Don\u2019t start.'},
   {f:{p:'CINICO'}, t:'We don\u2019t get paid either. Just saying.'}],
  [{f:{recoveries:true}, t:'This chassis isn\u2019t mine. I know it.'},
   {f:{}, t:'It works. Walk.'}],
  [{f:{cls:'BOMBARDERO'}, t:'Walls? Has anyone seen walls?'},
   {f:{p:'NERVIOSO'}, t:'Please aim far away from me.'}],
];
function chacharaPool(){
  return I18N.lang === 'gl' ? CHACHARA_GL : (I18N.lang === 'en' ? CHACHARA_EN : CHACHARA);
}

function _matchRol(u, f){
  if(f.p && u.personalidad !== f.p) return false;
  if(f.e && estadoConfianza(u) !== f.e) return false;
  if(f.cls && u.cls !== f.cls) return false;
  if(f.recoveries && !(u.recoveries > 0 || u.renacido)) return false;
  return true;
}

function playChachara(g, seleccionados){
  const cands = seleccionados.filter(u => !u.dead && !u.inside && u.team === PT);
  if(cands.length < 2) return false;
  for(const u of cands){ if(!u.personalidad) u.personalidad = pickPersonalidad(u.cls); }
  const barallada = [...chacharaPool()].sort(() => Math.random() - 0.5);
  for(const inter of barallada){
    if(inter.length > cands.length) continue;
    /* Repartir roles: unidades distintas que casen cos filtros */
    const usados = new Set();
    const cast = [];
    let ok = true;
    for(const linha of inter){
      const opcion = cands.filter(u => !usados.has(u.id) && _matchRol(u, linha.f))
                          .sort(() => Math.random() - 0.5)[0];
      if(!opcion){ ok = false; break; }
      usados.add(opcion.id);
      cast.push({u: opcion, t: linha.t});
    }
    if(!ok) continue;
    /* Emitir con retardo: cada un coa súa voz. Os RENACIDOS meten ruído. */
    cast.forEach((c, i) => {
      setTimeout(() => {
        if(c.u.dead) return;
        let texto = c.t;
        if(c.u.renacido && Math.random() < 0.35) texto = fraseRenacida(c.u);
        const est = estadoConfianza(c.u);
        const col = est === 'LEAL' ? '#7fdc7f' : est === 'SARCASTICO' ? '#cfe0ff'
                  : est === 'DESCONFIADO' ? '#ffd24a' : '#ff8a70';
        radio(`${c.u.name}: «${texto}»`, col, {x: c.u.x, y: c.u.y});
        sfxT('voice_blip', 150, c.u.cls);
      }, i * 1100);
    });
    g._lastChachara = g.t;
    return true;
  }
  return false;
}

function emitSelectionFrase(u){
  const now = Date.now();
  /* PRIMEIRA selección de esta unidade na partida: garantizada */
  const isFirstSelection = !u._fraseShownInOp;
  if(!isFirstSelection){
    if(now - _lastFraseTime < FRASE_COOLDOWN_MS) return;
    /* Probabilidade 70% para selecciones posteriores */
    if(Math.random() > 0.7) return;
  }
  /* (v0.21) Resposta encadeada: se acabas de seleccionar OUTRA unidade que falou,
     esta pode contestarlle (45%) en vez de soltar a súa frase de sempre */
  const RESPOSTAS = {
    LEAL:            ['Esta vez cruzamos.', 'Lo que él dijo.', 'Confirmo.'],
    SARCASTICO:      ['Qué optimista.', 'Ya lo estás gafando.', 'Apuntado en el registro de quejas.'],
    DESCONFIADO:     ['Eso dijiste la última vez.', 'Lo creeré cuando lo vea.', '¿Quién lo ordena exactamente?'],
    AUTOPRESERVACION:['Vosotros primero.', 'Yo no he oído nada.', 'Que lo haga otro.'],
  };
  let frase = null;
  const prev = window._lastSelFrase;
  if(prev && prev.uid !== u.id && Date.now() - prev.time < 6000 && Math.random() < 0.45){
    const arr = RESPOSTAS[estadoConfianza(u)] || RESPOSTAS.LEAL;
    frase = arr[Math.floor(Math.random() * arr.length)];
  }
  if(!frase){
    frase = (u.renacido && Math.random() < 0.4 && (u.piezasClases || true))
      ? fraseRenacida(u)
      : pickFrase(u, 'selection');
  }
  if(!frase) return;
  const est = estadoConfianza(u);
  /* Cor segundo estado para reforzar visualmente o ton */
  const col = est === 'LEAL' ? '#7fdc7f'
            : est === 'SARCASTICO' ? '#cfe0ff'
            : est === 'DESCONFIADO' ? '#ffd24a'
            : '#ff5340';
  radio(`${u.name}: «${frase}»`, col, {x:u.x, y:u.y});
  sfxT('voice_blip', 260, u.cls);
  window._lastSelFrase = {uid: u.id, time: Date.now()};
  u._lastFrase = {text: frase, color: col, time: now};
  if(typeof vozRobot === 'function') vozRobot(u, frase, 4, 'sel');   /* (v0.63) */
  if(!window._falaU) window._falaU = {};
  window._falaU[u.id] = u._lastFrase;   /* (v0.57) sobrevive aos snaps do guest */
  u._fraseShownInOp = true;
  _lastFraseTime = now;
}

function mkUnit(team, cls, x, y, persisted){
  const c = CLS[cls];
  const ops = persisted ? (persisted.ops||0) : 0;
  const hpB = clamp(ops*8, 0, 60);
  const dmgM= clamp(1+ops*0.06, 1, 1.5);
  /* Bonificadores aplicados a cualquier veterano (aliado o enemigo) */
  const applyBonus = ops > 0;
  /* Stats de Engineer mejoran con la experiencia (radio y velocidad de reparación) */
  const heal = c.eng ? engHealStats(applyBonus ? ops : 0) : {healRange:0, healRange:0, healRate:0};
  let name, id;
  if(persisted){ name=persisted.name; id=persisted.id; }
  else if(team===PT){
    name = pickName(DATA, game?game.units:[]);
    id   = 'R-'+String(DATA.nextId++).padStart(2,'0');
  } else {
    name = 'K-'+String(game?++game.enemyN:1).padStart(2,'0');
    id = name;
  }
  /* (v0.11) Personalidad fixa de por vida: se herda do persisted ou se asigna por pesos de clase */
  const personalidad = persisted && persisted.personalidad
    ? persisted.personalidad
    : pickPersonalidad(cls);
  const confianza = persisted && typeof persisted.confianza === 'number'
    ? persisted.confianza
    : 50;
  /* (v0.12) Equipamento persistente e efectos */
  const equipment = persisted ? [...(persisted.equipment||[])] : [];
  /* (v0.15) SKILLS por uso: bonos desde a actividade acumulada */
  const actv = persisted ? (persisted.activity||{}) : {};
  /* (v0.19 R2) Habilidades cruzadas herdadas das pezas do Reconstructor */
  const hab = (persisted && persisted.habilidades) || null;
  const sinergia = (persisted && persisted.sinergia) || null;
  const sold = sinergia === 'SOLDADURA' ? 1.10 : 1;
  const servo = equipment.includes('servo_alleo') ? 1.08 : 1;
  /* A velocidade dun robot mesturado sae da razón potencia/carga da súa
     montaxe (ver montaxeFisica). Sen montaxe —unidade de fábrica— o
     factor é 1 e non cambia nada. */
  const _fis = (persisted && persisted.montaxe && typeof montaxeFisica === 'function')
    ? montaxeFisica(persisted.montaxe, cls) : null;
  const eqSpd = (equipment.includes('mochila') ? 1.15 : 1) * (1 + skillBonus(actv,'PISTONES')) * sold * servo * (_fis ? _fis.factor : 1);
  const eqHp  = (equipment.includes('blindaxe') ? 1.2 : 1) * (1 + skillBonus(actv,'BLINDADO')) * (hab && hab.chasisHeavy ? 1.12 : 1) * sold;
  const eqRng = (equipment.includes('mira') ? 1.2 : 1) * (1 + skillBonus(actv,'OJO')) * (hab && hab.cazapilotos ? 1.15 : 1) * sold;
  const skDmg = (1 + skillBonus(actv,'VERDUGO')) * sold * servo;
  return {
    team, cls, name, id, ops,
    persisted: !!persisted,
    equipment,
    traits: persisted ? [...(persisted.traits||[])] : [],
    /* (v0.11) Personalidad e confianza */
    personalidad,
    confianza,
    confianzaDeltaThisOp: 0,  /* cap por op */
    /* Recurrencia (solo enemigos): apariciones acumuladas y nombres de aliados que ha matado */
    appearances: persisted ? (persisted.appearances||1) : 1,
    killedNames: persisted ? [...(persisted.killedNames||[])] : [],
    /* Eventos previos para conservar al final */
    pastEvents: persisted ? [...(persisted.events||[])] : [],
    pastMedals: persisted ? [...(persisted.medals||[])] : [],
    pastCrossings: persisted ? (persisted.crossings||0) : 0,
    pastRecoveries: persisted ? (persisted.recoveries||0) : 0,
    pastKills: persisted ? (persisted.kills||0) : 0,
    /* Eventos durante esta partida */
    eventBuffer: [],
    /* Estado dinámico */
    x, y, tx:x, ty:y,
    waypoints: [],
    hp: Math.round((c.hp + (applyBonus?hpB:0)) * eqHp), max: Math.round((c.hp + (applyBonus?hpB:0)) * eqHp),
    dmg: c.dmg * (applyBonus?dmgM:1) * skDmg,
    rng: Math.round(c.rng * eqRng), spd: c.spd * eqSpd, heavy:c.heavy, eng:c.eng,
    healRange: heal.healRange, healRate: heal.healRate,
    cool:0, fireCool: c.fireCool || 46, kills:0, repairs:0, sel:false, warned:false, dead:false,
    act: {dist:0, shots:0, kills:0, dmgTaken:0, caps:0, veh:0},
    skillCap: skillBonus(actv,'CONQUISTADOR'),
    skillVehFire: Math.max(skillBonus(actv,'PILOTO'), (hab && hab.nucleoPiloto) || 0),
    habilidades: hab,
    sinergia,
    renacido: (persisted && persisted.renacido) || null,
    piezasClases: (persisted && persisted.piezasClases) || null,
    /* A MONTAXE TEN QUE VIAXAR AO CAMPO. O debuxante decide por
       `u.montaxe`: se non chega, cae ao sprite xenérico da clase e o
       corpo que o xogador acaba de montar no taller non se ve en ningures.
       Copiábase piezasClases —que só serve para a ficha— e non esta, que
       é a que se debuxa. */
    montaxe: (persisted && persisted.montaxe) || null,
    doutrina: (persisted && persisted.doutrina) || null,
    vinculos: (persisted && persisted.vinculos) || null,
    alcume: (persisted && persisted.alcume) || null,
    rival: (persisted && persisted.rival) || null,
    medalsN: (persisted && persisted.medals && persisted.medals.length) || 0,
    reensamblado: !!(persisted && persisted.piezasDe && persisted.piezasDe.length),
    /* Track de cruces de río */
    lastSideOfRiver: x < RIVER.x1 ? 'L' : (x > RIVER.x2 ? 'R' : 'M'),
    crossingsThisOp: 0,
    /* Track de DEFENDIO: tiempo acumulado en lugar bajo fuego */
    defendPlace: null,
    defendStartT: 0,
    defendLastFireT: 0,
    /* Carga de restos (solo Engineer) */
    carrying: null,
    /* (Solo enemigos) tracking de daño causado a aliados — para entrar en lista de recurrentes */
    damageToAllies: 0,
    killedAllyNames: [],
  };
}

/* ---------- Producción ---------- */
function prodFactor(g, team){
  const mine = g.sectors.filter(s=>s.owner===team).length;
  return 1 - 0.13*mine;
}
function queueUnit(team, cls){
  const g=game; if(!g||g.over) return;
  if(g.modo === 'mundial') return;   /* (v0.60) o Mundial xógase co XI: sen produción */
  if(g.prod[team]) return;
  const myCount = g.units.filter(u=>u.team===team && !u.dead).length;
  if(myCount>=9){ if(team===PT) radio(TXT('r.capMax'), '#ff8'); return; }
  if(cls === 'TORRETA'){
    if(team === PT){
      if((DATA.chatarra||0) < TURRET_BUILD.cost){
        radio(TXT('r.senChatarraTorreta', {c:TURRET_BUILD.cost}), '#ff8');
        return;
      }
      DATA.chatarra -= TURRET_BUILD.cost;
    }
    const total = Math.round(TURRET_BUILD.prod * prodFactor(g,team));
    g.prod[team] = {cls, left:total, total};
    return;
  }
  if(cls === 'TANQUE'){
    if(team === PT){
      if((DATA.chatarra||0) < TANK_DEF.cost){
        radio(TXT('r.senChatarraTanque', {c:TANK_DEF.cost}), '#ff8');
        return;
      }
      DATA.chatarra -= TANK_DEF.cost;
    }
    const total = Math.round(TANK_DEF.prod * prodFactor(g,team));
    g.prod[team] = {cls, left:total, total};
    return;
  }
  const total = Math.round(CLS[cls].prod * prodFactor(g,team));
  g.prod[team] = {cls, left:total, total};
}
function tickProd(g){
  if(g.modo === 'mundial') return;   /* (v0.60) sen fábrica no Mundial */
  /* (v0.25.4) Colapso: as fábricas inimigas non producen máis */
  if((g._colapso || g.modo === 'crisol') && g.prod[ET]) g.prod[ET] = null;
  for(let t=0;t<2;t++){
    const p=g.prod[t]; if(!p) continue;
    p.left--;
    if(p.left<=0){
      g.prod[t]=null;
      const hq=g.hq[t];
      /* (v0.17.1) Spawn disperso: fronte / arriba / abaixo — un tanque acampado xa non tapa a saída */
      const spots = t===0
        ? [[hq.w+35, hq.h/2], [hq.w/2, -34], [hq.w/2, hq.h+34]]
        : [[-35, hq.h/2], [hq.w/2, -34], [hq.w/2, hq.h+34]];
      const spot = spots[Math.floor(rnd()*spots.length)];
      let sx = hq.x + spot[0] + (rnd()*24-12), sy = hq.y + spot[1] + (rnd()*24-12);
      if(typeof nudgeSpawn === 'function'){ const _ns = nudgeSpawn(g, t, sx, sy); sx = _ns.x; sy = _ns.y; }
      if(p.cls === 'TORRETA'){
        if(t === PT){
          g.turretPending = (g.turretPending || 0) + 1;
          radio(TXT('r.torretaLista'), '#c8a86a');
          sfx('radio_open');
        } else {
          g._turretPendingET = (g._turretPendingET || 0) + 1;   /* (v0.32) torreta do rival humano */
          if(g.modo === 'pvp') pvpRadioET(g, '⌂ TORRETA lista — clic esquerdo para colocala en territorio teu.', '#c8a86a');
        }
      } else if(p.cls === 'TANQUE'){
        /* (v0.14) TANQUE: sae xa pilotado por un GRUNT novo con nome */
        const pilot = mkUnit(t, 'GRUNT', sx, sy, null);
        /* (v1.01) O TANQUE sae 30 px ao lado do piloto, e ese despraza-
           mento non pasaba por ningunha comprobación. Como despois se
           fai `pilot.x = tank.x`, o piloto ía onde fose o tanque: nunha
           planta de interior iso metía unha unidade viva no formigón
           aínda tendo o spawn do piloto ben resolto. */
        const _tp = (typeof saírDoMacizo === 'function')
          ? saírDoMacizo(sx + (t===0?30:-30), sy) : {x: sx + (t===0?30:-30), y: sy};
        const tank = {
          id:'TANK_'+(g._tankN=(g._tankN||0)+1)+'_'+t, tipo:'TANQUE',
          x:_tp.x, y:_tp.y, tx:_tp.x, ty:_tp.y,
          hp:TANK_DEF.hp, max:TANK_DEF.hp, dmg:TANK_DEF.dmg, rng:TANK_DEF.rng,
          spd:TANK_DEF.spd, fireRate:TANK_DEF.fireRate, cool:0,
          angle:(t===0?0:Math.PI), team:t, occupant:pilot,
          destroyed:false, sel:false, waypoints:[],
        };
        pilot.inside = tank;
        pilot.x = tank.x; pilot.y = tank.y;
        g.units.push(pilot);
        g.vehicles.push(tank);
        if(t===PT) radio(TXT('r.saeTanque', {n:pilot.name}), '#7fdc7f', {x:tank.x, y:tank.y});
      } else {
        const u = mkUnit(t, p.cls, sx, sy, null);
        /* (v0.14) BOTÍN: 12% dos inimigos producidos levan unha peza de equipo */
        if(t === ET && rnd() < 0.12){
          const lootables = ['mochila','blindaxe','mira'];
          const eq = lootables[Math.floor(rnd()*lootables.length)];
          u.equipment.push(eq);
          if(eq==='mochila') u.spd *= 1.15;
          if(eq==='blindaxe'){ u.hp = Math.round(u.hp*1.2); u.max = Math.round(u.max*1.2); }
          if(eq==='mira') u.rng = Math.round(u.rng*1.2);
        }
        /* (v0.24.1) VETERANO DE VOLT: 25% de que a produción sexa un dos seus con nome */
        if(t === 1 && (DATA.voltRoster || []).length && rnd() < 0.25){
          g._voltFielded = g._voltFielded || new Set();
          const dispo = DATA.voltRoster.filter(v => !g._voltFielded.has(v.id) && v.cls === u.cls);
          const anyCls = dispo.length ? dispo : DATA.voltRoster.filter(v => !g._voltFielded.has(v.id));
          if(anyCls.length){
            const vet = anyCls[Math.floor(rnd() * anyCls.length)];
            g._voltFielded.add(vet.id);
            u.name = vet.name;
            u._voltVet = vet;
            const f = Math.min(1.2, 1 + 0.04 * (vet.ops || 1));
            u.hp = Math.round(u.hp * f); u.max = u.hp;
            u.dmg = u.dmg * f;
            radio(TXT('r.vetEnCampo', {n:vet.name, ops:vet.ops}), '#ff7a5a', {x:u.x, y:u.y});
          }
        }
        /* (v0.19 R2) PORTADOR: 10% de sacar ao campo unha peza TÚA do pool inimigo */
        if(t === 1 && (DATA.piezasEnemigas||[]).length && rnd() < 0.10){
          g._pezasEnCampo = g._pezasEnCampo || new Set();
          const libres = DATA.piezasEnemigas.filter(p => !g._pezasEnCampo.has(p.id));
          if(libres.length){
            const p = libres[Math.floor(rnd()*libres.length)];
            g._pezasEnCampo.add(p.id);
            u._pezaPortada = p;
            /* (v0.23) O RADAR detecta a intel: sen el, o portador pasa ás túas costas */
            if(g.radar && g.radar.owner === PT){
              addSubquest(g, {
                tipo: 'RECUPERACION', x: u.x, y: u.y,
                titulo: TXT('sq.recupera', {peza:PEZA_LABEL[p.tipo], de:p.deNome}),
                desc: TXT('sq.recuperaDesc'),
                carrier: u, pezaId: p.id, bounty: 12,
              });
              hqSay(TXT('hq.portador', {peza: PEZA_LABEL[p.tipo].toUpperCase(), nome: p.deNome}));
            }
          }
        }
        g.units.push(u);
        if(t===0){
          radioSay('produced', u);
          sfx('radio_open');
        }
      }
    }
  }
}

/* ---------- IA enemiga ---------- */
function tickAI(g){
  if(g.modo === 'pvp') return;   /* (v0.31) o rival é humano */
  /* (v1.04) UNHA OPERACIÓN DE CAMPAÑA NON PRODUCE. O inimigo é unha
     GARNICIÓN: está a que está, e cada un que cae xa non volve.

     Non abondaba con baleirar `g.prod[ET]` ao arrancar, e a proba
     colleuno: aparecían cinco inimigos que ninguén pedira. A liña de
     máis abaixo VOLVE ENCHER A COLA cada cinco segundos, e faino antes
     do temporizador de roles, así que hai que cortalo na cabeceira.

     O que si segue correndo é a reasignación de papeis: a garnición
     defende, persegue e flanquea coma sempre. O que non fai é
     reproducirse. */
  if(g.senBases){
    if(g.prod[ET]) g.prod[ET] = null;
    if(--g.aiTimer > 0) return;
    g.aiTimer = 60;
    /* Sen HQ vermello ao que agarrarse o papel é ir polo que se mova;
       as ordes concretas —agardar nunha sala, saír por un corredor—
       póñenas os gatillos da operación. */
    for(const u of g.units){
      if(u.team === ET && !u.dead && !u.inside) u.role = 'ASSAULT';
    }
    return;
  }
  /* (v0.11) Producción: independente da reasignación, mantén ritmo */
  if(g.aiProdTimer === undefined) g.aiProdTimer = 0;
  if(--g.aiProdTimer <= 0){
    g.aiProdTimer = 300 + rnd()*200;
    if(!g.prod[ET]){
      const r=rnd();
      if(DATA.opCount >= 2 && r > 0.92) queueUnit(ET, 'TANQUE');
      else queueUnit(ET, r<0.42?'GRUNT': r<0.66?'HEAVY': r<0.80?'ENGINEER': r<0.91?'SNIPER':'BOMBARDERO');
    }
  }

  /* Reasignación de roles cada 60 frames (1 segundo) — moito máis reactiva */
  if(--g.aiTimer > 0) return;
  g.aiTimer = 60;

  const mine = g.units.filter(u=>u.team===ET && !u.dead && !u.inside);
  if(mine.length === 0) return;

  /* === DETECCIÓN DE AMEAZAS === */
  /* HQ vermello en perigo: dano recente (últimos 4s) OU hai azuis en rango de ataque */
  const hqRed = g.hq[ET];
  const hqRedCenter = {x: hqRed.x + hqRed.w/2, y: hqRed.y + hqRed.h/2};
  const damageRecent = hqRed.lastDamageT && (g.t - hqRed.lastDamageT) < 60*4;
  const azulesPerto = g.units.filter(u =>
    u.team === PT && !u.dead && !u.inside &&
    Math.hypot(u.x - hqRedCenter.x, u.y - hqRedCenter.y) < 280
  );
  const hqUnderThreat = damageRecent || azulesPerto.length >= 1;

  /* === ASIGNACIÓN DE ROLES === */
  /* Limpar roles obsoletos */
  for(const u of mine){
    if(u.role === 'DEFEND_HQ' && !hqUnderThreat) u.role = null;
    if(u.role === 'CAPTURE' && u.roleTarget){
      const sec = g.sectors.find(s => s.id === u.roleTarget);
      if(!sec || sec.owner === ET) u.role = null;  /* xa é noso */
    }
  }

  /* 1. DEFENSA do HQ: se sob ameaza, asignar 3-4 unidades máis cercanas */
  if(hqUnderThreat){
    const defenders = mine
      .filter(u => !u.role || u.role === 'DEFEND_HQ')
      .sort((a,b) => Math.hypot(a.x-hqRedCenter.x, a.y-hqRedCenter.y) - Math.hypot(b.x-hqRedCenter.x, b.y-hqRedCenter.y));
    const needed = Math.min(4, defenders.length);
    for(let i = 0; i < needed; i++){
      defenders[i].role = 'DEFEND_HQ';
    }
  }

  /* 2. CAPTURA de sectores: asignar unidades sen rol aos sectores non-vermellos máis próximos */
  const sectorTargets = g.sectors.filter(s => s.owner !== 1);
  if(sectorTargets.length > 0){
    /* Para cada sector dispoñible, mira se xa hai algunha unidade vermella asignada */
    for(const sec of sectorTargets){
      const assignedCount = mine.filter(u => u.role === 'CAPTURE' && u.roleTarget === sec.id).length;
      if(assignedCount >= 2) continue;  /* xa hai abondas */
      /* Asignar a unidade libre máis próxima */
      const libres = mine.filter(u => !u.role);
      if(libres.length === 0) break;
      libres.sort((a,b) => Math.hypot(a.x-sec.x, a.y-sec.y) - Math.hypot(b.x-sec.x, b.y-sec.y));
      libres[0].role = 'CAPTURE';
      libres[0].roleTarget = sec.id;
    }
  }

  /* 3. ASALTO ao HQ azul: se aínda hai libres e o exército é grande, ofensiva.

     O tamaño do exército CONTA AS GORNECIDAS. `mine` exclúe as que están
     dentro dunha torreta ou dun vehículo —e ben excluídas están, que non
     se moven— pero para decidir se hai exército abondo si contan: unha
     unidade nunha torreta segue sendo dun exército. Sen isto pasaba o
     seguinte, atopado polo fuzz coa semente 1501646933: nove unidades
     vivas, cinco delas gornecidas, `mine.length` = 4, o asalto nunca se
     dispara e as catro libres quedan quietas para sempre. A batalla non
     remataba en 33 minutos de xogo.

     E se non hai NADA que facer —nin ameaza, nin sector que tomar— sae
     o asalto aínda que o exército sexa pequeno. Non é subirlle a
     agresividade: é que o repartidor non poida deixar a todo o mundo sen
     tarefa. Un exército parado nun mapa xa conquistado non é unha
     decisión táctica, é unha partida que non pecha.

     MEDIDO antes de darlle por bo, porque a nota que deixara isto sen
     arranxar dicía que tocar a IA era unha decisión de equilibrio. Sobre
     13 sementes, cun xogador que non dá ningunha orde:

         sen arranxo   12 derrotas, 1 sen rematar, 14.573 pasos de media
         con arranxo   13 derrotas, 0 sen rematar,  5.860 pasos

     A duración cae á metade, pero NON é que a IA ataque máis: as dúas
     correccións por separado dan o mesmo número (5.836 e 5.860), así que
     o que baixa a media é deixar de ter batallas arrastrándose ata o
     tope. O reparto de vitorias non cambia. */
  const exercito = g.units.filter(u => u.team === ET && !u.dead).length;
  const nadaQueFacer = !hqUnderThreat && sectorTargets.length === 0;
  if(exercito >= 5 || nadaQueFacer){
    const libres = mine.filter(u => !u.role);
    for(const u of libres){
      u.role = 'ASSAULT';
      u.roleTarget = null;
    }
  }

  /* === EXECUTAR ROLES === */
  /* Dar ordes só periódicamente para non saturar (cada 3 ciclos = 3s) */
  if((g.aiWave = (g.aiWave||0) + 1) % 3 !== 0) return;

  for(const u of mine){
    if(u.intentEnterTurret || u.intentEnterVehicle) continue;  /* Respectar intents */
    if(u.role === 'DEFEND_HQ'){
      /* Ir cara o HQ propio, con dispersión arredor del */
      const offX = (rnd() - 0.5) * 80;
      const offY = (rnd() - 0.5) * 80;
      orderMove(u, hqRedCenter.x + offX, hqRedCenter.y + offY);
    } else if(u.role === 'CAPTURE' && u.roleTarget){
      const sec = g.sectors.find(s => s.id === u.roleTarget);
      if(sec) orderMove(u, sec.x + (rnd()*40-20), sec.y + (rnd()*40-20));
    } else if(u.role === 'ASSAULT'){
      orderMove(u, g.hq[PT].x + 60, g.hq[PT].y + 40);
    }
  }
}

/* ============================================================
   PATHFINDING DE HEAVY (A.1)
   Si un Heavy tiene que cruzar el río, primero al puente.
   También aplica a infantería ligera (más rápido para todos
   ir por el puente que vadear, salvo que el cruce sea cerca).
   ============================================================ */
function orderMove(u, tx, ty){
  ty = clamp(ty, 8, H-8);
  tx = clamp(tx, 8, W-8);
  /* (v1.02) NUN INTERIOR, RUTA DE VERDADE.

     Vai aquí e non en tres sitios porque esta función é o punto único
     polo que pasan o clic do xogador, o clic de grupo, e TODAS as ordes
     da IA (perseguir, flanquear, cubrir un sector, retirarse). Poñelo
     aquí é o que garante que a IA navegue exactamente igual de ben ca o
     xogador; se se puxese só no clic, o interior sería inxogable para
     un dos dous bandos e ninguén sabería cal.

     rutaInterior devolve [] cando se ve o destino en liña recta, que é
     o caso máis frecuente e non custa nada. */
  if((window._bioma || 'VERDE') === 'INTERIOR' && typeof rutaInterior === 'function'){
    /* Gárdase o destino REAL: os waypoints consómense e sen isto, se a
       unidade queda atrancada a media ruta, non hai a onde volver
       pedirlle camiño. */
    u._destino = {x: tx, y: ty};
    u._atranco = 0;
    const r = rutaInterior(u.x, u.y, tx, ty);
    if(r && r.length){
      u.waypoints = r;
      u.tx = r[0].x; u.ty = r[0].y;
      return;
    }
    if(r){ u.waypoints = []; u.tx = tx; u.ty = ty; return; }
    /* r === null: non hai camiño (destino illado). Déixase a orde
       directa e que o esvaramento faga o que poida. */
  }
  /* ¿Hay que cruzar el río? */
  if(crossesRiver(u.x, tx)){
    /* Heavy: obligado al puente, con waypoint dobre (entrada + salida) para asegurar paso */
    if(u.heavy){
      /* Punto de saída no lado contrario: 30px alén do río */
      const exitX = u.x < RIVER.x1 ? RIVER.x2 + 30 : RIVER.x1 - 30;
      u.waypoints = [
        {x:BRIDGE_CENTER.x, y:BRIDGE_CENTER.y},
        {x:exitX, y:BRIDGE_CENTER.y},
        {x:tx, y:ty}
      ];
      u.tx = u.waypoints[0].x; u.ty = u.waypoints[0].y;
      return;
    }
    /* Ligero: si el destino está lejos del puente vertical, vadea;
       si está cerca de la altura del puente, va por el puente. */
    const distToBridgeY = Math.abs(ty - BRIDGE_CENTER.y);
    if(distToBridgeY < 90){
      u.waypoints = [{x:BRIDGE_CENTER.x, y:BRIDGE_CENTER.y}, {x:tx, y:ty}];
      u.tx = u.waypoints[0].x; u.ty = u.waypoints[0].y;
      return;
    }
  }
  u.waypoints = [];
  u.tx = tx; u.ty = ty;
}

/* ============================================================
   FORMACIÓN POR CLASE (v0.11) — Nivel A
   Cando se ordena mover >1 unidade ao mesmo punto, cada clase
   recolócase para crear unha formación coherente:
   - HEAVY na vangarda (cara o destino)
   - GRUNT nos flancos (laterais)
   - ENGINEER na retagarda (atrás)
   ============================================================ */
function orderMoveGroup(units, px, py){
  if(units.length === 0) return;
  if(units.length === 1){
    orderMove(units[0], px, py);
    return;
  }
  /* Centroide do grupo */
  const cx = units.reduce((a,u)=>a+u.x, 0) / units.length;
  const cy = units.reduce((a,u)=>a+u.y, 0) / units.length;
  /* Vector unitario dirección movemento (cara o punto destino) */
  const dx = px - cx, dy = py - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx/dist, uy = dy/dist;
  /* Vector perpendicular (rotación 90°) para flanqueo */
  const perpX = -uy, perpY = ux;

  /* Separar por rol */
  const heavies   = units.filter(u => u.heavy);
  const engineers = units.filter(u => u.eng || u.cls==='SNIPER');  /* sniper na retagarda */
  const grunts    = units.filter(u => !u.heavy && !u.eng && u.cls!=='SNIPER');

  const FRONT = 22;     /* HEAVY: distancia adiante respecto ao punto */
  const REAR  = 32;     /* ENGINEER: distancia atrás */
  const FLANK = 28;     /* GRUNT: distancia lateral mínima */
  const SIDE_SPACING = 22; /* separación entre unidades da mesma fila */

  /* HEAVY: liña frontal centrada (lixeiramente adiante do punto) */
  heavies.forEach((u, i) => {
    const lateral = (i - (heavies.length-1)/2) * SIDE_SPACING;
    const tx = px + ux * FRONT + perpX * lateral;
    const ty = py + uy * FRONT + perpY * lateral;
    orderMove(u, tx, ty);
  });

  /* GRUNT: nos flancos. Alterna esquerda/dereita, separa con FLANK + i*sub-spacing */
  grunts.forEach((u, i) => {
    const side = (i % 2 === 0) ? 1 : -1;
    const layer = Math.floor(i / 2);  /* 0, 0, 1, 1, 2, 2... */
    const lateralDist = FLANK + layer * SIDE_SPACING;
    const tx = px + perpX * (side * lateralDist);
    const ty = py + perpY * (side * lateralDist);
    orderMove(u, tx, ty);
  });

  /* ENGINEER: retagarda centrada (atrás do punto, na dirección oposta ao movemento) */
  engineers.forEach((u, i) => {
    const lateral = (i - (engineers.length-1)/2) * SIDE_SPACING;
    const tx = px - ux * REAR + perpX * lateral;
    const ty = py - uy * REAR + perpY * lateral;
    orderMove(u, tx, ty);
  });
}

/* ============================================================
   IA REACTIVA POR IDENTIDAD (v0.3)
   Cuando el bando rojo controla el Radar Central, conoce la
   composición del bando azul y reacciona en consecuencia:
   - Pesados enemigos priorizan veteranos aliados
   - Ligeros enemigos evitan veteranos aliados si pueden
   - Engineers enemigos huyen a reagruparse si hay veterano cerca
   El bando azul, cuando controla el radar, recibe la info
   en forma de mensajes de radio al detectar recurrentes.
   ============================================================ */
const AGGRO_RANGE = 220;
function chooseTarget(u, g){
  /* (v0.20) O xogador só pode fixar o que VE (visión compartida do equipo).
     A IA segue omnisciente na v1. */
  const _fogOK = (cand) => u.team !== PT || foeVisible(cand, g);
  /* Búsqueda lineal por defecto (sin radar enemigo o sin IA reactiva) */
  let defaultFoe = null, defaultD = 1e9;
  for(const v of g.units){
    if(v.dead || v.team === u.team) continue;
    if(v.inside) continue;  /* (v0.8) protexido pola torreta — non é foe directo */
    if(!_fogOK(v)) continue;   /* (v0.20) invisible = non existe para o xogador */
    const d = dist(u, v);
    if(d < defaultD){ defaultD = d; defaultFoe = v; }
  }
  /* IA reactiva solo si el bando rojo tiene radar y la unidad es del bando rojo */
  if(u.team !== ET || g.radar.owner !== ET){
    /* Sin radar: el enemigo NO discrimina por veteranía.
       Para reforzar la diferencia perceptual, si el objetivo más cercano es un
       veterano y hay un novato razonablemente cercano (dentro del 40% más),
       hay un 50% de probabilidad de cambiar al novato. Esto rompe el "focus
       fantasma" sobre veteranos cuando no debería existir. */
    if(u.team === ET && g.modo !== 'pvp' && defaultFoe && (defaultFoe.ops||0) >= 3){
      const altFoes = [];
      for(const v of g.units){
        if(v.dead || v.team !== 0 || v === defaultFoe) continue;
        if(v.inside) continue;
        if((v.ops||0) < 3 && dist(u, v) < defaultD * 1.4) altFoes.push(v);
      }
      if(altFoes.length > 0 && rnd() < 0.5){
        return altFoes[Math.floor(rnd()*altFoes.length)];
      }
    }
    return defaultFoe;
  }

  /* Candidatos: aliados azules en rango razonable */
  const candidates = [];
  for(const v of g.units){
    if(v.dead || v.team !== 0) continue;
    if(v.inside) continue;
    const d = dist(u, v);
    if(d < AGGRO_RANGE) candidates.push({v, d});
  }
  if(candidates.length === 0) return defaultFoe;

  if(u.heavy){
    /* Heavy enemigo: prioriza al veterano de mayor experiencia, dentro de un margen razonable */
    candidates.sort((a, b) => {
      const va = a.v.ops || 0, vb = b.v.ops || 0;
      if(va !== vb) return vb - va;
      return a.d - b.d;
    });
    return candidates[0].v;
  }
  if(!u.heavy && !u.eng){
    /* Ligero enemigo: prefiere no-veteranos si los hay cerca */
    const noVets = candidates.filter(c => (c.v.ops||0) < 3);
    if(noVets.length > 0){
      noVets.sort((a, b) => a.d - b.d);
      return noVets[0].v;
    }
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0].v;
  }
  /* Engineer enemigo: si hay veterano azul cerca, huye (devuelve null para no disparar) */
  if(u.eng){
    const veteranNear = candidates.find(c => (c.v.ops||0) >= 3 && c.d < 110);
    if(veteranNear && g.modo !== 'pvp'){   /* (v0.35) a fuxida do eng é reflexo da IA */
      /* Buscar Heavy aliado para refugiarse */
      let protector = null, pd = 1e9;
      for(const a of g.units){
        if(a.dead || a.team !== ET || !a.heavy || a === u) continue;
        const d = dist(u, a);
        if(d < pd){ pd = d; protector = a; }
      }
      if(protector){
        u.tx = protector.x + (rnd()*30 - 15);
        u.ty = protector.y + (rnd()*30 - 15);
      } else {
        /* Sin Heavy disponible: retirada al HQ propio */
        u.tx = g.hq[ET].x + g.hq[ET].w/2;
        u.ty = g.hq[ET].y + g.hq[ET].h/2;
      }
      return null;
    }
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0].v;
  }
  return defaultFoe;
}

/* ---------- Movimiento, combate, captura ---------- */
function tickUnits(g){
  for(const u of g.units){
    if(u.dead) continue;
    /* (v1.04) UNIDADE INERTE ou XA EXTRAÍDA: non se move, non dispara e
       non a ve ninguén. A inerte agarda a que un ENGINEER a erga —é o
       corazón de RESCATE e REPARACIÓN—; a extraída xa saíu do edificio
       e non está. */
    if(u.inerte || u.extraido) continue;
    /* Unidade dentro dunha torreta: non se move nin combate por si soa; a torreta xestiónaa */
    if(u.inside){
      /* Manter posición sincronizada coa torreta */
      u.x = u.inside.x; u.y = u.inside.y;
      if(u.act) u.act.veh++;
      continue;
    }
    /* Objetivo de combate: usa IA reactiva si el rojo tiene radar */
    let foe = chooseTarget(u, g);
    let fd = foe ? dist(u, foe) : 1e9;
    /* (v0.24) Os GRISES (team 2) non teñen HQ inimigo: requisan robots, non edificios */
    const hqFoe = u.team === 2 ? null : g.hq[1-u.team];
    const dHq = hqFoe ? Math.hypot(u.x-(hqFoe.x+hqFoe.w/2), u.y-(hqFoe.y+hqFoe.h/2)) : 1e9;

    if(u.cool>0) u.cool--;
    /* (v0.17.1) BOMBARDERO: prioridade de asedio — vehículos > torretas > HQ > infantería */
    if(u.cls === 'BOMBARDERO' && u.cool <= 0){
      let st = null, sd = 1e9, stype = null;
      if(g.vehicles) for(const vv of g.vehicles){
        if(vv.destroyed || vv.team === u.team || vv.team === -1) continue;
        const d = Math.hypot(vv.x - u.x, vv.y - u.y);
        if(d <= u.rng && d < sd){ st = vv; sd = d; stype = 'veh'; }
      }
      if(!st && g.turrets) for(const tt of g.turrets){
        if(tt.destroyed || tt.team === u.team || tt.team === -1) continue;
        const d = Math.hypot(tt.x - u.x, tt.y - u.y);
        if(d <= u.rng && d < sd){ st = tt; sd = d; stype = 'tur'; }
      }
      if(!st && dHq <= u.rng + 20){ st = hqFoe; stype = 'hq'; }
      if(st){
        u.cool = u.fireCool || 46; if(u.act) u.act.shots++; u._revealT = g.t; if(u.team===PT||rnd()<0.5) sfxT('shot_'+u.cls.toLowerCase(), 75);
        const killPilot = (host, cause) => {
          const dead = host.occupant;
          dead.dead = true; dead.deathCause = cause;
          /* (v0.60/61) MUNDIAL: explotar dentro dun vehículo = TARXETA VERMELLA
             — mesmo regulamento para os DOUS equipos */
          if(g.modo === 'mundial' && window._mundial){
            if(dead.team === PT){
              window._mundial.vermellas.push(dead.id);
              radio(TXT('mun.vermella', {n: dead.name}), '#ff5340');
            } else if(dead.team === ET){
              window._mundial.vermellasRival.push(dead.id);
              radio(TXT('mun.vermellaRival', {n: dead.name}), '#7fd0ff');
            }
          }
          u.kills++; g.kills[u.team]++;
          host.occupant = null;
          if(dead.team !== PT) dropScrap(g, host.x, host.y, CHATARRA_VALUES[dead.cls] || 5);
        };
        if(stype === 'veh'){
          const dv = u.dmg * BOMB_VS_VEH;
          if(st.occupant && !st.occupant.dead){
            const sp = st.tipo === 'TANQUE' ? 0.85 : 0.70;
            st.hp -= dv * sp; st.occupant.hp -= dv * (1 - sp);
            if(st.occupant.hp <= 0) killPilot(st, u.cls);
          } else st.hp -= dv;
        } else if(stype === 'tur'){
          const dt = u.dmg * BOMB_VS_STRUCT;
          if(st.occupant && !st.occupant.dead){
            st.hp -= dt * 0.7; st.occupant.hp -= dt * 0.3;
            if(st.occupant.hp <= 0) killPilot(st, u.cls);
          } else st.hp -= dt;
        } else {
          const hqIdx3 = g.hq.indexOf(st);
          if(hqIdx3 >= 0 && hqEscudado(g, hqIdx3)){
            avisoEscudo(g, hqIdx3, u.team);
          } else {
            st.hp -= u.dmg * BOMB_VS_STRUCT;
            st.lastDamageT = g.t;
          }
        }
        const sx2 = stype === 'hq' ? st.x + st.w/2 : st.x;
        const sy2 = stype === 'hq' ? st.y + st.h/2 : st.y;
        g.tracers.push({x1:u.x, y1:u.y, x2:sx2, y2:sy2, t:7, team:u.team});
      }
    }
    if(foe && fd<=u.rng && u.cool<=0){
      u.cool = u.fireCool || 46; if(u.act) u.act.shots++; u._revealT = g.t; if(u.team===PT||rnd()<0.5) sfxT('shot_'+u.cls.toLowerCase(), 75);
      const _dmgCob = enCobertura(foe, u, g) ? u.dmg * 0.75 : u.dmg;
      foe.hp -= _dmgCob;
      foe._golpeT = g.t;   /* (v0.64) marca para a pose de IMPACTO */
      if(foe.act) foe.act.dmgTaken += _dmgCob;
      /* (v0.14) BOMBARDERO: metralla en área — dana (nunca mata) aos inimigos preto do impacto */
      if(u.cls === 'BOMBARDERO'){
        for(const e2 of g.units){
          if(e2.dead || e2 === foe || e2.team === u.team || e2.inside) continue;
          if(Math.hypot(e2.x - foe.x, e2.y - foe.y) < BOMB_SPLASH_R){
            e2.hp = Math.max(1, e2.hp - u.dmg * BOMB_SPLASH_F);
          }
        }
        /* (v0.26) CRÁTER: a explosión deixa cicatriz no chan — e o burato é cobertura */
        if(rnd() < 0.35 && !inWater(foe.x, foe.y)){
          g.craters = g.craters || [];
          g.craters.push({x: foe.x, y: foe.y, r: 8});
          if(g.craters.length > 40) g.craters.shift();
        }
      }
      g.tracers.push({x1:u.x,y1:u.y,x2:foe.x,y2:foe.y,t:6,team:u.team});
      /* Si el atacante es enemigo y dañó a un aliado, registrar para recurrencia */
      if(u.team===ET && foe.team===PT){
        u.damageToAllies = (u.damageToAllies||0) + u.dmg;
      }
      /* Marcar que estoy en combate (para DEFENDIO) */
      if(u.team===PT){ u.defendLastFireT = g.t; }
      if(foe.hp<=0 && !foe.dead && !cheatDeath(foe, g)){
        foe.dead=true; u.kills++; g.kills[u.team]++;
        /* (v0.96) Sáltase en pezas. Vai para OS DOUS bandos: é
           información de combate, non premio. */
        if(typeof efxDesmontar === 'function') efxDesmontar(foe, u.cls);
        /* (v0.83) O SNIPER mata lonxe, moitas veces fóra de cámara: sen
           marca, o xogador non se entera de que o seu francotirador está
           a facer o seu traballo. Só nos nosos abates — os do inimigo xa
           se notan abondo. */
        if(u.team === PT && u.cls === 'SNIPER' && typeof efxSniper === 'function'){
          efxSniper(foe.x, foe.y);
        }
        if(u.team===PT){
          radioSay('killed_enemy', u, {targetName: foe.name});
          logEvent(u, {type:'MATO_EN', place: placeAt(u.x, u.y), target: foe.name});
          /* (v0.79) chío por vozRobot; o cargador vello non existía */
        }
        if(foe.team===PT){
          /* Si el matador es enemigo, registrar el nombre del caído */
          if(u.team===ET){
            u.killedAllyNames = u.killedAllyNames || [];
            u.killedAllyNames.push(foe.name);
          }
          const place = placeAt(foe.x, foe.y);
          radioSay('fallen', foe, {place}, '#ff5340');
          sfx('signal_lost');
          /* Crear restos */
          logEvent(foe, {type:'CAYO_EN', place});
          foe.deathCause = u.cls;  /* (v0.12) memoria: quen o matou */
          g.remains.push({
            x: foe.x, y: foe.y,
            unit: foe,
            timer: 90*60,
            secured: false,
            place,
          });
          /* (v0.11.2) Aliados próximos reaccionan á morte */
          triggerNearDeathReactions(foe, g);
        }
        /* (v0.12) Inimigo morto → chatarra no chan */
        if(foe.team !== PT){
          dropScrap(g, foe.x, foe.y, CHATARRA_VALUES[foe.cls] || 5);
          /* (v0.14) BOTÍN: o seu equipo cae como chatarra especial dourada */
          if(foe.equipment && foe.equipment.length){
            for(const eq of foe.equipment){
              g.scrap.push({x:foe.x+10, y:foe.y-8, amount:0, loot:eq, timer:90*60, collected:false});
            }
          }
        }
      }
      if(foe.team===PT && !foe.dead && foe.hp<foe.max*0.34 && !foe.warned){
        foe.warned=true;
        /* Tracking de DURO_DE_MATAR */
        foe.criticalThisOp = (foe.criticalThisOp||0) + 1;
        const line = pickLine('under_fire', foe);
        radio(line, '#ffd24a');
        sfx('radio_open');
        setTimeout(()=>{
          sfx('radio_static', 0.4);
          /* (v0.79) idem */
        }, 80);
        /* Interrupción del panel lateral con frase incluida */
        panelInterrupt = {unit: foe, until: g.t + 60*4, line};
      }
    } else if(!foe || fd>u.rng){
      if(dHq<=u.rng+20 && u.cool<=0){
        u.cool = u.fireCool || 46; if(u.act) u.act.shots++; u._revealT = g.t; if(u.team===PT||rnd()<0.5) sfxT('shot_'+u.cls.toLowerCase(), 75); if(hqEscudado(g, u.team===PT?1:0)){ avisoEscudo(g, u.team===PT?1:0, u.team); } else { hqFoe.hp-=u.dmg * (u.habilidades && u.habilidades.antimuro ? 2 : 1); }
        /* (v0.11) Tracking de ameaza: marcar que o HQ foi atacado neste frame */
        hqFoe.lastDamageT = g.t;
        g.tracers.push({x1:u.x,y1:u.y,x2:hqFoe.x+hqFoe.w/2,y2:hqFoe.y+hqFoe.h/2,t:6,team:u.team});
      }
    }

    /* (v0.8) Atacar torretas inimigas en rango — só se aínda non disparou neste frame */
    if(u.cool<=0 && g.turrets){
      for(const tu of g.turrets){
        if(tu.destroyed || tu.team===u.team || tu.team===-1) continue;
        const dT = Math.hypot(tu.x-u.x, tu.y-u.y);
        if(dT <= u.rng + 5){
          u.cool = u.fireCool || 46; if(u.act) u.act.shots++; u._revealT = g.t; if(u.team===PT||rnd()<0.5) sfxT('shot_'+u.cls.toLowerCase(), 75);
          if(tu.occupant && !tu.occupant.dead){
            /* (v0.14) SNIPER mata pilotos a través da cúpula: 30/70. Resto 70/30 */
            const spT = u.cls==='SNIPER' ? 0.30 : (u.habilidades && u.habilidades.cazapilotos ? 0.50 : 0.70);
            const dmgT = u.dmg * (u.cls==='BOMBARDERO' ? BOMB_VS_STRUCT : (u.habilidades && u.habilidades.antimuro ? 2 : 1));
            tu.hp -= dmgT * spT;
            tu.occupant.hp -= dmgT * (1 - spT);
            /* Aviso piloto en perigo */
            if(!tu.occupant.warned && tu.occupant.hp < tu.occupant.max*0.34 && tu.occupant.team===PT){
              tu.occupant.warned = true;
              const line = pickLine('under_fire', tu.occupant);
              if(typeof radio==='function') radio(line, '#ffd24a');
              panelInterrupt = {unit: tu.occupant, until: g.t + 60*4, line};
            }
            /* KIA do piloto dentro */
            if(tu.occupant.hp <= 0){
              const dead = tu.occupant;
              dead.dead = true;
              dead.deathCause = u.cls;  /* (v0.12) memoria */
              u.kills++;
              g.kills[u.team]++;
              if(dead.team !== PT) dropScrap(g, tu.x, tu.y, CHATARRA_VALUES[dead.cls] || 5);
              if(dead.team===PT){
                const place = (typeof placeAt==='function')?placeAt(tu.x, tu.y):'campo';
                if(typeof radio==='function') radio(TXT('r.caeuTorreta', {n:dead.name}), '#ff5340');
                if(typeof sfx==='function') sfx('signal_lost');
                g.remains.push({
                  x: tu.x + 22, y: tu.y + 22,
                  unit: dead, timer:90*60, secured:false, place,
                });
                if(typeof logEvent==='function') logEvent(dead, {type:'CAYO_EN', place});
              }
              dead.inside = null;
              tu.occupant = null;
              tu.sel = false;
            }
          } else {
            /* Baleira: todo o dano vai á estructura */
            tu.hp -= u.dmg;
          }
          g.tracers.push({x1:u.x,y1:u.y,x2:tu.x,y2:tu.y,t:6,team:u.team});
          break;  /* só ataca unha torreta por frame */
        }
      }
    }

    /* (v0.10) Atacar vehículos (jeeps) inimigos en rango — só se non disparou xa */
    if(u.cool<=0 && g.vehicles){
      for(const veh of g.vehicles){
        if(veh.team === 2 && !veh.occupant) continue;   /* (v0.62.1) o balón baleiro non é alvo */
        if(veh.destroyed || veh.team===u.team || veh.team===-1) continue;
        const dV = Math.hypot(veh.x-u.x, veh.y-u.y);
        if(dV <= u.rng + 5){
          u.cool = u.fireCool || 46; if(u.act) u.act.shots++; u._revealT = g.t; if(u.team===PT||rnd()<0.5) sfxT('shot_'+u.cls.toLowerCase(), 75);
          if(veh.occupant && !veh.occupant.dead){
            /* (v0.14) Split por atacante e vehículo:
               normal→jeep 70/30 · normal→tanque 85/15 (blindado)
               SNIPER→jeep 30/70 · SNIPER→tanque 25/75 (especialista en desocupar) */
            let sp = u.cls==='SNIPER' ? 0.30 : (u.habilidades && u.habilidades.cazapilotos ? 0.50 : 0.70);
            if(veh.tipo==='TANQUE') sp = u.cls==='SNIPER' ? 0.25 : (u.habilidades && u.habilidades.cazapilotos ? 0.55 : 0.85);
            const dmgV = u.dmg * (u.cls==='BOMBARDERO' ? BOMB_VS_VEH : (u.habilidades && u.habilidades.antimuro ? 2 : 1));
            veh.hp -= dmgV * sp;
            veh.occupant.hp -= dmgV * (1 - sp);
            if(!veh.occupant.warned && veh.occupant.hp < veh.occupant.max*0.34 && veh.occupant.team===PT){
              veh.occupant.warned = true;
              const line = pickLine('under_fire', veh.occupant);
              if(typeof radio==='function') radio(line, '#ffd24a');
              panelInterrupt = {unit: veh.occupant, until: g.t + 60*4, line};
            }
            if(veh.occupant.hp <= 0){
              const dead = veh.occupant;
              dead.dead = true;
              dead.deathCause = u.cls;  /* (v0.12) memoria */
              u.kills++;
              g.kills[u.team]++;
              if(dead.team !== PT) dropScrap(g, veh.x, veh.y, CHATARRA_VALUES[dead.cls] || 5);
              if(dead.team===PT){
                const place = (typeof placeAt==='function')?placeAt(veh.x, veh.y):'campo';
                if(typeof radio==='function') radio(TXT('r.caeuJeep', {n:dead.name}), '#ff5340');
                if(typeof sfx==='function') sfx('signal_lost');
                g.remains.push({
                  x: veh.x + 22, y: veh.y + 22,
                  unit: dead, timer:90*60, secured:false, place,
                });
                if(typeof logEvent==='function') logEvent(dead, {type:'CAYO_EN', place});
              }
              dead.inside = null;
              veh.occupant = null;
              veh.sel = false;
              veh.tx = veh.x; veh.ty = veh.y;  /* parar movemento */
            }
          } else {
            /* Baleiro: todo o dano vai á estructura */
            veh.hp -= u.dmg * (u.cls==='BOMBARDERO' ? BOMB_VS_VEH : 1);
          }
          g.tracers.push({x1:u.x,y1:u.y,x2:veh.x,y2:veh.y,t:6,team:u.team});
          break;
        }
      }
    }

    /* (v0.13) Disparar ao muro que bloquea */
    if(u.cool<=0 && u._blockingWall && !u._blockingWall.destroyed){
      const dw = Math.hypot(u._blockingWall.x-u.x, u._blockingWall.y-u.y);
      if(dw <= u.rng + 12){
        u.cool = u.fireCool || 46; if(u.act) u.act.shots++; u._revealT = g.t; if(u.team===PT||rnd()<0.5) sfxT('shot_'+u.cls.toLowerCase(), 75);
        /* (v0.27.1) A IA non roe muros mentres a cazas: primeiro intenta rodealos */
        if(u.team !== PT && u.cls !== 'BOMBARDERO' && (u._wallTries || 0) < 2){
          u._wallTries = (u._wallTries || 0) + 1;
          const lado = (u._wallTries % 2 === 1) ? 1 : -1;
          const w2 = u._blockingWall;
          const horiz = Math.abs(u.x - w2.x) > Math.abs(u.y - w2.y);
          if(horiz) orderMove(u, u.x, u.y + lado * 56);
          else orderMove(u, u.x + lado * 56, u.y);
        } else {
          damageWall(g, u._blockingWall, u.dmg * (u.cls==='BOMBARDERO' ? BOMB_VS_STRUCT : (u.habilidades && u.habilidades.antimuro ? 2 : 1)));
        }
        g.tracers.push({x1:u.x,y1:u.y,x2:u._blockingWall.x,y2:u._blockingWall.y,t:6,team:u.team});
        if(u._blockingWall.destroyed) u._blockingWall = null;
      }
    }

    if(u.team===ET && g.modo !== 'pvp' && foe && fd<150 && fd>u.rng*0.8){
      orderMove(u, foe.x, foe.y);   /* (v0.35) kiting: só cando manda a IA */
    }
    /* (v0.24) GRISES: barrido de robots — perseguen ao máis próximo de CALQUERA bando */
    if(u.team===2 && g.t % 30 === 0){
      if(!foe || fd > u.rng * 1.1){
        let best = null, bd = 1e9;
        for(const o of g.units){
          if(o.dead || o.inside || o.team === 2) continue;
          const d = dist(u, o);
          if(d < bd){ bd = d; best = o; }
        }
        if(best) orderMove(u, best.x, best.y);
        else if(Math.hypot(u.tx-u.x, u.ty-u.y) < 8){
          orderMove(u, 100 + rnd()*(W-200), 100 + rnd()*(H-200));
        }
      }
    }

    /* (v0.19 R2) RECOLECTOR: brazo de ENGINEER nun non-engineer — pilla chatarra/restos/pezas */
    if(!u.eng && u.team===PT && u.habilidades && u.habilidades.recolector && g.scrap){
      for(const s of g.scrap){
        if(!s.collected && Math.hypot(u.x-s.x, u.y-s.y) < 28){
          s.collected = true;
          if(s.peza){
            g.pezasRecuperadas = g.pezasRecuperadas || [];
            g.pezasRecuperadas.push(s.peza.id);
            radio(TXT('r.recuperouPeza', {n:u.name, peza:PEZA_LABEL[s.peza.tipo].toUpperCase(), de:s.peza.deNome}), '#ff9a3c', {x:s.x, y:s.y});
            sfx('loot_pick');
          } else if(s.loot){
            g.lootGanado = g.lootGanado || [];
            g.lootGanado.push(s.loot);
            radio(TXT('r.recuperouBotin', {n:u.name}), '#ffd700', {x:s.x, y:s.y});
            sfx('loot_pick');
          } else if(u.team === PT){
            g.chatarraGanada = (g.chatarraGanada||0) + s.amount;
            radio(TXT('r.recolleuChatarra', {n: u.name, a: s.amount}), '#c8a86a', {x:s.x, y:s.y});
            sfxT('scrap_pick', 180);
          } else {
            g._chatarraET = (g._chatarraET||0) + s.amount;   /* (v0.31) crédito do rival humano */
          }
        }
      }
      for(const r of g.remains){
        if(!r.secured && r.unit && r.unit.team === u.team && Math.hypot(u.x-r.x, u.y-r.y) < 28){
          r.secured = true;
          r.recoveredBy = u.name;
          if(u.team === PT) radio(TXT('r.asegurouRestos', {n:u.name, de:r.unit.name}), '#7fdc7f', {x:r.x, y:r.y});
          else if(g.modo === 'pvp') pvpRadioET(g, `${u.name} asegurou os restos de ${r.unit.name}.`, '#7fdc7f');
        }
      }
    }
    /* (v0.22) ENGINEER albanel: construír o muro encargado, in situ e exposto */
    if(u.eng && u.buildTask && (u.team === PT || (g.modo === 'pvp' && u.team === ET))){
      const bt = u.buildTask;
      const d = Math.hypot(u.x - bt.x, u.y - bt.y);
      if(d > 26){
        /* aínda de camiño: asegurar que vai cara alí */
        if(Math.hypot(u.tx - bt.x, u.ty - bt.y) > 30) orderMove(u, bt.x + 14, bt.y);
      } else {
        bt.progress++;
        if(bt.progress % 45 === 0) sfxT('wall_hit', 300);   /* marteladas */
        if(bt.progress >= WALL_BUILD.frames){
          /* empurrar a quen estea enriba para non atrapalo */
          for(const o of g.units){
            if(!o.dead && !o.inside && Math.abs(o.x - bt.x) < 12 && Math.abs(o.y - bt.y) < 12){
              o.x += 16; o.tx = o.x;
            }
          }
          g.walls.push({x: bt.x, y: bt.y, hp: WALL_HP, max: WALL_HP, destroyed: false});
          radio(TXT('r.muroLevantado', {n:u.name}), '#7fdc7f', {x: bt.x, y: bt.y});
          sfx('capture');
          if(u.act) u.act.caps += 0;  /* (sen efecto; reservado) */
          u.buildTask = null;
        }
      }
    }
    /* Engineer: reparar + recuperar restos */
    if(u.eng){
      let reparoEsteFrame = false;
      for(const v of g.units){
        if(v.dead||v.team!==u.team||v===u) continue;
        if(dist(u,v) < u.healRange && v.hp<v.max){
          const hpBefore = v.hp;
          v.hp = Math.min(v.max, v.hp + u.healRate);
          u.repairs += u.healRate;
          reparoEsteFrame = true;
          u._curaT = g.t;   /* (v0.64) o ENXEÑEIRO inclínase: pose de CURAR.
                               _curandoT vai no paciente e é outra cousa. */
          /* (v0.83) marca no PACIENTE + soldadura no punto de contacto */
          v._curandoT = g.t;
          if(typeof efxCura === 'function') efxCura(u.x, u.y, v.x, v.y);
          /* (v0.11.1) Δ confianza: sanar de <34% a >50% = +10 (rescate in extremis, subido de 5) */
          if(v.team === PT && hpBefore < v.max*0.34 && v.hp >= v.max*0.5 && !v._savedFromCriticThisOp){
            aplicarConfianza(v, +10);
            v._savedFromCriticThisOp = true;
            v._savedBy = u.name;  /* (v0.12) memoria: quen me salvou */
            /* (v0.11.2) Frase 'saved' — a unidade salvada di algo */
            const frase = pickFrase(v, 'saved');
            if(frase && frase !== '...'){
              const est = estadoConfianza(v);
              const col = est === 'LEAL' ? '#7fdc7f'
                        : est === 'SARCASTICO' ? '#cfe0ff'
                        : est === 'DESCONFIADO' ? '#ffd24a' : '#ff5340';
              radio(`${v.name}: «${frase}»`, col, {x:v.x, y:v.y});
              v._lastFrase = {text: frase, color: col, time: Date.now()};
            }
          }
        }
      }
      /* Frase ocasional del engineer mientras repara — cada ~8s */
      if(reparoEsteFrame && u.team===PT){
        u.repairVoiceCool = (u.repairVoiceCool||0) - 1;
        if(u.repairVoiceCool <= 0){
          /* (v0.79) idem */
          u.repairVoiceCool = 60 * 8;  /* 8 segundos */
        }
      }
      /* (v0.12) Reparar ESTRUCTURAS aliadas danadas (torretas e vehículos), ao 50% da velocidade */
      const structRate = u.healRate * 0.5;
      if(g.turrets){
        for(const tu of g.turrets){
          if(tu.destroyed || tu.team !== u.team) continue;
          if(dist(u, tu) < u.healRange && tu.hp < tu.max){
            tu.hp = Math.min(tu.max, tu.hp + structRate);
            u.repairs += structRate;
            if(!tu._repairMsgShown && u.team === PT){
              radio(TXT('r.reparandoTorreta', {n:u.name, id:tu.id}), '#7fdc7f');
              tu._repairMsgShown = true;
            }
            if(tu.hp >= tu.max) tu._repairMsgShown = false;
          }
        }
      }
      if(g.vehicles){
        for(const veh of g.vehicles){
          if(veh.destroyed || veh.team !== u.team) continue;
          if(dist(u, veh) < u.healRange && veh.hp < veh.max){
            veh.hp = Math.min(veh.max, veh.hp + structRate);
            u.repairs += structRate;
            if(!veh._repairMsgShown && u.team === PT){
              radio(TXT('r.reparandoJeep', {n:u.name, id:veh.id}), '#7fdc7f');
              veh._repairMsgShown = true;
            }
            if(veh.hp >= veh.max) veh._repairMsgShown = false;
          }
        }
      }
      /* (v0.12) Recoller chatarra cercana (gancho amplia o radio) */
      const pickupR = (u.equipment && u.equipment.includes('gancho')) ? 48 : 28;
      if(u.team===PT && g.scrap){
        for(const s of g.scrap){
          if(!s.collected && Math.hypot(u.x-s.x, u.y-s.y) < pickupR){
            s.collected = true;
            if(s.peza){
              g.pezasRecuperadas = g.pezasRecuperadas || [];
              g.pezasRecuperadas.push(s.peza.id);
              radio(TXT('r.recuperouPeza', {n:u.name, peza:PEZA_LABEL[s.peza.tipo].toUpperCase(), de:s.peza.deNome}), '#ff9a3c', {x:s.x, y:s.y});
              sfx('loot_pick');
            } else if(s.loot){
              g.lootGanado = g.lootGanado || [];
              g.lootGanado.push(s.loot);
              const lbl = EQUIPOS[s.loot] ? EQUIPOS[s.loot].label : s.loot;
              radio(TXT('r.recuperouBotinL', {n:u.name, l:lbl}), '#ffd700', {x:s.x, y:s.y});
              sfx('loot_pick');
            } else if(u.team === PT){
              g.chatarraGanada = (g.chatarraGanada||0) + s.amount;
              radio(TXT('r.recolleuChatarra', {n: u.name, a: s.amount}), '#c8a86a', {x:s.x, y:s.y});
              sfxT('scrap_pick', 180);
            } else {
              g._chatarraET = (g._chatarraET||0) + s.amount;   /* (v0.31) crédito do rival humano */
            }
          }
        }
      }
      /* Recuperar restos cercanos — (v0.33) só os do PROPIO equipo */
      if(u.team===PT || (g.modo==='pvp' && u.team===ET)){
        for(const r of g.remains){
          if(!r.secured && r.unit && r.unit.team === u.team && Math.hypot(u.x-r.x, u.y-r.y) < pickupR){
            r.secured = true;
            radioSay('remains_secured', u, {targetName: r.unit.name, place: r.place}, '#7fdc7f');
            sfx('order_confirm');
            /* (v0.79) idem */
            logEvent(u, {type:'RECUPERO_A', target: r.unit.name, place: r.place});
            logEvent(r.unit, {type:'RECUPERADO_EN', place: r.place, byUnit: u.name});
            /* Tracking para rasgos/medallas del Engineer */
            u.recoveredThisOp = u.recoveredThisOp || [];
            u.recoveredThisOp.push(r.unit.id);  /* a quién recuperó (por ID) */
            u.recoveredNamesThisOp = u.recoveredNamesThisOp || [];
            u.recoveredNamesThisOp.push(r.unit.name);
          }
        }
      }
    }

    /* Movimiento con waypoints y regla de agua */
    let tx = u.tx, ty = u.ty;
    /* Si tiene waypoint y ha llegado a él, pasar al siguiente */
    if(u.waypoints && u.waypoints.length>0){
      const w = u.waypoints[0];
      if(Math.hypot(u.x-w.x, u.y-w.y) < 14){
        u.waypoints.shift();
        if(u.waypoints.length>0){ u.tx=u.waypoints[0].x; u.ty=u.waypoints[0].y; }
        /* (v1.02) O punto dáse por bo a 14 px, e ese metro e pico chega
           para CORTAR A ESQUINA: a ruta calculouse desde o centro do
           punto e a unidade sae del por outro sitio, así que o tramo
           seguinte pode ter xa un muro polo medio. Compróbase aquí —
           unha vez por tramo, non por fotograma— e se non está limpo,
           recalcúlase desde onde está de verdade. */
        if(u.waypoints.length > 0 && typeof vistaLibre === 'function'
           && (window._bioma || 'VERDE') === 'INTERIOR'
           && !vistaLibre(u.x, u.y, u.tx, u.ty) && u._destino){
          const d3 = u._destino;
          u._destino = null;
          orderMove(u, d3.x, d3.y);
        }
      }
      tx = u.tx; ty = u.ty;
    }
    const dx=tx-u.x, dy=ty-u.y, d=Math.hypot(dx,dy);
    if(d>3){
      let sp=u.spd;
      const nx=u.x+dx/d*sp, ny=u.y+dy/d*sp;
      /* (v0.13) Muro no camiño: parar e marcalo como obxectivo */
      const bw = inWall(g, nx, ny);
      if(bw){ u._blockingWall = bw; continue; }
      u._blockingWall = null;
      /* (v1.01) FORMIGÓN NO CAMIÑO: non se derruba e non hai pathfinding,
         así que hai que ESVARAR. Próbase mover só nun eixo e despois só
         no outro; se ningún dos dous vale, é unha esquina e quédase.

         Sen isto, un escuadrón mandado ao outro lado do edificio
         quedaba pegado á parede empurrando de fronte para sempre, que é
         o que fai que un interior sen navegación non se poida xogar.
         Non é un camiño óptimo —non pretende selo—, pero segue a parede
         ata a porta, que é o que fai unha persoa nun corredor. */
      if(typeof macizoEn === 'function' && macizoEn(nx, ny)){
        const _x0 = u.x, _y0 = u.y;
        if(!macizoEn(nx, u.y)) u.x = nx;
        else if(!macizoEn(u.x, ny)) u.y = ny;
        /* (v1.02) A PREGUNTA É SE AVANZOU, NON SE ESVAROU.

           Isto medíase antes coma "algún eixo se puido mover", e estaba
           mal: indo case en horizontal, `ny` é practicamente `u.y`, así
           que o esvaramento vertical "funcionaba" desprazando cero
           píxeles e reiniciaba o contador. A unidade vibraba contra a
           parede indefinidamente e o contador nunca chegaba a saltar.
           Era a metade dos casos que non chegaban a destino.

           Agora mídese o desprazamento real. Se non chega a un terzo do
           paso, iso é estar tesa, e tras medio segundo pídese ruta OUTRA
           VEZ desde onde estea — que xa non é onde estaba cando se
           calculou a primeira. */
        const avance = Math.hypot(u.x - _x0, u.y - _y0);
        if(avance < sp * 0.35){
          u._atranco = (u._atranco || 0) + 1;
          if(u._atranco > 24 && u._destino){
            u._atranco = 0;
            const d2 = u._destino;
            u._destino = null;               /* que orderMove non recurse */
            orderMove(u, d2.x, d2.y);
          }
          continue;
        }
        u._atranco = 0;
        if(u.act) u.act.dist += avance;
        u._movedT = g.t;
        u.x=clamp(u.x,8,W-8); u.y=clamp(u.y,8,H-8);
        continue;
      }
      u._atranco = 0;
      if(inWater(nx,ny)){
        if(u.heavy){
          /* Non avanzar neste frame. Os waypoints xa apuntan á ponte;
             tentar de novo no seguinte frame con micro-axuste cara o waypoint */
          /* Pequeno empuxe perpendicular para desbloquear se quedou tanxente */
          const perpX = -dy/d, perpY = dx/d;
          const tryX = u.x + perpX * 0.5;
          const tryY = u.y + perpY * 0.5;
          if(!inWater(tryX, tryY)){
            u.x = tryX; u.y = tryY;
          }
          continue;
        }
        sp = u.spd*0.4;
      }
      u.x += dx/d*sp; u.y += dy/d*sp;
      if(u.act) u.act.dist += sp;
      u._movedT = g.t;
      u.x=clamp(u.x,8,W-8); u.y=clamp(u.y,8,H-8);
    }

    /* (v0.12) Kit de autorreparación: rexenera fóra de combate (>5s sen disparar) */
    if(((u.equipment && u.equipment.includes('kit')) || u.sinergia === 'NUCLEO_QUENTE') && u.hp < u.max){
      if(g.t - (u.defendLastFireT||0) > 60*5){
        u.hp = Math.min(u.max, u.hp + 0.04);
      }
    }
    /* Track de cruce de río */
    if(u.team===PT){
      const side = u.x < RIVER.x1 ? 'L' : (u.x > RIVER.x2 ? 'R' : 'M');
      if(side!=='M' && u.lastSideOfRiver!=='M' && side !== u.lastSideOfRiver){
        u.crossingsThisOp++;
      }
      if(side!=='M') u.lastSideOfRiver = side;
    }

    /* Track de DEFENDIO: en sector propio + bajo fuego reciente */
    if(u.team===PT){
      const here = placeAt(u.x, u.y);
      const inOwnSector = SECTORS.some(s=>s.place===here && g.sectors.find(gs=>gs.id===s.id)?.owner===PT);
      const recentlyFought = (g.t - u.defendLastFireT) < 60*8; // últimos 8s
      if(inOwnSector && recentlyFought){
        if(u.defendPlace !== here){
          u.defendPlace = here;
          u.defendStartT = g.t;
        }
      } else if(u.defendPlace){
        /* Salió del lugar o dejó de combatir: registrar si fue significativo */
        const durSec = (g.t - u.defendStartT)/60;
        if(durSec >= 30){  // mínimo 30s para que cuente
          logEvent(u, {type:'DEFENDIO', place:u.defendPlace, duration: Math.round(durSec)});
        }
        u.defendPlace = null;
      }
    }
  }

  /* Restos: timer y limpieza */
  for(const r of g.remains){
    if(r.expired) continue;
    if(!r.secured){
      /* (v1.06) Os restos de ESCENARIO non levan reloxo: xa levan aí
         desde antes de que chegases. Non caducan, non se poden
         asegurar e non teñen nome — están para que preguntes que
         pasou aquí, non para que os recollas. */
      if(r.escenario) continue;
      r.timer--;
      if(r.timer<=0){ r.expired = true; }
    }
  }
  /* (v0.12) Chatarra: timer */
  if(g.scrap){
    for(const s of g.scrap){
      if(s.collected) continue;
      s.timer--;
      if(s.timer<=0) s.collected = true;  /* oxida e desaparece */
    }
  }
  /* (v0.21) A voz do HQ */
  if(g.t % 30 === 0) tickHQ(g);
  /* (v0.84) O titorial vai co mesmo pulso que o resto: comproba
     condicións, non tempos, así que abonda con mirar de cando en vez. */
  if(g.t % 20 === 0 && typeof tickTitorial === 'function') tickTitorial(g);
  /* (v0.23) Subquests: condicións + panel */
  if(g.t % 15 === 0 && g.modo !== 'pvp'){ tickSubquests(g); renderSqPanel(g); }
  /* (v0.26.1) Aviso didáctico: o radar é o detector de misións */
  if(!g._radarHint && g.modo !== 'pvp' && g.t > 1500 && DATA.opCount >= 1 && g.radar && g.radar.owner !== PT){
    g._radarHint = true;
    hqSay(TXT('hq.radarHint'), 0, 'hq.radarHint');
  }
  /* (v0.26) anuncio do clima ao empezar */
  if(!g._climaAnunciado && g.t > 90){
    g._climaAnunciado = true;
    if(g.clima && g.clima.id !== 'CLARO'){
      hqSay(TXT('hq.clima', {label: TXT('clima.' + g.clima.id), vis: Math.round(g.clima.vis*100)}));
    }
  }
  /* (v0.26) RIVALIDADES: o marcador cántase en vivo */
  if(g.t % 60 === 0){
    for(const u of g.units){
      if(u.dead || u.team !== PT || !u.rival) continue;
      if(u._rivalLastK === undefined) u._rivalLastK = u.kills;
      if(u.kills > u._rivalLastK){
        u._rivalLastK = u.kills;
        const outro = g.units.find(o => o.id === u.rival.con && !o.dead);
        if(outro && (!g._rivalT || g.t - g._rivalT > 1500)){
          g._rivalT = g.t;
          const vai = u.kills > outro.kills ? TXT('r.rivalPerdendo') : u.kills === outro.kills ? TXT('r.rivalEmpate') : TXT('r.rivalRespiras');
          radio(`${u.name}: «${u.kills}. ${outro.name}: ${outro.kills}. ${vai}»`, '#ff9a3c', {x:u.x, y:u.y});
          sfxT('voice_blip', 180, u.cls);
        }
      }
    }
  }
  /* (v0.24.1) VOLT */
  if(g.t % 45 === 0 && g.modo !== 'crisol' && g.modo !== 'pvp') tickVolt(g);
  /* (v0.25.4) COLAPSO INIMIGO — anti-farmeo: sen sectores e co HQ afundido,
     as súas fábricas paran e VOLT abre a conta atrás da demolición */
  if(g.t % 30 === 0 && !g.over){
    if(g.modo !== 'crisol' && g.modo !== 'pvp' && !g._colapso && g.hq[ET].hp > 0 && g.hq[ET].hp < g.hq[ET].max * 0.30
       && !g.sectors.some(s => s.owner === ET)){
      g._colapso = g.t;
      g.prod[ET] = null;   /* a fábrica morre */
      hqSay(TXT('hq.colapso'), 0, 'hq.colapso');
      setTimeout(() => voltSay('grumble'), 2500);
    }
    if(g._colapso){
      const restante = 5400 - (g.t - g._colapso);
      if(restante <= 3600 && !g._colAviso60){ g._colAviso60 = true; hqSay(TXT('hq.peche60'), 0, 'hq.peche60'); }
      if(restante <= 1800 && !g._colAviso30){ g._colAviso30 = true; hqSay(TXT('hq.peche30'), 0, 'hq.peche30'); }
      if(restante <= 600 && !g._colAviso10){ g._colAviso10 = true; hqSay(TXT('hq.peche10'), 0, 'hq.peche10'); }
      if(restante <= 0){
        radio(TXT('r.voltTornillos'), '#ff7a5a');
        sfxT('voice_blip', 250, 'VOLT');
        g.hq[ET].hp = 0;
        addShake(g, 8);
        g.booms = g.booms || [];
        g.booms.push({x: g.hq[ET].x + g.hq[ET].w/2, y: g.hq[ET].y + g.hq[ET].h/2, t: 14, big: true});
        sfxT('expl_struct', 150);
      }
    }
  }
  /* (v0.24) OS GRISES: 18% por op desde a op 5, a media batalla */
  /* (v0.27.2) O CRISOL: xestor de oleadas */
  if(g.modo === 'crisol' && !g.over && g.t % 30 === 0){
    const vivos2 = g.units.filter(u => u.team === 2 && !u.dead).length;
    const meus2 = g.units.filter(u => u.team === PT && !u.dead).length;
    if(meus2 === 0 && !g.prod[PT] && g._wave > 0){
      radio('▣ ÓPTIMA: ' + TXT('optima.crisolDerrota'), '#e8c060');
      /* A marca queda gardada: nun modo sen vitoria, o rexistro É o
         resultado. */
      try{
        DATA.marcas = DATA.marcas || {};
        if((DATA.marcas.crisolRecord || 0) < g._wave){
          DATA.marcas.crisolRecord = g._wave;
          radio('★ ' + TXT('cri.record', {n: g._wave}), '#ffd700');
        }
      }catch(e){ console.error('[crisol]', e); }
      g.hq[PT].hp = 0;
    } else if(vivos2 === 0){
      /* O CRISOL NON REMATA EN VITORIA. Antes pechaba na oleada 5 e
         dábache a proba por superada; agora segue mentres che quede
         alguén vivo, que é o que é un modo de supervivencia. A única
         saída é a de arriba: quedar sen ninguén e sen produción.

         A oleada 5 conserva a liña de ÓPTIMA, pero xa non como final:
         a validación complétase e a máquina segue mandando xente. */
      if(g._wave === 5 && !g._crisolAviso){
        g._crisolAviso = true;
        radio('▣ ÓPTIMA: ' + TXT('optima.crisolVitoria'), '#e8c060');
        hqSay(TXT('hq.crisolVitoria'), 0, 'hq.crisolVitoria');
      }
      if(g.t - g._waveClearT > 700){
        g._wave++;
        g._waveClearT = g.t;
        /* TOPE DE 12 POR OLEADA. Sen el, "2 + oleada" chega a sesenta
           robots á vez e o que remata a partida é a taxa de fotogramas,
           non o inimigo. A dificultade segue subindo pola vida e polas
           clases, que non custan rendemento. */
        const n = Math.min(12, 2 + g._wave);
        const dende = rnd() < 0.5 ? 30 : H - 30;
        const x0 = 150 + rnd() * (W - 300);
        g._greysN = g._greysN || 0;
        for(let i = 0; i < n; i++){
          /* Máis fondo de catálogo segundo avanza: a partir da 6 aparece
             o bombardeiro, e da 8 en diante a metade da oleada deixa de
             ser tropa de recheo. */
          let cls = 'GRUNT';
          if(i === 0 && g._wave >= 3) cls = 'HEAVY';
          else if(i === 1 && g._wave >= 4) cls = 'SNIPER';
          else if(i === 2 && g._wave >= 6) cls = 'BOMBARDERO';
          else if(g._wave >= 8 && i % 2 === 1) cls = rnd() < 0.5 ? 'HEAVY' : 'SNIPER';
          /* (v1.01) Mesmo caso ca en spawnGreys: o bordo do mapa nunha
             planta de interior é a cortiza, non o campo. */
          const _s = saírDoMacizo(x0 + (i - n/2) * 26, dende + (rnd()*16 - 8));
          const u = mkUnit(2, cls, _s.x, _s.y, null);
          g._greysN++;
          u.name = 'VAL-' + String(g._greysN).padStart(2, '0');
          const f = 1 + 0.07 * g._wave;
          u.hp = Math.round(u.hp * f); u.max = u.hp;
          g.units.push(u);
          orderMove(u, W/2 + (rnd()*240 - 120), H/2 + (rnd()*180 - 90));
        }
        radio('▣ ÓPTIMA: ' + TXT('optima.iteracion', {n: g._wave, u: n}), '#e8c060');
        sfxT('voice_blip', 200, 'OPTIMA');
        addShake(g, 2);
      } else if(g._wave > 0 && !g._waveBreather){
        g._waveBreather = true;
        hqSay(TXT('hq.oleada', {n: g._wave}));
      }
    }
    if(vivos2 > 0) g._waveBreather = false;
  }
  if(g.modo !== 'crisol' && g.modo !== 'pvp' && !g._greysTried && g.t > 2700 && DATA.opCount >= 3){
    g._greysTried = true;
    if(rnd() < 0.30) spawnGreys(g);
  }
  /* (v0.21 R2) VÍNCULOS: buff activo se o compañeiro está preto */
  if(g.t % 20 === 0){
    for(const u of g.units){
      if(u.dead || u.team !== PT || !u.vinculos || !u.vinculos.length) continue;
      if(u._dmgBase === undefined) u._dmgBase = u.dmg;
      let activo = false, conQuen = null;
      for(const v of u.vinculos){
        const outro = g.units.find(o => o.id === v.con && !o.dead && !o.inside);
        if(outro && Math.hypot(u.x - outro.x, u.y - outro.y) < VINCULO.RADIO){
          activo = true; conQuen = outro; break;
        }
      }
      u._vinculoActivo = activo;
      u.dmg = Math.round(u._dmgBase * (activo ? VINCULO.BUFF : 1));
      if(activo && conQuen){
        g._vincAnunciados = g._vincAnunciados || new Set();
        const chave = [u.id, conQuen.id].sort().join('|');
        if(!g._vincAnunciados.has(chave)){
          g._vincAnunciados.add(chave);
          radio(TXT('r.vellosEquipo', {a:u.name, b:conQuen.name}), '#ffd700', {x:u.x, y:u.y});
          sfxT('voice_blip', 200, u.cls);
        }
      }
    }
  }
  /* (v0.19 R2) Portadores mortos soltan a peza — varrido único que cobre todos os sitios de morte */
  for(const u of g.units){
    if(u.dead && u._pezaPortada && !u._pezaDropped){
      u._pezaDropped = true;
      g.scrap = g.scrap || [];
      g.scrap.push({x:u.x+8, y:u.y-10, amount:0, peza:u._pezaPortada, timer:90*60, collected:false});
      radio(TXT('r.pezaNoChan', {peza:PEZA_LABEL[u._pezaPortada.tipo].toUpperCase(), de:u._pezaPortada.deNome}), '#ff9a3c', {x:u.x, y:u.y});
    }
  }
}

