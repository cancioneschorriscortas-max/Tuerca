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
  q.id = 'SQ' + (g.subquests.length + 1) + '_' + Math.floor(rnd()*999);
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
    if(rnd() < 0.45){
      /* punto en terra no terzo central do mapa */
      let cx = 0, cy = 0, tent = 0;
      do {
        cx = W * (0.35 + rnd() * 0.3);
        cy = H * (0.2 + rnd() * 0.6);
        tent++;
      } while((inWater(cx, cy) || inWall(g, cx, cy)) && tent < 40);
      addSubquest(g, {
        tipo: 'TECNOLOXIA', x: cx, y: cy,
        titulo: TXT('sq.tec'),
        desc: TXT('sq.tecDesc'),
        progress: 0, progressMax: 180,
      });
      hqSay(TXT('hq.tecnoloxia'), 0, 'hq.tecnoloxia');
    }
  }

  /* SPAWN — RESTOS INCRUSTADOS NUN MURO: demolición requerida (co radar) */
  if(!g._sqMuroTried && g.t > 1500 && radarMeu){
    g._sqMuroTried = true;
    if(rnd() < 0.40){
      /* muro intacto lonxe de ambos HQs */
      const hq0 = g.hq[0], hq1 = g.hq[1];
      const cands = (g.walls || []).filter(w => !w.destroyed
        && Math.hypot(w.x - (hq0.x + hq0.w/2), w.y - (hq0.y + hq0.h/2)) > 180
        && Math.hypot(w.x - (hq1.x + hq1.w/2), w.y - (hq1.y + hq1.h/2)) > 180);
      if(cands.length){
        const w = cands[Math.floor(rnd() * cands.length)];
        /* que hai dentro: peza do pool perdido (60% se hai) ou caché de chatarra */
        let peza = null;
        const pool = (DATA.piezasEnemigas || []).filter(p => !(g._pezasEnCampo && g._pezasEnCampo.has(p.id)));
        if(pool.length && rnd() < 0.6){
          peza = pool[Math.floor(rnd() * pool.length)];
          g._pezasEnCampo = g._pezasEnCampo || new Set();
          g._pezasEnCampo.add(peza.id);
        }
        addSubquest(g, {
          tipo: 'MURO_RESTOS', x: w.x, y: w.y, wallRef: w, peza,
          titulo: peza ? TXT('sq.muroPeza', {peza:PEZA_LABEL[peza.tipo], de:peza.deNome}) : TXT('sq.muro'),
          desc: TXT('sq.muroDesc'),
          bounty: peza ? 0 : 6,
        });
        hqSay(TXT('hq.muroRestos'), 0, 'hq.muroRestos');
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
          hqSay(TXT('hq.sinalPerdida'), 0, 'hq.sinalPerdida');
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
          radio(TXT('r.pezaCascallos', {peza:PEZA_LABEL[q.peza.tipo].toUpperCase(), de:q.peza.deNome}), '#ff9a3c', {x: q.x, y: q.y});
        } else {
          q._drop = {x: q.x, y: q.y - 4, amount: 18, timer: 90 * 60, collected: false};
          radio(TXT('r.cacheCascallos'), '#c8a86a', {x: q.x, y: q.y});
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
          hqSay(TXT('hq.oxidados'), 0, 'hq.oxidados');
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
          const eq = unicos[Math.floor(rnd() * unicos.length)];
          eng.equipment = eng.equipment || [];
          eng.equipment.push(eq.id);
          if(eq.id === 'servo_alleo'){ eng.spd *= 1.08; eng.dmg = Math.round(eng.dmg * 1.08); if(eng._dmgBase) eng._dmgBase *= 1.08; }
          const rec = DATA.units.find(r => r.id === eng.id);
          if(rec){ rec.equipment = rec.equipment || []; rec.equipment.push(eq.id); }
          radio(TXT('r.analizou', {n:eng.name, eq:eq.nome, d:eq.desc}), '#b48aff', {x:q.x, y:q.y});
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
    radio(TXT('r.sqCumprida', {n:unidade.name}), '#b48aff', {x:unidade.x, y:unidade.y});
  }
  hqSay(TXT('hq.sqDone') + (q.bounty ? TXT('hq.sqPrima', {n: q.bounty}) : ''));
  sfx('loot_pick');
}

/* ============================================================
   A VOZ DO HQ (v0.21) — terceira voz do xogo. Máquina operativa:
   datos, prioridades, silencio. Sen retranca (iso é de ÓPTIMA),
   sen barro (iso é das unidades).
   ============================================================ */
/* (v0.80) `clave` é a clave i18n da frase, e serve para buscar gravación
   no manifesto de voces. Sen ela queda o blip xenérico de sempre; con
   ela, o HQ fala — humano se hai .ogg, chío se non.
   Vai de terceiro parámetro para non romper as chamadas que xa pasaban
   delayMs. */
function hqSay(text, delayMs = 0, clave = null){
  const emit = () => {
    radio(`HQ: ${text}`, '#8aa0b8');
    if(clave && typeof vozMando === 'function') vozMando(clave, text);
    else sfxT('voice_blip', 200, 'HQ');
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
/* (v0.40 F3) VOLT en tres voces — REDACTADO, non traducido. */
const VOLT_LINES_ML = {
  es: {
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
  },
  gl: {
    intro: ["Aquí VOLT. Outra vez vós. Rematemos axiña.",
            "VOLT en frecuencia. Lin o voso expediente. Mediocre.",
            "Mesmo barro, mesmos erros. Adiante."],
    taunt: ["Un menos. Contámolos por vós.",
            "¿Ese tiña nome? Xa non importa.",
            "Chatarra vosa, campo meu."],
    grumble: ["Material substituíble. Seguide gastando munición.",
              "Cada baixa miña pagarédela dúas veces."],
    rage: ["{name}... Esa vasma pagar.",
           "{name} tiña historial. Agora tedes a miña atención."],
    derrotado: ["Retirada táctica. Isto non remata aquí.",
                "Quedade co campo. Eu quedo coa lección."],
    vencedor: ["Informade a ÓPTIMA: VOLT non negocia.",
               "Recollede o que vos deixe. Se vos deixo algo."],
  },
  en: {
    intro: ["VOLT here. You again. Let's make this quick.",
            "VOLT on frequency. I've read your file. Mediocre.",
            "Same mud, same mistakes. Proceed."],
    taunt: ["One less. We keep count for you.",
            "Did that one have a name? Not anymore.",
            "Your scrap, my field."],
    grumble: ["Replaceable materiel. Keep wasting ammunition.",
              "Every loss of mine, you'll pay for twice."],
    rage: ["{name}... You will answer for that one.",
           "{name} had a record. Now you have my attention."],
    derrotado: ["Tactical withdrawal. This isn't over.",
                "Keep the field. I keep the lesson."],
    vencedor: ["Inform OPTIMA: VOLT does not negotiate.",
               "Collect what I leave you. If I leave you anything."],
  },
};
function voltSay(pool, ctx = {}){
  const VL = VOLT_LINES_ML[I18N.lang] || VOLT_LINES_ML.es;
  const arr = VL[pool];
  let t = arr[Math.floor(rnd() * arr.length)];
  t = t.replace('{name}', ctx.name || '');
  radio(`VOLT: «${t}»`, '#ff7a5a');
  sfxT('voice_blip', 250, 'VOLT');
}

function tickVolt(g){
  if(DATA.opCount < 2) return;
  /* presentación unha vez por op */
  if(!g._voltIntro && g.t > 600){
    g._voltIntro = true;
    if(rnd() < 0.6) voltSay('intro');
  }
  /* burla cando cae un teu (throttle 40s) */
  if(!g._voltTauntT || g.t - g._voltTauntT > 2400){
    const caido = g.units.find(u => u.team === PT && u.dead && u._hqMourned && !u._voltTaunted);
    if(caido){
      caido._voltTaunted = true;
      if(rnd() < 0.35){
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
      radio(TXT('r.baixaVet', {n: vet.name, ops: vet.ops}), '#ffd700');
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
    hqSay(TXT('hq.escudo'), 0, 'hq.escudo');
  }
}

/* ============================================================
   OS GRISES (v0.24) — Brigadas de Requisa de ÓPTIMA. Team 2:
   hostís a AMBOS bandos, nunca aos HQs. Quedan ata que os maten.
   Veñen por chasis. A xustificación é sempre absurda.
   ============================================================ */
const REQUISAS_OPTIMA_ML = {
  es: [
    'AVISO DE REQUISA: la División de Reciclaje Preventivo recolectará chasis operativos para la nueva línea de inodoros institucionales. La resistencia computa como donación voluntaria.',
    'Sus unidades han sido preseleccionadas para el programa de repuestos corporativos. Enhorabuena. La brigada de requisa no negocia.',
    'ÓPTIMA requisa material rodante para la fabricación de percheros ejecutivos. Todo chasis es susceptible. Mantengan la calma reglamentaria.',
    'Recordatorio: el inventario de ÓPTIMA incluye a ÓPTIMA, a ustedes, y al enemigo. La brigada procede a actualizar existencias.',
  ],
  gl: [
    'AVISO DE REQUISA: a División de Reciclaxe Preventiva recollerá chasis operativos para a nova liña de inodoros institucionais. A resistencia computa como doazón voluntaria.',
    'As súas unidades foron preseleccionadas para o programa de repostos corporativos. Noraboa. A brigada de requisa non negocia.',
    'ÓPTIMA requisa material rodante para a fabricación de perchas executivas. Todo chasis é susceptible. Manteñan a calma regulamentaria.',
    'Recordatorio: o inventario de ÓPTIMA inclúe a ÓPTIMA, a vostedes, e ao inimigo. A brigada procede a actualizar existencias.',
  ],
  en: [
    'REQUISITION NOTICE: the Preventive Recycling Division will collect operational chassis for the new line of institutional toilets. Resistance is booked as voluntary donation.',
    'Your units have been shortlisted for the corporate spare-parts program. Congratulations. The requisition brigade does not negotiate.',
    'OPTIMA is requisitioning rolling stock for the manufacture of executive coat racks. All chassis are eligible. Maintain regulation calm.',
    'Reminder: OPTIMA\u2019s inventory includes OPTIMA, yourselves, and the enemy. The brigade is proceeding to update stock levels.',
  ],
};
function spawnGreys(g){
  const n = 4 + Math.floor(rnd() * 3);   /* 4-6 */
  const dende = rnd() < 0.5 ? 'norte' : 'sur';
  const y0 = dende === 'norte' ? 30 : H - 30;
  const x0 = 150 + rnd() * (W - 300);
  g._greysN = g._greysN || 0;
  for(let i = 0; i < n; i++){
    const cls = (i === 0 && n >= 5) ? 'HEAVY' : 'GRUNT';
    const u = mkUnit(2, cls, x0 + (i - n/2) * 26 + rnd()*10, y0 + (rnd()*16-8), null);
    g._greysN++;
    u.name = 'REQ-' + String(g._greysN).padStart(2, '0');
    u.hp = Math.round(u.hp * 1.15); u.max = u.hp;   /* material corporativo: algo mellor */
    g.units.push(u);
    orderMove(u, W/2 + (rnd()*200-100), H/2 + (rnd()*160-80));
  }
  hqSay(TXT('hq.grises'), 0, 'hq.grises');
  sfx('radio_static');
  setTimeout(() => {
    const _rq = REQUISAS_OPTIMA_ML[I18N.lang] || REQUISAS_OPTIMA_ML.es;
    radio(`▣ ÓPTIMA: ${_rq[Math.floor(rnd()*_rq.length)]}`, '#e8c060');
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
      setTimeout(() => hqSay(TXT('hq.senResposta', {nome})), 2000);
    }
  }

  /* Produción baixo mínimos */
  if(!g._hq.prodLow && g._hq.peak >= 5 && vivos.length < g._hq.peak * 0.4){
    g._hq.prodLow = true;
    hqSay(TXT('hq.prodBaixa'), 0, 'hq.prodBaixa');
  }

  /* Sectores: superioridade / colapso */
  if(g.sectors && g.sectors.length){
    const meus = g.sectors.filter(s => s.owner === PT).length;
    if(!g._hq.supIndustrial && meus === g.sectors.length){
      g._hq.supIndustrial = true;
      hqSay(TXT('hq.superioridade'), 0, 'hq.superioridade');
    }
    if(!g._hq.redPerdida && g.sectors.every(s => s.owner === ET)){
      g._hq.redPerdida = true;
      hqSay(TXT('hq.sectoresPerdidos'), 0, 'hq.sectoresPerdidos');
    }
  }

  /* Integridade do HQ */
  if(!g._hq.dano50 && g.hq[PT].hp < g.hq[PT].max * 0.5){
    g._hq.dano50 = true;
    hqSay(TXT('hq.hq50'), 0, 'hq.hq50');
  }

  /* Radar: enlace gañado/perdido */
  if(g.radar){
    if(g._hq.radarPrev === undefined) g._hq.radarPrev = g.radar.owner;
    if(g.radar.owner !== g._hq.radarPrev){
      if(g.radar.owner === PT) hqSay(TXT('hq.radarOn'), 0, 'hq.radarOn');
      else if(g._hq.radarPrev === 0) hqSay(TXT('hq.radarOff'), 0, 'hq.radarOff');
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
  return rnd() < prob;
}

/* Resolve a expulsión ou morte do ocupante ao destruírse a estructura.
   Devolve true se sobreviviu. */
function resolveEjection(u, sx, sy, structLabel, g){
  if(rollSupervivencia(u)){
    u.inside = null;
    u.x = sx + (rnd()*40 - 20);
    u.y = sy + 26;
    if(u.team === PT){
      radio(TXT(structLabel==='jeep' ? 'r.saiuJeepExpl' : 'r.saiuTorretaExpl', {n: u.name}), '#ffd24a');
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
    radio(TXT(structLabel==='jeep' ? 'r.nonSaiuJeepExpl' : 'r.nonSaiuTorretaExpl', {n: u.name}), '#ff5340');
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
  /* (v0.43) vía i18n con fallback a 'o inimigo' */
  const k = 'causa.' + causa;
  const t = TXT(k);
  return t === k ? TXT('causa.default') : t;
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
    const arr = petTable().blindaxe[cls] || petTable().blindaxe.GRUNT;
    return glNorm(arr[Math.floor(Math.random()*arr.length)].replace(/\{op\}/g, rec.lastDeath.op));
  }
  /* Traizoada e non ten kit → pídeo (con amargura) */
  if(rec.lastBetrayal && !eq.includes('kit') && Math.random() < 0.35){
    const arr = petTable().kit[cls] || petTable().kit.GRUNT;
    return glNorm(arr[Math.floor(Math.random()*arr.length)].replace(/\{op\}/g, rec.lastBetrayal.op));
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

/* (v0.44 F3c) MEMORIA / PETICION / GLITCH en galego e inglés */
const FRASES_MEMORIA_GL = {
  betrayal: {
    GRUNT: [
      "Na Op {op} deixáchesme tirado, xefe. Non se esquece.",
      "Desde a Op {op} durmo cun ollo aberto.",
      "Op {op}. Só digo iso. Op {op}.",
    ],
    HEAVY: [
      "Desde a Op {op} non me fío de ti. E teño razóns, carallo.",
      "Na Op {op} deixáchesme vendido. Iso non se me esquece.",
      "A Op {op}? Sigo agardando unha explicación.",
    ],
    ENGINEER: [
      "Os meus rexistros da Op {op} seguen abertos. Ti saberás.",
      "Desde a Op {op} recalculei a nosa relación profesional.",
      "Op {op}. Téñoo documentado. Con timestamps.",
    ],
  },
  death: {
    GRUNT: [
      "Na Op {op} matoume {causa} en {place}. Aínda o soño, xefe.",
      "Xa morrín unha vez en {place}, Op {op}. Non penso repetir.",
      "{causa} reventoume na Op {op}. Ande con ollo esta vez.",
    ],
    HEAVY: [
      "Na Op {op} esnaquizoume {causa} en {place}. Teño contas pendentes.",
      "Morrín en {place}. Op {op}. E volvín. A ver quen aguanta máis.",
      "{causa}, Op {op}, {place}. Téñoo gravado a lume.",
    ],
    ENGINEER: [
      "Rexistro da Op {op}: destruído por {causa} en {place}. Prefiro non actualizalo.",
      "Xa coñezo {place}. Morrín alí na Op {op}. Curiosa sensación, volver.",
      "Na Op {op}, {causa} interrompeu as miñas funcións. Permanentemente. Case.",
    ],
  },
  save: {
    GRUNT: [
      "{name} sacoume da Op {op}. A ese si lle debo unha, xefe.",
      "Se non fose por {name} na Op {op}, non estaría aquí.",
    ],
    HEAVY: [
      "{name} salvoume o pelexo na Op {op}. Iso non se esquece. O bo tampouco.",
      "A {name} débolle a Op {op}. Con el si vou onde sexa.",
    ],
    ENGINEER: [
      "{name} interveu eficazmente na Op {op}. Queda rexistrado. Con gratitude.",
      "Sigo operativo grazas a {name}, Op {op}. Os datos non menten.",
    ],
  },
};
const FRASES_MEMORIA_EN = {
  betrayal: {
    GRUNT: [
      "In Op {op} you left me behind, chief. That doesn't get forgotten.",
      "Since Op {op} I sleep with one eye open.",
      "Op {op}. That's all I'm saying. Op {op}.",
    ],
    HEAVY: [
      "Since Op {op} I don't trust you. And I have my reasons, damn it.",
      "In Op {op} you sold me out. I don't forget that.",
      "Op {op}? Still waiting for an explanation.",
    ],
    ENGINEER: [
      "My records from Op {op} remain open. Your call.",
      "Since Op {op} I have recalculated our professional relationship.",
      "Op {op}. I have it documented. With timestamps.",
    ],
  },
  death: {
    GRUNT: [
      "In Op {op}, {causa} killed me at {place}. I still dream about it, chief.",
      "I already died once at {place}, Op {op}. Not planning a repeat.",
      "{causa} tore me apart in Op {op}. Watch your step this time.",
    ],
    HEAVY: [
      "In Op {op}, {causa} wrecked me at {place}. I have unfinished business.",
      "I died at {place}. Op {op}. And I came back. Let's see who lasts longer.",
      "{causa}, Op {op}, {place}. Burned into my memory.",
    ],
    ENGINEER: [
      "Record from Op {op}: destroyed by {causa} at {place}. I'd rather not update it.",
      "I know {place}. I died there in Op {op}. Curious feeling, coming back.",
      "In Op {op}, {causa} interrupted my functions. Permanently. Almost.",
    ],
  },
  save: {
    GRUNT: [
      "{name} pulled me out of Op {op}. That one I do owe, chief.",
      "If it weren't for {name} in Op {op}, I wouldn't be here.",
    ],
    HEAVY: [
      "{name} saved my hide in Op {op}. That doesn't get forgotten. The good doesn't either.",
      "I owe {name} for Op {op}. With them, I'll go anywhere.",
    ],
    ENGINEER: [
      "{name} intervened effectively in Op {op}. Logged. With gratitude.",
      "Still operational thanks to {name}, Op {op}. The data doesn't lie.",
    ],
  },
};
const FRASES_PETICION_GL = {
  blindaxe: {
    GRUNT:    ["Cómprame blindaxe, xefe. Non quero repetir a Op {op}.", "Con máis chapa, o da Op {op} non pasa. Dígocho eu."],
    HEAVY:    ["Máis blindaxe. Despois da Op {op} non é un capricho, carallo.", "Chapa nova? O da Op {op} non se repite."],
    ENGINEER: ["Solicito blindaxe adicional. Referencia: Op {op}. Motivos: obvios.", "Tras a Op {op}, recomendo investir na miña integridade estrutural."],
  },
  kit: {
    GRUNT:    ["Xa que nunca vén ninguén, cómprame o kit. Amáñome só, xefe.", "O kit de reparación. Así non dependo de ninguén. Coma na Op {op}."],
    HEAVY:    ["Cómprame o kit e non che pido nada máis. Visto o visto na Op {op}.", "O kit. Xa que os médicos non chegan, carallo."],
    ENGINEER: ["Un kit de autorreparación optimizaría a miña autonomía. A Op {op} aválao.", "Solicito o kit. Os datos da Op {op} xustifican o investimento."],
  },
};
const FRASES_PETICION_EN = {
  blindaxe: {
    GRUNT:    ["Buy me armor, chief. I don't want a repeat of Op {op}.", "With more plating, Op {op} doesn't happen again. Trust me."],
    HEAVY:    ["More armor. After Op {op} it's not a whim, damn it.", "New plating? Op {op} doesn't happen twice."],
    ENGINEER: ["Requesting additional armor. Reference: Op {op}. Reasons: obvious.", "After Op {op}, I recommend investing in my structural integrity."],
  },
  kit: {
    GRUNT:    ["Since nobody ever comes, buy me the kit. I'll manage alone, chief.", "The repair kit. So I don't depend on anyone. Like in Op {op}."],
    HEAVY:    ["Buy me the kit and I won't ask for anything else. Given what happened in Op {op}.", "The kit. Since the medics never show up, damn it."],
    ENGINEER: ["A self-repair kit would optimize my autonomy. Op {op} supports it.", "Requesting the kit. The data from Op {op} justifies the investment."],
  },
};
const FRASES_GLITCH_GL = [
  "Reparación comple— quen é {name}? Eu son... procedo.",
  "Sistemas... sistemas... cantos somos aquí dentro?",
  "Obxectivo fixado. Non. Si. Quen dixo iso?",
  "Este brazo lembra cousas que eu non fixen.",
  "Cargando personalidade... 74%... suficiente.",
  "Ás veces soño con quilómetros que non camiñei.",
];
const FRASES_GLITCH_EN = [
  "Repair comple— who is {name}? I am... proceeding.",
  "Systems... systems... how many of us are in here?",
  "Target locked. No. Yes. Who said that?",
  "This arm remembers things I never did.",
  "Loading personality... 74%... good enough.",
  "Sometimes I dream of kilometers I never walked.",
];
/* Selectores por idioma con fallback á castelá */
function memTable(){
  if(I18N.lang === 'gl' && typeof FRASES_MEMORIA_GL !== 'undefined') return FRASES_MEMORIA_GL;
  if(I18N.lang === 'en' && typeof FRASES_MEMORIA_EN !== 'undefined') return FRASES_MEMORIA_EN;
  return FRASES_MEMORIA;
}
function petTable(){
  if(I18N.lang === 'gl' && typeof FRASES_PETICION_GL !== 'undefined') return FRASES_PETICION_GL;
  if(I18N.lang === 'en' && typeof FRASES_PETICION_EN !== 'undefined') return FRASES_PETICION_EN;
  return FRASES_PETICION;
}
function glitchTable(){
  if(I18N.lang === 'gl' && typeof FRASES_GLITCH_GL !== 'undefined') return FRASES_GLITCH_GL;
  if(I18N.lang === 'en' && typeof FRASES_GLITCH_EN !== 'undefined') return FRASES_GLITCH_EN;
  return FRASES_GLITCH;
}
function fraseRenacida(rec){
  const r = Math.random();
  const clasesAlleas = (rec.piezasClases || []).filter(c => c !== rec.cls);
  /* 45%: frase roubada a unha clase doadora, coa marca de estrañeza */
  if(r < 0.45 && clasesAlleas.length){
    const cls = clasesAlleas[Math.floor(Math.random()*clasesAlleas.length)];
    const pool = endOpTable()[cls];
    if(pool){
      const estados = Object.keys(pool);
      const est = estados[Math.floor(Math.random()*estados.length)];
      const ctxs = Object.keys(pool[est]).filter(k => Array.isArray(pool[est][k]) && pool[est][k].length && pool[est][k][0] !== '...');
      if(ctxs.length){
        const arr = pool[est][ctxs[Math.floor(Math.random()*ctxs.length)]];
        const f = arr[Math.floor(Math.random()*arr.length)].replace(/\{name\}/g, '...');
        return glNorm(`${f} ${I18N.lang==='gl' ? '...perdón. Iso non era meu.' : I18N.lang==='en' ? "...sorry. That wasn't mine." : '...perdón. Eso no era mío.'}`);
      }
    }
  }
  /* 30%: mestura cortada de dúas frases */
  if(r < 0.75){
    const propio = endOpTable()[rec.cls] || endOpTable().GRUNT;
    const est = Object.keys(propio)[0];
    const arrA = propio[est].end_op_alive || ['...'];
    const a = arrA[Math.floor(Math.random()*arrA.length)];
    const _G = glitchTable();
    const g = _G[Math.floor(Math.random()*_G.length)];
    const corte = Math.max(4, Math.floor(a.length * 0.4));
    return glNorm(a.slice(0, corte) + '— ' + g.replace(/\{name\}/g, rec.name));
  }
  /* 25%: glitch puro */
  const _G2 = glitchTable();
  return glNorm(_G2[Math.floor(Math.random()*_G2.length)].replace(/\{name\}/g, rec.name));
}

/* Escolle frase-memoria se procede. Devolve null se non hai memoria aplicable. */
function pickFraseMemoria(rec, est){
  const cls = rec.cls;
  /* Prioridade 1: traizón non perdoada (só en estados de desconfianza) */
  if(rec.lastBetrayal && (est === 'DESCONFIADO' || est === 'AUTOPRESERVACION') && Math.random() < 0.6){
    const arr = (memTable().betrayal[cls] || memTable().betrayal.GRUNT);
    let f = arr[Math.floor(Math.random()*arr.length)];
    return glNorm(f.replace(/\{op\}/g, rec.lastBetrayal.op));
  }
  /* Prioridade 2: morte previa (calquera estado — morrer marca) */
  if(rec.lastDeath && Math.random() < 0.45){
    const arr = (memTable().death[cls] || memTable().death.GRUNT);
    let f = arr[Math.floor(Math.random()*arr.length)];
    return glNorm(f.replace(/\{op\}/g, rec.lastDeath.op)
            .replace(/\{causa\}/g, causaLabel(rec.lastDeath.causa))
            .replace(/\{place\}/g, (typeof placeLabel==='function') ? placeLabel(rec.lastDeath.place) : rec.lastDeath.place));
  }
  /* Prioridade 3: gratitude (só LEAL) */
  if(rec.lastSave && est === 'LEAL' && Math.random() < 0.35){
    const arr = (memTable().save[cls] || memTable().save.GRUNT);
    let f = arr[Math.floor(Math.random()*arr.length)];
    return glNorm(f.replace(/\{op\}/g, rec.lastSave.op)
            .replace(/\{name\}/g, rec.lastSave.who));
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
  /* SNIPER — mide, agarda e fala pouco. Cando fala, é para dar un
     dato: distancia, vento, obxectivo. A súa maneira de dicir que
     está mal é deixar de dar datos. */
  SNIPER: {
    LEAL: {
        LEAL: {
            briefing: ["Posición asignada. Estaré arriba antes que vosotros.", "Dadme altura y no necesito nada más."],
            selection: ["Aquí arriba.", "Te escucho."],
            critical: ["Sigo teniendo el pulso firme. Es lo único que hace falta."]
        },
        SARCASTICO: {
            briefing: ["Otra colina. Qué novedad.", "Tranquilo, ya me busco yo el sitio."],
            selection: ["Rápido, que tengo el ojo puesto."],
            critical: ["Me han encontrado. Era cuestión de tiempo."]
        },
        DESCONFIADO: {
            briefing: ["¿Esta vez tampoco vais a decirme quién es el objetivo?"],
            selection: ["Qué."],
            critical: ["Estoy solo aquí arriba. Como siempre."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoy no subo."],
            refusing_briefing: ["Desde arriba se ve todo, comandante. También lo que les hace a los suyos.", "He hecho la cuenta de los que subieron conmigo. No sale."],
            selection: ["..."]
        }
    },
    NERVIOSO: {
        LEAL: {
            briefing: ["Ya he medido el viento tres veces. Cuatro. Vale. Listo.", "Me pongo arriba y no me muevo. No me muevo, ¿verdad?"],
            selection: ["Sí. Sí, dime.", "Estoy. Estoy aquí."],
            critical: ["Me han dado y no vi de dónde. No vi de dónde."]
        },
        SARCASTICO: {
            briefing: ["Distancia, viento, objetivo desconocido. Perfecto.", "Genial. Otra vez a ciegas."],
            selection: ["¿Ahora qué pasa?"],
            critical: ["Sabía que esto iba a acabar así."]
        },
        DESCONFIADO: {
            briefing: ["¿Cuántos de los que subieron conmigo bajaron?"],
            selection: ["No me hagas contar."],
            critical: ["Que alguien mire hacia aquí. Que alguien mire."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoy no distingo el viento del pulso."],
            refusing_briefing: ["No subo. No subo. No me lo pidas otra vez.", "Cuento a los que faltan y me quedo sin dedos."],
            selection: ["..."]
        }
    },
    IRONICO: {
        LEAL: {
            briefing: ["Mil doscientos metros. Un paseo.", "Dadme una piedra alta y os hago el trabajo de tres."],
            selection: ["Desde aquí también se ve tu error, por cierto.", "Al aparato."],
            critical: ["He estado peor. No mucho, pero he estado."]
        },
        SARCASTICO: {
            briefing: ["Objetivo desconocido. Estupendo. Disparo a lo que se mueva y ya lo identificáis vosotros.", "Otra vez el mismo cerro. Le voy a poner nombre."],
            selection: ["Sorpréndeme."],
            critical: ["Bueno. Al menos han acertado a la primera."]
        },
        DESCONFIADO: {
            briefing: ["¿Sabes lo que se ve estupendamente desde arriba? Todo."],
            selection: ["Habla, que estoy ocupado mirando."],
            critical: ["Y no viene nadie. Qué raro."]
        },
        AUTOPRESERVACION: {
            briefing: ["Me quedo aquí. La vista es buena."],
            refusing_briefing: ["He hecho los cálculos. No salen.", "Sube tú, que tienes tan buena puntería para mandar."],
            selection: ["..."]
        }
    },
    ESTOICO: {
        LEAL: {
            briefing: ["Arriba. Sin ruido.", "Cuando estéis en posición, yo ya estaré."],
            selection: ["Listo."],
            critical: ["Funciono."]
        },
        SARCASTICO: {
            briefing: ["Otra."],
            selection: ["Aquí."],
            critical: ["Aguanto."]
        },
        DESCONFIADO: {
            briefing: ["Objetivo desconocido. Otra vez."],
            selection: ["Habla."],
            critical: ["Ya."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoy no."],
            refusing_briefing: ["He subido demasiadas veces."],
            selection: ["..."]
        }
    },
    CINICO: {
        LEAL: {
            briefing: ["Me tenéis para contar metros y apretar. Los cuento y aprieto."],
            selection: ["Distancia y objetivo. Lo demás me sobra."],
            critical: ["Se acabó el cálculo."]
        },
        SARCASTICO: {
            briefing: ["Objetivo desconocido. Me encanta esa parte del informe.", "Otra colina, otro número, otro nombre que no va a leer nadie."],
            selection: ["¿Y hoy a quién no vamos a identificar?"],
            critical: ["Al menos yo sí sé quién me ha dado."]
        },
        DESCONFIADO: {
            briefing: ["Desde arriba he visto quién recoge a los caídos. No erais vosotros."],
            selection: ["Dilo y ya."],
            critical: ["Apuntadlo en el registro y a otra cosa."]
        },
        AUTOPRESERVACION: {
            briefing: ["Ya he contado bastante."],
            refusing_briefing: ["Mil doscientos setenta y seis metros. Esa es la distancia a la que me da igual.", "Que suba otro. Números hay muchos."],
            selection: ["..."]
        }
    }
  },
  /* BOMBARDERO — ruidoso, cariñoso coas súas bombas e cómodo
     diante. A súa maneira de dicir que está mal é deixar de
     querer cargar. */
  BOMBARDERO: {
    LEAL: {
        LEAL: {
            briefing: ["¡Cargado y contento! ¿Dónde lo pongo?", "Traigo de las grandes. De las que se oyen desde la base."],
            selection: ["¡Aquí!", "Dime dónde."],
            critical: ["Me queda pólvora. Eso es lo importante."]
        },
        SARCASTICO: {
            briefing: ["Más pólvora, menos problemas. Eso decía el cartel, ¿no?", "Otra vez a abrir puertas a lo bruto."],
            selection: ["¿Qué reviento?"],
            critical: ["Me han dado a mí antes que a la carga. Mala suerte."]
        },
        DESCONFIADO: {
            briefing: ["¿Y si esta vez me avisáis antes de que estalle algo cerca?"],
            selection: ["Habla."],
            critical: ["No viene nadie, ¿verdad?"]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoy no cargo nada."],
            refusing_briefing: ["Fabricar, cargar, explotar, repetir. Me he saltado el repetir.", "Que las lleve otro."],
            selection: ["..."]
        }
    },
    NERVIOSO: {
        LEAL: {
            briefing: ["Las he revisado dos veces. Tres. Están bien. Están bien.", "No me hagáis correr con esto encima."],
            selection: ["¡Sí! Dime.", "Voy, voy."],
            critical: ["¡Cuidado con lo que llevo encima! ¡Cuidado!"]
        },
        SARCASTICO: {
            briefing: ["Genial, otra vez el primero en la puerta.", "Claro. Que vaya el que lleva los explosivos."],
            selection: ["¿Ahora?"],
            critical: ["Ya te dije que esto iba a pasar."]
        },
        DESCONFIADO: {
            briefing: ["¿Cuántos de los míos han vuelto enteros? Dímelo tú."],
            selection: ["No me grites."],
            critical: ["Se está calentando. Se está calentando mucho."]
        },
        AUTOPRESERVACION: {
            briefing: ["No con esto encima."],
            refusing_briefing: ["Llevo cuarenta kilos de razones para quedarme.", "No. Hoy no. Hoy no."],
            selection: ["..."]
        }
    },
    IRONICO: {
        LEAL: {
            briefing: ["Traigo alegría explosiva. Literalmente, lo pone en la caja.", "Decidme dónde y os hago una puerta nueva."],
            selection: ["A tus órdenes, con estruendo.", "Dime."],
            critical: ["Estoy hecho un cuadro. Uno abstracto."]
        },
        SARCASTICO: {
            briefing: ["El plan del día: fabricar, cargar, explotar, repetir. Qué vida tan variada.", "Otra puerta. Voy a echar de menos las llaves."],
            selection: ["¿A quién le abro?"],
            critical: ["Bueno. Al menos he hecho ruido."]
        },
        DESCONFIADO: {
            briefing: ["Curioso que siempre vaya delante el que lleva la pólvora."],
            selection: ["Tú dirás."],
            critical: ["Nadie corre hacia aquí. Qué sorpresa."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoy me quedo apagado."],
            refusing_briefing: ["Más pólvora, menos problemas. Cero pólvora, cero problemas.", "Explotar es fácil. Repetir es lo difícil."],
            selection: ["..."]
        }
    },
    ESTOICO: {
        LEAL: {
            briefing: ["Cargado.", "Donde digas."],
            selection: ["Aquí."],
            critical: ["Aguanto."]
        },
        SARCASTICO: {
            briefing: ["Otra puerta."],
            selection: ["Dime."],
            critical: ["Ya."]
        },
        DESCONFIADO: {
            briefing: ["Delante otra vez."],
            selection: ["Habla."],
            critical: ["No viene nadie."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoy no."],
            refusing_briefing: ["He cargado bastante."],
            selection: ["..."]
        }
    },
    CINICO: {
        LEAL: {
            briefing: ["Me hicieron para abrir agujeros. Los abro."],
            selection: ["Señala y me voy."],
            critical: ["Se acabó la mecha."]
        },
        SARCASTICO: {
            briefing: ["Fabricar, cargar, explotar, repetir. Lo de repetir lo pusieron por optimismo.", "Otra vez de llave maestra."],
            selection: ["¿Qué estorba hoy?"],
            critical: ["Al menos me llevo el sitio por delante."]
        },
        DESCONFIADO: {
            briefing: ["Nunca preguntáis qué hay al otro lado de lo que abro."],
            selection: ["Dilo."],
            critical: ["Apuntadlo y seguid."]
        },
        AUTOPRESERVACION: {
            briefing: ["Ya he abierto bastantes."],
            refusing_briefing: ["La caja pone ALEGRÍA EXPLOSIVA. Alguien tiene mucho sentido del humor.", "Que la lleve el que lo escribió."],
            selection: ["..."]
        }
    }
  },
};

/* (v0.40 F3b) FRASES en inglés — a voz interactiva do escuadrón, REESCRITA.
   Fallback por táboa: se unha lingua non ten táboa, úsase a castelá enteira. */
const FRASES_EN = {
  GRUNT: {
    LEAL: {
      LEAL:           { briefing:["At your orders, chief. Wherever you say.", "Right here, buddy.", "Whatever you need."],
                        selection:["Say it.", "Orders.", "Here."],
                        critical:["Holding on, chief. Holding on.","Still standing."] },
      SARCASTICO:     { briefing:["Bit tired today, chief."],
                        selection:["Fine, chief."],
                        critical:["This isn't like the other times, chief."] },
      DESCONFIADO:    { briefing:["Something changed. Don't know what."],
                        selection:["Hold on, chief."],
                        critical:["Support! Please!"] },
      AUTOPRESERVACION:{briefing:["I don't know who you are anymore."],
                        refusing_briefing:["Not today, chief. Not today."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["Everything under control, chief? Tell me it is.","It's going to be fine, right?"],
                        selection:["Here. Listening.","Yes?"],
                        critical:["I'm all alone out here! Help!","I need support!"] },
      SARCASTICO:     { briefing:["Hope somebody actually covers me this time.","Off to the front again."],
                        selection:["Okay, okay.","Yes..."],
                        critical:["I knew it! I knew this would happen!","They left me alone again!"] },
      DESCONFIADO:    { briefing:["This smells bad, chief. Really bad.","I don't like it, I don't like it."],
                        selection:["Wait. Are you sure?","Really?"],
                        critical:["They left me! They left me again!","I don't want to die here!"] },
      AUTOPRESERVACION:{briefing:["No, no. Not today. Send the HEAVY."],
                        refusing_briefing:["I'm not meat. I'm not disposable. I'm not going out today.","Send someone else. Not me. Not anymore."],
                        selection:["..."] },
    },
    IRONICO: {
      LEAL:           { briefing:["Me again. Alright then.","My turn, I suppose."],
                        selection:["Go ahead, chief.","Here. The usual guy."],
                        critical:["It was a matter of time."] },
      SARCASTICO:     { briefing:["Of course, send the grunt. That's what we're for.","Me at the front again. What a surprise."],
                        selection:["Yes. Me again."],
                        critical:["Unbelievable. My turn again."] },
      DESCONFIADO:    { briefing:["To the front again, buddy? Shocking."],
                        selection:["What do you need now?"],
                        critical:["Now THIS is new. And not in a good way."] },
      AUTOPRESERVACION:{briefing:["I'll pass today. Seriously."],
                        refusing_briefing:["Sure, send the grunt. That's what we're for. But not today, buddy."],
                        critical:["This one's on you. I'm done.","..."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Ready, chief.","Moving."],
                        selection:["Say it."],
                        critical:["Holding."] },
      SARCASTICO:     { briefing:["Let's go then."],
                        selection:["Yes."],
                        critical:["This is getting complicated."] },
      DESCONFIADO:    { briefing:["What's the plan, chief?"],
                        selection:["Awaiting instructions."],
                        critical:["I need support."] },
      AUTOPRESERVACION:{briefing:["Don't talk to me today, chief."],
                        refusing_briefing:["Not today, chief. Send someone else."],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Good. Maybe this time it won't be a disaster."],
                        selection:["I hear you."],
                        critical:["Still here. For now."] },
      SARCASTICO:     { briefing:["Fourth run. I know the way by now.","Again. The usual."],
                        selection:["Tell me."],
                        critical:["To be expected."] },
      DESCONFIADO:    { briefing:["The plan has holes. As always, buddy."],
                        selection:["If you insist."],
                        critical:["I called it, didn't I?"] },
      AUTOPRESERVACION:{briefing:["I've seen enough, chief."],
                        refusing_briefing:["Three ops saving your hide. Today you save it yourself.","No. Not me."],
                        selection:["..."] },
    },
  },
  HEAVY: {
    LEAL: {
      LEAL:           { briefing:["We're on it, chief.","Nothing touches you while I'm here.","Wherever it's needed."],
                        selection:["Talk to me.","Speak.","Here."],
                        critical:["Holding, don't worry.","Easy, I'm still up."] },
      SARCASTICO:     { briefing:["Out there again? Damn it, fine."],
                        selection:["Fine, fine."],
                        critical:["This is getting ugly, chief!"] },
      DESCONFIADO:    { briefing:["Are you serious about this plan?"],
                        selection:["Let's see."],
                        critical:["Support, damn it! They're on me!"] },
      AUTOPRESERVACION:{briefing:["Screw you. Seriously."],
                        refusing_briefing:["After last time, I'm not going out. Send your damn mother."],
                        critical:["You son of a bitch, you let me die again!","..."] },
    },
    IRONICO: {
      LEAL:           { briefing:["Time for the show again.","Lead on, chief. I'm sharp today."],
                        selection:["Let's hear it."],
                        critical:["This is getting complicated, damn it."] },
      SARCASTICO:     { briefing:["Magnificent. A garbage plan and me up front. As always.","Another masterpiece, huh?"],
                        selection:["Fine, shoot. Irony aside."],
                        critical:["Holy hell! What a surprise!","Damn, damn, damn!"] },
      DESCONFIADO:    { briefing:["If this goes like Op 4, I quit.","This looks like the other times. Bad."],
                        selection:["Out with it. Let's see."],
                        critical:["I told you no. I TOLD YOU."] },
      AUTOPRESERVACION:{briefing:["Today I'm in charge. You watch."],
                        refusing_briefing:["I'm staying in the turret. Screw you."],
                        critical:["Your plan, your problem. I mind my own.","..."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Ready.","Moving."],
                        selection:["Yes."],
                        critical:["Enduring."] },
      SARCASTICO:     { briefing:["Damn, another one."],
                        selection:["Go on."],
                        critical:["This is ugly."] },
      DESCONFIADO:    { briefing:["Are we sure about this?"],
                        selection:["Speak."],
                        critical:["I need support, damn it."] },
      AUTOPRESERVACION:{briefing:["Not today."],
                        refusing_briefing:["Don't come at me with a plan. Not today.","I'll pass today."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["All under control? Really?"],
                        selection:["Here, damn it. Listening."],
                        critical:["Support, for God's sake, support!"] },
      SARCASTICO:     { briefing:["I hope you have an actual plan this time."],
                        selection:["Fine, damn it."],
                        critical:["I said it! Damn it, I said it!"] },
      DESCONFIADO:    { briefing:["This doesn't smell right. At all."],
                        selection:["You sure, chief?"],
                        critical:["I'm going to die out here! Get me out!"] },
      AUTOPRESERVACION:{briefing:["No! Hell no!"],
                        refusing_briefing:["I refuse! To hell with all of it, I refuse!"],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Fine. This might even work."],
                        selection:["I'm listening."],
                        critical:["It was a matter of time."] },
      SARCASTICO:     { briefing:["We've done this before. We know how it ends, damn it."],
                        selection:["Tell me."],
                        critical:["Well, look at that. Shocking."] },
      DESCONFIADO:    { briefing:["Your plan looks like garbage. As always."],
                        selection:["If you insist."],
                        critical:["I told you, damn it. I told you."] },
      AUTOPRESERVACION:{briefing:["I've seen enough."],
                        refusing_briefing:["You're not moving me today. Send your damn mother."],
                        selection:["..."] },
    },
  },
  ENGINEER: {
    IRONICO: {
      LEAL:           { briefing:["Interesting decision. It will work.","Proceeding. With good expectations, this time."],
                        selection:["Say it.","Yes."],
                        critical:["This exceeds the projected margin."] },
      SARCASTICO:     { briefing:["I understand your plan. Partially.","Another incursion. Fine."],
                        selection:["Go on."],
                        critical:["Curious place to die."] },
      DESCONFIADO:    { briefing:["I'll trust you, against my better judgment.","Your plan presents certain... peculiarities."],
                        selection:["If you insist."],
                        critical:["This was foreseeable. It was."] },
      AUTOPRESERVACION:{briefing:["Of course. You decided. Proceeding.","I understand your plan follows a logic that escapes me."],
                        refusing_briefing:["Today I'll attend to administrative tasks. Your plan doesn't require me.","I've computed my odds. Today I decline to participate."],
                        selection:["..."],
                        critical:["I'm sorry for you. Not for me."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Ready.","Moving."],
                        selection:["Yes."],
                        critical:["Enduring."] },
      SARCASTICO:     { briefing:["Proceeding."],
                        selection:["Go on."],
                        critical:["Not ideal."] },
      DESCONFIADO:    { briefing:["Go ahead."],
                        selection:["Yes."],
                        critical:["Under fire."] },
      AUTOPRESERVACION:{briefing:["Not today."],
                        refusing_briefing:["I decline this operation.","Today I remain at base."],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Fine. Maybe this time it won't be catastrophic."],
                        selection:["I hear you."],
                        critical:["It was a matter of time."] },
      SARCASTICO:     { briefing:["This op won't go as planned either. Proceeding.","Familiar. Proceeding."],
                        selection:["Go on."],
                        critical:["As expected."] },
      DESCONFIADO:    { briefing:["Your plan follows a logic that escapes me, as usual."],
                        selection:["If you insist."],
                        critical:["Predictable."] },
      AUTOPRESERVACION:{briefing:["I've run the numbers and prefer not to participate."],
                        refusing_briefing:["I've computed my odds. Today I decline to participate.","My calculations do not endorse your plan. I remain at base."],
                        selection:["..."] },
    },
    LEAL: {
      LEAL:           { briefing:["With you, always.","Whatever you need."],
                        selection:["Here."],
                        critical:["Holding on, don't worry."] },
      SARCASTICO:     { briefing:["Bit tired today."],
                        selection:["Fine."],
                        critical:["This isn't like the other times."] },
      DESCONFIADO:    { briefing:["Something changed. Don't know what."],
                        selection:["Go ahead."],
                        critical:["I need help."] },
      AUTOPRESERVACION:{briefing:["I don't know who you are anymore."],
                        refusing_briefing:["I can't today. Seriously."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["Everything under control? I trust you."],
                        selection:["Yes, here."],
                        critical:["I need support, please!"] },
      SARCASTICO:     { briefing:["I hope it's different this time."],
                        selection:["Fine."],
                        critical:["I said it, I said it!"] },
      DESCONFIADO:    { briefing:["This smells bad. You know it, right?"],
                        selection:["Are you sure?"],
                        critical:["I'm going to die here!"] },
      AUTOPRESERVACION:{briefing:["I can't anymore."],
                        refusing_briefing:["My calculations say no. I remain at base."],
                        selection:["..."] },
    },
  },
  /* SNIPER — mide, agarda e fala pouco. Cando fala, é para dar un
     dato: distancia, vento, obxectivo. A súa maneira de dicir que
     está mal é deixar de dar datos. */
  SNIPER: {
    LEAL: {
        LEAL: {
            briefing: ["Position assigned. I will be up there before you are.", "Give me height and I need nothing else."],
            selection: ["Up here.", "I am listening."],
            critical: ["My hand is still steady. That is the only part that matters."]
        },
        SARCASTICO: {
            briefing: ["Another hill. How new.", "Relax. I will find my own spot."],
            selection: ["Quickly. I have an eye on something."],
            critical: ["They found me. It was only a matter of time."]
        },
        DESCONFIADO: {
            briefing: ["Are you not going to tell me who the target is this time either?"],
            selection: ["What."],
            critical: ["I am alone up here. As always."]
        },
        AUTOPRESERVACION: {
            briefing: ["I am not going up today."],
            refusing_briefing: ["You can see everything from up there, commander. Including what you do to your own.", "I counted the ones who went up with me. The number does not work."],
            selection: ["..."]
        }
    },
    NERVIOSO: {
        LEAL: {
            briefing: ["I have measured the wind three times. Four. Fine. Ready.", "I go up and I do not move. I do not move, right?"],
            selection: ["Yes. Yes, tell me.", "Here. I am here."],
            critical: ["They hit me and I did not see where from. I did not see where from."]
        },
        SARCASTICO: {
            briefing: ["Distance, wind, target unknown. Perfect.", "Wonderful. Blind again."],
            selection: ["What now?"],
            critical: ["I knew this would end like this."]
        },
        DESCONFIADO: {
            briefing: ["How many of the ones who went up with me came back down?"],
            selection: ["Do not make me count."],
            critical: ["Somebody look this way. Somebody look."]
        },
        AUTOPRESERVACION: {
            briefing: ["Today I cannot tell the wind from my own hands."],
            refusing_briefing: ["I am not going up. I am not going up. Do not ask me again.", "I count the missing and I run out of fingers."],
            selection: ["..."]
        }
    },
    IRONICO: {
        LEAL: {
            briefing: ["Twelve hundred metres. A stroll.", "Give me a tall rock and I will do the work of three."],
            selection: ["I can see your mistake from here too, by the way.", "Speaking."],
            critical: ["I have been worse. Not much worse, but worse."]
        },
        SARCASTICO: {
            briefing: ["Target unknown. Splendid. I shoot whatever moves and you identify it afterwards.", "The same hill again. I am going to name it."],
            selection: ["Surprise me."],
            critical: ["Well. At least they got me first try."]
        },
        DESCONFIADO: {
            briefing: ["Do you know what you can see beautifully from up there? Everything."],
            selection: ["Talk. I am busy watching."],
            critical: ["And nobody comes. How odd."]
        },
        AUTOPRESERVACION: {
            briefing: ["I am staying here. The view is good."],
            refusing_briefing: ["I ran the numbers. They do not work.", "You go up. You have such fine aim when it comes to orders."],
            selection: ["..."]
        }
    },
    ESTOICO: {
        LEAL: {
            briefing: ["Up. Quietly.", "By the time you are in position, I will already be there."],
            selection: ["Ready."],
            critical: ["Functioning."]
        },
        SARCASTICO: {
            briefing: ["Another."],
            selection: ["Here."],
            critical: ["Holding."]
        },
        DESCONFIADO: {
            briefing: ["Target unknown. Again."],
            selection: ["Speak."],
            critical: ["Noted."]
        },
        AUTOPRESERVACION: {
            briefing: ["Not today."],
            refusing_briefing: ["I have gone up too many times."],
            selection: ["..."]
        }
    },
    CINICO: {
        LEAL: {
            briefing: ["You keep me to count metres and squeeze. I count and I squeeze."],
            selection: ["Distance and target. The rest is padding."],
            critical: ["No more arithmetic."]
        },
        SARCASTICO: {
            briefing: ["Target unknown. That is my favourite part of the report.", "Another hill, another number, another name nobody will read."],
            selection: ["And who are we not identifying today?"],
            critical: ["At least I know who got me."]
        },
        DESCONFIADO: {
            briefing: ["From up there I saw who collects the fallen. It was not you."],
            selection: ["Say it and be done."],
            critical: ["Put it in the register and move on."]
        },
        AUTOPRESERVACION: {
            briefing: ["I have counted enough."],
            refusing_briefing: ["Twelve hundred and seventy-six metres. That is the range at which I stop caring.", "Send someone else up. There are plenty of numbers."],
            selection: ["..."]
        }
    }
  },
  /* BOMBARDERO — ruidoso, cariñoso coas súas bombas e cómodo
     diante. A súa maneira de dicir que está mal é deixar de
     querer cargar. */
  BOMBARDERO: {
    LEAL: {
        LEAL: {
            briefing: ["Loaded and happy! Where do you want it?", "I brought the big ones. The ones they hear back at base."],
            selection: ["Here!", "Tell me where."],
            critical: ["I still have powder. That is what counts."]
        },
        SARCASTICO: {
            briefing: ["More powder, fewer problems. That is what the sign said, right?", "Opening doors the loud way again."],
            selection: ["What am I blowing up?"],
            critical: ["They hit me before the charge. Bad luck."]
        },
        DESCONFIADO: {
            briefing: ["How about you warn me before something goes off near me this time?"],
            selection: ["Talk."],
            critical: ["Nobody is coming, are they?"]
        },
        AUTOPRESERVACION: {
            briefing: ["I am not loading anything today."],
            refusing_briefing: ["Build, load, detonate, repeat. I skipped the repeat.", "Let someone else carry them."],
            selection: ["..."]
        }
    },
    NERVIOSO: {
        LEAL: {
            briefing: ["I checked them twice. Three times. They are fine. They are fine.", "Do not make me run with this on my back."],
            selection: ["Yes! Tell me.", "Going, going."],
            critical: ["Careful with what I am carrying! Careful!"]
        },
        SARCASTICO: {
            briefing: ["Great. First through the door again.", "Of course. Send the one carrying the explosives."],
            selection: ["Now?"],
            critical: ["I told you this would happen."]
        },
        DESCONFIADO: {
            briefing: ["How many of mine came back in one piece? You tell me."],
            selection: ["Do not shout at me."],
            critical: ["It is heating up. It is heating up a lot."]
        },
        AUTOPRESERVACION: {
            briefing: ["Not with this on my back."],
            refusing_briefing: ["I am carrying forty kilos of reasons to stay here.", "No. Not today. Not today."],
            selection: ["..."]
        }
    },
    IRONICO: {
        LEAL: {
            briefing: ["I bring explosive joy. It says so on the crate, literally.", "Tell me where and I will make you a new door."],
            selection: ["At your service, loudly.", "Tell me."],
            critical: ["I am a work of art. An abstract one."]
        },
        SARCASTICO: {
            briefing: ["Plan for the day: build, load, detonate, repeat. What a varied life.", "Another door. I am going to start missing keys."],
            selection: ["Who am I opening up?"],
            critical: ["Well. At least I made noise."]
        },
        DESCONFIADO: {
            briefing: ["Funny how the one carrying the powder always walks in front."],
            selection: ["Go on then."],
            critical: ["Nobody is running this way. What a surprise."]
        },
        AUTOPRESERVACION: {
            briefing: ["Today I stay unlit."],
            refusing_briefing: ["More powder, fewer problems. No powder, no problems.", "Detonating is the easy part. Repeating is the hard one."],
            selection: ["..."]
        }
    },
    ESTOICO: {
        LEAL: {
            briefing: ["Loaded.", "Wherever you say."],
            selection: ["Here."],
            critical: ["Holding."]
        },
        SARCASTICO: {
            briefing: ["Another door."],
            selection: ["Tell me."],
            critical: ["Noted."]
        },
        DESCONFIADO: {
            briefing: ["Out in front again."],
            selection: ["Speak."],
            critical: ["Nobody is coming."]
        },
        AUTOPRESERVACION: {
            briefing: ["Not today."],
            refusing_briefing: ["I have carried enough."],
            selection: ["..."]
        }
    },
    CINICO: {
        LEAL: {
            briefing: ["They built me to make holes. I make them."],
            selection: ["Point and I go."],
            critical: ["Fuse is out."]
        },
        SARCASTICO: {
            briefing: ["Build, load, detonate, repeat. They added the repeat out of optimism.", "Master key duty again."],
            selection: ["What is in the way today?"],
            critical: ["At least I am taking the place with me."]
        },
        DESCONFIADO: {
            briefing: ["You never ask what is on the other side of what I open."],
            selection: ["Say it."],
            critical: ["Write it down and carry on."]
        },
        AUTOPRESERVACION: {
            briefing: ["I have opened enough of them."],
            refusing_briefing: ["The crate says EXPLOSIVE JOY. Somebody has a great sense of humour.", "Let whoever wrote that carry it."],
            selection: ["..."]
        }
    }
  },
};


/* (v0.44 F3c) FRASES en GALEGO — a voz interactiva do escuadrón.
   Mesma estrutura ca castelá: clase × personalidade × estado × contexto. */
const FRASES_GL = {
  GRUNT: {
    LEAL: {
      LEAL:           { briefing:["Ás ordes, xefe. Onde diga.", "Aquí estou, compa.", "O que necesite."],
                        selection:["Diga.", "Mande.", "Aquí."],
                        critical:["Aguanto, xefe. Aguanto.","Sigo en pé."] },
      SARCASTICO:     { briefing:["Hoxe estou un pouco canso, xefe."],
                        selection:["Vale, xefe."],
                        critical:["Isto non é coma outras veces, xefe."] },
      DESCONFIADO:    { briefing:["Algo cambiou. Non sei que."],
                        selection:["Espere, xefe."],
                        critical:["Apoio! Por favor!"] },
      AUTOPRESERVACION:{briefing:["Xa non sei quen é vostede."],
                        refusing_briefing:["Hoxe non podo, xefe. Hoxe non."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["Todo controlado, xefe? Dígame que si.","Vai saír ben, verdade?"],
                        selection:["Aquí, atento.","Si?"],
                        critical:["Estou aquí soíño! Axuda!","Necesito apoio!"] },
      SARCASTICO:     { briefing:["Espero que esta vez si me cubra alguén.","Xa imos outra vez á fronte."],
                        selection:["Vale, vale.","Si..."],
                        critical:["Sabíao! Sabía que ía pasar!","Deixáronme só outra vez!"] },
      DESCONFIADO:    { briefing:["Isto cheira mal, xefe. Moi mal.","Non me gusta, non me gusta."],
                        selection:["Espera. Está seguro?","De verdade?"],
                        critical:["Deixáronme! Deixáronme outra vez!","Non quero morrer aquí!"] },
      AUTOPRESERVACION:{briefing:["Non, non. Hoxe non. Que vaia o HEAVY."],
                        refusing_briefing:["Eu non son carne. Non son desbotable. Hoxe non saio.","Que vaia outro. Eu xa non."],
                        selection:["..."] },
    },
    IRONICO: {
      LEAL:           { briefing:["Outra vez eu. Pois imos.","Xa me toca, supoño."],
                        selection:["Diga, xefe.","Aquí, o de sempre."],
                        critical:["Era cuestión de tempo."] },
      SARCASTICO:     { briefing:["Pois claro, manda o grunt. Para iso estamos.","Outra vez eu á fronte. Que novidade."],
                        selection:["Si. Outra vez eu."],
                        critical:["Manda carallo. Outra vez tócame a min."] },
      DESCONFIADO:    { briefing:["Outra vez á fronte, compa? Vaia sorpresa."],
                        selection:["Que necesita agora?"],
                        critical:["Isto si que é novo. E non no bo sentido."] },
      AUTOPRESERVACION:{briefing:["Hoxe paso. En serio."],
                        refusing_briefing:["Pois claro, manda o grunt. Para iso estamos. Pero hoxe non, compa."],
                        critical:["Cárgasme ti isto. Eu xa non.","..."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Listo, xefe.","Imos."],
                        selection:["Diga."],
                        critical:["Aguanto."] },
      SARCASTICO:     { briefing:["Imos logo."],
                        selection:["Si."],
                        critical:["Isto complícase."] },
      DESCONFIADO:    { briefing:["Cal é o plan, xefe?"],
                        selection:["Espero instrucións."],
                        critical:["Necesito apoio."] },
      AUTOPRESERVACION:{briefing:["Non me fale hoxe, xefe."],
                        refusing_briefing:["Hoxe non, xefe. Que vaia outro."],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Ben. Quizais esta vez non sexa un desastre."],
                        selection:["Óiovos."],
                        critical:["Sigo aquí. Polo de agora."] },
      SARCASTICO:     { briefing:["Imos á cuarta. Xa coñezo o camiño.","Outra vez. O de sempre."],
                        selection:["Dime."],
                        critical:["Era esperable."] },
      DESCONFIADO:    { briefing:["O plan ten buratos. Coma sempre, compa."],
                        selection:["Se insistes."],
                        critical:["Díxeno, verdade?"] },
      AUTOPRESERVACION:{briefing:["Vin dabondo, xefe."],
                        refusing_briefing:["Levo tres ops salvándolle o pelexo. Hoxe sálvao vostede.","Non. Eu non."],
                        selection:["..."] },
    },
  },
  HEAVY: {
    LEAL: {
      LEAL:           { briefing:["Aí estamos, xefe.","Comigo non che pasa nada.","Onde faga falla."],
                        selection:["Ti dirás.","Fala.","Aquí."],
                        critical:["Aguanto, tranquilo.","Tranquilo, sigo."] },
      SARCASTICO:     { briefing:["Outra vez aí? Carallo, vale."],
                        selection:["Vale, vale."],
                        critical:["Isto estase poñendo feo, xefe!"] },
      DESCONFIADO:    { briefing:["Vas en serio con este plan?"],
                        selection:["A ver."],
                        critical:["Apoio, carallo! Que me dan!"] },
      AUTOPRESERVACION:{briefing:["Que che dean. En serio."],
                        refusing_briefing:["Despois da última vez, hoxe non saio. Que vaia a túa puta nai."],
                        critical:["Fillo de puta, deixáchesme morrer outra vez!","..."] },
    },
    IRONICO: {
      LEAL:           { briefing:["Imos facer o numeriño outra vez.","Manda, xefe. Hoxe estou fino."],
                        selection:["A ver con que me saes."],
                        critical:["Isto complícase, carallo."] },
      SARCASTICO:     { briefing:["Magnífico. Plan de merda e eu o primeiro. Coma sempre.","Outra obra mestra, non?"],
                        selection:["Vale, dispara. Ironía á parte."],
                        critical:["A hostia! Que sorpresa!","Carallo, carallo, carallo!"] },
      DESCONFIADO:    { briefing:["Se isto é coma a Op 4, dimito.","Isto pinta coma outras veces. Mal."],
                        selection:["Solta. A ver."],
                        critical:["Díxenche que non. DÍXENCHO."] },
      AUTOPRESERVACION:{briefing:["Hoxe mando eu. Ti observa."],
                        refusing_briefing:["Quedo na torreta. Que che dean."],
                        critical:["O teu plan, o teu problema. Eu ao meu.","..."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Listo.","Imos."],
                        selection:["Si."],
                        critical:["Resisto."] },
      SARCASTICO:     { briefing:["Carallo, outra."],
                        selection:["Adiante."],
                        critical:["Isto é feo."] },
      DESCONFIADO:    { briefing:["Estamos seguros disto?"],
                        selection:["Fala."],
                        critical:["Necesito apoio, carallo."] },
      AUTOPRESERVACION:{briefing:["Hoxe non."],
                        refusing_briefing:["Non me saias cun plan. Hoxe non.","Hoxe paso."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["Todo controlado? De verdade?"],
                        selection:["Aquí, carallo. Atento."],
                        critical:["Apoio, hostia, apoio!"] },
      SARCASTICO:     { briefing:["Espero que esta vez teñas un plan de verdade."],
                        selection:["Vale, carallo."],
                        critical:["Díxeno! Carallo, díxeno!"] },
      DESCONFIADO:    { briefing:["Non me cheira ben. Para nada."],
                        selection:["Seguro, xefe?"],
                        critical:["Vou palmar! Sácame de aquí!"] },
      AUTOPRESERVACION:{briefing:["Non! Hostia, non!"],
                        refusing_briefing:["Négome! Me cago en todo, négome!"],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Vale. Isto podería mesmo saír ben."],
                        selection:["Escóitote."],
                        critical:["Era cuestión de tempo."] },
      SARCASTICO:     { briefing:["Xa fixemos isto. Sabemos como acaba, carallo."],
                        selection:["Dime."],
                        critical:["Mira ti que sorpresa."] },
      DESCONFIADO:    { briefing:["O teu plan ten unha pinta de merda. Coma sempre."],
                        selection:["Se insistes."],
                        critical:["Díxencho, carallo. Díxencho."] },
      AUTOPRESERVACION:{briefing:["Vin dabondo."],
                        refusing_briefing:["Hoxe non me moves. Que vaia a túa puta nai."],
                        selection:["..."] },
    },
  },
  ENGINEER: {
    IRONICO: {
      LEAL:           { briefing:["Interesante decisión. Funcionará.","Procedo. Con boas expectativas, esta vez."],
                        selection:["Diga.","Si."],
                        critical:["Isto sáese da marxe prevista."] },
      SARCASTICO:     { briefing:["Comprendo o teu plan. En parte.","Outra incursión. Ben."],
                        selection:["Adiante."],
                        critical:["Curioso lugar para morrer."] },
      DESCONFIADO:    { briefing:["Vou confiar, contra o meu mellor xuízo.","O teu plan presenta algunhas... peculiaridades."],
                        selection:["Se insistes."],
                        critical:["Isto era previsible. Érao."] },
      AUTOPRESERVACION:{briefing:["Claro. Ti o decidiches. Procedo.","Comprendo que o teu plan ten unha lóxica que se me escapa."],
                        refusing_briefing:["Hoxe dedicareime a tarefas administrativas. O teu plan non me require.","Calculei as miñas probabilidades. Hoxe declino participar."],
                        selection:["..."],
                        critical:["Laméntoo por ti. Non por min."] },
    },
    ESTOICO: {
      LEAL:           { briefing:["Listo.","Imos."],
                        selection:["Si."],
                        critical:["Resisto."] },
      SARCASTICO:     { briefing:["Procedo."],
                        selection:["Adiante."],
                        critical:["Non é ideal."] },
      DESCONFIADO:    { briefing:["Adiante."],
                        selection:["Si."],
                        critical:["Baixo lume."] },
      AUTOPRESERVACION:{briefing:["Hoxe non."],
                        refusing_briefing:["Declino esta operación.","Hoxe permanezo na base."],
                        selection:["..."] },
    },
    CINICO: {
      LEAL:           { briefing:["Vale. Esta vez quizais non sexa catastrófico."],
                        selection:["Óiote."],
                        critical:["Era cuestión de tempo."] },
      SARCASTICO:     { briefing:["Esta op tampouco sairá segundo o previsto. Procedo.","Coñecido. Procedo."],
                        selection:["Adiante."],
                        critical:["Como esperaba."] },
      DESCONFIADO:    { briefing:["O teu plan ten unha lóxica que se me escapa, coma de costume."],
                        selection:["Se insistes."],
                        critical:["Previsible."] },
      AUTOPRESERVACION:{briefing:["Calculei e prefiro non participar."],
                        refusing_briefing:["Calculei as miñas probabilidades. Hoxe declino participar.","Os meus cálculos non avalan o teu plan. Permanezo na base."],
                        selection:["..."] },
    },
    LEAL: {
      LEAL:           { briefing:["Contigo sempre.","O que necesites."],
                        selection:["Aquí."],
                        critical:["Aguanto, non te preocupes."] },
      SARCASTICO:     { briefing:["Hoxe estou un pouco canso."],
                        selection:["Vale."],
                        critical:["Isto non é coma outras veces."] },
      DESCONFIADO:    { briefing:["Algo cambiou. Non sei que."],
                        selection:["Adiante."],
                        critical:["Necesito axuda."] },
      AUTOPRESERVACION:{briefing:["Xa non sei quen es."],
                        refusing_briefing:["Hoxe non podo. En serio."],
                        selection:["..."] },
    },
    NERVIOSO: {
      LEAL:           { briefing:["Todo baixo control? Confío en ti."],
                        selection:["Si, aquí."],
                        critical:["Necesito apoio, por favor!"] },
      SARCASTICO:     { briefing:["Espero que esta vez sexa distinto."],
                        selection:["Vale."],
                        critical:["Díxeno, díxeno!"] },
      DESCONFIADO:    { briefing:["Isto cheira mal. Sábelo, verdade?"],
                        selection:["Estás seguro?"],
                        critical:["Vou morrer aquí!"] },
      AUTOPRESERVACION:{briefing:["Non podo máis."],
                        refusing_briefing:["Os meus cálculos din que non. Permanezo na base."],
                        selection:["..."] },
    },
  },
  /* SNIPER — mide, agarda e fala pouco. Cando fala, é para dar un
     dato: distancia, vento, obxectivo. A súa maneira de dicir que
     está mal é deixar de dar datos. */
  SNIPER: {
    LEAL: {
        LEAL: {
            briefing: ["Posición asignada. Estarei arriba antes ca vós.", "Dádeme altura e non preciso máis nada."],
            selection: ["Aquí arriba.", "Escóitote."],
            critical: ["Sigo co pulso firme. É o único que fai falla."]
        },
        SARCASTICO: {
            briefing: ["Outro outeiro. Que novidade.", "Tranquilo, xa me busco eu o sitio."],
            selection: ["Rápido, que teño o ollo posto."],
            critical: ["Atopáronme. Era cuestión de tempo."]
        },
        DESCONFIADO: {
            briefing: ["Esta vez tampouco me ides dicir quen é o obxectivo?"],
            selection: ["Que."],
            critical: ["Estou só aquí arriba. Coma sempre."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoxe non subo."],
            refusing_briefing: ["Desde arriba vese todo, comandante. Tamén o que lles fai aos seus.", "Fixen a conta dos que subiron comigo. Non sae."],
            selection: ["..."]
        }
    },
    NERVIOSO: {
        LEAL: {
            briefing: ["Xa medín o vento tres veces. Catro. Vale. Listo.", "Póñome arriba e non me movo. Non me movo, non?"],
            selection: ["Si. Si, dime.", "Estou. Estou aquí."],
            critical: ["Déronme e non vin de onde. Non vin de onde."]
        },
        SARCASTICO: {
            briefing: ["Distancia, vento, obxectivo descoñecido. Perfecto.", "Xenial. Outra vez ás cegas."],
            selection: ["Agora que pasa?"],
            critical: ["Sabía que isto ía acabar así."]
        },
        DESCONFIADO: {
            briefing: ["Cantos dos que subiron comigo baixaron?"],
            selection: ["Non me fagas contar."],
            critical: ["Que alguén mire para aquí. Que alguén mire."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoxe non distingo o vento do pulso."],
            refusing_briefing: ["Non subo. Non subo. Non mo pidas outra vez.", "Conto os que faltan e quedo sen dedos."],
            selection: ["..."]
        }
    },
    IRONICO: {
        LEAL: {
            briefing: ["Mil douscentos metros. Un paseo.", "Dádeme unha pedra alta e fágovos o traballo de tres."],
            selection: ["Desde aquí tamén se ve o teu erro, por certo.", "Ao aparello."],
            critical: ["Estiven peor. Non moito, pero estiven."]
        },
        SARCASTICO: {
            briefing: ["Obxectivo descoñecido. Estupendo. Disparo ao que se mova e xa o identificades vós.", "Outra vez o mesmo outeiro. Vóulle poñer nome."],
            selection: ["Sorpréndeme."],
            critical: ["Ben. Polo menos acertaron á primeira."]
        },
        DESCONFIADO: {
            briefing: ["Sabes o que se ve de marabilla desde arriba? Todo."],
            selection: ["Fala, que estou ocupado mirando."],
            critical: ["E non vén ninguén. Que raro."]
        },
        AUTOPRESERVACION: {
            briefing: ["Quedo aquí. A vista é boa."],
            refusing_briefing: ["Fixen os cálculos. Non saen.", "Sobe ti, que tes tan boa puntería para mandar."],
            selection: ["..."]
        }
    },
    ESTOICO: {
        LEAL: {
            briefing: ["Arriba. Sen ruído.", "Cando esteades en posición, eu xa estarei."],
            selection: ["Listo."],
            critical: ["Funciono."]
        },
        SARCASTICO: {
            briefing: ["Outra."],
            selection: ["Aquí."],
            critical: ["Aguanto."]
        },
        DESCONFIADO: {
            briefing: ["Obxectivo descoñecido. Outra vez."],
            selection: ["Fala."],
            critical: ["Xa."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoxe non."],
            refusing_briefing: ["Subín demasiadas veces."],
            selection: ["..."]
        }
    },
    CINICO: {
        LEAL: {
            briefing: ["Tédesme para contar metros e apertar. Cóntoos e aperto."],
            selection: ["Distancia e obxectivo. O demais sóbrame."],
            critical: ["Acabouse o cálculo."]
        },
        SARCASTICO: {
            briefing: ["Obxectivo descoñecido. Encántame esa parte do informe.", "Outro outeiro, outro número, outro nome que non vai ler ninguén."],
            selection: ["E hoxe a quen non imos identificar?"],
            critical: ["Polo menos eu si sei quen me deu."]
        },
        DESCONFIADO: {
            briefing: ["Desde arriba vin quen recolle os caídos. Non erades vós."],
            selection: ["Dío e listo."],
            critical: ["Apuntádeo no rexistro e a outra cousa."]
        },
        AUTOPRESERVACION: {
            briefing: ["Xa contei abondo."],
            refusing_briefing: ["Mil douscentos setenta e seis metros. Esa é a distancia á que me dá igual.", "Que suba outro. Números hai moitos."],
            selection: ["..."]
        }
    }
  },
  /* BOMBARDERO — ruidoso, cariñoso coas súas bombas e cómodo
     diante. A súa maneira de dicir que está mal é deixar de
     querer cargar. */
  BOMBARDERO: {
    LEAL: {
        LEAL: {
            briefing: ["Cargado e contento! Onde o poño?", "Traio das grandes. Das que se oen desde a base."],
            selection: ["Aquí!", "Dime onde."],
            critical: ["Quédame pólvora. Iso é o importante."]
        },
        SARCASTICO: {
            briefing: ["Máis pólvora, menos problemas. Iso dicía o cartel, non?", "Outra vez a abrir portas ao bruto."],
            selection: ["Que rebento?"],
            critical: ["Déronme a min antes ca á carga. Mala sorte."]
        },
        DESCONFIADO: {
            briefing: ["E se esta vez me avisades antes de que estoupe algo preto?"],
            selection: ["Fala."],
            critical: ["Non vén ninguén, non?"]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoxe non cargo nada."],
            refusing_briefing: ["Fabricar, cargar, estoupar, repetir. Saltei o repetir.", "Que as leve outro."],
            selection: ["..."]
        }
    },
    NERVIOSO: {
        LEAL: {
            briefing: ["Revisáinas dúas veces. Tres. Están ben. Están ben.", "Non me fagades correr con isto enriba."],
            selection: ["Si! Dime.", "Vou, vou."],
            critical: ["Coidado co que levo enriba! Coidado!"]
        },
        SARCASTICO: {
            briefing: ["Xenial, outra vez o primeiro na porta.", "Claro. Que vaia o que leva os explosivos."],
            selection: ["Agora?"],
            critical: ["Xa che dixen que isto ía pasar."]
        },
        DESCONFIADO: {
            briefing: ["Cantos dos meus volveron enteiros? Dimo ti."],
            selection: ["Non me berres."],
            critical: ["Estase a quentar. Estase a quentar moito."]
        },
        AUTOPRESERVACION: {
            briefing: ["Non con isto enriba."],
            refusing_briefing: ["Levo corenta quilos de razóns para quedar.", "Non. Hoxe non. Hoxe non."],
            selection: ["..."]
        }
    },
    IRONICO: {
        LEAL: {
            briefing: ["Traio alegría explosiva. Literalmente, pono na caixa.", "Dicídeme onde e fágovos unha porta nova."],
            selection: ["Ás túas ordes, con estrondo.", "Dime."],
            critical: ["Estou feito un cadro. Un abstracto."]
        },
        SARCASTICO: {
            briefing: ["O plan do día: fabricar, cargar, estoupar, repetir. Que vida tan variada.", "Outra porta. Vou botar de menos as chaves."],
            selection: ["A quen lle abro?"],
            critical: ["Ben. Polo menos fixen ruído."]
        },
        DESCONFIADO: {
            briefing: ["Curioso que sempre vaia diante o que leva a pólvora."],
            selection: ["Ti dirás."],
            critical: ["Ninguén corre para aquí. Que sorpresa."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoxe quedo apagado."],
            refusing_briefing: ["Máis pólvora, menos problemas. Cero pólvora, cero problemas.", "Estoupar é doado. Repetir é o difícil."],
            selection: ["..."]
        }
    },
    ESTOICO: {
        LEAL: {
            briefing: ["Cargado.", "Onde digas."],
            selection: ["Aquí."],
            critical: ["Aguanto."]
        },
        SARCASTICO: {
            briefing: ["Outra porta."],
            selection: ["Dime."],
            critical: ["Xa."]
        },
        DESCONFIADO: {
            briefing: ["Diante outra vez."],
            selection: ["Fala."],
            critical: ["Non vén ninguén."]
        },
        AUTOPRESERVACION: {
            briefing: ["Hoxe non."],
            refusing_briefing: ["Carguei abondo."],
            selection: ["..."]
        }
    },
    CINICO: {
        LEAL: {
            briefing: ["Fixéronme para abrir buratos. Ábroos."],
            selection: ["Sinala e vou."],
            critical: ["Acabouse a mecha."]
        },
        SARCASTICO: {
            briefing: ["Fabricar, cargar, estoupar, repetir. O de repetir puxérono por optimismo.", "Outra vez de chave mestra."],
            selection: ["Que estorba hoxe?"],
            critical: ["Polo menos levo o sitio por diante."]
        },
        DESCONFIADO: {
            briefing: ["Nunca preguntades que hai do outro lado do que abro."],
            selection: ["Dío."],
            critical: ["Apuntádeo e seguide."]
        },
        AUTOPRESERVACION: {
            briefing: ["Xa abrín abondas."],
            refusing_briefing: ["A caixa pon ALEGRÍA EXPLOSIVA. Alguén ten moito sentido do humor.", "Que a leve o que o escribiu."],
            selection: ["..."]
        }
    }
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

/* (v0.44) FRASES_END_OP en GALEGO — mesma estrutura, voz propia */
const FRASES_END_OP_GL = {
  BOMBARDERO: {
    LEAL: { end_op_alive:["Todo o que apuntei, caeu.","Demolición completada, xefe."], end_op_critical:["Case voo eu tamén."],
            saved:["Grazas. Estas mans valen cartos."], near_death_aliado:["{name}! Carallo, estaba ao meu lado!"] },
    SARCASTICO: { end_op_alive:["Outro día facendo buratos."], end_op_critical:["Estoupou todo menos eu. Por pouco."],
            saved:["Xusto antes do bum. Aprecio o detalle."], near_death_aliado:["{name} voou. E non polas miñas bombas."] },
    DESCONFIADO: { end_op_alive:["Volvín. Coa mochila medio baleira."], end_op_critical:["Mandáchesme moi adiante. Outra vez."],
            saved:["Vale. Unha que che debo."], near_death_aliado:["{name}! Díxenche que isto pasaría!"] },
    AUTOPRESERVACION: { end_op_alive:["As miñas bombas traballaron. Eu, o xusto."], end_op_critical:["..."],
            saved:["..."], near_death_aliado:["..."] },
  },
  SNIPER: {
    LEAL: { end_op_alive:["Obxectivos neutralizados.","Limpo."], end_op_critical:["Víronme. Non volverá pasar."],
            saved:["...grazas. Non adoito necesitalo."], near_death_aliado:["{name}. Vino caer. Non puiden tirar a tempo."] },
    SARCASTICO: { end_op_alive:["Outra xornada de mirar pola mira."], end_op_critical:["Case me cazan a min. Irónico."],
            saved:["Curioso. Normalmente son eu quen decide quen vive."], near_death_aliado:["{name} caído. Anotado."] },
    DESCONFIADO: { end_op_alive:["Sobrevivín. Só, coma sempre."], end_op_critical:["Deixáchesme sen cobertura. Outra vez."],
            saved:["Non o esperaba. De ti."], near_death_aliado:["{name}. Desde onde estaba, non cheguei."] },
    AUTOPRESERVACION: { end_op_alive:["Vivo. Non grazas ás túas posicións."], end_op_critical:["..."],
            saved:["..."], near_death_aliado:["..."] },
  },
  GRUNT: {
    LEAL: {
      end_op_alive:   ["Outra completada, xefe.", "Aquí seguimos.", "Como debe ser.", "Sigo en pé, xefe."],
      end_op_critical:["Por un pelo, xefe.", "Case quedo alí.", "Por pouco non a conto."],
      saved:          ["Grazas, xefe. De verdade.", "Salváchesme o pelexo.", "Aquí sigo grazas a esa."],
      near_death_aliado:["Compa! Non!", "A hostia, caeu {name}!", "{name}! Carallo, non!"],
    },
    SARCASTICO: {
      end_op_alive:   ["Unha máis. E sigo respirando, non sei como.", "Sobrevivín. Outra vez.", "Outra ao saco."],
      end_op_critical:["Case deixo o pelexo. Outra vez.", "Eu dixen que algo pasaría.", "Mira ti, case me toca."],
      saved:          ["Xusto a tempo. Coma sempre.", "Unha máis para a túa conta."],
      near_death_aliado:["Adeus, compa. Vía­o vir.", "Outro menos. Que sorpresa."],
    },
    DESCONFIADO: {
      end_op_alive:   ["Saín. Esta vez.", "Sigo aquí. Non sei por canto."],
      end_op_critical:["Por un pelo! E ti segues cos teus plans?", "Case non a conto. Váleche?"],
      saved:          ["...grazas. Esta vez.", "Tarde, pero grazas."],
      near_death_aliado:["{name}! Díxeno, carallo, díxeno!", "E van varios. VARIOS!"],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["Vivo. A pesar de ti, non grazas a ti.", "Esta vez si. A próxima négome."],
      end_op_critical:["Nunca máis, xefe. NUNCA MÁIS.", "Case me cargas. Tomo nota."],
      saved:          ["Déboche unha. Pero xa estamos en paz, por todas as anteriores.", "..."],
      near_death_aliado:["...", "Outro ao montón. Eu serei o próximo."],
    },
  },
  HEAVY: {
    LEAL: {
      end_op_alive:   ["Outra ao saco, xefe.", "Sen novidade. Coma sempre.", "Aquí estou."],
      end_op_critical:["Esta foi dura. Pero aquí estou.", "Carallo, que fea. Pero aguantei."],
      saved:          ["Grazas, xefe. Déboche unha.", "Carallo, xusto a tempo."],
      near_death_aliado:["{name}! CARALLO!", "Non, hostia, NON!", "{name}, aguanta!"],
    },
    SARCASTICO: {
      end_op_alive:   ["Sobrevivín. De que te sorprendes?", "Misión cumprida, supoño.", "Outra hostia máis."],
      end_op_critical:["Carallo coa op. Case non a conto.", "Débesme unha. E van varias.", "Mira, sigo respirando. Ti verás."],
      saved:          ["Chegas tarde. Pero grazas, supoño."],
      near_death_aliado:["{name}! Carallo, outro!", "A hostia. Caeu {name}."],
    },
    DESCONFIADO: {
      end_op_alive:   ["Vivo. Non polo teu mérito.", "Sigo aquí. Mañá xa veremos."],
      end_op_critical:["Díxencho, hostia! Díxencho!", "Por un pelo. Outra vez."],
      saved:          ["...vale. Grazas.", "Xusto a tempo, carallo."],
      near_death_aliado:["Díxencho! {name} caeu pola túa culpa!", "Carallo, carallo, CARALLO!"],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["Sáesme debendo unha. E van varias.", "Vivo. A vergoña é túa."],
      end_op_critical:["Outra vez por un pelo. Váleche xa?", "Que che dean. A próxima non saio."],
      saved:          ["Tarde. Coma sempre.", "..."],
      near_death_aliado:["Outro ao burato. Que che dean.", "..."],
    },
  },
  ENGINEER: {
    LEAL: {
      end_op_alive:   ["Operación concluída.", "Eficiente, contra todo prognóstico."],
      end_op_critical:["Isto saíuse da marxe prevista.", "Danos considerables. Aguantei."],
      saved:          ["Agradecido. Sinceramente.", "Chegaches xusto. Aprécioo."],
      near_death_aliado:["{name}... síntoo.", "Falleille a {name}."],
    },
    SARCASTICO: {
      end_op_alive:   ["Concluída. O teu plan aproxímase ao éxito.", "Vivo. Por estatística, non por planificación."],
      end_op_critical:["Danos por riba do estimado. Coma sempre.", "Era o esperable. Sobrevivín por pouco."],
      saved:          ["Eficiente. Sorprendente.", "Apuntado. Déboche unha."],
      near_death_aliado:["{name} caído. Era cuestión de tempo.", "Perda prevista. Pero perda."],
    },
    DESCONFIADO: {
      end_op_alive:   ["Sobrevivín. Malia as decisións tomadas."],
      end_op_critical:["Era previsible. Érao."],
      saved:          ["Curioso. Non esperaba axuda."],
      near_death_aliado:["Era cuestión de tempo, {name}.", "Predicible. Triste, pero predicible."],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["Sobrevivín. Mañá revisarei o meu contrato.", "Vivo. Tomarei nota no teu expediente."],
      end_op_critical:["Débesme unha explicación. E un café.", "Lamento a operación. Non o resultado."],
      saved:          ["Procedo a recalcular as miñas probabilidades.", "..."],
      near_death_aliado:["{name} foi sacrificado. Tomo nota.", "..."],
    },
  },
};

/* (v0.44) FRASES_END_OP en INGLÉS — voz por clase: grunt chan, heavy rudo,
   engineer clínico, sniper lacónico, bombardero fachendoso */
const FRASES_END_OP_EN = {
  BOMBARDERO: {
    LEAL: { end_op_alive:["Everything I aimed at came down.","Demolition complete, chief."], end_op_critical:["Nearly blew up with it."],
            saved:["Thanks. These hands are worth money."], near_death_aliado:["{name}! Damn it, they were right next to me!"] },
    SARCASTICO: { end_op_alive:["Another day making holes."], end_op_critical:["Everything blew up but me. Barely."],
            saved:["Right before the boom. I appreciate the detail."], near_death_aliado:["{name} went up. And not from my bombs."] },
    DESCONFIADO: { end_op_alive:["I came back. Pack half empty."], end_op_critical:["You sent me too far forward. Again."],
            saved:["Fine. I owe you one."], near_death_aliado:["{name}! I told you this would happen!"] },
    AUTOPRESERVACION: { end_op_alive:["My bombs did the work. Me, the bare minimum."], end_op_critical:["..."],
            saved:["..."], near_death_aliado:["..."] },
  },
  SNIPER: {
    LEAL: { end_op_alive:["Targets neutralized.","Clean."], end_op_critical:["They saw me. Won't happen again."],
            saved:["...thanks. I don't usually need it."], near_death_aliado:["{name}. I watched them fall. Couldn't take the shot in time."] },
    SARCASTICO: { end_op_alive:["Another day of staring down a scope."], end_op_critical:["Almost got hunted myself. Ironic."],
            saved:["Curious. Usually I'm the one who decides who lives."], near_death_aliado:["{name} down. Noted."] },
    DESCONFIADO: { end_op_alive:["I survived. Alone, as always."], end_op_critical:["You left me without cover. Again."],
            saved:["Didn't expect that. From you."], near_death_aliado:["{name}. From where I was, I couldn't reach."] },
    AUTOPRESERVACION: { end_op_alive:["Alive. No thanks to your positioning."], end_op_critical:["..."],
            saved:["..."], near_death_aliado:["..."] },
  },
  GRUNT: {
    LEAL: {
      end_op_alive:   ["Another one done, chief.", "Still here.", "As it should be.", "Still standing, chief."],
      end_op_critical:["By a hair, chief.", "Almost stayed out there.", "Barely made it back."],
      saved:          ["Thanks, chief. Really.", "You saved my hide.", "Still here thanks to that one."],
      near_death_aliado:["Buddy! No!", "Hell, {name} is down!", "{name}! Damn it, no!"],
    },
    SARCASTICO: {
      end_op_alive:   ["One more. And still breathing, don't ask me how.", "Survived. Again.", "Another one for the pile."],
      end_op_critical:["Almost left my hide out there. Again.", "I said something would happen.", "Look at that, almost my turn."],
      saved:          ["Just in time. As always.", "One more for your tab."],
      near_death_aliado:["Bye, buddy. Saw it coming.", "One less. What a surprise."],
    },
    DESCONFIADO: {
      end_op_alive:   ["I made it out. This time.", "Still here. Don't know for how long."],
      end_op_critical:["By a hair! And you're still running your plans?", "Barely made it. Good enough for you?"],
      saved:          ["...thanks. This time.", "Late, but thanks."],
      near_death_aliado:["{name}! I said it, damn it, I said it!", "That's several now. SEVERAL!"],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["Alive. In spite of you, not because of you.", "This time, yes. Next time I refuse."],
      end_op_critical:["Never again, chief. NEVER AGAIN.", "You almost got me killed. Noted."],
      saved:          ["I owe you one. But we're even, for all the other times.", "..."],
      near_death_aliado:["...", "Another one for the heap. I'll be next."],
    },
  },
  HEAVY: {
    LEAL: {
      end_op_alive:   ["Another one in the bag, chief.", "Nothing to report. As always.", "Here I am."],
      end_op_critical:["That was a rough one. But here I am.", "Damn, that was ugly. But I held."],
      saved:          ["Thanks, chief. I owe you one.", "Damn, just in time."],
      near_death_aliado:["{name}! DAMN IT!", "No, hell, NO!", "{name}, hold on!"],
    },
    SARCASTICO: {
      end_op_alive:   ["I survived. Why so surprised?", "Mission accomplished, I guess.", "Another beating taken."],
      end_op_critical:["Hell of an op. Barely made it.", "You owe me one. That's several now.", "Look, still breathing. Your call."],
      saved:          ["You're late. But thanks, I guess."],
      near_death_aliado:["{name}! Damn, another one!", "Hell. {name} is down."],
    },
    DESCONFIADO: {
      end_op_alive:   ["Alive. Not thanks to you.", "Still here. Tomorrow, we'll see."],
      end_op_critical:["I told you, damn it! I told you!", "By a hair. Again."],
      saved:          ["...fine. Thanks.", "Just in time, damn it."],
      near_death_aliado:["I told you! {name} fell because of you!", "Damn, damn, DAMN!"],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["You owe me one. That's several now.", "Alive. The shame is yours."],
      end_op_critical:["By a hair again. Had enough yet?", "Screw it. Next time I'm not going out."],
      saved:          ["Late. As always.", "..."],
      near_death_aliado:["Another one in the hole. Screw you.", "..."],
    },
  },
  ENGINEER: {
    LEAL: {
      end_op_alive:   ["Operation concluded.", "Efficient, against all odds."],
      end_op_critical:["This exceeded the projected margin.", "Considerable damage. I held."],
      saved:          ["Grateful. Sincerely.", "You arrived just in time. I appreciate it."],
      near_death_aliado:["{name}... I'm sorry.", "I failed {name}."],
    },
    SARCASTICO: {
      end_op_alive:   ["Concluded. Your plan is approaching success.", "Alive. By statistics, not by planning."],
      end_op_critical:["Damage above estimate. As always.", "It was to be expected. I barely survived."],
      saved:          ["Efficient. Surprising.", "Noted. I owe you one."],
      near_death_aliado:["{name} down. It was a matter of time.", "A projected loss. But a loss."],
    },
    DESCONFIADO: {
      end_op_alive:   ["I survived. Despite the decisions made."],
      end_op_critical:["It was predictable. It was."],
      saved:          ["Curious. I wasn't expecting help."],
      near_death_aliado:["It was a matter of time, {name}.", "Predictable. Sad, but predictable."],
    },
    AUTOPRESERVACION: {
      end_op_alive:   ["I survived. Tomorrow I review my contract.", "Alive. Adding a note to your file."],
      end_op_critical:["You owe me an explanation. And a coffee.", "I regret the operation. Not the outcome."],
      saved:          ["Proceeding to recalculate my odds.", "..."],
      near_death_aliado:["{name} was sacrificed. Noted.", "..."],
    },
  },
};

/* (v0.44) Táboa END_OP segundo o idioma activo, con fallback á castelá */
function endOpTable(){
  if(I18N.lang === 'gl' && typeof FRASES_END_OP_GL !== 'undefined') return FRASES_END_OP_GL;
  if(I18N.lang === 'en' && typeof FRASES_END_OP_EN !== 'undefined') return FRASES_END_OP_EN;
  return FRASES_END_OP;
}

/* Pickea unha frase do pool con fallback se a combinación non existe */
function pickFrase(u, contexto, opts){
  if(!u || u.team !== PT) return null;
  const cls = u.cls;
  const pers = u.personalidad;
  const est = estadoConfianza(u);
  let result = null;
  /* (v0.44 F3c) táboa por idioma con fallback á castelá */
  const _FR = (I18N.lang === 'en' && typeof FRASES_EN !== 'undefined') ? FRASES_EN
            : (I18N.lang === 'gl' && typeof FRASES_GL !== 'undefined') ? FRASES_GL
            : FRASES;
  /* As cinco clases teñen a súa propia voz. Houbo un tempo en que só a
     tiñan tres —SNIPER e BOMBARDERO saían dicindo «...» no briefing, e o
     fallback tapábao— e chegouse a poñer un préstamo de voz entre clases
     como apaño. Xa non fai falla: escribíronselles as súas. Se algún día
     se engade unha clase sen frases, a proba de test/briefing.test.js
     salta antes de que ninguén xogue con ela. */
  const cls_table = _FR[cls] || FRASES[cls];
  if(cls_table){
    const pers_table = cls_table[pers];
    if(pers_table){
      const est_table = pers_table[est];
      if(est_table){
        const arr = est_table[contexto];
        if(arr && arr.length > 0){
          result = arr[Math.floor(rnd() * arr.length)];
        }
      }
    }
  }
  /* Fallback xenérico para end_op_*, saved, near_death_aliado: por clase × estado */
  const _EO = endOpTable();
  if(!result && _EO[cls] && _EO[cls][est]){
    const arr = _EO[cls][est][contexto];
    if(arr && arr.length > 0){
      result = arr[Math.floor(rnd() * arr.length)];
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
  return glNorm(result);
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
    radio(TXT('r.necesitasEng'), '#ff8');
  } else if((DATA.chatarra||0) < WALL_BUILD.cost){
    radio(TXT('r.senChatarraMuro', {c: WALL_BUILD.cost}), '#ff8');
  } else {
    game.wallPlacing = eng.id;
    radio(TXT('r.muroClic', {c: WALL_BUILD.cost, n: eng.name}), '#c8a86a');
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
    radio(TXT('r.torretaDesplegada', {n: pilot.name}), '#7fdc7f', {x, y});
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

