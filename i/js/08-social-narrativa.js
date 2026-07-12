/* ============================================================
   SUBQUESTS (v0.23 SQ1) — misións secundarias que XORDEN do
   estado real da partida. O RADAR é quen as detecta: sen radar,
   o que pasa no mapa pasa ás túas costas.
   ============================================================ */
let _sqPanel = null;
function ensureSqPanel(){
  if(_sqPanel) return _sqPanel;
  _sqPanel = document.createElement('div');
  _sqPanel.id = 'sqPanel';
  _sqPanel.style.cssText = 'position:fixed; right:8px; top:230px; width:230px; background:rgba(10,10,10,0.88); border:1px solid #6a4a9a; font-family:Courier New; font-size:11px; color:#cbb8ee; z-index:40; display:none;';
  _sqPanel.innerHTML = '<div id="sqHead" style="padding:5px 8px; cursor:pointer; color:#b48aff; border-bottom:1px solid #443366;">◈ MISIÓNS ▾</div><div id="sqList"></div>';
  document.body.appendChild(_sqPanel);
  _sqPanel.querySelector('#sqHead').addEventListener('click', () => {
    const l = _sqPanel.querySelector('#sqList');
    const pregado = l.style.display === 'none';
    l.style.display = pregado ? '' : 'none';
    _sqPanel.querySelector('#sqHead').textContent = pregado ? '◈ MISIÓNS ▾' : '◈ MISIÓNS ▸';
  });
  return _sqPanel;
}

function addSubquest(g, q){
  g.subquests = g.subquests || [];
  q.id = 'SQ' + (g.subquests.length + 1) + '_' + Math.floor(Math.random()*999);
  g.subquests.push(q);
  sfx('radio_open');
  return q;
}

function renderSqPanel(g){
  const panel = ensureSqPanel();
  const activas = (g.subquests || []).filter(q => !q._gone);
  if(!activas.length || !g || g.over){ panel.style.display = 'none'; return; }
  panel.style.display = '';
  const list = panel.querySelector('#sqList');
  let html = '';
  for(const q of activas){
    const estado = q.done ? '<b style="color:#7fdc7f;">✓ CUMPRIDA</b>'
                 : q.failed ? '<b style="color:#ff5340;">✖ PERDIDA</b>'
                 : (q.progressMax ? `${Math.round((q.progress||0)/q.progressMax*100)}%` : 'activa');
    html += `<div data-sq="${q.id}" style="padding:6px 8px; border-bottom:1px solid #332244; cursor:pointer;" title="Clic: centrar cámara">
      <div style="color:${q.done ? '#7fdc7f' : q.failed ? '#ff5340' : '#e0d0ff'};">${q.titulo}</div>
      <div class="small" style="color:#8a7aaa;">${q.desc} · ${estado}</div></div>`;
  }
  if(list.innerHTML !== html){
    list.innerHTML = html;
    list.querySelectorAll('[data-sq]').forEach(el => {
      el.addEventListener('click', () => {
        const q = (g.subquests||[]).find(x => x.id === el.dataset.sq);
        if(q) camJumpTo(q.x, q.y);
      });
    });
  }
}

function tickSubquests(g){
  g.subquests = g.subquests || [];
  const radarMeu = g.radar && g.radar.owner === PT;

  /* SPAWN — TECNOLOXÍA DESCOÑECIDA: unha vez por op, detectada polo radar */
  if(!g._sqTecTried && g.t > 2400 && radarMeu){
    g._sqTecTried = true;
    if(Math.random() < 0.45){
      /* punto en terra no terzo central do mapa */
      let cx = 0, cy = 0, tent = 0;
      do {
        cx = W * (0.35 + Math.random() * 0.3);
        cy = H * (0.2 + Math.random() * 0.6);
        tent++;
      } while((inWater(cx, cy) || inWall(g, cx, cy)) && tent < 40);
      addSubquest(g, {
        tipo: 'TECNOLOXIA', x: cx, y: cy,
        titulo: '◈ Tecnoloxía descoñecida',
        desc: 'Achega un ENGINEER para analizala',
        progress: 0, progressMax: 180,
      });
      hqSay('Tecnología no identificada detectada en el sector central. Se requiere INGENIERO.');
    }
  }

  /* SPAWN — RESTOS INCRUSTADOS NUN MURO: demolición requerida (co radar) */
  if(!g._sqMuroTried && g.t > 1500 && radarMeu){
    g._sqMuroTried = true;
    if(Math.random() < 0.40){
      /* muro intacto lonxe de ambos HQs */
      const hq0 = g.hq[0], hq1 = g.hq[1];
      const cands = (g.walls || []).filter(w => !w.destroyed
        && Math.hypot(w.x - (hq0.x + hq0.w/2), w.y - (hq0.y + hq0.h/2)) > 180
        && Math.hypot(w.x - (hq1.x + hq1.w/2), w.y - (hq1.y + hq1.h/2)) > 180);
      if(cands.length){
        const w = cands[Math.floor(Math.random() * cands.length)];
        /* que hai dentro: peza do pool perdido (60% se hai) ou caché de chatarra */
        let peza = null;
        const pool = (DATA.piezasEnemigas || []).filter(p => !(g._pezasEnCampo && g._pezasEnCampo.has(p.id)));
        if(pool.length && Math.random() < 0.6){
          peza = pool[Math.floor(Math.random() * pool.length)];
          g._pezasEnCampo = g._pezasEnCampo || new Set();
          g._pezasEnCampo.add(peza.id);
        }
        addSubquest(g, {
          tipo: 'MURO_RESTOS', x: w.x, y: w.y, wallRef: w, peza,
          titulo: peza ? `⚙ Restos no muro: ${PEZA_LABEL[peza.tipo]} de ${peza.deNome}` : '◈ Restos incrustados nun muro',
          desc: 'Tomba o muro e recolle o que garda',
          bounty: peza ? 0 : 6,
        });
        hqSay('Ecos estructurales anómalos: restos aliados incrustados en un muro. Demolición requerida.');
      }
    }
  }

  for(const q of g.subquests){
    if(q._gone) continue;
    /* retirar do panel 6s despois de rematar */
    if((q.done || q.failed) && g.t - (q._doneT || 0) > 360){ q._gone = true; continue; }
    if(q.done || q.failed) continue;

    if(q.tipo === 'RECUPERACION'){
      /* seguir ao portador vivo; se caeu, seguir ao drop */
      const carrier = q.carrier;
      if(carrier && !carrier.dead){
        q.x = carrier.x; q.y = carrier.y;
      } else {
        const drop = (g.scrap || []).find(s => s.peza && s.peza.id === q.pezaId && !s.collected);
        if(drop){ q.x = drop.x; q.y = drop.y; }
        else if(!(g.pezasRecuperadas || []).includes(q.pezaId)){
          /* nin portador nin drop nin recuperada → oxidou/perdida */
          q.failed = true; q._doneT = g.t;
          hqSay('Señal de material propio perdida.');
        }
      }
      if((g.pezasRecuperadas || []).includes(q.pezaId)){
        const recolector = g.units.find(u => u.team === PT && !u.dead && Math.hypot(u.x - q.x, u.y - q.y) < 60);
        completarSubquest(g, q, recolector);
      }
    }

    if(q.tipo === 'MURO_RESTOS'){
      /* Muro derrubado → o que gardaba cae ao chan */
      if(q.wallRef.destroyed && !q._dropped){
        q._dropped = true;
        g.scrap = g.scrap || [];
        if(q.peza){
          q._drop = {x: q.x, y: q.y - 4, amount: 0, peza: q.peza, timer: 90 * 60, collected: false};
          radio(`⚙ ${PEZA_LABEL[q.peza.tipo].toUpperCase()} DE ${q.peza.deNome} entre os cascallos!`, '#ff9a3c', {x: q.x, y: q.y});
        } else {
          q._drop = {x: q.x, y: q.y - 4, amount: 18, timer: 90 * 60, collected: false};
          radio('◈ Caché de chatarra entre os cascallos.', '#c8a86a', {x: q.x, y: q.y});
        }
        g.scrap.push(q._drop);
      }
      if(q._drop){
        q.x = q._drop.x; q.y = q._drop.y;
        if(q.peza && (g.pezasRecuperadas || []).includes(q.peza.id)){
          const quen = g.units.find(u => u.team === PT && !u.dead && Math.hypot(u.x - q.x, u.y - q.y) < 60);
          completarSubquest(g, q, quen);
        } else if(!q.peza && q._drop.collected && q._drop.timer > 0){
          const quen = g.units.find(u => u.team === PT && !u.dead && Math.hypot(u.x - q.x, u.y - q.y) < 60);
          completarSubquest(g, q, quen);
        } else if(q._drop.collected && q._drop.timer <= 0){
          q.failed = true; q._doneT = g.t;
          hqSay('Restos oxidados. Recuperación fallida.');
        }
      }
    }

    if(q.tipo === 'TECNOLOXIA'){
      const eng = g.units.find(u => u.team === PT && !u.dead && !u.inside && u.eng
                                    && Math.hypot(u.x - q.x, u.y - q.y) < 26);
      if(eng){
        q.progress++;
        if(q.progress % 50 === 0) sfxT('shot_engineer', 300);
        if(q.progress >= q.progressMax){
          /* Equipo ÚNICO non fabricable: só do inimigo ou dos grises */
          const unicos = [
            {id:'optica_termica', nome:'ÓPTICA TÉRMICA', desc:'+40 de visión na néboa'},
            {id:'servo_alleo',    nome:'SERVO ALLEO',    desc:'+8% velocidade e dano'},
          ];
          const eq = unicos[Math.floor(Math.random() * unicos.length)];
          eng.equipment = eng.equipment || [];
          eng.equipment.push(eq.id);
          if(eq.id === 'servo_alleo'){ eng.spd *= 1.08; eng.dmg = Math.round(eng.dmg * 1.08); if(eng._dmgBase) eng._dmgBase *= 1.08; }
          const rec = DATA.units.find(r => r.id === eng.id);
          if(rec){ rec.equipment = rec.equipment || []; rec.equipment.push(eq.id); }
          radio(`◈ ${eng.name} analizou a tecnoloxía: ${eq.nome} — ${eq.desc}. Non se fabrica: só se ROUBA.`, '#b48aff', {x:q.x, y:q.y});
          completarSubquest(g, q, eng);
        }
      } else if(q.progress > 0){
        q.progress = Math.max(0, q.progress - 2);   /* sen engineer, a análise decae */
      }
    }
  }
}

function completarSubquest(g, q, unidade){
  if(q.done || q.failed) return;
  q.done = true;
  q._doneT = g.t;
  if(q.bounty){
    g.chatarraGanada = (g.chatarraGanada || 0) + q.bounty;
  }
  if(unidade){
    unidade.confianza = Math.min(100, (unidade.confianza || 50) + 2);
    radio(`◈ ${unidade.name}: misión secundaria cumprida.`, '#b48aff', {x:unidade.x, y:unidade.y});
  }
  hqSay(`Objetivo secundario completado.${q.bounty ? ` Prima: ${q.bounty} de chatarra.` : ''}`);
  sfx('loot_pick');
}

/* ============================================================
   A VOZ DO HQ (v0.21) — terceira voz do xogo. Máquina operativa:
   datos, prioridades, silencio. Sen retranca (iso é de ÓPTIMA),
   sen barro (iso é das unidades).
   ============================================================ */
function hqSay(text, delayMs = 0){
  const emit = () => {
    radio(`HQ: ${text}`, '#8aa0b8');
    sfxT('voice_blip', 200, 'HQ');
  };
  if(delayMs > 0) setTimeout(emit, delayMs);
  else emit();
}

/* ============================================================
   VOLT (v0.24.1) — o comandante inimigo. Cuarta voz: seco,
   competitivo, rancoroso. Odia a ÓPTIMA case tanto coma a ti.
   Os SEUS veteranos tamén teñen nome — e ti podes matalos.
   ============================================================ */
const VOLT_NOMES = ['KILO','VATIO','DINAMO','FUSIBLE','TENAZA','CROMO','BUJIA','DIODO','PERNO','LASTRE'];
const VOLT_LINES = {
  intro: ["Aquí VOLT. Otra vez vosotros. Acabemos rápido.",
          "VOLT en frecuencia. He leído vuestro expediente. Mediocre.",
          "Mismo barro, mismos errores. Adelante."],
  taunt: ["Uno menos. Los contamos por vosotros.",
          "¿Ese tenía nombre? Ya no importa.",
          "Chatarra vuestra, campo mío."],
  grumble: ["Material reemplazable. Seguid gastando munición.",
            "Cada baja mía la pagaréis dos veces."],
  rage: ["{name}... Esa me la vais a pagar.",
         "{name} tenía historial. Ahora tenéis mi atención."],
  derrotado: ["Retirada táctica. Esto no acaba aquí.",
              "Quedaos el campo. Yo me quedo la lección."],
  vencedor: ["Informad a ÓPTIMA: VOLT no negocia.",
             "Recoged lo que os deje. Si os dejo algo."],
};
function voltSay(pool, ctx = {}){
  const arr = VOLT_LINES[pool];
  let t = arr[Math.floor(Math.random() * arr.length)];
  t = t.replace('{name}', ctx.name || '');
  radio(`VOLT: «${t}»`, '#ff7a5a');
  sfxT('voice_blip', 250, 'VOLT');
}

function tickVolt(g){
  if(DATA.opCount < 2) return;
  /* presentación unha vez por op */
  if(!g._voltIntro && g.t > 600){
    g._voltIntro = true;
    if(Math.random() < 0.6) voltSay('intro');
  }
  /* burla cando cae un teu (throttle 40s) */
  if(!g._voltTauntT || g.t - g._voltTauntT > 2400){
    const caido = g.units.find(u => u.team === PT && u.dead && u._hqMourned && !u._voltTaunted);
    if(caido){
      caido._voltTaunted = true;
      if(Math.random() < 0.35){
        g._voltTauntT = g.t;
        setTimeout(() => voltSay('taunt'), 3500);
      }
    }
  }
  /* rosma cando perde material */
  if(!g._voltGr1 && g.kills[PT] >= 6){ g._voltGr1 = true; voltSay('grumble'); }
  /* morte dun veterano SEU: rabia + parte de baixa */
  for(const u of g.units){
    if(u.team === ET && u.dead && u._voltVet && !u._voltMourned){
      u._voltMourned = true;
      const vet = u._voltVet;
      DATA.voltRoster = (DATA.voltRoster || []).filter(v => v.id !== vet.id);
      radio(`★ Baixa confirmada: ${vet.name}, veterano inimigo (${vet.ops} ops).`, '#ffd700');
      g.chatarraGanada = (g.chatarraGanada || 0) + 8;
      setTimeout(() => voltSay('rage', {name: vet.name}), 2000);
    }
  }
}

/* ============================================================
   ESCUDO DE SUBMINISTRO (v0.26.1) — o HQ é INVULNERABLE mentres
   o seu bando controle algún sector. Nada de rush: primeiro
   córtaslle as liñas, despois derrúbalo. A guerra é o mapa.
   (Deseño a partir do rush de 3 snipers da partida de Agarfal.)
   ============================================================ */
function hqEscudado(g, hqIdx){
  if(!g.sectors) return false;
  const def = g.sectors.filter(s => s.owner === hqIdx).length;
  const atk = g.sectors.filter(s => s.owner === (1 - hqIdx)).length;
  return !(atk > def);   /* exposto SÓ se o atacante domina o mapa */
}
function avisoEscudo(g, hqIdx, atacanteTeam){
  if(atacanteTeam !== 0) return;
  if(!g._escudoAvisado){
    g._escudoAvisado = true;
    hqSay('HQ enemigo bajo ESCUDO DE SUMINISTRO. Solo cae si controlas MÁS sectores que él.');
  }
}

/* ============================================================
   OS GRISES (v0.24) — Brigadas de Requisa de ÓPTIMA. Team 2:
   hostís a AMBOS bandos, nunca aos HQs. Quedan ata que os maten.
   Veñen por chasis. A xustificación é sempre absurda.
   ============================================================ */
const REQUISAS_OPTIMA = [
  'AVISO DE REQUISA: la División de Reciclaje Preventivo recolectará chasis operativos para la nueva línea de inodoros institucionales. La resistencia computa como donación voluntaria.',
  'Sus unidades han sido preseleccionadas para el programa de repuestos corporativos. Enhorabuena. La brigada de requisa no negocia.',
  'ÓPTIMA requisa material rodante para la fabricación de percheros ejecutivos. Todo chasis es susceptible. Mantengan la calma reglamentaria.',
  'Recordatorio: el inventario de ÓPTIMA incluye a ÓPTIMA, a ustedes, y al enemigo. La brigada procede a actualizar existencias.',
];
function spawnGreys(g){
  const n = 4 + Math.floor(Math.random() * 3);   /* 4-6 */
  const dende = Math.random() < 0.5 ? 'norte' : 'sur';
  const y0 = dende === 'norte' ? 30 : H - 30;
  const x0 = 150 + Math.random() * (W - 300);
  g._greysN = g._greysN || 0;
  for(let i = 0; i < n; i++){
    const cls = (i === 0 && n >= 5) ? 'HEAVY' : 'GRUNT';
    const u = mkUnit(2, cls, x0 + (i - n/2) * 26 + Math.random()*10, y0 + (Math.random()*16-8), null);
    g._greysN++;
    u.name = 'REQ-' + String(g._greysN).padStart(2, '0');
    u.hp = Math.round(u.hp * 1.15); u.max = u.hp;   /* material corporativo: algo mellor */
    g.units.push(u);
    orderMove(u, W/2 + (Math.random()*200-100), H/2 + (Math.random()*160-80));
  }
  hqSay('Señales no identificadas. Múltiples. Origen: administración central.');
  sfx('radio_static');
  setTimeout(() => {
    radio(`▣ ÓPTIMA: ${REQUISAS_OPTIMA[Math.floor(Math.random()*REQUISAS_OPTIMA.length)]}`, '#e8c060');
    sfxT('voice_blip', 200, 'OPTIMA');
  }, 2500);
}

function tickHQ(g){
  g._hq = g._hq || {};
  const vivos = g.units.filter(u => u.team === PT && !u.dead);
  g._hq.peak = Math.max(g._hq.peak || 0, vivos.length);

  /* Caído: 2 segundos de silencio de radio... e o nome */
  if(!g._hq.lastMournT || g.t - g._hq.lastMournT > 2700){
    const caido = g.units.find(u => u.team === PT && u.dead && u.name && !u._hqMourned);
    if(caido){
      caido._hqMourned = true;
      g._hq.lastMournT = g.t;
      const nome = caido.name;
      setTimeout(() => hqSay(`Operador ${nome}... sin respuesta.`), 2000);
    }
  }

  /* Produción baixo mínimos */
  if(!g._hq.prodLow && g._hq.peak >= 5 && vivos.length < g._hq.peak * 0.4){
    g._hq.prodLow = true;
    hqSay('Producción por debajo del 40%. Prioridad: supervivencia.');
  }

  /* Sectores: superioridade / colapso */
  if(g.sectors && g.sectors.length){
    const meus = g.sectors.filter(s => s.owner === PT).length;
    if(!g._hq.supIndustrial && meus === g.sectors.length){
      g._hq.supIndustrial = true;
      hqSay('Superioridad industrial confirmada.');
    }
    if(!g._hq.redPerdida && g.sectors.every(s => s.owner === ET)){
      g._hq.redPerdida = true;
      hqSay('Red de sectores comprometida. Reevaluando.');
    }
  }

  /* Integridade do HQ */
  if(!g._hq.dano50 && g.hq[PT].hp < g.hq[PT].max * 0.5){
    g._hq.dano50 = true;
    hqSay('Integridad estructural al cincuenta por ciento. Se requiere presencia.');
  }

  /* Radar: enlace gañado/perdido */
  if(g.radar){
    if(g._hq.radarPrev === undefined) g._hq.radarPrev = g.radar.owner;
    if(g.radar.owner !== g._hq.radarPrev){
      if(g.radar.owner === PT) hqSay('Enlace de radar establecido. Cobertura ampliada.');
      else if(g._hq.radarPrev === 0) hqSay('Enlace de radar perdido.');
      g._hq.radarPrev = g.radar.owner;
    }
  }
}

/* Estado psicolóxico actual segundo a confianza */
/* ============================================================
   ROLL DE SUPERVIVENCIA (v0.12) — cando a estructura ocupada
   é destruída, o piloto tira un dado modificado por clase,
   veteranía e traits. Se falla, morre na explosión.
   ============================================================ */
function rollSupervivencia(u){
  let prob = 0.60;                                      /* base 60% */
  prob += Math.min(0.25, (u.ops || 0) * 0.05);          /* +5%/op, cap +25% */
  if((u.traits||[]).includes('DURO_DE_MATAR')) prob += 0.15;
  if(u.cls === 'HEAVY') prob += 0.10;                   /* chasis reforzado */
  if(u.cls === 'GRUNT') prob -= 0.05;                   /* chasis lixeiro */
  prob = Math.min(0.95, prob);                          /* teito 95%: sempre hai drama */
  return Math.random() < prob;
}

/* Resolve a expulsión ou morte do ocupante ao destruírse a estructura.
   Devolve true se sobreviviu. */
function resolveEjection(u, sx, sy, structLabel, g){
  if(rollSupervivencia(u)){
    u.inside = null;
    u.x = sx + (Math.random()*40 - 20);
    u.y = sy + 26;
    if(u.team === PT){
      radio(`${u.name} saíu da explosión ${structLabel}.`, '#ffd24a');
    }
    return true;
  }
  /* Non sobreviviu */
  u.inside = null;
  u.dead = true;
  u.deathCause = 'explosion';  /* (v0.12) memoria */
  u.x = sx; u.y = sy;
  g.kills[u.team === PT ? ET : PT]++;
  if(u.team !== PT) dropScrap(g, sx, sy, CHATARRA_VALUES[u.cls] || 5);
  if(u.team === PT){
    const place = (typeof placeAt === 'function') ? placeAt(sx, sy) : 'campo';
    radio(`${u.name} NON saíu da explosión ${structLabel}.`, '#ff5340');
    if(typeof sfx === 'function') sfx('signal_lost');
    if(typeof logEvent === 'function') logEvent(u, {type:'CAYO_EN', place});
    g.remains.push({ x:sx + 20, y:sy + 20, unit:u, timer:90*60, secured:false, place });
    if(typeof triggerNearDeathReactions === 'function') triggerNearDeathReactions(u, g);
  }
  return false;
}

/* ============================================================
   FRASES DE MEMORIA (v0.12) — referencias a eventos concretos
   do pasado: {op}, {place}, {causa}, {name}
   ============================================================ */
const FRASES_MEMORIA = {
  betrayal: {
    GRUNT: [
      "En la Op {op} me dejaste tirado, jefe. No se olvida.",
      "Desde la Op {op} duermo con un ojo abierto.",
      "Op {op}. Solo digo eso. Op {op}.",
    ],
    HEAVY: [
      "Desde la Op {op} no me fío de ti. Y tengo razones, joder.",
      "En la Op {op} me dejaste vendido. Eso no se me olvida.",
      "¿La Op {op}? Sigo esperando una explicación.",
    ],
    ENGINEER: [
      "Mis registros de la Op {op} siguen abiertos. Tú sabrás.",
      "Desde la Op {op} he recalculado nuestra relación profesional.",
      "Op {op}. Lo tengo documentado. Con timestamps.",
    ],
  },
  death: {
    GRUNT: [
      "En la Op {op} me mató {causa} en {place}. Todavía lo sueño, jefe.",
      "Ya morí una vez en {place}, Op {op}. No pienso repetir.",
      "{causa} me reventó en la Op {op}. Ándese con ojo esta vez.",
    ],
    HEAVY: [
      "En la Op {op} me destrozó {causa} en {place}. Tengo cuentas pendientes.",
      "Morí en {place}. Op {op}. Y volví. A ver quién aguanta más.",
      "{causa}, Op {op}, {place}. Lo tengo grabado a fuego.",
    ],
    ENGINEER: [
      "Registro de la Op {op}: destruido por {causa} en {place}. Prefiero no actualizarlo.",
      "Ya conozco {place}. Morí allí en la Op {op}. Curiosa sensación, volver.",
      "En la Op {op}, {causa} interrumpió mis funciones. Permanentemente. Casi.",
    ],
  },
  save: {
    GRUNT: [
      "{name} me sacó de la Op {op}. A ese sí le debo una, jefe.",
      "Si no fuera por {name} en la Op {op}, no estaría aquí.",
    ],
    HEAVY: [
      "{name} me salvó el pellejo en la Op {op}. Eso no se olvida. Lo bueno tampoco.",
      "A {name} le debo la Op {op}. Con él sí voy a donde sea.",
    ],
    ENGINEER: [
      "{name} intervino eficazmente en la Op {op}. Queda registrado. Con gratitud.",
      "Sigo operativo gracias a {name}, Op {op}. Los datos no mienten.",
    ],
  },
};

/* Etiqueta lexible da causa de morte */
function causaLabel(causa){
  switch(causa){
    case 'GRUNT':     return 'un grunt enemigo';
    case 'HEAVY':     return 'un pesado enemigo';
    case 'ENGINEER':  return 'un engineer enemigo';
    case 'torreta':   return 'una torreta';
    case 'jeep':      return 'un jeep';
    case 'explosion': return 'la explosión';
    case 'TANQUE':    return 'un tanque';
    default:          return 'el enemigo';
  }
}

/* (v0.12) Peticións de equipamento en base ao historial */
const FRASES_PETICION = {
  blindaxe: {
    GRUNT:    ["Cómprame blindaje, jefe. No quiero repetir la Op {op}.", "Con más chapa, lo de la Op {op} no pasa. Se lo digo yo."],
    HEAVY:    ["Más blindaje. Después de la Op {op} no es un capricho, joder.", "¿Chapa nueva? Lo de la Op {op} no se repite."],
    ENGINEER: ["Solicito blindaje adicional. Referencia: Op {op}. Motivos: obvios.", "Tras la Op {op}, recomiendo invertir en mi integridad estructural."],
  },
  kit: {
    GRUNT:    ["Ya que nunca viene nadie, cómprame el kit. Me apaño solo, jefe.", "El kit de reparación. Así no dependo de nadie. Como en la Op {op}."],
    HEAVY:    ["Cómprame el kit y no te pido nada más. Visto lo visto en la Op {op}.", "El kit. Ya que los médicos no llegan, joder."],
    ENGINEER: ["Un kit de autorreparación optimizaría mi autonomía. La Op {op} lo avala.", "Solicito el kit. Los datos de la Op {op} justifican la inversión."],
  },
};

function pickFrasePeticion(rec, est){
  const cls = rec.cls;
  const eq = rec.equipment || [];
  /* Morreu e non ten blindaxe → pídea */
  if(rec.lastDeath && !eq.includes('blindaxe') && Math.random() < 0.35){
    const arr = FRASES_PETICION.blindaxe[cls] || FRASES_PETICION.blindaxe.GRUNT;
    return arr[Math.floor(Math.random()*arr.length)].replace(/\{op\}/g, rec.lastDeath.op);
  }
  /* Traizoada e non ten kit → pídeo (con amargura) */
  if(rec.lastBetrayal && !eq.includes('kit') && Math.random() < 0.35){
    const arr = FRASES_PETICION.kit[cls] || FRASES_PETICION.kit.GRUNT;
    return arr[Math.floor(Math.random()*arr.length)].replace(/\{op\}/g, rec.lastBetrayal.op);
  }
  return null;
}

/* (v0.19 R3) A VOZ DO RENACIDO: frases sen sentido, cortadas, ou roubadas
   ás clases dos DOADORES das súas pezas. */
const FRASES_GLITCH = [
  "Reparación comple— ¿quién es {name}? Yo soy... procedo.",
  "Sistemas... sistemas... ¿cuántos somos aquí dentro?",
  "Objetivo fijado. No. Sí. ¿Quién ha dicho eso?",
  "Este brazo recuerda cosas que yo no hice.",
  "Cargando personalidad... 74%... suficiente.",
  "A veces sueño con kilómetros que no caminé.",
];
function fraseRenacida(rec){
  const r = Math.random();
  const clasesAlleas = (rec.piezasClases || []).filter(c => c !== rec.cls);
  /* 45%: frase roubada a unha clase doadora, coa marca de estrañeza */
  if(r < 0.45 && clasesAlleas.length){
    const cls = clasesAlleas[Math.floor(Math.random()*clasesAlleas.length)];
    const pool = FRASES_END_OP[cls];
    if(pool){
      const estados = Object.keys(pool);
      const est = estados[Math.floor(Math.random()*estados.length)];
      const ctxs = Object.keys(pool[est]).filter(k => Array.isArray(pool[est][k]) && pool[est][k].length && pool[est][k][0] !== '...');
      if(ctxs.length){
        const arr = pool[est][ctxs[Math.floor(Math.random()*ctxs.length)]];
        const f = arr[Math.floor(Math.random()*arr.length)].replace(/\{name\}/g, '...');
        return `${f} ...perdón. Eso no era mío.`;
      }
    }
  }
  /* 30%: mestura cortada de dúas frases */
  if(r < 0.75){
    const propio = FRASES_END_OP[rec.cls] || FRASES_END_OP.GRUNT;
    const est = Object.keys(propio)[0];
    const arrA = propio[est].end_op_alive || ['...'];
    const a = arrA[Math.floor(Math.random()*arrA.length)];
    const g = FRASES_GLITCH[Math.floor(Math.random()*FRASES_GLITCH.length)];
    const corte = Math.max(4, Math.floor(a.length * 0.4));
    return a.slice(0, corte) + '— ' + g.replace(/\{name\}/g, rec.name);
  }
  /* 25%: glitch puro */
  return FRASES_GLITCH[Math.floor(Math.random()*FRASES_GLITCH.length)].replace(/\{name\}/g, rec.name);
}

/* Escolle frase-memoria se procede. Devolve null se non hai memoria aplicable. */
function pickFraseMemoria(rec, est){
  const cls = rec.cls;
  /* Prioridade 1: traizón non perdoada (só en estados de desconfianza) */
  if(rec.lastBetrayal && (est === 'DESCONFIADO' || est === 'AUTOPRESERVACION') && Math.random() < 0.6){
    const arr = (FRASES_MEMORIA.betrayal[cls] || FRASES_MEMORIA.betrayal.GRUNT);
    let f = arr[Math.floor(Math.random()*arr.length)];
    return f.replace(/\{op\}/g, rec.lastBetrayal.op);
  }
  /* Prioridade 2: morte previa (calquera estado — morrer marca) */
  if(rec.lastDeath && Math.random() < 0.45){
    const arr = (FRASES_MEMORIA.death[cls] || FRASES_MEMORIA.death.GRUNT);
    let f = arr[Math.floor(Math.random()*arr.length)];
    return f.replace(/\{op\}/g, rec.lastDeath.op)
            .replace(/\{causa\}/g, causaLabel(rec.lastDeath.causa))
            .replace(/\{place\}/g, (typeof placeLabel==='function') ? placeLabel(rec.lastDeath.place) : rec.lastDeath.place);
  }
  /* Prioridade 3: gratitude (só LEAL) */
  if(rec.lastSave && est === 'LEAL' && Math.random() < 0.35){
    const arr = (FRASES_MEMORIA.save[cls] || FRASES_MEMORIA.save.GRUNT);
    let f = arr[Math.floor(Math.random()*arr.length)];
    return f.replace(/\{op\}/g, rec.lastSave.op)
            .replace(/\{name\}/g, rec.lastSave.who);
  }
  return null;
}

function estadoConfianza(u){
  const c = u.confianza;
  if(c >= 70) return 'LEAL';
  if(c >= 40) return 'SARCASTICO';
  if(c >= 20) return 'DESCONFIADO';
  return 'AUTOPRESERVACION';
}

/* Aplicar delta de confianza modulado pola personalidade, con cap por op */
function aplicarConfianza(u, delta){
  if(!u || u.team !== PT) return;
  const mods = PERSONALIDAD_MODS[u.personalidad] || PERSONALIDAD_MODS.ESTOICO;
  const mod = delta >= 0 ? mods.pos : mods.neg;
  const realDelta = delta * mod;
  /* Cap por op: ±30 neto (subido de 20 na v0.11.1 para máis dinamismo) */
  const accum = (u.confianzaDeltaThisOp || 0) + realDelta;
  if(Math.abs(accum) > 30){
    const excess = Math.abs(accum) - 30;
    const sign = accum < 0 ? -1 : 1;
    u.confianza += realDelta - sign*excess;
    u.confianzaDeltaThisOp = sign * 30;
  } else {
    u.confianza += realDelta;
    u.confianzaDeltaThisOp = accum;
  }
  u.confianza = Math.max(0, Math.min(100, u.confianza));
}

/* ============================================================
   POOL DE FRASES — clase × personalidade × estado × contexto
   ============================================================ */
const FRASES = {
  GRUNT: {
    LEAL: {
      LEAL:           { briefing:["A la orden, jefe. Donde diga.", "Aquí estoy, compa.", "Lo que necesite."],
                        selection:["Diga.", "Mande.", "Aquí."],
                        critical:["Aguanto, jefe. Aguanto.","Sigo en pie."] },
      SARCASTICO:     { briefing:["Hoy estoy un poco cansado, jefe."],
                        selection:["Vale, jefe."],
                        critical:["Esto no es como otras veces, jefe."] },
      DESCONFIADO:    { briefing:["Algo cambió. No sé qué."],
                        selection:["Espere, jefe."],
                        critical:["¡Apoyo! ¡Por favor!"] },
      AUTOPRESERVACION:{briefing:["Ya no sé quién es usted."],
                        refusing_briefing:["Hoy no puedo, jefe. Hoy no."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["¿Todo controlado, jefe? Dígame que sí.","¿Va a salir bien, verdad?"],
                        selection:["Aquí, atento.","¿Sí?"],
                        critical:["¡Estoy aquí solito! ¡Ayuda!","¡Necesito apoyo!"] },
      SARCASTICO:     { briefing:["Espero que esta vez sí me cubra alguien.","Ya vamos otra vez al frente."],
                        selection:["Vale, vale.","Sí..."],
                        critical:["¡Lo sabía! ¡Sabía que iba a pasar!","¡Me dejaron solo otra vez!"] },
      DESCONFIADO:    { briefing:["Esto huele feo, jefe. Muy feo.","No me gusta, no me gusta."],
                        selection:["Espera. ¿Está seguro?","¿De verdad?"],
                        critical:["¡Me dejaron! ¡Me dejaron otra vez!","¡No quiero morir aquí!"] },
      AUTOPRESERVACION:{briefing:["No, no. Hoy no. Que vaya el HEAVY."],
                        refusing_briefing:["Yo no soy carne. No soy desechable. Hoy no salgo.","Que vaya otro. Yo ya no."],
                        selection:["..."] },
    },
    IRONICO: {
      LEAL:           { briefing:["Otra vez yo. Pues vamos.","Ya me toca, supongo."],
                        selection:["Diga, jefe.","Aquí, el de siempre."],
                        critical:["Era cuestión de tiempo."] },
      SARCASTICO:     { briefing:["Pues claro, manda al grunt. Para eso estamos.","Otra vez yo al frente. Qué novedad."],
                        selection:["Sí. Otra vez yo."],
                        critical:["Me lleva. Otra vez me toca a mí."] },
      DESCONFIADO:    { briefing:["¿Otra vez al frente, compa? Vaya sorpresa."],
                        selection:["¿Qué necesita ahora?"],
                        critical:["Esto sí que es nuevo. Y no en el buen sentido."] },
      AUTOPRESERVACION:{briefing:["Hoy paso. En serio."],
                        refusing_briefing:["Pues claro, manda al grunt. Para eso estamos. Pero hoy no, compa."],
                        critical:["Me cargas tú esto. Yo ya no.","..."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Listo, jefe.","Vamos."],
                        selection:["Diga."],
                        critical:["Aguanto."] },
      SARCASTICO:     { briefing:["Vamos pues."],
                        selection:["Sí."],
                        critical:["Esto se complica."] },
      DESCONFIADO:    { briefing:["¿Cuál es el plan, jefe?"],
                        selection:["Espero instrucciones."],
                        critical:["Necesito apoyo."] },
      AUTOPRESERVACION:{briefing:["No me hable hoy, jefe."],
                        refusing_briefing:["Hoy no, jefe. Que vaya otro."],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Bien. Quizás esta vez no sea un desastre."],
                        selection:["Le oigo."],
                        critical:["Sigo aquí. Por ahora."] },
      SARCASTICO:     { briefing:["Vamos a la cuarta. Ya conozco el camino.","Otra vez. Lo de siempre."],
                        selection:["Dime."],
                        critical:["Era esperable."] },
      DESCONFIADO:    { briefing:["El plan tiene agujeros. Como siempre, compa."],
                        selection:["Si insistes."],
                        critical:["Lo dije, ¿verdad?"] },
      AUTOPRESERVACION:{briefing:["He visto suficiente, jefe."],
                        refusing_briefing:["Llevo tres ops salvándole los huevos. Hoy se los salva usted.","No. Yo no."],
                        selection:["..."] },
    },
  },
  HEAVY: {
    LEAL: {
      LEAL:           { briefing:["Ahí estamos, jefe.","Conmigo no te pasa nada.","Donde haga falta."],
                        selection:["Tú dirás.","Habla.","Aquí."],
                        critical:["Aguanto, tranquilo.","Tranquilo, sigo."] },
      SARCASTICO:     { briefing:["¿Otra vez ahí? Joder, vale."],
                        selection:["Vale, vale."],
                        critical:["¡Esto se está poniendo feo, jefe!"] },
      DESCONFIADO:    { briefing:["¿Vas en serio con este plan?"],
                        selection:["A ver."],
                        critical:["¡Apoyo, joder! ¡Que me dan!"] },
      AUTOPRESERVACION:{briefing:["Que te den. En serio."],
                        refusing_briefing:["Después de la última vez, hoy no salgo. Que vaya tu puta madre."],
                        critical:["¡Hijo de puta, me has dejado morir otra vez!","..."] },
    },
    IRONICO: {
      LEAL:           { briefing:["Vamos a hacer el numerito otra vez.","Manda, jefe. Hoy estoy fino."],
                        selection:["A ver con qué me sales."],
                        critical:["Esto se complica, joder."] },
      SARCASTICO:     { briefing:["Magnífico. Plan de mierda y yo el primero. Como siempre.","Otra obra maestra, ¿no?"],
                        selection:["Vale, dispara. Ironía aparte."],
                        critical:["¡La hostia! ¡Qué sorpresa!","¡Joder, joder, joder!"] },
      DESCONFIADO:    { briefing:["Si esto es como la Op 4, dimito.","Esto pinta como otras veces. Mal."],
                        selection:["Suelta. A ver."],
                        critical:["Te dije que no. TE LO DIJE."] },
      AUTOPRESERVACION:{briefing:["Hoy mando yo. Tú observa."],
                        refusing_briefing:["Me quedo en la torreta. Que te den."],
                        critical:["Tu plan, tu problema. Yo a lo mío.","..."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Listo.","Vamos."],
                        selection:["Sí."],
                        critical:["Resisto."] },
      SARCASTICO:     { briefing:["Joder, otra."],
                        selection:["Adelante."],
                        critical:["Esto es feo."] },
      DESCONFIADO:    { briefing:["¿Estamos seguros de esto?"],
                        selection:["Habla."],
                        critical:["Necesito apoyo, joder."] },
      AUTOPRESERVACION:{briefing:["Hoy no."],
                        refusing_briefing:["No me salgas con un plan. Hoy no.","Hoy paso."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["¿Todo controlado? ¿De verdad?"],
                        selection:["Aquí, joder. Atento."],
                        critical:["¡Apoyo, hostia, apoyo!"] },
      SARCASTICO:     { briefing:["Espero que esta vez tengas un plan de verdad."],
                        selection:["Vale, joder."],
                        critical:["¡Lo dije! ¡Joder, lo dije!"] },
      DESCONFIADO:    { briefing:["No me huele bien. Para nada."],
                        selection:["¿Seguro, jefe?"],
                        critical:["¡Voy a palmar! ¡Sácame de aquí!"] },
      AUTOPRESERVACION:{briefing:["¡No! ¡Hostia, no!"],
                        refusing_briefing:["¡Me niego! ¡Me cago en todo, me niego!"],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Vale. Esto podría incluso salir bien."],
                        selection:["Te escucho."],
                        critical:["Era cuestión de tiempo."] },
      SARCASTICO:     { briefing:["Ya hemos hecho esto. Sabemos cómo acaba, joder."],
                        selection:["Dime."],
                        critical:["Mira tú qué sorpresa."] },
      DESCONFIADO:    { briefing:["Tu plan tiene una pinta de mierda. Como siempre."],
                        selection:["Si insistes."],
                        critical:["Te lo dije, joder. Te lo dije."] },
      AUTOPRESERVACION:{briefing:["He visto suficiente."],
                        refusing_briefing:["Hoy no me mueves. Que vaya tu puta madre."],
                        selection:["..."] },
    },
  },
  ENGINEER: {
    IRONICO: {
      LEAL:           { briefing:["Interesante decisión. Funcionará.","Procedo. Con buenas expectativas, esta vez."],
                        selection:["Diga.","Sí."],
                        critical:["Esto se sale del margen previsto."] },
      SARCASTICO:     { briefing:["Comprendo tu plan. En parte.","Otra incursión. Bien."],
                        selection:["Adelante."],
                        critical:["Curioso lugar para morir."] },
      DESCONFIADO:    { briefing:["Voy a confiar, contra mi mejor juicio.","Tu plan presenta algunas... peculiaridades."],
                        selection:["Si insistes."],
                        critical:["Esto era previsible. Lo era."] },
      AUTOPRESERVACION:{briefing:["Claro. Tú lo has decidido. Procedo.","Comprendo que tu plan tiene una lógica que se me escapa."],
                        refusing_briefing:["Hoy me dedicaré a tareas administrativas. Tu plan no me requiere.","He calculado mis probabilidades. Hoy declino participar."],
                        selection:["..."],
                        critical:["Lo lamento por ti. No por mí."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Listo.","Vamos."],
                        selection:["Sí."],
                        critical:["Resisto."] },
      SARCASTICO:     { briefing:["Procedo."],
                        selection:["Adelante."],
                        critical:["No es ideal."] },
      DESCONFIADO:    { briefing:["Adelante."],
                        selection:["Sí."],
                        critical:["Bajo fuego."] },
      AUTOPRESERVACION:{briefing:["Hoy no."],
                        refusing_briefing:["Declino esta operación.","Hoy permanezco en base."],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Vale. Esta vez quizás no sea catastrófico."],
                        selection:["Te oigo."],
                        critical:["Era cuestión de tiempo."] },
      SARCASTICO:     { briefing:["Esta op tampoco saldrá según lo previsto. Procedo.","Conocido. Procedo."],
                        selection:["Adelante."],
                        critical:["Como esperaba."] },
      DESCONFIADO:    { briefing:["Tu plan tiene una lógica que se me escapa, como de costumbre."],
                        selection:["Si insistes."],
                        critical:["Previsible."] },
      AUTOPRESERVACION:{briefing:["He calculado y prefiero no participar."],
                        refusing_briefing:["He calculado mis probabilidades. Hoy declino participar.","Mis cálculos no avalan tu plan. Permanezco en base."],
                        selection:["..."] },
    },
    LEAL: {
      LEAL:           { briefing:["Contigo siempre.","Lo que necesites."],
                        selection:["Aquí."],
                        critical:["Aguanto, no te preocupes."] },
      SARCASTICO:     { briefing:["Hoy estoy un poco cansado."],
                        selection:["Vale."],
                        critical:["Esto no es como otras veces."] },
      DESCONFIADO:    { briefing:["Algo cambió. No sé qué."],
                        selection:["Adelante."],
                        critical:["Necesito ayuda."] },
      AUTOPRESERVACION:{briefing:["Ya no sé quién eres."],
                        refusing_briefing:["Hoy no puedo. En serio."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["¿Todo bajo control? Confío en ti."],
                        selection:["Sí, aquí."],
                        critical:["¡Necesito apoyo, por favor!"] },
      SARCASTICO:     { briefing:["Espero que esta vez sea distinto."],
                        selection:["Vale."],
                        critical:["¡Lo dije, lo dije!"] },
      DESCONFIADO:    { briefing:["Esto huele mal. Lo sabes, ¿verdad?"],
                        selection:["¿Estás seguro?"],
                        critical:["¡Voy a morir aquí!"] },
      AUTOPRESERVACION:{briefing:["No puedo más."],
                        refusing_briefing:["Mis cálculos dicen no. Permanezco en base."],
                        selection:["..."] },
    },
  },
};

/* (v0.11) Fallback xenérico por clase × estado para end_op_alive/critical.
   Úsase cando o pool específico (clase × personalidade × estado) non ten frase.
   Mantén o ton da clase aínda que se perda matiz da personalidade. */
const FRASES_END_OP = {
  BOMBARDERO: {
    LEAL: { end_op_alive:["Todo lo que apunté, cayó.","Demolición completada, jefe."], end_op_critical:["Casi vuelo yo también."],
            saved:["Gracias. Estas manos valen dinero."], near_death_aliado:["¡{name}! ¡Joder, estaba a mi lado!"] },
    SARCASTICO: { end_op_alive:["Otro día haciendo boquetes."], end_op_critical:["Explotó todo menos yo. Por poco."],
            saved:["Justo antes del boom. Aprecio el detalle."], near_death_aliado:["{name} voló. Y no por mis bombas."] },
    DESCONFIADO: { end_op_alive:["Volví. Con la mochila medio vacía."], end_op_critical:["Me mandaste muy adelante. Otra vez."],
            saved:["Vale. Una que te debo."], near_death_aliado:["¡{name}! ¡Te dije que esto pasaría!"] },
    AUTOPRESERVACION: { end_op_alive:["Mis bombas trabajaron. Yo, lo justo."], end_op_critical:["..."],
            saved:["..."], near_death_aliado:["..."] },
  },
  SNIPER: {
    LEAL: { end_op_alive:["Objetivos neutralizados.","Limpio."], end_op_critical:["Me vieron. No volverá a pasar."],
            saved:["...gracias. No suelo necesitarlo."], near_death_aliado:["{name}. Lo vi caer. No pude tirar a tiempo."] },
    SARCASTICO: { end_op_alive:["Otra jornada de mirar por la mira."], end_op_critical:["Casi me cazan a mí. Irónico."],
            saved:["Curioso. Normalmente soy yo el que decide quién vive."], near_death_aliado:["{name} caído. Anotado."] },
    DESCONFIADO: { end_op_alive:["Sobreviví. Solo, como siempre."], end_op_critical:["Me dejaste sin cobertura. Otra vez."],
            saved:["No lo esperaba. De ti."], near_death_aliado:["{name}. Desde donde estaba, no llegué."] },
    AUTOPRESERVACION: { end_op_alive:["Vivo. No gracias a tus posiciones."], end_op_critical:["..."],
            saved:["..."], near_death_aliado:["..."] },
  },
  GRUNT: {
    LEAL: {
      end_op_alive:   ["Otra completada, jefe.", "Aquí seguimos.", "Como debe ser.", "Sigo en pie, jefe."],
      end_op_critical:["Por los pelos, jefe.", "Casi me quedo allí.", "Por poco no la cuento."],
      saved:          ["Gracias, jefe. De verdad.", "Me salvaste el pellejo.", "Aquí sigo gracias a esa."],
      near_death_aliado:["¡Compa! ¡No!", "¡La hostia, cayó {name}!", "¡{name}! ¡Joder, no!"],
    },
    SARCASTICO: {
      end_op_alive:   ["Una más. Y sigo respirando, no sé cómo.", "Sobreviví. Otra vez.", "Otra al saco."],
      end_op_critical:["Casi me dejo el pellejo. Otra vez.", "Yo dije que algo pasaría.", "Mira tú, casi me toca."],
      saved:          ["Justo a tiempo. Como siempre.", "Una más para tu cuenta."],
      near_death_aliado:["Adiós, compa. Me lo veía venir.", "Otro menos. Qué sorpresa."],
    },
    DESCONFIADO: {
      end_op_alive:   ["Salí. Esta vez.", "Sigo aquí. No sé por cuánto."],
      end_op_critical:["¡Por los pelos! ¿Y tú sigues con tus planes?", "Casi no la cuento. ¿Te vale?"],
      saved:          ["...gracias. Esta vez.", "Tarde, pero gracias."],
      near_death_aliado:["¡{name}! ¡Lo dije, joder, lo dije!", "Y van varios. ¡VARIOS!"],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["Vivo. A pesar de ti, no gracias a ti.", "Esta vez sí. La próxima me niego."],
      end_op_critical:["Nunca más, jefe. NUNCA MÁS.", "Casi me cargas. Tomo nota."],
      saved:          ["Te debo una. Pero ya estamos en paz, por todas las anteriores.", "..."],
      near_death_aliado:["...", "Otro al montón. Yo seré el próximo."],
    },
  },
  HEAVY: {
    LEAL: {
      end_op_alive:   ["Otra al saco, jefe.", "Sin novedad. Como siempre.", "Aquí estoy."],
      end_op_critical:["Esta ha sido dura. Pero aquí estoy.", "Joder, qué fea. Pero aguanté."],
      saved:          ["Gracias, jefe. Te debo una.", "Joder, justo a tiempo."],
      near_death_aliado:["¡{name}! ¡JODER!", "¡No, hostia, NO!", "¡{name}, aguanta!"],
    },
    SARCASTICO: {
      end_op_alive:   ["Sobreviví. ¿De qué te sorprendes?", "Misión cumplida, supongo.", "Otra hostia más."],
      end_op_critical:["Joder con la op. Casi no la cuento.", "Me debes una. Y van varias.", "Mira, sigo respirando. Tú verás."],
      saved:          ["Llegas tarde. Pero gracias, supongo."],
      near_death_aliado:["¡{name}! ¡Joder, otro!", "La hostia. Cayó {name}."],
    },
    DESCONFIADO: {
      end_op_alive:   ["Vivo. No por tu mérito.", "Sigo aquí. Mañana ya veremos."],
      end_op_critical:["¡Te lo dije, hostia! ¡Te lo dije!", "Por los pelos. Otra vez."],
      saved:          ["...vale. Gracias.", "Justo a tiempo, joder."],
      near_death_aliado:["¡Te lo dije! ¡{name} ha caído por tu culpa!", "¡Joder, joder, JODER!"],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["Me sales debiendo una. Y van varias.", "Vivo. La vergüenza es tuya."],
      end_op_critical:["Otra vez por los pelos. ¿Te vale ya?", "Que te den. La próxima no salgo."],
      saved:          ["Tarde. Como siempre.", "..."],
      near_death_aliado:["Otro al hoyo. Que te den.", "..."],
    },
  },
  ENGINEER: {
    LEAL: {
      end_op_alive:   ["Operación concluida.", "Eficiente, contra todo pronóstico."],
      end_op_critical:["Esto se ha salido del margen previsto.", "Daños considerables. Aguanté."],
      saved:          ["Agradecido. Sinceramente.", "Llegaste justo. Lo aprecio."],
      near_death_aliado:["{name}... lo siento.", "He fallado a {name}."],
    },
    SARCASTICO: {
      end_op_alive:   ["Concluida. Tu plan se aproxima al éxito.", "Vivo. Por estadística, no por planificación."],
      end_op_critical:["Daños por encima del estimado. Como siempre.", "Era lo esperable. Sobreviví por poco."],
      saved:          ["Eficiente. Sorprendente.", "Apuntado. Te debo una."],
      near_death_aliado:["{name} caído. Era cuestión de tiempo.", "Pérdida prevista. Pero pérdida."],
    },
    DESCONFIADO: {
      end_op_alive:   ["Sobreviví. Pese a las decisiones tomadas."],
      end_op_critical:["Era previsible. Lo era."],
      saved:          ["Curioso. No esperaba ayuda."],
      near_death_aliado:["Era cuestión de tiempo, {name}.", "Predecible. Triste, pero predecible."],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["Sobreviví. Mañana revisaré mi contrato.", "Vivo. Tomaré nota en tu expediente."],
      end_op_critical:["Me debes una explicación. Y un café.", "Lamento la operación. No el resultado."],
      saved:          ["Procedo a recalcular mis probabilidades.", "..."],
      near_death_aliado:["{name} ha sido sacrificado. Tomo nota.", "..."],
    },
  },
};

/* Pickea unha frase do pool con fallback se a combinación non existe */
function pickFrase(u, contexto, opts){
  if(!u || u.team !== PT) return null;
  const cls = u.cls;
  const pers = u.personalidad;
  const est = estadoConfianza(u);
  let result = null;
  const cls_table = FRASES[cls];
  if(cls_table){
    const pers_table = cls_table[pers];
    if(pers_table){
      const est_table = pers_table[est];
      if(est_table){
        const arr = est_table[contexto];
        if(arr && arr.length > 0){
          result = arr[Math.floor(Math.random() * arr.length)];
        }
      }
    }
  }
  /* Fallback xenérico para end_op_*, saved, near_death_aliado: por clase × estado */
  if(!result && FRASES_END_OP[cls] && FRASES_END_OP[cls][est]){
    const arr = FRASES_END_OP[cls][est][contexto];
    if(arr && arr.length > 0){
      result = arr[Math.floor(Math.random() * arr.length)];
    }
  }
  /* Fallback final: en AUTOPRESERVACION o silencio é válido */
  if(!result){
    if(est === 'AUTOPRESERVACION') return '...';
    return null;
  }
  /* Substituír {name} se opts.targetName está definido */
  if(opts && opts.targetName){
    result = result.replace(/\{name\}/g, opts.targetName);
  }
  return result;
}

/* Cooldown global para que as frases non se solapen */
let _lastFraseTime = 0;
const FRASE_COOLDOWN_MS = 800;

/* (v0.11.2) Disparar reaccións de aliados ao caer un compañeiro cercano */
function triggerNearDeathReactions(deadUnit, g){
  if(!deadUnit || deadUnit.team !== PT) return;  /* só aliados disparan reaccións */
  let spoke = false;
  for(const ally of g.units){
    if(ally.dead || ally.team !== PT || ally === deadUnit || ally.inside) continue;
    const d = Math.hypot(ally.x - deadUnit.x, ally.y - deadUnit.y);
    if(d < 60){  /* radio de "preto" */
      /* (v0.12.1) Δ confianza: ver morrer un compañeiro preto doe. -3, cap -9/op */
      ally._allyDeathPenalty = (ally._allyDeathPenalty || 0);
      if(ally._allyDeathPenalty > -9){
        aplicarConfianza(ally, -3);
        ally._allyDeathPenalty -= 3;
      }
      /* Só un aliado fala por morte para non saturar */
      if(!spoke){
        const frase = pickFrase(ally, 'near_death_aliado', {targetName: deadUnit.name});
        if(frase && frase !== '...'){
          const est = estadoConfianza(ally);
          const col = est === 'LEAL' ? '#7fdc7f'
                    : est === 'SARCASTICO' ? '#cfe0ff'
                    : est === 'DESCONFIADO' ? '#ffd24a' : '#ff5340';
          radio(`${ally.name}: «${frase}»`, col, {x:ally.x, y:ally.y});
          sfxT('voice_blip', 260, ally.cls);
          ally._lastFrase = {text: frase, color: col, time: Date.now()};
          spoke = true;
        }
      }
    }
  }
}

/* (v0.12.1) Frases de protesta por orde suicida (HP<25% cara ao HQ inimigo) */
const FRASES_SUICIDA = {
  GRUNT:    ["¿Con este daño, jefe? Vale... usted manda.", "Voy hecho pedazos, pero voy. Como siempre."],
  HEAVY:    ["¿Así? ¿En serio? Joder, vale.", "Medio muerto y al frente. Genial, jefe."],
  ENGINEER: ["Con mi integridad actual, esto es estadísticamente cuestionable. Procedo.", "Anoto la orden. Y mis objeciones."],
};

/* MURO construíble (v0.22): o ENGINEER constrúeo IN SITU, cela de 16px,
   ~4 segundos exposto. */
const WALL_BUILD = {cost:10, frames:240};

function startWallPlacing(){
  const eng = game.units.find(u => u.team===PT && !u.dead && !u.inside && u.sel && u.eng && !u.buildTask);
  if(!eng){
    radio('Necesitas un ENGINEER seleccionado (e libre) para construír muros.', '#ff8');
  } else if((DATA.chatarra||0) < WALL_BUILD.cost){
    radio(`Chatarra insuficiente para MURO (${WALL_BUILD.cost}⚙).`, '#ff8');
  } else {
    game.wallPlacing = eng.id;
    radio(`⌂ MURO ${WALL_BUILD.cost}⚙ — clic onde queiras que ${eng.name} o levante. Botón dereito cancela.`, '#c8a86a');
  }
}

function validWallSpot(x, y, g){
  if(x < 30 || y < 30 || x > W - 30 || y > H - 30) return false;
  if(inWater(x, y)) return false;
  if(inWall(g, x, y)) return false;
  const hq = g.hq[PT];
  let ok = Math.hypot(x - (hq.x + hq.w/2), y - (hq.y + hq.h/2)) < TURRET_BUILD.nearHQ;
  if(!ok){
    for(const s of g.sectors){
      if(s.owner === PT && Math.hypot(x - s.x, y - s.y) < TURRET_BUILD.nearSector){ ok = true; break; }
    }
  }
  if(!ok) return false;
  for(const t of g.turrets){
    if(!t.destroyed && Math.hypot(x - t.x, y - t.y) < 22) return false;
  }
  if(g.radar && Math.hypot(x - g.radar.x, y - g.radar.y) < 45) return false;
  const hqF = g.hq[ET];
  if(x > hqF.x - 60 && x < hqF.x + hqF.w + 60 && y > hqF.y - 60 && y < hqF.y + hqF.h + 60) return false;
  return true;
}

/* (v0.20) ¿Punto válido para torreta? Territorio propio: preto do HQ ou dun sector teu */
function validTurretSpot(x, y, g){
  if(x < 30 || y < 30 || x > W - 30 || y > H - 30) return false;
  if(inWater(x, y)) return false;
  if(inWall(g, x, y)) return false;
  const hq = g.hq[PT];
  let enTerritorio = Math.hypot(x - (hq.x + hq.w/2), y - (hq.y + hq.h/2)) < TURRET_BUILD.nearHQ;
  if(!enTerritorio){
    for(const s of g.sectors){
      if(s.owner === PT && Math.hypot(x - s.x, y - s.y) < TURRET_BUILD.nearSector){ enTerritorio = true; break; }
    }
  }
  if(!enTerritorio) return false;
  for(const t of g.turrets){
    if(!t.destroyed && Math.hypot(x - t.x, y - t.y) < TURRET_BUILD.minGap) return false;
  }
  for(const v of g.vehicles){
    if(!v.destroyed && Math.hypot(x - v.x, y - v.y) < TURRET_BUILD.minGap) return false;
  }
  if(g.radar && Math.hypot(x - g.radar.x, y - g.radar.y) < 70) return false;
  const hqF = g.hq[ET];
  if(x > hqF.x - 60 && x < hqF.x + hqF.w + 60 && y > hqF.y - 60 && y < hqF.y + hqF.h + 60) return false;
  return true;
}
/* (v0.32) Executar unha validación/acción coma se fósemos outro equipo
   (para que o host valide territorio e coloque estruturas do rival) */
function comoEquipo(team, fn){
  const a = PT, b = ET; PT = team; ET = 1 - team;
  try{ return fn(); } finally { PT = a; ET = b; }
}
function placeTurret(x, y, g, team){
  team = (team === undefined) ? PT : team;
  g._turretN = (g._turretN || 0) + 1;
  const pilot = mkUnit(team, 'GRUNT', x, y, null);
  const tu = {id:'T_BUILD_' + g._turretN, x, y, hp:TURRET_BUILD.hp, max:TURRET_BUILD.hp,
    team:team, occupant:pilot, cool:0, rng:TURRET_BUILD.rng, dmg:TURRET_BUILD.dmg,
    fireRate:TURRET_BUILD.fireRate, sel:false, angle:-Math.PI/2};
  pilot.inside = tu;
  g.units.push(pilot);
  g.turrets.push(tu);
  if(team === PT){
    g.turretPending--;
    radio(`⌂ Torreta desplegada — ${pilot.name} aos mandos.`, '#7fdc7f', {x, y});
  } else {
    g._turretPendingET = Math.max(0, (g._turretPendingET||0) - 1);
    if(g.modo === 'pvp') pvpRadioET(g, `⌂ Torreta desplegada — ${pilot.name} aos mandos.`, '#7fdc7f');
  }
  sfx('capture');
}

function checkSuicideOrder(u, tx, ty, g){
  if(u.team !== PT || u._suicideOrderThisOp) return;
  if(u.hp / u.max >= 0.25) return;
  const hqFoe = g.hq[ET];
  const d = Math.hypot(tx - (hqFoe.x + hqFoe.w/2), ty - (hqFoe.y + hqFoe.h/2));
  if(d < 180){
    u._suicideOrderThisOp = true;
    aplicarConfianza(u, -5);
    const arr = FRASES_SUICIDA[u.cls] || FRASES_SUICIDA.GRUNT;
    const frase = arr[Math.floor(Math.random() * arr.length)];
    radio(`${u.name}: «${frase}»`, '#ffd24a', {x:u.x, y:u.y});
  }
}

