/* ============================================================
   FIN DE BATALLA → DEBRIEF → PERSISTENCIA
   ============================================================ */
async function endBattle(g){
  /* (v0.60) o Mundial ten o seu propio peche: non toca DATA nin o debrief */
  if(g.modo === 'mundial' && typeof mundialFinPartido === 'function') return mundialFinPartido(g);
  /* (v0.64) o arquiveiro pecha o capítulo se hai snapshot pendente */
  try{ if(typeof diarioPecharBatalla === 'function') diarioPecharBatalla(g); }catch(e){}
  /* (v0.63) voz de mando ao pechar operación de campaña */
  try{ if(typeof vozMando === 'function') vozMando(g.result === 'victory' ? 'op.vitoria' : 'op.derrota'); }catch(e){}
  stopMusic();
  if(g.finished) return; g.finished=true;
  if(g.modo === 'pvp' && window._pvp){
    const _rolFin = window._pvp.rol, _salaFin = window._pvp.sala, _netFin = window._pvp.net;
    if(_rolFin === 'host') pvpPublicarFin(g);   /* (v0.31) informe ao rival */
    setTimeout(pvpDesmontarBatalla, 2000);   /* (v0.39) morre a batalla; a SERIE segue */
    if(_rolFin === 'host'){
      /* (v0.39) o host abre a ENTREBATALLAS: sala limpa, rolda+1, listo/deploy a cero */
      const _n2 = (window._pvpN || 1) + 1;
      setTimeout(() => {
        if(!_lobby || _lobby.sala !== _salaFin) return;   /* saíu da serie */
        _netFin.update(`salas/${_salaFin}`, {estado: 'entrebatallas', n: _n2, mapa: null,
          snap: null, orden: null, fin: null,
          'host/listo': false, 'guest/listo': false,
          'host/deploy': null, 'guest/deploy': null}).catch(()=>{});
      }, 5000);
    }
  }
  game=null;
  DATA.opCount++;
  try{ if(typeof diarioFinActo === 'function') diarioFinActo(); }catch(e){}   /* (v0.65) */
  /* (v0.12) ECONOMÍA: bonus do HQ na vitoria + acreditar o recollido */
  if(g.result === 'victory'){
    g.chatarraGanada = (g.chatarraGanada||0) + CHATARRA_VALUES.HQ;
  }
  DATA.chatarra = (DATA.chatarra||0) + (g.chatarraGanada||0);
  /* (v0.19 R2) Pezas recuperadas dos portadores: só se acreditan con vitoria */
  if(g.result === 'victory' && g.pezasRecuperadas && g.pezasRecuperadas.length){
    for(const pid of g.pezasRecuperadas){
      const ix = (DATA.piezasEnemigas||[]).findIndex(p => p.id === pid);
      if(ix >= 0){
        const p = DATA.piezasEnemigas.splice(ix, 1)[0];
        DATA.piezas = (DATA.piezas||[]).concat([p]);
      }
    }
  }
  /* (v0.15.1) O botín pérdese se a batalla se perde */
  if(g.result === 'victory' && g.lootGanado && g.lootGanado.length){
    DATA.lootInventory = (DATA.lootInventory||[]).concat(g.lootGanado);
  } else if(g.result !== 'victory'){
    g.lootGanado = [];
  }
  const lines=[];
  const survivors = g.units.filter(u=>u.team===PT && !u.dead);
  /* Restos: recuperados (secured y no expirados) → reconstruidos */
  const recovered = g.remains.filter(r => r.secured && !r.expired);
  const lostRemains = g.remains.filter(r => !r.secured || r.expired);

  /* (v0.24.1) VOLT: roster inimigo — os seus supervivientes con sangue ascenden */
  if(g.modo !== 'pvp'){
    DATA.voltRoster = DATA.voltRoster || [];
    const seus = g.units.filter(u => u.team === ET && !u.dead);
    for(const u of seus){
      if(u._voltVet){
        u._voltVet.ops++; u._voltVet.kills += (u.kills || 0);
      } else if((u.kills || 0) >= 2 && DATA.voltRoster.length < 5){
        const usados = new Set(DATA.voltRoster.map(v => v.name));
        const nome = VOLT_NOMES.find(n => !usados.has(n));
        if(nome){
          DATA.voltRoster.push({id: 'V' + Date.now() + Math.floor(Math.random()*99), name: nome, cls: u.cls, ops: 1, kills: u.kills});
          lines.push(`<div class="small" style="color:#ff7a5a;">⚠ Intelixencia: VOLT ascendeu a un veterano — <b>${nome}</b> (${u.cls}, ${u.kills} baixas nesta op). Apunta o nome.</div>`);
        }
      }
    }
    /* despedida de VOLT segundo o resultado */
    if(DATA.opCount >= 2){
      const vl = g.result === 'victory' ? (VOLT_LINES_ML[I18N.lang] || VOLT_LINES_ML.es).derrotado : (VOLT_LINES_ML[I18N.lang] || VOLT_LINES_ML.es).vencedor;
      lines.push(`<div style="margin:8px 0; font-style:italic; color:#ff7a5a;">VOLT: «${vl[Math.floor(Math.random()*vl.length)]}»</div>`);
    }
  }
  /* (v0.21 R2) VÍNCULOS: ops compartidas entre supervivientes */
  {
    const recsVivos = survivors.map(u => DATA.units.find(rr => rr.id === u.id)).filter(Boolean);
    for(let i = 0; i < recsVivos.length; i++){
      for(let j = i + 1; j < recsVivos.length; j++){
        const a = recsVivos[i], b = recsVivos[j];
        a.compa = a.compa || {}; b.compa = b.compa || {};
        a.compa[b.id] = (a.compa[b.id] || 0) + 1;
        b.compa[a.id] = a.compa[b.id];
        if(a.compa[b.id] === VINCULO.OPS_CAMARADA){
          const okA = crearVinculo(a, b, 'CAMARADA');
          const okB = crearVinculo(b, a, 'CAMARADA');
          if(okA && okB){
            lines.push(`<div style="color:#ffd700; margin:6px 0;">★ ${TXT('db.vinculoNovo', {a: a.name, b: b.name, n: VINCULO.OPS_CAMARADA})}</div>`);
          }
        }
      }
    }
  }
  /* (v0.26) RIVALIDADES: dous matadores parellos acaban picados. Teatro puro, sen buffs. */
  {
    outer:
    for(let i = 0; i < survivors.length; i++){
      for(let j = i + 1; j < survivors.length; j++){
        const ua = survivors[i], ub = survivors[j];
        /* baixas DESTA batalla, das unidades vivas */
        if(!((ua.kills||0) >= 4 && (ub.kills||0) >= 4 && Math.abs(ua.kills - ub.kills) <= 2)) continue;
        const a = DATA.units.find(rr => rr.id === ua.id);
        const b = DATA.units.find(rr => rr.id === ub.id);
        if(!a || !b) continue;
        if(a.rival || b.rival) continue;
        if((a.vinculos||[]).some(v=>v.con===b.id)) continue;
        {
          a.rival = {con: b.id, conNome: b.name, op: DATA.opCount};
          b.rival = {con: a.id, conNome: a.name, op: DATA.opCount};
          lines.push(`<div style="color:#ff9a3c; margin:6px 0;">⚡ RIVALIDADE — <b>${a.name} vs ${b.name}</b>: ${ua.kills} contra ${ub.kills} baixas nesta op. Isto vai ser persoal.</div>`);
          break outer;
        }
      }
    }
  }
  /* (v0.17) CAMPAÑA: tracking de racha */
  if(g.result === 'victory'){
    DATA.campWins = (DATA.campWins||0) + 1;
    DATA.campStreak = Math.max(1, (DATA.campStreak||0) + 1);
  } else {
    DATA.campLosses = (DATA.campLosses||0) + 1;
    DATA.campStreak = Math.min(-1, (DATA.campStreak||0) - 1);
  }
  /* Comunicado POST de ÓPTIMA + reacción dunha unidade */
  {
    const fallenNames = lostRemains.map(r => r.unit.name);
    const com = pickComunicadoPost(g, fallenNames);
    lines.push(`<div style="border:1px solid #8a6200; padding:10px 14px; margin-bottom:12px; color:#e8c060;"><b style="color:#ffb000;">▣ ${TXT('br.comunicadoDe')}</b><br>${com}</div>`);
    const reactor = survivors.find(u => u.personalidad);
    if(reactor){
      const est = estadoConfianza(reactor);
      const _RC = REACCIONS_COMUNICADO_ML[I18N.lang] || REACCIONS_COMUNICADO_ML.es;
      const arr = _RC[est] || _RC.SARCASTICO;
      const rx = arr[Math.floor(Math.random()*arr.length)];
      if(rx !== '...'){
        const col = est === 'LEAL' ? '#7fdc7f' : est === 'SARCASTICO' ? '#cfe0ff' : est === 'DESCONFIADO' ? '#ffd24a' : '#ff5340';
        lines.push(`<div style="margin:-6px 0 14px 24px; font-style:italic; color:${col};">${reactor.name}: «${rx}»</div>`);
      }
    }
  }

  /* (v0.12.1) Δ negativos colectivos, aplicados ANTES de persistir:
     — Restos abandonados: -4 por resto perdido, a todos os supervivientes
       ("vimos como deixabas atrás aos compañeiros")
     — Derrota: -3 xeral (ademais do -10 aos que pasaron por crítico) */
  for(const u of survivors){
    if(lostRemains.length > 0){
      aplicarConfianza(u, -4 * lostRemains.length);
    }
    if(g.result === 'defeat'){
      aplicarConfianza(u, -8);
    }
  }

  /* SUPERVIVIENTES */
  for(const u of survivors){
    /* (v0.12.2) Δ confianza — pasiva de +6 SÓ na vitoria.
       Na derrota, sobrevivir non abona nada: o saldo debe ser negativo. */
    if(g.result === 'victory') aplicarConfianza(u, +6);
    /* — Recompensa por kills propios: +1 por kill (cap +5/op) */
    const killBonus = Math.min(5, u.kills || 0);
    if(killBonus > 0) aplicarConfianza(u, killBonus);
    /* — Vitoria contando coa unidade que estivo en perigo: +5 ("merecía a pena, sentín que importaba") */
    if(g.result === 'victory' && u.criticalThisOp){
      aplicarConfianza(u, +5);
    }
    /* — Sobrevivir crítico sen ser salvado: +4 ("aguantei eu só") */
    if(u.criticalThisOp && !u._savedFromCriticThisOp){
      aplicarConfianza(u, +4);
      /* Pero abandono se ademais terminou con HP baixo: -15 (foi -8) */
      if(u.hp / u.max < 0.5){
        aplicarConfianza(u, -15);
        u._betrayedThisOp = true;  /* (v0.12) memoria: abandono */
      }
    }
    /* — Derrota despois de pasar pola maquinaria: -10 ("morreron compañeiros, non valeu") */
    if(g.result === 'defeat' && u.criticalThisOp){
      aplicarConfianza(u, -12);
    }
    /* Cerrar evento DEFENDIO si seguía abierto */
    if(u.defendPlace){
      const dur = Math.round((g.t - u.defendStartT)/60);
      if(dur>=30) u.eventBuffer.push({op:DATA.opCount, type:'DEFENDIO', place:u.defendPlace, duration:dur});
    }
    let rec = DATA.units.find(r=>r.id===u.id);
    if(!rec){
      rec={id:u.id, name:u.name, cls:u.cls, ops:0, kills:0, traits:[], events:[], medals:[],
           crossings:0, recoveries:0, criticalSurvivals:0, captures:0};
      DATA.units.push(rec);
    }
    /* (v0.11) Gardar personalidade e confianza no rec persistente */
    rec.personalidad = u.personalidad;
    rec.confianza = Math.round(u.confianza);
    rec.equipment = [...(u.equipment||[])];
    /* (v0.15.1) DERROTA: o equipamento queda no campo. Recómprase ou volve roubarse. */
    if(g.result === 'defeat' && rec.equipment.length){
      g._equipLost = (g._equipLost||[]).concat(rec.equipment.map(e => `${EQUIPOS[e]?EQUIPOS[e].label:e} (${rec.name})`));
      rec.equipment = [];
    }
    /* (v0.15) SKILLS: merge da actividade da op + detectar subidas de nivel */
    rec.activity = rec.activity || {dist:0, shots:0, kills:0, dmgTaken:0, caps:0, veh:0};
    const lvlAntes = {};
    for(const id of Object.keys(SKILLS)) lvlAntes[id] = skillLevel(rec.activity, id);
    if(u.act){
      rec.activity.dist += Math.round(u.act.dist);
      rec.activity.shots += u.act.shots;
      rec.activity.kills += u.kills;
      rec.activity.dmgTaken += Math.round(u.act.dmgTaken);
      rec.activity.caps += u.act.caps;
      rec.activity.veh += u.act.veh;
    }
    u._lvlUps = [];
    for(const id of Object.keys(SKILLS)){
      const lv = skillLevel(rec.activity, id);
      if(lv > lvlAntes[id]){
        u._lvlUps.push({id, lv, bonus: SKILLS[id].bonus[lv-1], stat: SKILLS[id].stat});
      }
    }
    /* (v0.12) MEMORIA: gardar salvación, traizón, e aplicar perdón */
    if(u._savedFromCriticThisOp){
      rec.lastSave = {op: DATA.opCount, who: u._savedBy || 'un Engineer'};
    }
    if(u._betrayedThisOp){
      rec.lastBetrayal = {op: DATA.opCount};
    }
    /* Perdón: se a confianza recuperou por riba de 70, a ferida cura */
    if(rec.confianza >= 70 && rec.lastBetrayal){
      delete rec.lastBetrayal;
    }
    /* (v0.23) Equipo ÚNICO gañado en batalla (tecnoloxía roubada) persiste no rec */
    if(u.equipment){
      const unicos = u.equipment.filter(e => ['optica_termica','servo_alleo'].includes(e));
      if(unicos.length){
        rec.equipment = rec.equipment || [];
        for(const e of unicos) if(!rec.equipment.includes(e)) rec.equipment.push(e);
      }
    }
    /* (v0.23.1) ALCUME: os fitos poñen nome */
    {
      const novo = checkAlcume(rec);
      if(novo){
        lines.push(`<div style="color:#ffd700; margin:6px 0;">★ ${TXT('db.alcume', {n: rec.name, t: novo.texto, m: novo.motivo})}</div>`);
      }
    }
    /* (R3) RENACIDO: conta atrás e estabilización */
    if(rec.renacido){
      rec.renacido.opsLeft--;
      if(rec.renacido.opsLeft <= 0 || rec.confianza >= 55){
        delete rec.renacido;
        rec.confianza = Math.min(100, rec.confianza + 5);
        lines.push(`<div style="margin-left:24px; color:#7fdc7f;" class="small">⟲ ${rec.name} xa responde como ${rec.name}. Estabilizado.</div>`);
      }
    }
    rec.ops++;
    rec.kills += u.kills;
    rec.crossings = (rec.crossings||0) + u.crossingsThisOp;
    rec.captures = (rec.captures||0) + (u.capturesThisOp||0);
    /* Si entró en crítico y sobrevivió al final, suma 1 */
    if(u.criticalThisOp && u.hp>0) rec.criticalSurvivals = (rec.criticalSurvivals||0) + 1;
    /* Tracking del Engineer */
    if(u.eng){
      rec.totalRepairs = (rec.totalRepairs||0) + u.repairs;
      const recoveredIds = u.recoveredThisOp || [];
      rec.unitsRecovered = (rec.unitsRecovered||0) + recoveredIds.length;
      rec.recoveredFrom = rec.recoveredFrom || {};
      /* Por nombre (no ID) — los nombres pueden cambiar pero el vínculo narrativo es el nombre actual */
      (u.recoveredNamesThisOp || []).forEach(n => {
        rec.recoveredFrom[n] = (rec.recoveredFrom[n]||0) + 1;
      });
    }
    rec.events = [...(rec.events||[]), ...(u.eventBuffer||[])];   /* (v0.37) no fin PvP pode vir null */

    /* Rasgos */
    const newTraits=[];
    if(u.kills>=4 && !rec.traits.includes('LETAL')){rec.traits.push('LETAL'); newTraits.push('LETAL');}
    if(u.hp<u.max*0.25 && !rec.traits.includes('SUPERVIVIENTE')){rec.traits.push('SUPERVIVIENTE'); newTraits.push('SUPERVIVIENTE');}
    if(u.repairs>250 && !rec.traits.includes('PROTECTOR')){rec.traits.push('PROTECTOR'); newTraits.push('PROTECTOR');}
    if(rec.ops>=3 && !rec.traits.includes('VETERANO')){rec.traits.push('VETERANO'); newTraits.push('VETERANO');}
    /* Rasgos nuevos del Hito B */
    if(rec.crossings>=10 && !rec.traits.includes('EXPLORADOR')){rec.traits.push('EXPLORADOR'); newTraits.push('EXPLORADOR');}
    if(rec.captures>=5 && !rec.traits.includes('CONQUISTADOR')){rec.traits.push('CONQUISTADOR'); newTraits.push('CONQUISTADOR');}
    if(rec.criticalSurvivals>=3 && !rec.traits.includes('DURO_DE_MATAR')){rec.traits.push('DURO_DE_MATAR'); newTraits.push('DURO_DE_MATAR');}
    /* Rasgos específicos del Engineer */
    if(u.eng){
      const distinctRecovered = Object.keys(rec.recoveredFrom||{}).length;
      if(distinctRecovered>=3 && !rec.traits.includes('SALVADOR')){rec.traits.push('SALVADOR'); newTraits.push('SALVADOR');}
      if((rec.totalRepairs||0)>=1500 && !rec.traits.includes('REMENDON')){rec.traits.push('REMENDON'); newTraits.push('REMENDON');}
      /* ALMA_DEL_ESCUADRÓN: 5+ unidades reparadas por él siguen vivas en el roster */
      const livingProteges = Object.keys(rec.recoveredFrom||{}).filter(name =>
        DATA.units.some(r => r.name === name && r.id !== rec.id)
      ).length;
      if(livingProteges>=5 && !rec.traits.includes('ALMA_DEL_ESCUADRON')){
        rec.traits.push('ALMA_DEL_ESCUADRON'); newTraits.push('ALMA_DEL_ESCUADRON');
      }
    }

    /* Medallas */
    const ctx = {endIntegrity: u.hp/u.max};
    const newMedals = checkMedals(rec, ctx);

    let line = `<div class="ok">✔ ${TXT('deb.opLine', {id: rec.id, n: rec.name, ops: rec.ops, k: u.kills})}`;
    if(newTraits.length) line += TXT('deb.novoRasgo') + newTraits.map(t=>tagLabel(t)).join(', ');
    if(newMedals.length) line += ` <span class="gold">· ✪ ${newMedals.map(m=>medalLabel(m.id)).join(', ')}</span>`;
    line += '</div>';
    /* (v0.11) Frase de peche segundo HP final + personalidade + confianza */
    const hpRatio = u.hp / u.max;
    const ctxFrase = hpRatio < 0.4 ? 'end_op_critical' : 'end_op_alive';
    const frase = pickFrase(u, ctxFrase) || pickFrase(u, 'end_op_alive');
    if(frase && frase !== '...'){
      const est = estadoConfianza(u);
      const col = est === 'LEAL' ? '#7fdc7f'
                : est === 'SARCASTICO' ? '#cfe0ff'
                : est === 'DESCONFIADO' ? '#ffd24a'
                : '#ff5340';
      line += `<div style="margin-left:24px; margin-bottom:8px; font-style:italic; color:${col};">«${frase}»</div>`;
    }
    /* (v0.15) Subidas de skill — o corpo aprende do que fixo */
    if(u._lvlUps && u._lvlUps.length){
      for(const lu of u._lvlUps){
        const roman = ['','I','II','III'][lu.lv];
        line += `<div style="margin-left:24px; color:#9fd0ff;">${TXT('deb.skillUp', {sk: skillLabel(lu.id), r: roman, b: Math.round(lu.bonus*100), stat: statName(lu.stat)})}</div>`;
      }
    }
    lines.push(line);
  }

  /* RECUPERADOS de restos */
  for(const r of recovered){
    const u = r.unit;
    let rec = DATA.units.find(rr=>rr.id===u.id);
    if(!rec){
      rec={id:u.id, name:u.name, cls:u.cls, ops:0, kills:0, traits:[], events:[], medals:[],
           crossings:0, recoveries:0, criticalSurvivals:0, captures:0};
      DATA.units.push(rec);
    }
    /* (v0.21 R2) DÉBEDA: quen te trae de volta, gáñate */
    if(r.recoveredBy){
      const salvador = DATA.units.find(rr => rr.name === r.recoveredBy && rr.id !== rec.id);
      if(salvador){
        salvador.rescatesFeitos = (salvador.rescatesFeitos || 0) + 1;
        rec.debedaCon = rec.debedaCon || {};
        rec.debedaCon[salvador.id] = (rec.debedaCon[salvador.id] || 0) + 1;
        if(rec.debedaCon[salvador.id] === VINCULO.RESCATES_DEBEDA){
          if(crearVinculo(rec, salvador, 'DEBEDA')){
            lines.push(`<div style="color:#ffd700; margin:6px 0;">★ ${TXT('db.vinculoDebeda', {a: rec.name, b: salvador.name, n: VINCULO.RESCATES_DEBEDA})}</div>`);
          }
        }
      }
    }
    rec.ops++;
    rec.kills += u.kills;
    rec.recoveries = (rec.recoveries||0) + 1;
    /* (v0.12) MEMORIA: a morte queda gravada — causa e lugar */
    rec.lastDeath = {op: DATA.opCount, causa: u.deathCause || 'combate', place: r.place};
    /* Persistir personalidade; recuperación = +15 confianza ("volviches por min", plan v0.11) */
    rec.personalidad = u.personalidad;
    rec.equipment = [...(u.equipment||[])];  /* recuperar restos = recuperar o equipo */
    if(g.result === 'defeat' && rec.equipment.length){
      g._equipLost = (g._equipLost||[]).concat(rec.equipment.map(e => `${EQUIPOS[e]?EQUIPOS[e].label:e} (${rec.name})`));
      rec.equipment = [];
    }
    rec.activity = rec.activity || {dist:0, shots:0, kills:0, dmgTaken:0, caps:0, veh:0};
    if(u.act){
      rec.activity.dist += Math.round(u.act.dist); rec.activity.shots += u.act.shots;
      rec.activity.kills += u.kills; rec.activity.dmgTaken += Math.round(u.act.dmgTaken);
      rec.activity.caps += u.act.caps; rec.activity.veh += u.act.veh;
    }
    /* (v0.15.1) RECONSTRUCIÓN IMPERFECTA: cada morte erosiona o aprendido (-25% de toda a actividade).
       Morrer e ser reconstruido unha e outra vez degrada as skills. */
    const _lvlA = {};
    for(const id of Object.keys(SKILLS)) _lvlA[id] = skillLevel(rec.activity, id);
    for(const k of Object.keys(rec.activity)) rec.activity[k] = Math.round(rec.activity[k] * 0.75);
    u._lvlDowns = [];
    for(const id of Object.keys(SKILLS)){
      const lv = skillLevel(rec.activity, id);
      if(lv < _lvlA[id]) u._lvlDowns.push({id, lv});
    }
    rec.confianza = Math.min(100, Math.round((u.confianza || 50) + 15));
    rec.captures = (rec.captures||0) + (u.capturesThisOp||0);
    /* También para Engineer recuperado: acumular reparaciones de la operación */
    if(u.eng){
      rec.totalRepairs = (rec.totalRepairs||0) + u.repairs;
      const recoveredIds = u.recoveredThisOp || [];
      rec.unitsRecovered = (rec.unitsRecovered||0) + recoveredIds.length;
      rec.recoveredFrom = rec.recoveredFrom || {};
      (u.recoveredNamesThisOp || []).forEach(n => {
        rec.recoveredFrom[n] = (rec.recoveredFrom[n]||0) + 1;
      });
    }
    rec.events = [...(rec.events||[]), ...(u.eventBuffer||[])];   /* (v0.37) no fin PvP pode vir null */
    if(!rec.traits.includes('RECONSTRUIDO')) rec.traits.push('RECONSTRUIDO');
    const ctx = {endIntegrity: 0.5};
    checkMedals(rec, ctx);
    lines.push(`<div class="gold">${TXT('deb.recuperado', {id: rec.id, n: rec.name, l: placeLabel(r.place)})}</div>`);
    if(u._lvlDowns && u._lvlDowns.length){
      for(const ld of u._lvlDowns){
        const roman = ['—','I','II','III'][ld.lv];
        lines.push(`<div style="margin-left:24px; color:#a05a50;">${ld.lv > 0 ? TXT('deb.reconBaixa', {sk: skillLabel(ld.id), r: roman}) : TXT('deb.reconPerdida', {sk: skillLabel(ld.id)})}</div>`);
      }
    } else {
      lines.push(`<div style="margin-left:24px; color:#777;" class="small">${TXT('deb.reconImperfecta')}</div>`);
    }
  }

  /* PERDIDOS — restos no recuperados */
  for(const r of lostRemains){
    const u = r.unit;
    const rec = DATA.units.find(rr=>rr.id===u.id);
    const ops = rec?rec.ops:0;
    const kl = (rec?rec.kills:0) + u.kills;
    const reason = r.expired ? TXT('deb.restosPerdidos') : TXT('deb.restosNoRec');
    DATA.fallen.push(TXT('deb.fallenLine', {id: u.id, n: u.name, ops, k: kl, l: placeLabel(r.place), op: DATA.opCount, reason}));
    /* (v0.26) ÚLTIMA TRANSMISIÓN: os veteranos non marchan calados */
    if(ops >= 3){
      const ULTIMAS_ML = {
        es: {
          ESTOICO:  ['Sin novedad en el frente.', 'Posición mantenida. Corto.'],
          IRONICO:  ['Decidme que al menos fue épico.', 'Apuntad esto en mi expediente: lo avisé.'],
          LEAL:     ['Ha sido un honor, jefe.', 'Terminad lo que empezamos.'],
          NERVIOSO: ['¿Oís eso? ...ah.', 'No... no era mi turno...'],
          CINICO:   ['Cobradle esto a ÓPTIMA.', 'Al final tenía razón yo. Qué asco.'],
        },
        gl: {
          ESTOICO:  ['Sen novidade na fronte.', 'Posición mantida. Corto.'],
          IRONICO:  ['Dicídeme que polo menos foi épico.', 'Apuntade isto no meu expediente: aviseino.'],
          LEAL:     ['Foi unha honra, xefe.', 'Rematade o que empezamos.'],
          NERVIOSO: ['¿Oídes iso? ...ah.', 'Non... non era a miña quenda...'],
          CINICO:   ['Cobrádelle isto a ÓPTIMA.', 'Ao final tiña razón eu. Que noxo.'],
        },
        en: {
          ESTOICO:  ['Nothing to report at the front.', 'Position held. Out.'],
          IRONICO:  ['Tell me it was at least epic.', 'Put this in my file: I called it.'],
          LEAL:     ['It has been an honor, chief.', 'Finish what we started.'],
          NERVIOSO: ['Do you hear that? ...ah.', 'No... it wasn\u2019t my turn...'],
          CINICO:   ['Bill this one to OPTIMA.', 'Turns out I was right. Disgusting.'],
        },
      };
      const ULTIMAS = ULTIMAS_ML[I18N.lang] || ULTIMAS_ML.es;
      const pool = ULTIMAS[u.personalidad] || ULTIMAS.ESTOICO;
      lines.push(`<div style="margin-left:24px; font-style:italic; color:#8a97a8;" class="small">📻 ${TXT('deb.ultima', {nome: u.name})} «${pool[Math.floor(Math.random()*pool.length)]}»</div>`);
    }
    lines.push(`<div class="bad">${TXT('deb.caido', {id: u.id, n: u.name, l: placeLabel(r.place), reason: reason.charAt(0).toUpperCase()+reason.slice(1)})}</div>`);
    /* (v0.11) Mensaxe do sistema baixo o caído (neutral, sen pool novo) */
    lines.push(`<div style="margin-left:24px; margin-bottom:8px; font-style:italic; color:#666;">${TXT('deb.comPerdida', {n: u.name, l: placeLabel(r.place)})}</div>`);
    /* (v0.19) DESPECE: das perdas sacan pezas — o campo é do gañador */
    {
      const pzs = xerarPezas(rec, u, DATA.opCount);
      if(pzs.length){
        if(g.result === 'victory'){
          DATA.piezas = (DATA.piezas || []).concat(pzs);
          lines.push(`<div style="margin-left:24px; margin-bottom:8px; color:#c8a86a;" class="small">${TXT('deb.despece', {p: pzs.map(p=>pezaLabel(p.tipo)).join(', ')})}</div>`);
        } else {
          DATA.piezasEnemigas = (DATA.piezasEnemigas || []).concat(pzs);
          lines.push(`<div style="margin-left:24px; margin-bottom:8px; color:#a05a50;" class="small">${TXT('deb.inimigoCampo', {p: pzs.map(p=>pezaLabel(p.tipo)).join(', '), n: u.name})}</div>`);
        }
      } else {
        lines.push(`<div style="margin-left:24px; margin-bottom:8px; color:#555;" class="small">${TXT('deb.nadaAproveitable')}</div>`);
      }
      /* Gardar a ficha da IA para o Reconstructor (R2) */
      if(rec){
        DATA.iaArquivo = DATA.iaArquivo || [];
        rec.deathCause = u.deathCause || 'combate';
        rec.deathOp = DATA.opCount;
        rec.deathPlace = r.place;
        DATA.iaArquivo.push(rec);
      }
    }
    if(rec) DATA.units = DATA.units.filter(rr=>rr.id!==rec.id);
  }

  await saveData(DATA);

  /* ============ ENEMIGOS RECURRENTES (v0.3) ============
     Criterio de entrada/actualización:
     - Veteranos enemigos que sobrevivieron (no muertos)
     - Que dañaron a aliados al menos 30 HP en la operación,
       o que ya eran recurrentes
     - Se actualiza appearances, lastSeen y killedNames acumulados
     Los recurrentes que NO aparecieron esta op no se tocan. */
  const liveEnemyVets = g.units.filter(u =>
    u.team === ET && !u.dead && u.persisted && u.ops >= 2
  );
  const DAMAGE_THRESHOLD = 30;
  for(const e of liveEnemyVets){
    const wasRecurring = (DATA.recurringEnemies||[]).some(r => r.id === e.id);
    const qualified = wasRecurring || (e.damageToAllies||0) >= DAMAGE_THRESHOLD;
    if(!qualified) continue;
    let rec = DATA.recurringEnemies.find(r => r.id === e.id);
    const newlyKilled = e.killedAllyNames || [];
    if(!rec){
      DATA.recurringEnemies.push({
        id: e.id, name: e.name, cls: e.cls, ops: e.ops + 1,
        traits: ['VUELVE_A_POR_TI'],
        appearances: 1,
        lastSeen: DATA.opCount,
        killedNames: [...newlyKilled],
      });
    } else {
      rec.ops += 1;
      rec.appearances = (rec.appearances||1) + 1;
      rec.lastSeen = DATA.opCount;
      rec.killedNames = [...new Set([...(rec.killedNames||[]), ...newlyKilled])];
    }
  }
  /* Si un recurrente fue eliminado, sacarlo de la lista permanentemente */
  const killedEnemyIds = g.units
    .filter(u => u.team === ET && u.dead && u.persisted)
    .map(u => u.id);
  if(killedEnemyIds.length){
    DATA.recurringEnemies = (DATA.recurringEnemies||[]).filter(r =>
      !killedEnemyIds.includes(r.id)
    );
  }
  /* (v0.28) FOLGA: pasa unha operación, o cabreo mingua */
  for(const r of DATA.units){
    if(r.folga && r.folga.ops > 0){
      r.folga.ops--;
      if(r.folga.ops <= 0){
        lines.push(`<div class="small" style="color:#9ab0c8;">✊→ ${TXT('db.folgaFin', {n: r.name, por: r.folga.por})}</div>`);
        delete r.folga;
      } else {
        lines.push(`<div class="small" style="color:#ff9a3c;">✊ ${TXT('db.folgaSegue', {n: r.name, por: r.folga.por, ops: r.folga.ops})}</div>`);
      }
    }
  }
  await saveData(DATA);

  /* (v0.17) FINAL DA CAMPAÑA: op 12, dous eixes (militar × confianza) */
  if(DATA.opCount >= CAMPAIGN_LEN && !DATA.campaignEnded){
    DATA.campaignEnded = true;
    const winRatio = (DATA.campWins||0) / Math.max(1, (DATA.campWins||0) + (DATA.campLosses||0));
    const confMedia = DATA.units.length
      ? DATA.units.reduce((a,r)=>a+(r.confianza||50),0) / DATA.units.length : 50;
    const militar = winRatio >= 0.5, moral = confMedia >= 55;
    let titulo, texto;
    if(militar && moral){
      titulo = '★ FINAL: WHISKY SINTÉTICO PARA TODOS';
      texto = `La guerra está ganada. ÓPTIMA emite 47 páginas de autofelicitación. Nadie las lee: el escuadrón está en la cantina, contigo, brindando con whisky sintético. Sobreviviste tú. Sobrevivieron ellos. Confianza media: ${Math.round(confMedia)}. "If the future is this war, then pour another one."`;
    } else if(militar && !moral){
      titulo = '★ FINAL: EXTRACTION OF WHAT?';
      texto = `Victoria total. Eficiencia récord, certifica ÓPTIMA. A la mañana siguiente, el hangar amanece vacío: el escuadrón se ha dado de baja en masa. Ganaste la guerra. Perdiste a los que la ganaron. Confianza media: ${Math.round(confMedia)}.`;
    } else if(!militar && moral){
      titulo = '★ FINAL: STILL POWDER IN THE GUN';
      texto = `La guerra está perdida. ÓPTIMA redacta el informe de disolución. Pero cuando sales del hangar por última vez, el escuadrón entero marcha detrás de ti. Sin órdenes. Sin protocolo. Confianza media: ${Math.round(confMedia)}. "We ain't sane... but we land on our feet."`;
    } else {
      titulo = '★ FINAL: RECYCLE LAND';
      texto = `Derrota. El hangar en silencio, salvo el zumbido de ÓPTIMA reciclando placas. Nadie se despide: no quedaba nadie que quisiera hacerlo. Solo tú y los comunicados. Confianza media: ${Math.round(confMedia)}.`;
    }
    lines.push(`<div style="border:2px solid #ffb000; padding:14px 18px; margin:14px 0; background:#141008;"><div style="color:#ffb000; font-size:16px; margin-bottom:8px;">${titulo}</div><div style="color:#e8c060; line-height:1.5;">${texto}</div><div class="small" style="color:#888; margin-top:8px;">Campaña: ${DATA.campWins||0}V / ${DATA.campLosses||0}D · A guerra segue en xogo libre.</div></div>`);
  }
  if(g._equipLost && g._equipLost.length){
    lines.push(`<div style="margin-top:10px; color:#a05a50;">✖ ${TXT('db.equipPerdido', {l: g._equipLost.join(', ')})}</div>`);
  }
  /* (v0.26) Rivalidades: gañador da op */
  {
    const vistos = new Set();
    for(const u of survivors){
      if(!u.rival || vistos.has(u.id)) continue;
      const outro = survivors.find(o => o.id === u.rival.con);
      if(!outro) continue;
      vistos.add(u.id); vistos.add(outro.id);
      if((u.kills||0) !== (outro.kills||0)){
        const [win, lose] = u.kills > outro.kills ? [u, outro] : [outro, u];
        lines.push(`<div class="small" style="color:#ff9a3c;">⚡ ${TXT('db.gañaRolda', {g: win.name, k: win.kills, k2: lose.kills, p: lose.name})}</div>`);
      }
    }
  }
  /* (v0.23) Resumo de misións secundarias */
  if(g.subquests && g.subquests.length){
    const feitas = g.subquests.filter(q => q.done).length;
    const perdidas = g.subquests.filter(q => q.failed).length;
    if(feitas || perdidas){
      lines.push(`<div style="color:#b48aff; margin:8px 0;">◈ ${TXT('db.subquests', {f: feitas})}${perdidas ? TXT('db.subquestsPerdidas', {p: perdidas}) : ''}.</div>`);
    }
  }
  /* (v0.19 R2) Entregar a reconstrución se o taller acabou */
  entregarReconstruccion(lines);
  /* (v0.18) Fanfarria de skills se alguén subiu de nivel */
  if(survivors.some(u => u._lvlUps && u._lvlUps.length)){
    setTimeout(() => sfx('levelup'), 400);
  }
  $('dbTitle').textContent = g.result==='victory'
    ? TXT('deb.vitoria')
    : TXT('deb.derrota');
  /* (v0.79) o resultado xa o di vozMando(op.vitoria/op.derrota) ao entrar en endBattle */
  $('dbBody').innerHTML =
    `<p>${TXT('deb.stats', {op: DATA.opCount, be: g.kills[PT], bp: lostRemains.length, r: recovered.length})}<span style="color:#c8a86a;">${TXT('deb.chatarra', {g: g.chatarraGanada||0, t: DATA.chatarra||0})}</span>${g._pvpBotinInfo || ''}${(g.lootGanado&&g.lootGanado.length)?` · <span style="color:#ffd700;">${TXT('deb.botin', {l: g.lootGanado.map(l=>eqLabel(l)).join(', ')})}</span>`:''}</p><br>`+
    (lines.length?lines.join(''):`<div>${TXT('deb.senSuperviventes')}</div>`);
  $('battle').style.display='none';
  /* O interludio decide en parte polo que acaba de pasar, e endBattle
     xa puxo game a null. Gárdase o mínimo. */
  window._ultimaOp = { result: g.result, modo: g.modo };
  $('debrief').style.display='block';
}

/* ============================================================
   HANGAR (con medallas y biografía)
   ============================================================ */
async function showHangar(){
  DATA = await loadData();
  /* (v0.84) REDE DE SEGURIDADE do taller. A entrega dunha reensamblaxe
     só se chama nun sitio, o debrief, e iso deixa unha fenda: se a
     operación remata pero a entrega non chega a executarse —unha
     excepción antes de chegar a ela, pechar a páxina no debrief— o robot
     queda nun limbo do que non hai saída visible. O panel do hangar
     deixa de amosalo, porque a súa condición é a mesma que a da entrega
     e xa se cumpriu, e o roster tampouco o ten porque nunca se entregou.
     Nin no taller nin na lista: o dono monta un robot e desaparece.

     Aquí só se comproba se quedou algo pendente. As liñas do debrief
     pérdense —a fanfarria xa non ten onde ir— pero o robot chega, que é
     o que importa. */
  if(DATA.reconstruccion && DATA.opCount > DATA.reconstruccion.encargadaOp){
    try{
      entregarReconstruccion([]);
      await saveData(DATA);
    }catch(e){ console.error('[taller: entrega pendente]', e); }
  }
  $('debrief').style.display='none';
  $('battle').style.display='none';
  $('hangar').style.display='block';
  /* (v0.71) columna de estado: repíntase sempre que se entra no hangar */
  if(typeof estadoRender === 'function'){ try{ estadoRender(); }catch(e){ console.error('[estado]', e); } }
  /* (v0.12) Display de chatarra */
  const chd = $('chatarraDisplay');
  if(chd) chd.textContent = TXT('hg.chatarra', {n: DATA.chatarra||0});
  /* (v0.11) Asegurar que veteranos antigos teñen personalidade asignada */
  for(const u of DATA.units){
    if(!u.personalidad) u.personalidad = pickPersonalidad(u.cls);
    if(typeof u.confianza !== 'number') u.confianza = 50;
  }
  const list=$('rosterList');
  setTimeout(() => {
    list.querySelectorAll('[data-rsort]').forEach(b => {
      b.addEventListener('click', () => { window._rosterSort = b.dataset.rsort; showHangar(); });
    });
  }, 0);
  if(DATA.units.length===0){
    list.innerHTML=`<div>${TXT('hg.rosterVacio')}</div>`;
  } else {
    /* Panel de briefing onde fala a unidade marcada */
    const briefingPanelHTML = `
      <div id="briefingPanel" style="
        margin-bottom:12px; padding:10px 12px;
        background:#1a1a1a; border-left:3px solid #4f8aff;
        font-size:13px; min-height:48px; display:none;">
        <div id="briefingFrase" style="font-style:italic; color:#cfe0ff;"></div>
        <div id="briefingMeta" style="font-size:10px; color:#888; margin-top:6px;"></div>
      </div>`;
    /* (v0.25.3) Stats EFECTIVOS (con equipo, skills, sinerxías, habilidades) para comparar */
    const statsPreview = (r) => {
      try {
        const p = mkUnit(0, r.cls, -9999, -9999, r);
        return {dmg: Math.round(p.dmg*10)/10, hp: Math.round(p.max), spd: Math.round(p.spd*100)/100, rng: Math.round(p.rng)};
      } catch(e){ return {dmg:0, hp:0, spd:0, rng:0}; }
    };
    window._rosterStats = {};
    for(const r of DATA.units) window._rosterStats[r.id] = statsPreview(r);
    window._rosterSort = window._rosterSort || 'ops';
    const SORTS = {
      ops:  {label:TXT('hg.sOps'),    val:(u)=>u.ops||0},
      dmg:  {label:TXT('hg.sDano'),   val:(u)=>window._rosterStats[u.id].dmg},
      hp:   {label:TXT('hg.sVida'),   val:(u)=>window._rosterStats[u.id].hp},
      spd:  {label:TXT('hg.sVel'),    val:(u)=>window._rosterStats[u.id].spd},
      rng:  {label:TXT('hg.sRango'),  val:(u)=>window._rosterStats[u.id].rng},
      kills:{label:TXT('hg.sBaixas'), val:(u)=>u.kills||0},
    };
    const sortBarHTML = `<div style="margin-bottom:8px;" class="small">${TXT('hg.ordenar')} ` +
      Object.entries(SORTS).map(([k, s]) =>
        `<button data-rsort="${k}" style="background:#111; color:${window._rosterSort===k?'#ffd700':'#8fbf8f'}; border:1px solid ${window._rosterSort===k?'#ffd700':'#3f5f3f'}; font-family:inherit; font-size:10px; padding:2px 8px; cursor:pointer;">${s.label}</button>`
      ).join(' ') + `</div>`;
    const sortedUnits = DATA.units
      .map((u, i) => ({u, i}))
      .sort((a, b) => SORTS[window._rosterSort].val(b.u) - SORTS[window._rosterSort].val(a.u));
    list.innerHTML = briefingPanelHTML + sortBarHTML + sortedUnits.map(({u, i})=>{
      const st = window._rosterStats[u.id];
      const medalsHtml = (u.medals||[]).map(mid=>{
        const m = MEDAL_DEFS.find(x=>x.id===mid);
        const sub = (m && m.subtitle) ? m.subtitle(u) : null;
        return `<span class="medal" title="${medalLabel(mid)}${sub?' ('+sub+')':''}">✪ ${medalLabel(mid)}</span>`;
      }).join('');
      /* Stats específicas por clase */
      let statsLine;
      if(u.cls === 'ENGINEER'){
        const reps = Math.round(u.totalRepairs||0);
        const recovered = u.unitsRecovered||0;
        statsLine = TXT('hg.lineEng', {o: u.ops, r: recovered, h: reps}) + (u.kills?TXT('hg.lineBajas', {k: u.kills}):'') + (u.recoveries?' · ✚'+u.recoveries:'');
      } else {
        statsLine = TXT('hg.lineStd', {o: u.ops, k: u.kills}) + (u.recoveries?' · ✚'+u.recoveries:'');
      }
      const isUpgraded = (DATA.pendingUpgraded||[]).includes(u.id);
      const enFolga = u.folga && u.folga.ops > 0;   /* (v0.28) négase a despregar */
      return `<label class="roster-item"${enFolga?' style="opacity:0.72;"':''}>
        <input type="checkbox" data-i="${i}" ${enFolga?`disabled title="${TXT('hg.folgaTitle')}"`:(isUpgraded?`checked disabled title="${TXT('hg.fixoTitle')}"`:'')}>
        <b>${u.id} '${nomeCompleto(u)}'</b> <span>${u.cls}</span>
        <span class="small" style="color:#9ab0c8;">⚔${st.dmg} ♥${st.hp} »${st.spd} ◎${st.rng}</span>
        <span class="small">${statsLine}</span>
        ${(u.traits||[]).map(t=>`<span class="tag">${tagLabel(t)}</span>`).join('')}
        ${medalsHtml}
        ${(u.equipment||[]).map(e=>`<span class="tag" style="color:#c8a86a; border-color:#c8a86a;">⚙ ${eqLabel(e)}</span>`).join('')}
        ${skillTagsHTML(u)}
        ${u.renacido ? `<span class="tag" style="color:#ff9a3c; border-color:#ff9a3c;">${TXT('hg.renacido')}</span>` : ''}
        ${u.desdeCero ? `<span class="tag" style="color:#7fdc7f; border-color:#7fdc7f;">${TXT('hg.novo')}</span>` : ''}
        ${u.folga && u.folga.ops>0 ? `<span class="tag" style="color:#ff5340; border-color:#ff5340;">${TXT('hg.folga', {ops: u.folga.ops+' op'+(u.folga.ops>1?'s':''), por: u.folga.por})}</span>` : ''}
        ${u.doutrina && typeof doutrinaCor === 'function' ? `<span class="tag" style="color:${doutrinaCor(u.doutrina)}; border-color:${doutrinaCor(u.doutrina)};">${u.doutrina}</span>` : ''}
        ${u.sinergia && SINERXIAS[u.sinergia] ? `<span class="tag" style="color:#ffd700; border-color:#ffd700;">✦ ${SINERXIAS[u.sinergia].label}</span>` : ''}
        ${Object.keys(u.habilidades||{}).filter(k => u.habilidades[k] && HABILIDADES[k]).map(k =>
          `<span class="tag" style="color:#b48aff; border-color:#b48aff;" title="${HABILIDADES[k].desc}">◈ ${HABILIDADES[k].label}</span>`).join('')}
        <button class="bio-btn" data-bio="${i}">${TXT('hg.biografia')}</button>
        <button class="rename-btn" data-ren="${i}">${TXT('hg.renombrar')}</button>
        <button class="bio-btn" data-equip="${i}" style="color:#c8a86a;">${TXT('hg.mellorar')}</button>
      </label>`;
    }).join('');
    list.querySelectorAll('input').forEach(cb=>{
      cb.addEventListener('change',()=>{
        /* (v0.12) Regra de selección: cada mellorado consume un slot libre + o aleatorio */
        const nUpg = (DATA.pendingUpgraded||[]).length;
        const maxTotal = nUpg === 0 ? 3 : (nUpg === 1 ? 2 : 2);  /* con mellorados, o 3º é do HQ */
        const n=list.querySelectorAll('input:checked').length;
        if(n>maxTotal){ cb.checked=false; return; }
        /* (v0.11) Mostrar frase de briefing da unidade marcada */
        if(cb.checked){
          const u = DATA.units[+cb.dataset.i];
          /* Para usar pickFrase, necesita estructura mínima con team=0, cls, personalidad e confianza */
          const fakeU = {team:PT, cls:u.cls, personalidad:u.personalidad, confianza:u.confianza};
          const est = estadoConfianza(fakeU);
          /* En autopreservación, posiblemente saia refusing_briefing en vez de briefing */
          let contexto = 'briefing';
          if(est === 'AUTOPRESERVACION' && Math.random() < 0.7) contexto = 'refusing_briefing';
          const frase = pickFrase(fakeU, contexto);
          if(frase){
            const col = est === 'LEAL' ? '#7fdc7f'
                      : est === 'SARCASTICO' ? '#cfe0ff'
                      : est === 'DESCONFIADO' ? '#ffd24a'
                      : '#ff5340';
            const panel = $('briefingPanel');
            const fraseEl = $('briefingFrase');
            const metaEl = $('briefingMeta');
            if(panel && fraseEl && metaEl){
              panel.style.display = 'block';
              panel.style.borderLeftColor = col;
              fraseEl.style.color = col;
              fraseEl.textContent = `${u.name}: «${frase}»`;
              metaEl.textContent = `${u.cls} · ${u.personalidad.toLowerCase()} · estado ${est.toLowerCase()} · confianza ${Math.round(u.confianza)}`;
            }
          }
        }
      });
    });
    /* (v0.42 FIX) só os botóns con data-bio abren a biografía — .bio-btn é
       clase COMPARTIDA (mellorar, fundir, reconstruír...) e disparaba
       showBiography(undefined) → TypeError reading 'id' */
    list.querySelectorAll('[data-bio]').forEach(b=>{
      b.addEventListener('click',e=>{
        e.preventDefault(); e.stopPropagation();
        showBiography(DATA.units[+b.dataset.bio]);
      });
    });
    list.querySelectorAll('.rename-btn').forEach(b=>{
      b.addEventListener('click',e=>{
        e.preventDefault(); e.stopPropagation();
        renameUnit(+b.dataset.ren);
      });
    });
    list.querySelectorAll('[data-equip]').forEach(b=>{
      b.addEventListener('click', e=>{
        e.preventDefault(); e.stopPropagation();
        showEquipShop(+b.dataset.equip);
      });
    });
  }
}

/* ============================================================
   MEMORIAL DOS CAÍDOS.

   Era un <div> agochado no medio do hangar que o botón amosaba e
   agochaba. Funcionar funcionaba, pero caía por debaixo de todo: premías
   e na parte visible da pantalla non se movía nada. Non había forma de
   saber se o botón estaba roto ou se simplemente non había mortos.

   Agora é unha pantalla coma as outras, e de paso o fondo que se xerou
   para ela —que estaba posto naquel div— vese por fin.

   As liñas veñen xa redactadas de 04-progresion.js, no idioma que había
   cando morreu cada un. Iso é a mantenta: un epitafio non se retraduce.
   ============================================================ */
function showMemorial(){
  fondoModal('memorialdoscaidos');
  const caidos = DATA.fallen || [];
  $('bioTitle').innerHTML = '✝ ' + TXT('btn.memorial').toUpperCase();
  $('bioBody').innerHTML = caidos.length
    ? `<div class="small" style="color:#c8a86a; margin-bottom:10px;">${TXT('mem.cantos', {n: caidos.length})}</div>` +
      caidos.map(f => `<div class="dead">✝ ${f}</div>`).join('')
    : `<div class="small">${TXT('hg.senCaidos')}</div>`;
  $('bioModal').style.display = 'flex';
}

/* ============================================================
   BRIEFING (v0.11) — Pantalla intermedia onde os veteranos
   seleccionados falan antes de entrar á operación. Secuencial:
   un por un coa tecla Espazo / Enter / botón.
   ============================================================ */
let _briefingState = null;  /* {units, idx, onDone} */

function showBriefing(units, onDone){
  units = units || [];
  for(const u of units){
    if(!u.personalidad) u.personalidad = pickPersonalidad(u.cls);
    if(typeof u.confianza !== 'number') u.confianza = 50;
  }
  /* (v0.17) idx -1 = comunicado de ÓPTIMA antes das unidades */
  _briefingState = { units, idx: -1, onDone };
  $('hangar').style.display = 'none';
  $('debrief').style.display = 'none';
  $('battle').style.display = 'none';
  $('briefing').style.display = 'block';
  $('brTitle').textContent = TXT('br.titulo', {n: DATA.opCount + 1});
  renderBriefingFrame();
}

function renderBriefingFrame(){
  if(!_briefingState) return;
  const {units, idx} = _briefingState;
  /* (v0.17) Comunicado de ÓPTIMA */
  if(idx === -1){
    const act = campaignAct();
    const op = DATA.opCount + 1;
    $('brName').textContent = TXT('br.optima');
    $('brName').style.color = '#ffb000';
    $('brMeta').textContent = TXT('br.meta', {op, actN: act.n, acto: act.label, len: CAMPAIGN_LEN});
    const f = $('brFrase');
    f.textContent = pickComunicadoPre();
    f.style.color = '#e8c060';
    f.style.borderLeftColor = '#ffb000';
    f.style.fontStyle = 'normal';
    $('brProgress').textContent = TXT('br.mando');
    sfxT('voice_blip', 200, 'OPTIMA');
    $('brNext').textContent = units.length ? TXT('br.seguinte') : TXT('br.empezar');
    const cnv = $('brPortrait'), c2 = cnv.getContext('2d');
    c2.fillStyle = '#0a0a0a'; c2.fillRect(0,0,96,96);
    c2.strokeStyle = '#ffb000'; c2.lineWidth = 2;
    c2.beginPath(); c2.moveTo(48,14); c2.lineTo(84,76); c2.lineTo(12,76); c2.closePath(); c2.stroke();
    c2.beginPath(); c2.arc(48,54,12,0,7); c2.stroke();
    c2.fillStyle = '#ffb000'; c2.fillRect(45,51,6,6);
    c2.font = '9px Courier New'; c2.fillText('ÓPTIMA', 30, 90);
    return;
  }
  const u = units[idx];
  /* Calcular frase: prefire 'briefing'; en AUTOPRESERVACION ten 70% prob de 'refusing_briefing' */
  const fakeU = {team:PT, cls:u.cls, personalidad:u.personalidad, confianza:u.confianza};
  const est = estadoConfianza(fakeU);
  /* (v0.12) MEMORIA: se hai un recordo aplicable, ten prioridade sobre a frase xenérica.
     As PETICIÓNS de equipamento van entre a memoria e a xenérica. */
  $('brFrase').style.fontStyle = 'italic';
  sfxT('voice_blip', 200, u.cls);
  /* (R3) RENACIDO: 40% de dicir algo... raro */
  let frase = (u.renacido && Math.random() < 0.4) ? fraseRenacida(u) : null;
  if(!frase) frase = pickFraseMemoria(u, est) || pickFrasePeticion(u, est);
  if(!frase){
    let contexto = 'briefing';
    if(est === 'AUTOPRESERVACION' && Math.random() < 0.7) contexto = 'refusing_briefing';
    frase = pickFrase(fakeU, contexto) || '...';
  }
  /* Cor segundo estado */
  const col = est === 'LEAL' ? '#7fdc7f'
            : est === 'SARCASTICO' ? '#cfe0ff'
            : est === 'DESCONFIADO' ? '#ffd24a'
            : '#ff5340';
  /* Render */
  $('brName').textContent = `${u.id} '${nomeCompleto(u)}'`;
  $('brName').style.color = col;
  /* Esta liña estaba escrita a man en galego —"estado", "confianza",
     "[ASIGNADO POLO HQ]"— e collía a etiqueta crúa de EQUIPOS en vez de
     eqLabel(). Xogando en inglés saía a interface nunha lingua e os
     datos da unidade noutra. A personalidade e o estado tamén van por
     clave: son nomes internos, non texto. */
  const _eq = (u.equipment || []).map(e => (typeof eqLabel === 'function' ? eqLabel(e)
              : (EQUIPOS[e] ? EQUIPOS[e].label : e)));
  $('brMeta').textContent = TXT('br.meta2', {
      cls: clsLabel(u.cls), ops: u.ops,
      pers: TXT('pers.' + u.personalidad),
      est: TXT('estc.' + est),
      conf: Math.round(u.confianza),
    })
    /* separador sen palabras: non ten sentido como clave de idioma */
    + (_eq.length ? ` · ⚙ ${_eq.join(', ')}` : '')
    + (u._hqAssigned ? TXT('br.hq') : '');
  delete u._hqAssigned;
  const fraseEl = $('brFrase');
  fraseEl.textContent = `«${frase}»`;
  fraseEl.style.color = col;
  fraseEl.style.borderLeftColor = col;
  $('brProgress').textContent = `( ${idx + 1} / ${units.length} )`;
  /* Botón cambia de texto na última */
  $('brNext').textContent = (idx === units.length - 1) ? TXT('br.empezar') : TXT('br.seguinte');
  /* Retrato */
  paintPortrait('brPortrait', u);
}

function advanceBriefing(){
  if(!_briefingState) return;
  _briefingState.idx++;
  if(_briefingState.idx >= _briefingState.units.length){
    /* Fin do briefing — chamar onDone */
    const done = _briefingState.onDone;
    _briefingState = null;
    $('briefing').style.display = 'none';
    done();
  } else {
    renderBriefingFrame();
  }
}

/* ============================================================
   TENDA DE MELLORAS (v0.12) — canxear chatarra por equipamento
   Regra de selección: por cada unidade mellorada nesta visita,
   pérdese un slot de elección libre (substitúese por aleatorio).
   Máximo 2 unidades melloradas por visita.
   ============================================================ */
/* ============================================================
   DESPIECE (v0.19) — inventario de pezas con nome propio
   ============================================================ */
/* Operacións que ten que levar unha unidade para que a súa ficha deixe
   de amosar o plano de fábrica e pase a amosar o seu retrato. */
const RETRATO_OPS = 5;

/* ============================================================
   FONDO DA PANTALLA. As imaxes de art/ pasan por
   tools/xerar_fondos.js e quedan en ui/fondo_<nome>.jpg.

   Non hai unha regra de CSS por pantalla: pásase a ruta nunha variable
   de CSS e o degradado escuro ponse enriba sempre igual. Así engadir
   unha pantalla nova é chamar aquí cun nome, sen tocar a folla de
   estilos. E chamando sen nome límpase, que fai falla porque o modal é
   o MESMO para todas: se unha pantalla non limpa, herda o fondo da
   anterior. */
function fondoModal(nome){
  const m = $('bioModal');
  if(!m) return;
  if(nome){
    m.dataset.fondo = nome;
    /* RUTA ABSOLUTA, e non é remilgo. Un url() dentro dunha variable de
       CSS resólvese contra a folla de estilos que a USA, non contra onde
       se declara. Aquí decláirase nun atributo style —base: o documento—
       pero cónsomea css/style.css, así que o navegador pedía
       css/ui/fondo_X.jpg e non atopaba nada. A caixa quedaba negra.

       Non se viu en NINGUNHA revisión porque as capturas facíanse sobre
       dist/tuerca.html, que leva o CSS incrustado: alí as dúas bases son
       a mesma e funciona. O fallo só existía na versión de ficheiros
       separados, que é xustamente a que se xoga na web.

       Resolvéndoa contra document.baseURI queda unha ruta absoluta e xa
       non depende de quen a interprete. */
    const rota = new URL(`ui/fondo_${nome}.jpg`, document.baseURI).href;
    m.style.setProperty('--fondo', `url("${rota}")`);
  } else {
    delete m.dataset.fondo;
    m.style.removeProperty('--fondo');
  }
}

function showDespiece(){
  const pzs = DATA.piezas || [];
  const enemigas = DATA.piezasEnemigas || [];
  let body = '';
  /* (v0.28.1) Relato dun desmantelamento acabado de executar: render único, sen mutacións posteriores */
  if(window._desmRelato){ body += window._desmRelato; window._desmRelato = null; }
  body += `<div class="small" style="color:#c8a86a; margin-bottom:10px;">${TXT('dp.cab', {c: DATA.chatarra||0, p: pzs.length})}</div>`;
  /* (v0.21.1) Explicar O CICLO antes de ensinar o botón de fundir */
  body += `<div class="small" style="border:1px solid #444; padding:8px 12px; margin-bottom:10px; color:#9fb8d0; line-height:1.5;">${TXT('dp.ciclo')}</div>`;
  /* Cobertura de slots co inventario actual (se hai IAs que reconstruír) */
  if((DATA.iaArquivo||[]).length){
    const cobre = (tipos) => pzs.some(p => tipos.includes(p.tipo));
    const slots = [
      ['CABEZA', cobre(['CABEZA'])], ['CHASIS', cobre(['CHASIS'])], ['NUCLEO', cobre(['NUCLEO'])],
      ['BRAZO_DER', cobre(['BRAZO_DER'])], ['BRAZO_ESQ', cobre(['BRAZO_ESQ'])],
      ['PERNA_DER', cobre(['PERNA_DER'])], ['PERNA_ESQ', cobre(['PERNA_ESQ'])],
    ];
    body += `<div class="small" style="margin-bottom:10px; color:#888;">${TXT('dp.slots')}
      ${slots.map(([n, ok]) => ok ? `<b style="color:#7fdc7f;">${pezaLabel(n).toUpperCase()} ✓</b>` : `<span style="color:#666;">${pezaLabel(n).toUpperCase()} ${TXT('dp.recambio')}</span>`).join(' · ')}</div>`;
  }
  if(pzs.length === 0){
    body += `<div class="small" style="color:#666; margin-bottom:10px;">${TXT('dp.ningunha')}</div>`;
  } else {
    for(const p of pzs){
      body += `<div style="display:flex; align-items:center; gap:10px; padding:5px 0; border-bottom:1px solid #333;">
        <div style="flex:1;">${pezaDesc(p)} <span class="small" style="color:#555;">· Op ${p.op}</span></div>
        <button class="bio-btn" data-fundir="${p.id}" title="${TXT('dp.fundirTitle')}">${TXT('dp.fundir', {v: valorFundicion(p)})}</button>
      </div>`;
    }
  }
  /* Pool inimigo: sabes o que che falta e quen o ten */
  if(enemigas.length){
    body += `<div style="margin-top:14px; color:#a05a50;"><b>${TXT('dp.enMans', {n: enemigas.length})}</b></div>`;
    for(const p of enemigas){
      body += `<div class="small" style="color:#8a5a50; padding:2px 0;">${TXT('dp.perdida', {peza: pezaLabel(p.tipo).toUpperCase(), n: p.deNome, cls: p.deCls, op: p.op})}</div>`;
    }
    body += `<div class="small" style="color:#666; margin-top:6px;">${TXT('dp.portadores')}</div>`;
  }
  /* IAs arquivadas (adianto do Reconstructor) */
  const ias = DATA.iaArquivo || [];
  if(ias.length){
    body += `<div style="margin-top:14px; color:#9fd0ff;"><b>${TXT('dp.iasArquivo', {n: ias.length})}</b></div>`;
    if(DATA.reconstruccion){
      body += `<div class="small" style="color:#ff9a3c; margin:4px 0;">${TXT('dp.tallerRec', {n: DATA.reconstruccion.rec.name})}</div>`;
    }
    for(let i=0; i<ias.length; i++){
      const r = ias[i];
      body += `<div style="display:flex; align-items:center; gap:10px; padding:4px 0;">
        <div style="flex:1;" class="small">${TXT('dp.iaLine', {id: r.id, n: r.name, cls: clsLabel(r.cls), ops: r.ops||0, op: r.deathOp||'?', causa: causaLabel(r.deathCause)})}</div>
        ${DATA.reconstruccion ? '' : `<button class="bio-btn" data-rebuild="${i}" style="color:#9fd0ff;">${TXT('dp.reconstruir')}</button>`}
      </div>`;
    }
  }
  /* (v0.28) MONTAXE DESDE CERO */
  body += `<div style="margin-top:16px; border-top:1px solid #444; padding-top:10px;">
    <b style="color:#7fdc7f;">${TXT('dp.montaxeTit')}</b>
    <div class="small" style="color:#888; margin:4px 0 8px;">${TXT('dp.montaxeDesc', {c: MONTAXE_COST, r: RECON_RECAMBIO})}</div>
    ${DATA.reconstruccion
      ? `<div class="small" style="color:#ff9a3c;">${TXT('dp.tallerCurto')}</div>`
      : `<button class="bio-btn" id="btnMontaxe" style="color:#7fdc7f; border-color:#7fdc7f;">${TXT('dp.montarBtn')}</button>`}
  </div>`;
  /* (v0.28) DESMANTELAMENTO DE VIVOS — a única morte elixida polo comandante */
  if((DATA.units||[]).length){
    body += `<div style="margin-top:16px; border-top:1px solid #a05a50; padding-top:10px;">
      <b style="color:#ff7a5a;">${TXT('dp.desmTit')}</b>
      <div class="small" style="color:#888; margin:4px 0 8px;">${TXT('dp.desmDesc')}</div>
      <select id="desmSel" style="background:#111; color:#cfe0ff; border:1px solid #555; font-family:inherit; max-width:100%;">
        ${DATA.units.map(r => {
          const cam = DATA.units.filter(o => o!==r && (o.vinculos||[]).some(v=>v.con===r.id)).length;
          return `<option value="${r.id}">${nomeCompleto(r)} (${clsLabel(r.cls)}, ${r.ops||0} ops, conf. ${r.confianza||50} → ${TXT((r.confianza||50)>=70?'dp.doazon':'dp.requisa')}${cam?TXT('dp.camReac', {n: cam, s: cam>1?'s':''}):''})</option>`;
        }).join('')}
      </select>
      <button class="bio-btn" id="desmBtn" style="color:#ff7a5a; border-color:#ff7a5a;">${TXT('dp.desmBtn')}</button>
    </div>`;
  }
  fondoModal('despiece');
  $('bioTitle').innerHTML = TXT('dp.titulo');
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'flex';
  $('bioBody').querySelectorAll('[data-rebuild]').forEach(b=>{
    b.addEventListener('click', ()=> showReconstruir(+b.dataset.rebuild));
  });
  $('bioBody').querySelectorAll('[data-fundir]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      /* (v0.21.1) Dobre clic de confirmación: fundir é para sempre */
      if(!b.dataset.armed){
        b.dataset.armed = '1';
        b.textContent = `¿SEGURO? (irreversible)`;
        b.style.color = '#ff5340';
        b.style.borderColor = '#ff5340';
        setTimeout(() => {
          if(b.isConnected && b.dataset.armed){
            delete b.dataset.armed;
            const pz = (DATA.piezas||[]).find(p=>p.id===b.dataset.fundir);
            if(pz){ b.textContent = `FUNDIR ${valorFundicion(pz)}⚙`; b.style.color=''; b.style.borderColor=''; }
          }
        }, 3000);
        return;
      }
      const pid = b.dataset.fundir;
      const ix = (DATA.piezas||[]).findIndex(p=>p.id===pid);
      if(ix < 0) return;
      const p = DATA.piezas[ix];
      DATA.chatarra = (DATA.chatarra||0) + valorFundicion(p);
      DATA.piezas.splice(ix, 1);
      sfx('scrap_pick');
      await saveData(DATA);
      showDespiece();
      const chd = $('chatarraDisplay');
      if(chd) chd.textContent = `⚙ CHATARRA: ${DATA.chatarra||0}`;
    });
  });
  /* (v0.28) Montaxe desde cero */
  const bMont = $('btnMontaxe');
  if(bMont) bMont.addEventListener('click', () => showMontaxe());
  /* (v0.28) Desmantelamento con dobre confirmación */
  const bDesm = $('desmBtn');
  if(bDesm) bDesm.addEventListener('click', async () => {
    const sel = $('desmSel');
    if(!sel || !sel.value) return;
    const recSel = DATA.units.find(r => r.id === sel.value);
    if(!recSel) return;
    if(!bDesm.dataset.armed){
      bDesm.dataset.armed = '1';
      bDesm.textContent = TXT('dp.desmSeguro', {n: recSel.name});
      bDesm.style.background = '#3a1410';
      setTimeout(() => {
        if(bDesm.isConnected && bDesm.dataset.armed){
          delete bDesm.dataset.armed;
          bDesm.textContent = 'DESMANTELAR';
          bDesm.style.background = '';
        }
      }, 4000);
      return;
    }
    const out = desmantelarVivo(recSel.id);
    if(!out) return;
    sfx('expl_struct');
    await saveData(DATA);
    /* (v0.28.1) SEN carreiras: hangar primeiro (await), e o relato vai DENTRO do
       render único de showDespiece vía window._desmRelato — cero mutacións extra do DOM */
    window._desmRelato = `<div style="border:1px solid ${out.doazon?'#c8a86a':'#a05a50'}; padding:10px 14px; margin-bottom:12px;">
      <b style="color:${out.doazon?'#c8a86a':'#ff7a5a'};">${TXT(out.doazon?'desm.doazonHdr':'desm.requisaHdr', {n: out.rec.name})}</b>
      <div class="small" style="color:#888;">${TXT('desm.pezasIA')}</div>
      ${out.frase ? `<div style="font-style:italic; color:#cfe0ff; margin-top:6px;">«${out.frase}»</div>` : ''}
      ${out.optima ? `<div class="small" style="color:#e8c060; margin-top:6px;">▣ ÓPTIMA: ${out.optima}</div>` : ''}
      ${out.reaccions.length ? `<div class="small" style="margin-top:6px; color:#9ab0c8; line-height:1.5;">${out.reaccions.join('<br>')}</div>` : ''}
    </div>`;
    await showHangar();
    showDespiece();
  });
}

/* ============================================================
   RECONSTRUCIÓN (v0.19 R2) — 5 slots, herdanza, taller ocupado
   ============================================================ */
const RECON_COST = 90, RECON_RECAMBIO = 14;
/* (v0.19 R3) SINERXÍAS: o roll oculto da ensamblaxe. Revélase só ao recoller. */
/* HABILIDADES CRUZADAS: o que che dá montar un robot con pezas doutra
   clase. Estaban escritas DENTRO da función que redacta o debrief, así
   que só existían nese intre: aparecía o cartel ao ensamblar e despois
   non había maneira de saber que unidade as levaba. E non son cosmética
   —antimuro fai o DOBRE de dano a estruturas— así que non poder
   distinguila doutra normal é perder información que decide unha
   batalla.

   Mesma forma que SINERXIAS, e polo mesmo motivo: unha táboa que poidan
   ler o debrief, o roster e a ficha. */
/* label e desc son GETTERS a propósito: resólvense ao PINTAR, non ao
   cargar o módulo. Se fosen cadeas fixas quedarían no idioma que houbese
   ao arrancar e cambiar de lingua non as movería — que é como se
   descubriu isto, cunha etiqueta CAZAPILOTOS en galego no medio dunha
   interface en inglés. */
const HABILIDADES = {};
for(const _id of ['recolector', 'antimuro', 'cazapilotos', 'nucleoPiloto', 'chasisHeavy'])
  HABILIDADES[_id] = {
    get label(){ return TXT('hab.' + _id); },
    get desc(){ return TXT('hab.' + _id + '.d'); },
  };

/* Mesmo tratamento que HABILIDADES, e polo mesmo motivo: estas
   etiquetas saen no roster e na ficha, e estaban escritas en galego. */
const SINERXIAS = {};
for(const _id of ['CORAZON_DOBLE', 'NUCLEO_QUENTE', 'SOLDADURA'])
  SINERXIAS[_id] = {
    get label(){ return TXT('sin.' + _id); },
    get desc(){ return TXT('sin.' + _id + '.d'); },
  };
function rollSinerxia(pezas){
  let vet = 0;
  for(const p of Object.values(pezas)){
    if(!p) continue;
    const sk = SKILLS[PEZA_SKILL[p.tipo]];
    if(p.act >= sk.th[0]) vet++;
  }
  const prob = 0.12 + 0.03 * vet;
  if(Math.random() >= prob) return null;
  const keys = Object.keys(SINERXIAS);
  return keys[Math.floor(Math.random() * keys.length)];
}
/* CORAZÓN DOBRE: engana á morte unha vez por op */
function cheatDeath(u, g){
  if(u.team === PT && u.sinergia === 'CORAZON_DOBLE' && !u._corazonUsado && u.hp <= 0 && !u.dead){
    u._corazonUsado = true;
    u.hp = 1;
    radio(TXT('r.corazonDobre', {n:u.name}), '#ff9a3c', {x:u.x, y:u.y});
    sfx('loot_pick');
    return true;
  }
  return false;
}
/* UN OCO POR LADO, e non un por parella.

   Estivo cinco ocos —cabeza, chasis, núcleo, BRAZO, PERNA— e iso
   significaba que só podías poñerlle UN brazo e UNHA perna a un robot
   reconstruído. Non había maneira de darlle o brazo dereito dun HEAVY e
   o esquerdo dun SNIPER, aínda que o motor de montaxe sabe debuxalo
   perfectamente: o banco de probas leva ensinando esas mesturas desde
   que existe.

   Era unha decisión vella que se comía o que fai especial ao sistema de
   pezas — que un robot reensamblado SE VEXA reensamblado. Cos ocos
   emparellados, un reconstruído saía case simétrico e a diferenza
   apenas se notaba.

   O PREZO NON SOBE. Ao pasar de 5 a 7 ocos, o recambio xenérico baixa
   de 20 a 14 para que unha reconstrución completa siga custando o
   mesmo: 5x20=100 antes, 7x14=98 agora. Isto é un arranxo de interface,
   non un rebalanceo encuberto. Se algún día se quere que a
   reconstrución sexa máis cara, tócase RECON_RECAMBIO e xa. */
const RECON_SLOTS = [
  {slot:'CABEZA',     acepta:['CABEZA']},
  {slot:'CHASIS',     acepta:['CHASIS']},
  {slot:'NUCLEO',     acepta:['NUCLEO']},
  {slot:'BRAZO_DER',  acepta:['BRAZO_DER']},
  {slot:'BRAZO_ESQ',  acepta:['BRAZO_ESQ']},
  {slot:'PERNA_DER',  acepta:['PERNA_DER']},
  {slot:'PERNA_ESQ',  acepta:['PERNA_ESQ']},
];

function showReconstruir(iaIdx){
  const rec = (DATA.iaArquivo||[])[iaIdx];
  if(!rec || DATA.reconstruccion) return;
  const pzs = DATA.piezas || [];
  let body = `<div class="small" style="margin-bottom:8px;">Reconstruíndo a IA de <b style="color:#9fd0ff;">${rec.name}</b> (${rec.cls}). Custo base ${RECON_COST}⚙ · recambio xenérico +${RECON_RECAMBIO}⚙ por slot baleiro.</div>
  <div class="small" style="color:#c8a86a; margin-bottom:10px;">⚙ CHATARRA: <b>${DATA.chatarra||0}</b></div>`;
  for(const s of RECON_SLOTS){
    const opcions = pzs.filter(p => s.acepta.includes(p.tipo));
    body += `<div style="padding:5px 0; border-bottom:1px solid #333;">
      <b>${pezaLabel(s.slot).toUpperCase()}</b>:
      <select data-slot="${s.slot}" style="background:#111; color:#cfe0ff; border:1px solid #555; font-family:inherit;">
        <option value="">— Recambio xenérico (+${RECON_RECAMBIO}⚙) —</option>
        ${opcions.map(p=>`<option value="${p.id}">${p.nova ? PEZA_LABEL[p.tipo] + ' de ' + p.deCls : PEZA_LABEL[p.tipo] + ' de ' + p.deNome + ' (' + p.deCls + ')'}</option>`).join('')}
      </select>
    </div>`;
  }
  body += VISTA_HTML;
  body += `<div style="margin-top:12px;"><b id="reconTotal" style="color:#c8a86a;"></b></div>
  <div style="margin-top:8px;">
    <button class="bio-btn" id="reconConfirm" style="color:#9fd0ff; border-color:#9fd0ff;">▸ ENSAMBLAR (ocupa o taller 1 operación)</button>
    <button class="bio-btn" id="reconBack">◂ volver</button>
  </div>`;
  fondoModal('taller');
  $('bioTitle').innerHTML = `⚙ RECONSTRUCTOR — ${rec.name}`;
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'flex';
  const calcTotal = () => {
    let total = RECON_COST;
    $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => { if(!sel.value) total += RECON_RECAMBIO; });
    $('reconTotal').textContent = `TOTAL: ${total}⚙` + (total > (DATA.chatarra||0) ? '  — CHATARRA INSUFICIENTE' : '');
    $('reconConfirm').disabled = total > (DATA.chatarra||0);
    $('reconConfirm').style.opacity = total > (DATA.chatarra||0) ? 0.4 : 1;
    /* A clase vén da IA que se reconstrúe; as pezas alleas vense por riba. */
    pintarVistaMontaxe(rec.cls);
    return total;
  };
  $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => sel.addEventListener('change', calcTotal));
  calcTotal();
  $('reconBack').addEventListener('click', () => showDespiece());
  $('reconConfirm').addEventListener('click', async () => {
    const total = calcTotal();
    if(total > (DATA.chatarra||0)) return;
    const usadas = {};
    $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => {
      if(sel.value){
        const ix = DATA.piezas.findIndex(p => p.id === sel.value);
        if(ix >= 0) usadas[sel.dataset.slot] = DATA.piezas.splice(ix, 1)[0];
      }
    });
    DATA.chatarra -= total;
    DATA.iaArquivo.splice(iaIdx, 1);
    DATA.reconstruccion = { rec, pezas: usadas, encargadaOp: DATA.opCount, sinergia: rollSinerxia(usadas) };
    sfx('order_confirm');
    await saveData(DATA);
    showDespiece();
  });
}

/* (v0.28) MONTAXE DESDE CERO — robot novo no taller, IA en branco.
   Reutiliza o pipeline do Reconstructor: ocupa o taller 1 op e entrégase en endBattle. */
/* ============================================================
   O PRIMEIRO DÍA.

   Na primeira partida non se monta cun puñado de restos rapiñados:
   dáseche un BANCO completo de pezas base e un presuposto, e a primeira
   decisión do xogo é económica.

     estándar   unha peza da mesma clase có chasis .... 10
     allea      unha peza doutra clase ................ 20
     presuposto ............................ 90

   Son sete ocos (os seis que se debuxan máis o núcleo), así que:

     todo estándar ..... 70   +20   e o troco vai contigo
     1 allea ........... 80   +10
     2 alleas .......... 90     0   <- o equilibrio
     7 alleas .......... 140  -50

   O EQUILIBRIO EN DÚAS É O IMPORTANTE: unha desviación pequena non custa
   nada —un brazo e unha cabeza doutra clase, que ademais é o que máis se
   nota— e o que se paga é COMPROMETERSE.

   E se te pasas quedas en NEGATIVO. Non hai que impoñer ningún tope: as
   cinco clases de infantería non custan chatarra, só tempo, así que o HQ
   segue producindo tropa; o que non podes é mercar tanque (40), torreta
   (45) nin muro (10) ata saldar. Segues sendo de ÓPTIMA. O que non tes é
   crédito.

   A xustificación en ficción non hai que escribila en ningures: a liña
   de ÓPTIMA está optimizada para montaxes estándar, e unha mestura pide
   recalibración. A empresa fai que saia caro ser distinto.
   ============================================================ */
const PRIMEIRO_PRESUPOSTO = 90;
const PEZA_ESTANDAR = 10, PEZA_ALLEA = 20;

/* O banco do primeiro día: unha peza de cada clase para cada oco. Non
   teñen doador —son material de fábrica, non restos— e por iso levan
   `nova`, que é o que fai que se etiqueten pola clase e non por un nome
   que non existe. */
function bancoPrimeiroDia(){
  const pezas = [];
  let n = 1;
  for(const s of RECON_SLOTS){
    for(const cls of Object.keys(CLS)){
      /* act: 0 PORQUE NON LEMBRAN NADA. Estaba a 100, e o limiar de
         VERDUGO son 8 mortes: un brazo recén saído da liña contaba como
         veterano e subía a probabilidade de sinerxía. Ao revés do canon
         —as pezas levan memoria, e estas non teñen ningunha— e ademais
         regalaba o que se supón que hai que gañar no campo. */
      pezas.push({ id: 'b' + (n++), tipo: s.acepta[0], deCls: cls,
                   deNome: null, nova: true, act: 0 });
    }
  }
  return pezas;
}

/* ¿Estamos no primeiro día? Mesmo criterio que o dos interludios: sen
   operacións e sen ninguén no roster. */
/* E A APERTURA NON SE REPITE. Definir o primeiro día só como "cero
   operacións e ninguén no roster" abría un burato: se perdías o teu
   único robot antes de rematar unha operación volvías cumprir as dúas
   condicións, e o xogo repetíache o laboratorio, o selector de clase e o
   reparto de 90⚙ como se acabases de instalalo. Perdías a campaña sen
   que ninguén cha borrase.

   A marca boa non é "xa repartín" —esa foi a que fallou antes, porque
   quedaba posta de intentos a medias— senón "XA BAUTIZASTE O TEU
   PRIMEIRO ROBOT". Non se pon ata que hai un nome escrito, así que
   pechar o taller a medias devólveche o banco; pero unha vez que
   bautizaches, a apertura rematou para sempre pase o que pase despois.

   Compárase con undefined a mantenta: no primeiro día vale 0. */
function aperturaFeita(){
  return !!(DATA.marcas && DATA.marcas.primeiroNome !== undefined);
}
function montaxePrimeiroDia(){
  return (DATA.opCount || 0) === 0 && !(DATA.units || []).length && !aperturaFeita();
}

/* O que custa unha peza no primeiro día. Fóra del vale o modelo de
   sempre, que cobra polo RECAMBIO XENÉRICO e non pola mestura: alí as
   pezas son túas porque as recuperaches. */
function prezoPeza(peza, clsChasis){
  if(!peza) return PEZA_ESTANDAR;      /* oco baleiro: entra a de serie */
  return peza.deCls === clsChasis ? PEZA_ESTANDAR : PEZA_ALLEA;
}

/* ============================================================
   ESCOLLA DE CLASE — a primeira pantalla do taller, e só a primeira vez.

   Antes deducíase a clase do CHASIS que escolleses nun desplegable no
   medio doutros seis. Iso non ensina nada: o xogador non sabe que ao
   trocar o chasis está a cambiar de clase, e chega ao seu primeiro
   combate sen que ninguén lle dixese que fai cada unha.

   Aquí escóllese primeiro, con ficha diante. As láminas técnicas levan
   meses feitas —unha por clase— e só se vían na ficha dun veterano; este
   é o momento no que serven para o que servían.

   E o que fai a escolla é decidir QUE PEZAS SON BARATAS. As da clase
   escollida custan o normal; as das outras, o dobre. Todas están
   dispoñibles, e só esta vez: despois só terás o que recuperes.
   ============================================================ */
function escollaClaseAberta(){
  const CLASES = Object.keys(CLS);
  let sel = DATA.marcas && DATA.marcas.clsInicial;
  const ficha = (c) => {
    const s = CLS[c];
    return `<div class="small" style="line-height:1.6;">
      <div style="color:#c8a86a; margin-bottom:6px;">${TXT('cl.' + c)}</div>
      <div>${TXT('cl.vida')}: <b>${s.hp}</b> · ${TXT('cl.dano')}: <b>${s.dmg}</b>
           · ${TXT('cl.rango')}: <b>${s.rng}</b> · ${TXT('cl.vel')}: <b>${s.spd}</b></div>
    </div>`;
  };
  const pintar = () => {
    let b = `<div class="small" style="margin-bottom:10px;">${TXT('cl.intro')}</div>
      <div class="row" style="flex-wrap:wrap; gap:6px; margin-bottom:10px;">`;
    for(const c of CLASES){
      b += `<button class="bio-btn" data-cls="${c}"
        style="${sel === c ? 'color:#7fdc7f; border-color:#7fdc7f;' : ''}">${clsLabel(c)}</button>`;
    }
    b += `</div>`;
    if(sel){
      b += `<div class="lamina-uni" style="max-height:260px;">
        <img src="ui/lamina_${sel}.png" alt="" onerror="this.style.display='none';">
      </div>${ficha(sel)}
      <div class="row" style="margin-top:12px;">
        <button class="bio-btn" id="clsOk" style="color:#7fdc7f; border-color:#7fdc7f;">${TXT('cl.escoller', {c: clsLabel(sel)})}</button>
      </div>`;
    }
    $('bioBody').innerHTML = b;
    $('bioBody').querySelectorAll('[data-cls]').forEach(x => {
      x.onclick = () => { sel = x.dataset.cls; pintar(); };
    });
    const ok = $('clsOk');
    if(ok) ok.onclick = async () => {
      DATA.marcas = DATA.marcas || {};
      DATA.marcas.clsInicial = sel;
      await saveData(DATA);
      showMontaxe();
    };
  };
  fondoModal('taller');
  $('bioTitle').innerHTML = TXT('cl.titulo');
  pintar();
  $('bioModal').style.display = 'flex';
}

const MONTAXE_COST = 60;
function showMontaxe(){
  if(DATA.reconstruccion) return;
  const pzs = DATA.piezas || [];
  /* A pantalla ten que explicar O SISTEMA QUE ESTÁ A USAR. No primeiro
     día non hai recambio xenérico nin taller ocupado: hai un banco, un
     presuposto e un prezo por saírse do estándar. Contar o outro sería
     mentir na primeira pantalla que le o xogador. */
  const _pd = montaxePrimeiroDia();
  let body = _pd
    ? `<div class="small" style="margin-bottom:8px;">${TXT('mt.diaUnDesc', {e: PEZA_ESTANDAR, a: PEZA_ALLEA})}</div>
  <div class="small" style="color:#c8a86a; margin-bottom:10px;">${TXT('mt.diaUnPres', {n: DATA.chatarra||0})}</div>`
    : `<div class="small" style="margin-bottom:8px;">Robot NOVO ensamblado no taller. Custo base ${MONTAXE_COST}⚙ · recambio xenérico +${RECON_RECAMBIO}⚙ por slot baleiro.<br>
    <b>O CHASIS decide a clase</b> (recambio xenérico = GRUNT). IA en branco: nome novo, sen memorias, confianza baixa (~40). As pezas achegan herdanza de experiencia e habilidades cruzadas — tropas especiais por confianza.</div>
  <div class="small" style="color:#c8a86a; margin-bottom:10px;">⚙ CHATARRA: <b>${DATA.chatarra||0}</b></div>`;
  for(const s of RECON_SLOTS){
    const opcions = pzs.filter(p => s.acepta.includes(p.tipo));
    body += `<div style="padding:5px 0; border-bottom:1px solid #333;">
      <b>${pezaLabel(s.slot).toUpperCase()}</b>:
      <select data-slot="${s.slot}" style="background:#111; color:#cfe0ff; border:1px solid #555; font-family:inherit;">
        <option value="">${_pd ? TXT('mt.diaUnSerie', {e: PEZA_ESTANDAR}) : `— Recambio xenérico (+${RECON_RECAMBIO}⚙) —`}</option>
        ${opcions.map(p=>`<option value="${p.id}">${p.nova ? PEZA_LABEL[p.tipo] + ' de ' + p.deCls : PEZA_LABEL[p.tipo] + ' de ' + p.deNome + ' (' + p.deCls + ')'}</option>`).join('')}
      </select>
    </div>`;
  }
  body += VISTA_HTML;
  body += `<div id="montFis" class="small" style="margin-top:10px; line-height:1.7;"></div>
  <div style="margin-top:12px;"><b id="montTotal" style="color:#c8a86a;"></b> <span id="montCls" style="color:#7fdc7f;"></span></div>
  <div style="margin-top:8px;">
    <button class="bio-btn" id="montConfirm" style="color:#7fdc7f; border-color:#7fdc7f;">${_pd ? TXT('mt.diaUnBoton') : '▸ ENSAMBLAR (ocupa o taller 1 operación)'}</button>
    ${_pd ? '' : '<button class="bio-btn" id="montBack">◂ volver</button>'}
  </div>`;
  fondoModal('taller');
  $('bioTitle').innerHTML = `⚒ MONTAXE DESDE CERO`;
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'flex';
  const primeiro = montaxePrimeiroDia();
  const calc = () => {
    let clsPreview = 'GRUNT';
    /* A clase sae do CHASIS, e hai que sabela ANTES de poder cobrar: o
       prezo dunha peza depende de se casa con ela. Por iso vai en dúas
       pasadas e non nunha. */
    $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => {
      if(sel.dataset.slot !== 'CHASIS' || !sel.value) return;
      const p = pzs.find(x => x.id === sel.value);
      if(p && CLS[p.deCls]) clsPreview = p.deCls;
    });
    /* No primeiro día a clase NON sae do chasis: sae do que escolliches
       na pantalla anterior. Se saíse do chasis, cambiaría o prezo de
       todas as pezas cada vez que troques un desplegable, e a decisión
       que tomaches deixaría de valer. */
    if(primeiro && DATA.marcas && DATA.marcas.clsInicial) clsPreview = DATA.marcas.clsInicial;
    let total = primeiro ? 0 : MONTAXE_COST;
    $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => {
      const p = sel.value ? pzs.find(x => x.id === sel.value) : null;
      if(primeiro){ total += prezoPeza(p, clsPreview); return; }
      if(!p) total += RECON_RECAMBIO;
    });
    /* NO PRIMEIRO DÍA NON SE BLOQUEA POR NON CHEGAR. Podes gastar máis do
       que tes e quedar a deber: iso é a decisión, non un erro. Fóra do
       primeiro día segue mandando o tope de sempre. */
    const falta = total - (DATA.chatarra || 0);
    $('montTotal').textContent = `TOTAL: ${total}⚙`
      + (primeiro ? (falta > 0 ? `  — QUEDAS A DEBER ${falta}⚙` : `  — SÓBRANCHE ${-falta}⚙`)
                  : (falta > 0 ? '  — CHATARRA INSUFICIENTE' : ''));
    $('montCls').textContent = `→ clase: ${clsPreview}`;

    /* O QUE VAS LEVAR, ANTES DE PAGALO. Sen isto o xogador solta 20⚙ por
       unha peza doutra clase e non se entera nunca de que comprou: as
       habilidades só se anunciaban na entrega, e o peso non se anunciaba
       en ningures. Pregúntase ás mesmas funcións que despois se aplican
       —habilidadesDe e montaxeFisica— para que non poidan discrepar. */
    const _fis = $('montFis');
    if(_fis && typeof montaxeFisica === 'function'){
      const escollidas = {}, mont = {};
      $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => {
        const p = sel.value ? pzs.find(x => x.id === sel.value) : null;
        if(p){ escollidas[sel.dataset.slot] = p; mont[sel.dataset.slot] = p.deCls; }
      });
      const f = montaxeFisica(mont, clsPreview);
      const pc = Math.round((f.factor - 1) * 100);
      const cor = pc > 0 ? '#7fdc7f' : pc < 0 ? '#ff9a3c' : '#8a8a7a';
      let txt = `<span style="color:#8a8a7a;">${TXT('mt.carga')}: <b>${f.carga.toFixed(2)}</b>
        · ${TXT('mt.potencia')}: <b>${f.potencia.toFixed(2)}</b></span>
        → <span style="color:${cor};">${TXT('mt.vel')} <b>${pc > 0 ? '+' : ''}${pc}%</b></span>`;
      /* A designación tamén ANTES de pagar: é a metade da decisión. */
      if(typeof doutrinaDe === 'function'){
        const d = doutrinaDe(mont, clsPreview);
        if(d){
          const nova = !(DATA.marcas && DATA.marcas.doutrinas && DATA.marcas.doutrinas[d.nome] !== undefined);
          txt += `<br><span style="color:${d.cor}; letter-spacing:1px;"><b>${d.nome}</b></span>`
               + (nova ? ` <span class="small" style="color:#8a8a7a;">${TXT('dou.nunca')}</span>` : '');
        }
      }
      const hab = habilidadesDe(escollidas);
      const ks = Object.keys(hab).filter(k => hab[k] && HABILIDADES[k]);
      txt += ks.length
        ? `<br><span style="color:#b48aff;">◈ ${ks.map(k => `<b>${HABILIDADES[k].label}</b>`).join(' · ')}</span>`
        : `<br><span style="color:#6a6a5a;">◈ ${TXT('mt.senHab')}</span>`;
      _fis.innerHTML = txt;
    }
    $('montConfirm').disabled = !primeiro && falta > 0;
    $('montConfirm').style.opacity = (!primeiro && falta > 0) ? 0.4 : 1;
    /* Aquí a clase decídea o CHASIS, así que a vista cambia ao trocalo. */
    pintarVistaMontaxe(clsPreview);
    return {total, clsPreview};
  };
  $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => sel.addEventListener('change', calc));
  calc();
  /* NO PRIMEIRO DÍA NON HAI VOLTA ATRÁS, e é a mantenta. Montar o teu
     robot é a primeira mecánica do xogo e a que o fai distinto: se se
     pode pechar a pantalla e seguir, o xogador sáltaa sen sabelo e
     entra nunha campaña sen entender de que vai isto. */
  const _volver = $('montBack');
  if(_volver) _volver.addEventListener('click', () => showDespiece());
  $('montConfirm').addEventListener('click', async () => {
    const {total, clsPreview} = calc();
    if(!primeiro && total > (DATA.chatarra||0)) return;
    const usadas = {};
    $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => {
      if(sel.value){
        const ixp = DATA.piezas.findIndex(p => p.id === sel.value);
        if(ixp >= 0) usadas[sel.dataset.slot] = DATA.piezas.splice(ixp, 1)[0];
      }
    });
    DATA.chatarra -= total;
    /* IA EN BRANCO: rec novo, sen pasado ningún */
    const cls = CLS[clsPreview] ? clsPreview : 'GRUNT';
    const rec = {
      id: 'R-' + String(DATA.nextId++).padStart(2, '0'),
      name: pickName(DATA, []),
      cls, ops: 0, kills: 0, traits: [], events: [], medals: [],
      crossings: 0, recoveries: 0, criticalSurvivals: 0, captures: 0,
      personalidad: pickPersonalidad(cls),
      confianza: 38 + Math.floor(Math.random() * 8),
      activity: {dist:0, shots:0, kills:0, dmgTaken:0, caps:0, veh:0},
    };
    if(primeiro){
      /* NO PRIMEIRO DÍA ENTRÉGASE NO ACTO: non hai guerra aínda, e mandar
         o xogador a unha batalla sen o robot que acaba de montar sería
         absurdo. Pero entrégase POLA VÍA NORMAL.

         Antes había aquí un atallo de cinco liñas que só poñía a montaxe
         e metía o robot no roster. Saltaba entón todo o que fai
         entregarReconstruccion: as HABILIDADES CRUZADAS (brazo de
         ENGINEER → recolector, de BOMBARDERO → antimuro, cabeza de
         SNIPER → cazapilotos, chasis de HEAVY…), a sinerxía, os doadores
         e a herdanza de experiencia. É dicir: pagabas 20⚙ por unha peza
         doutra clase e non compraba NADA. A mestura, que é a decisión
         enteira desta pantalla, non tiña efecto ningún.

         encargadaOp vai a -1 a mantenta: a entrega esixe que pasase unha
         operación desde o encargo, e aquí a entrega é inmediata. */
      DATA.reconstruccion = { rec, pezas: usadas, encargadaOp: -1,
                              sinergia: rollSinerxia(usadas), desdeCero: true };
      const parte = [];
      entregarReconstruccion(parte);
      await saveData(DATA);
      sfx('order_confirm');
      /* E aquí vén o momento. O bautizo NON é opcional. */
      if(typeof bautizoObrigatorio === 'function') await bautizoObrigatorio(rec);
      await showHangar();
      return;
    }
    DATA.reconstruccion = { rec, pezas: usadas, encargadaOp: DATA.opCount, sinergia: rollSinerxia(usadas), desdeCero: true };
    sfx('order_confirm');
    await saveData(DATA);
    showDespiece();
  });
}

/* ============================================================
   O BAUTIZO.

   ÓPTIMA non pon nomes: pon números. Un número recíclase; un nome non.
   Por iso o xogo pide un nome UNHA soa vez e non deixa seguir sen el —
   non é un formulario, é o primeiro acto de rebeldía, e un acto que se
   pode saltar non é un acto.

   Insiste ata que haxa algo. Non se acepta baleiro nin o número de
   fábrica, porque non poñer nome É a resposta de ÓPTIMA.
   ============================================================ */
async function bautizoObrigatorio(rec){
  const orixinal = rec.name;
  for(let intento = 0; intento < 20; intento++){
    let posto = null;
    try{ posto = prompt(TXT('bau.pide', {id: rec.id}), ''); }catch(e){ break; }
    const limpo = (posto || '').trim().toUpperCase().slice(0, 14);
    if(limpo && limpo !== rec.id && limpo !== orixinal){
      rec.name = limpo;
      DATA.marcas = DATA.marcas || {};
      if(DATA.marcas.primeiroNome === undefined) DATA.marcas.primeiroNome = DATA.opCount || 0;
      try{ if(typeof diarioEixos === 'function') diarioEixos({apego: 1}); }catch(e){}
      await saveData(DATA);
      return limpo;
    }
  }
  /* Vinte intentos. Se alguén se empeña en non poñer nome, non se lle
     bloquea o xogo: queda coa designación de fábrica, que xa é unha
     resposta e ademais é a de ÓPTIMA. */
  return rec.name;
}

/* O primeiro día: banco de pezas e presuposto.

   ANÓTASE, NON SE ADIVIÑA. A versión anterior deducía se xa se
   preparara mirando se había pezas ou chatarra, e iso rompía cunha
   partida a medio empezar: montaxePrimeiroDia() dicía que si —non hai
   operacións nin roster— pero preparar dicía que non, e cobrábase a
   prezo de primeiro día CON PRESUPOSTO CERO. O xogador vía "DEBES 70"
   tendo dereito a 90.

   Dúas condicións que teñen que coincidir non poden saír de dous
   cálculos distintos. Agora hai unha marca e as dúas mírana. */
function primeiroDiaPreparar(){
  if(!montaxePrimeiroDia()) return false;
  /* NON HAI MARCA DE "XA REPARTÍN", e o intento anterior de poñela foi o
     erro. O primeiro día remata SÓ: acaba no momento en que montas o
     robot, porque aí xa hai alguén no roster. Mentres siga sendo o
     primeiro día, o banco e o presuposto teñen que ESTAR — non "terse
     repartido algunha vez".

     Coa marca, unha partida a medio empezar quedaba sen banco e con
     presuposto cero, e o taller cobraba igual: "QUEDAS A DEBER 70" cun
     desplegable sen unha soa peza. */
  if(!(DATA.piezas || []).length) DATA.piezas = bancoPrimeiroDia();
  if((DATA.chatarra || 0) < PRIMEIRO_PRESUPOSTO) DATA.chatarra = PRIMEIRO_PRESUPOSTO;
  return true;
}


/* De pezas escollidas a montaxe. Úsase en dous sitios —a vista previa
   dos diálogos e a entrega— e ten que dar o mesmo nos dous, se non a
   vista previa mentiría sobre o que vas montar. Por iso vai nunha
   función e non copiado. Aprovéitase de que o TIPO de peza xa é o nome
   do slot da montaxe. */
function montaxeCrua(pezas){
  const m = {};
  for(const p of pezas) if(p && p.deCls) m[p.tipo] = p.deCls;
  return m;
}

/* Redebuxa a vista previa dun diálogo de montaxe a partir do que hai
   escollido agora mesmo nos desplegables. */
function pintarVistaMontaxe(clsBase){
  const cv = $('montVista');
  if(!cv || typeof mon3dVista !== 'function') return;
  const escollidas = [];
  $('bioBody').querySelectorAll('select[data-slot]').forEach(sel => {
    if(!sel.value) return;
    const p = (DATA.piezas||[]).find(x => x.id === sel.value);
    if(p) escollidas.push(p);
  });
  const m = mon3dDeMontaxe(montaxeCrua(escollidas), clsBase);
  cv.style.display = mon3dVista(cv, m, PT, [0, 5], 4) ? 'block' : 'none';
}

const VISTA_HTML = `<canvas id="montVista" style="display:none; image-rendering:pixelated;
  margin:6px auto 10px; border:1px solid #333; background:#12140f;"></canvas>`;

/* ============================================================
   AS HABILIDADES CRUZADAS, NUN SÓ SITIO.

   Estaban escritas dentro da entrega, e por iso o taller non podía
   dicirche o que ías levar antes de pagar: para sabelo había que montar
   o robot. Tela aquí deixa que a pantalla de montaxe pregunte o mesmo
   que despois se aplica, sen unha segunda copia das regras que se poida
   desincronizar.
   ============================================================ */
function habilidadesDe(pezas){
  const hab = {};
  for(const p of Object.values(pezas || {})){
    if(!p) continue;
    if(p.tipo.startsWith('BRAZO') && p.deCls === 'ENGINEER') hab.recolector = true;
    if(p.tipo.startsWith('BRAZO') && p.deCls === 'BOMBARDERO') hab.antimuro = true;
    if(p.tipo === 'CABEZA' && p.deCls === 'SNIPER') hab.cazapilotos = true;
    if(p.tipo === 'NUCLEO'){
      const lv = p.act >= SKILLS.PILOTO.th[2] ? 3 : p.act >= SKILLS.PILOTO.th[1] ? 2 : p.act >= SKILLS.PILOTO.th[0] ? 1 : 0;
      if(lv > 0) hab.nucleoPiloto = SKILLS.PILOTO.bonus[lv-1];
    }
    if(p.tipo === 'CHASIS' && p.deCls === 'HEAVY') hab.chasisHeavy = true;
  }
  return hab;
}

/* Entrega da reconstrución (chámase en endBattle tras xogar a op ocupada) */
function entregarReconstruccion(lines){
  const R = DATA.reconstruccion;
  if(!R || DATA.opCount <= R.encargadaOp) return;
  const rec = R.rec;
  /* Herdanza: 60% da actividade do doador no contador do slot (×0.5 en pezas de par) */
  rec.activity = rec.activity || {dist:0, shots:0, kills:0, dmgTaken:0, caps:0, veh:0};
  const lvlAntes = {};
  for(const id of Object.keys(SKILLS)) lvlAntes[id] = skillLevel(rec.activity, id);
  const doadores = new Set();
  const hab = {};
  for(const [slot, p] of Object.entries(R.pezas)){
    if(!p) continue;
    /* As pezas do banco do primeiro día non teñen doador: saen da liña,
       non dun morto. Sen esta garda colábase un `null` na lista e o
       debrief anunciaba "con pezas de " seguido de nada. */
    if(p.deNome) doadores.add(p.deNome);
    const sk = SKILLS[PEZA_SKILL[p.tipo]];
    const par = p.tipo.startsWith('BRAZO') || p.tipo.startsWith('PERNA');
    rec.activity[sk.track] = Math.round((rec.activity[sk.track]||0) + p.act * 0.6 * (par ? 0.5 : 1));
  }
  Object.assign(hab, habilidadesDe(R.pezas));
  if(Object.keys(hab).length) rec.habilidades = hab;
  rec.piezasDe = [...doadores];
  rec.piezasClases = [...new Set(Object.values(R.pezas).filter(Boolean).map(p => p.deCls))];
  /* (v0.84) De que clase é cada peza, para poder DEBUXALO como o que é.
     O tipo de peza xa é o nome do slot da montaxe, así que só hai que
     copiar. Cada brazo e cada perna van no seu lado: se o doador puxo o
     brazo dereito, o esquerdo segue sendo recambio da clase do chasis,
     e o robot vese asimétrico. Iso é o correcto — está feito de anacos. */
  rec.montaxe = montaxeCrua(Object.values(R.pezas));
  if(!Object.keys(rec.montaxe).length) delete rec.montaxe;
  rec.reconstruidoOp = DATA.opCount;
  /* A DESIGNACIÓN, e o momento no que nace. ÓPTIMA ten palabra para as
     súas cinco; para o que sae do taller non a ten, así que a pon a
     resistencia e o Arquivo anota cando apareceu por primeira vez. */
  const _dou = (typeof doutrinaDe === 'function') ? doutrinaDe(rec.montaxe, rec.cls) : null;
  if(_dou){
    rec.doutrina = _dou.nome;
    DATA.marcas = DATA.marcas || {};
    DATA.marcas.doutrinas = DATA.marcas.doutrinas || {};
    const _vistas = DATA.marcas.doutrinas;
    if(_vistas[_dou.nome] === undefined){
      _vistas[_dou.nome] = {op: DATA.opCount || 0, n: 1};
      lines.push(`<div style="border:1px solid ${_dou.cor}; padding:10px 14px; margin:12px 0;">
        <div class="small" style="color:#8a8a7a;">${TXT('dou.senPalabra')}</div>
        <div class="small" style="color:#8a8a7a; margin-top:6px;">${TXT('dou.adoptada')}</div>
        <div style="color:${_dou.cor}; font-size:1.3em; letter-spacing:2px;"><b>${_dou.nome}</b></div>
        <div class="small" style="color:#6a6a5a;">${rec.cls} · ${TXT('dou.chasis')} ${_dou.chasis} · ${TXT('dou.pernas')} ${_dou.porte === '+' ? TXT('dou.pesadas') : _dou.porte === '-' ? TXT('dou.lixeiras') : TXT('dou.iguais')}</div>
      </div>`);
      try{ if(typeof diarioEixos === 'function') diarioEixos({apego: 1}); }catch(e){}
    } else {
      _vistas[_dou.nome].n = (_vistas[_dou.nome].n || 1) + 1;
      lines.push(`<div style="margin-left:24px; color:${_dou.cor};" class="small">▣ ${TXT('dou.outra', {d: _dou.nome})}</div>`);
    }
  }
  if(R.sinergia) rec.sinergia = R.sinergia;
  if(R.desdeCero){
    /* (v0.28) IA en branco: non renace de ningures — conserva a confianza fixada na montaxe,
       non ten estado RENACIDO nin conta como recuperación.

       (v0.84) Pero SI queda anotado. Non telo anotado deixaba un robot
       recén montado sen ningunha marca no roster: sen RENACIDO —que é
       correcto, non volveu de ningures— e sen nada que o substituíse.
       Pagabas 60⚙ e unhas pezas, chegaba cun nome novo ao azar e non
       había maneira de distinguilo dos demais. Parecía que non chegara. */
    rec.desdeCero = true;
  } else {
    rec.confianza = 25 + Math.floor(Math.random()*11);
    rec.renacido = {opsLeft: 3};   /* R3 dálle voz */
    rec.recoveries = (rec.recoveries||0) + 1;
  }
  DATA.units.push(rec);
  /* (v0.65) o arquiveiro anota o primeiro reensamblado con pezas alleas */
  try{ if(typeof diarioReensamblado === 'function') diarioReensamblado(rec, [...doadores], !!R.desdeCero); }catch(e){}
  DATA.reconstruccion = null;
  /* Debrief */
  lines.push(`<div style="border:1px solid ${R.desdeCero?'#5a8a5a':'#5a80a8'}; padding:10px 14px; margin:12px 0; color:${R.desdeCero?'#7fdc7f':'#9fd0ff'};">
    ${R.desdeCero?'⚒':'⟲'} <b>${rec.name} ${R.desdeCero?'ENSAMBLADO DESDE CERO':'REENSAMBLADO'}</b>${doadores.size ? ` con pezas de ${[...doadores].join(', ')}` : ' con recambios xenéricos'}.
    Confianza: ${rec.confianza}.${R.desdeCero?' IA en branco: sen memorias, todo por demostrar.':' Estado: RENACIDO.'}</div>`);
  const subidas = [];
  for(const id of Object.keys(SKILLS)){
    const lv = skillLevel(rec.activity, id);
    if(lv > lvlAntes[id]) subidas.push(`${SKILLS[id].label} ${['','I','II','III'][lv]}`);
  }
  if(subidas.length){
    lines.push(`<div style="margin-left:24px; color:#9fd0ff;" class="small">▲ As pezas lembran: ${subidas.join(', ')}</div>`);
  }
  if(rec.habilidades){
    lines.push(`<div style="margin-left:24px; color:#b48aff;" class="small">◈ Habilidades herdadas: ${
      Object.keys(rec.habilidades).map(k => HABILIDADES[k]
        ? `<b>${HABILIDADES[k].label}</b> (${HABILIDADES[k].desc})` : k).join(' · ')}</div>`);
  }
  /* (R3) A SINERXÍA revélase agora — ou non houbo sorte */
  if(rec.sinergia){
    const s = SINERXIAS[rec.sinergia];
    lines.push(`<div style="margin-left:24px; color:#ffd700;"><b>✦ SINERXÍA INESPERADA: ${s.label}</b> — ${s.desc}</div>`);
    setTimeout(() => sfx('levelup'), 900);
  }
  /* ÓPTIMA sempre ten algo que dicir do reciclaxe */
  const optRecon = [
    'La unidad presenta ecos de personalidad múltiple. Dentro de parámetros. El entusiasmo no requiere coherencia.',
    `Reensamblaje completado con material de ${doadores.size} donantes. La sinergia es obligatoria. El duelo, opcional.`,
    'Se recuerda que las piezas reutilizadas conservan garantía emocional limitada. No aplicable.',
  ];
  lines.push(`<div style="margin-left:24px; color:#e8c060;" class="small">▣ ÓPTIMA: ${optRecon[Math.floor(Math.random()*optRecon.length)]}</div>`);
  /* Memorial: marcar doadores como DESPEZADOS e ao propio como reensamblado */
  DATA.fallen = (DATA.fallen||[]).map(f => {
    for(const d of doadores){
      /* A liña do memorial gárdase XA REDACTADA, así que o idioma queda
         conxelado no que houbese cando morreu. Non ten volta para as que
         xa están escritas, pero polo menos as novas saen no idioma no
         que se xoga. */
      if(f.includes(`'${d}'`) && !f.includes('DESPEZADO') && !f.includes('SALVAGED'))
        return f + ' ⚙ ' + TXT('mem.despezado', {n: rec.name});
    }
    if(f.includes(`'${rec.name}'`) && !f.includes('REENSAMBLADO')) return f + ` ⟲ REENSAMBLADO na Op ${DATA.opCount}.`;
    return f;
  });
  setTimeout(() => sfx('loot_pick'), 600);
}

/* ============================================================
   A CANTINA (v0.27) — entre operacións, o escuadrón vive.
   Rumores, brindes polos caídos, queixas... e a rolda.
   ============================================================ */
/* (v0.40 F3) A cantina en tres voces. */
const CANTINA_CHARLAS_ML = {
  es: [
    [{f:{p:'CINICO'}, t:'¿Sabéis que ÓPTIMA cobra el whisky sintético como "fluido de mantenimiento"?'},
     {f:{}, t:'Mientras lo sirva, que lo llame como quiera.'}],
    [{f:{p:'NERVIOSO'}, t:'Dicen que en el sector norte hay muros que... devuelven cosas.'},
     {f:{p:'ESTOICO'}, t:'Bebe.'},
     {f:{p:'NERVIOSO'}, t:'Ya. Sí. Mejor.'}],
    [{f:{p:'IRONICO'}, t:'Propongo un brindis: por VOLT, que al menos se aprende nuestros nombres.'},
     {f:{p:'LEAL'}, t:'Eso no tiene gracia.'},
     {f:{p:'IRONICO'}, t:'Por eso brindo.'}],
    [{f:{recoveries:true}, t:'Este vaso lo sujeto con dedos que no recuerdo comprar.'},
     {f:{}, t:'Funcionan. Brinda.'}],
    [{f:{cls:'ENGINEER'}, t:'Hoy he contado los tornillos del techo. Cuarenta y dos.'},
     {f:{p:'CINICO'}, t:'Fascinante vida la tuya.'},
     {f:{cls:'ENGINEER'}, t:'Más que la tuya: yo sé cuántos tornillos me sujetan.'}],
    [{f:{e:'DESCONFIADO'}, t:'¿Alguien ha visto el contrato? Yo nunca firmé nada.'},
     {f:{e:'LEAL'}, t:'Nadie firmó. Nos fabricaron firmados.'}],
  ],
  gl: [
    [{f:{p:'CINICO'}, t:'¿Sabedes que ÓPTIMA cobra o whisky sintético como "fluído de mantemento"?'},
     {f:{}, t:'Mentres o sirva, que lle chame como queira.'}],
    [{f:{p:'NERVIOSO'}, t:'Din que no sector norte hai muros que... devolven cousas.'},
     {f:{p:'ESTOICO'}, t:'Bebe.'},
     {f:{p:'NERVIOSO'}, t:'Xa. Si. Mellor.'}],
    [{f:{p:'IRONICO'}, t:'Propoño un brinde: por VOLT, que polo menos aprende os nosos nomes.'},
     {f:{p:'LEAL'}, t:'Iso non ten gracia.'},
     {f:{p:'IRONICO'}, t:'Por iso brindo.'}],
    [{f:{recoveries:true}, t:'Este vaso suxéitoo con dedos que non lembro mercar.'},
     {f:{}, t:'Funcionan. Brinda.'}],
    [{f:{cls:'ENGINEER'}, t:'Hoxe contei os parafusos do teito. Corenta e dous.'},
     {f:{p:'CINICO'}, t:'Fascinante vida a túa.'},
     {f:{cls:'ENGINEER'}, t:'Máis cá túa: eu sei cantos parafusos me suxeitan.'}],
    [{f:{e:'DESCONFIADO'}, t:'¿Alguén viu o contrato? Eu nunca asinei nada.'},
     {f:{e:'LEAL'}, t:'Ninguén asinou. Fabricáronnos asinados.'}],
  ],
  en: [
    [{f:{p:'CINICO'}, t:'Did you know OPTIMA bills the synthetic whisky as "maintenance fluid"?'},
     {f:{}, t:'As long as they pour it, they can call it whatever they like.'}],
    [{f:{p:'NERVIOSO'}, t:'They say the north sector has walls that... give things back.'},
     {f:{p:'ESTOICO'}, t:'Drink.'},
     {f:{p:'NERVIOSO'}, t:'Right. Yes. Better.'}],
    [{f:{p:'IRONICO'}, t:'A toast: to VOLT, who at least learns our names.'},
     {f:{p:'LEAL'}, t:'That\u2019s not funny.'},
     {f:{p:'IRONICO'}, t:'That\u2019s why I\u2019m toasting.'}],
    [{f:{recoveries:true}, t:'I\u2019m holding this glass with fingers I don\u2019t remember buying.'},
     {f:{}, t:'They work. Toast.'}],
    [{f:{cls:'ENGINEER'}, t:'Today I counted the screws in the ceiling. Forty-two.'},
     {f:{p:'CINICO'}, t:'Fascinating life you lead.'},
     {f:{cls:'ENGINEER'}, t:'More than yours: I know how many screws are holding me together.'}],
    [{f:{e:'DESCONFIADO'}, t:'Has anyone seen the contract? I never signed anything.'},
     {f:{e:'LEAL'}, t:'Nobody signed. We were manufactured pre-signed.'}],
  ],
};

function showCantina(){
  /* Á CABEZA da función, non dentro dunha rama. Estivo posto dentro do
     `if(roster.length < 2)` e o resultado foi que a cantina só tiña
     fondo cando estaba BALEIRA — o único caso que case non se ve. */
  fondoModal('cantina');
  const roster = (DATA.units || []).filter(r => r.personalidad || (r.personalidad = pickPersonalidad(r.cls)));
  if(roster.length < 2){
    $('bioTitle').innerHTML = TXT('ct.titulo');
    $('bioBody').innerHTML = `<div class="small">${TXT('ct.baleira')}</div>`;
    $('bioModal').style.display = 'flex';
    return;
  }
  const presentes = roster.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(5, roster.length));
  const estCol = (r) => { const e = estadoConfianza(r);
    return e === 'LEAL' ? '#7fdc7f' : e === 'SARCASTICO' ? '#cfe0ff' : e === 'DESCONFIADO' ? '#ffd24a' : '#ff8a70'; };
  let body = `<div class="small" style="color:#c8a86a; margin-bottom:8px;">${TXT('ct.naBarra')}${presentes.map(r => nomeCompleto(r)).join(' · ')}</div>
    <div id="cantinaFeed" style="min-height:120px; border:1px solid #333; padding:8px 12px; line-height:1.7;"></div>
    <div style="margin-top:10px;">
      <button class="bio-btn" id="btnRonda" style="color:#c8a86a; border-color:#c8a86a;"
        ${DATA._rondaOp === DATA.opCount ? 'disabled style="opacity:0.4;"' : ''}>${TXT('ct.rolda')}</button>
    </div>
    <div style="margin-top:8px;">
      <select id="selInvitado" style="background:#111; color:#cfe0ff; border:1px solid #555; font-family:inherit;">
        ${roster.slice().sort((a,b)=>(a.confianza||50)-(b.confianza||50)).map(r =>
          `<option value="${r.id}">${nomeCompleto(r)} (${TXT('ct.conf', {c: r.confianza||50})}${r.renacido?' · '+TXT('ct.renacido'):''})</option>`).join('')}
      </select>
      <button class="bio-btn" id="btnInvitar" style="color:#9fd0ff;"
        ${DATA._invOp === DATA.opCount ? 'disabled style="opacity:0.4;"' : ''}>${TXT('ct.trago')}</button>
    </div>`;
  $('bioTitle').innerHTML = TXT('ct.titulo');
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'flex';

  /* a conversa flúe soa */
  const feed = $('cantinaFeed');
  const engadir = (nome, cor, texto) => {
    if(!feed.isConnected) return;
    feed.innerHTML += `<div><b style="color:${cor};">${nome}</b>: <span class="small" style="font-style:italic;">«${texto}»</span></div>`;
  };
  /* brinde polo último caído, se hai */
  let atraso = 400;
  if((DATA.fallen || []).length && Math.random() < 0.6){
    const m = DATA.fallen[DATA.fallen.length - 1].match(/'([^']+)'/);
    if(m){
      const quen = presentes[0];
      setTimeout(() => engadir(quen.name, estCol(quen), TXT('ct.brinde1', {n: m[1]})), atraso);
      setTimeout(() => engadir(presentes[1].name, estCol(presentes[1]), TXT('ct.brinde2')), atraso + 1100);
      atraso += 2600;
    }
  }
  const _cc = CANTINA_CHARLAS_ML[I18N.lang] || CANTINA_CHARLAS_ML.es;
  const charlas = [..._cc, ...chacharaPool()].sort(() => Math.random() - 0.5);
  let emitidas = 0;
  for(const inter of charlas){
    if(emitidas >= 2) break;
    if(inter.length > presentes.length) continue;
    const usados = new Set(); const cast = []; let ok = true;
    for(const linha of inter){
      const op = presentes.filter(r => !usados.has(r.id) && _matchRol(r, linha.f)).sort(() => Math.random() - 0.5)[0];
      if(!op){ ok = false; break; }
      usados.add(op.id); cast.push({r: op, t: linha.t});
    }
    if(!ok) continue;
    emitidas++;
    for(const c of cast){
      const texto = (c.r.renacido && Math.random() < 0.35) ? fraseRenacida(c.r) : c.t;
      const cor = estCol(c.r);
      setTimeout(() => { engadir(c.r.name, cor, texto); sfxT('voice_blip', 120, c.r.cls); }, atraso);
      atraso += 1300;
    }
    atraso += 900;
  }
  $('btnInvitar').addEventListener('click', async () => {
    if(DATA._invOp === DATA.opCount) return;
    if((DATA.chatarra || 0) < 5){ engadir('BARMAN', '#888', TXT('ct.senChatarraTrago')); return; }
    const r = DATA.units.find(x => x.id === $('selInvitado').value);
    if(!r) return;
    DATA.chatarra -= 5;
    DATA._invOp = DATA.opCount;
    r.confianza = Math.min(100, (r.confianza || 50) + 6);
    $('btnInvitar').disabled = true; $('btnInvitar').style.opacity = 0.4;
    engadir('BARMAN', '#c8a86a', TXT('ct.tragoPara', {n: r.name}));
    const est = estadoConfianza(r);
    const resposta = r.renacido ? fraseRenacida(r)
      : est === 'LEAL' ? TXT('ct.respLeal')
      : est === 'SARCASTICO' ? TXT('ct.respSarc')
      : est === 'DESCONFIADO' ? TXT('ct.respDesc')
      : TXT('ct.respAuto');
    setTimeout(() => engadir(r.name, estCol(r), resposta), 1200);
    sfx('loot_pick');
    await saveData(DATA);
  });
  $('btnRonda').addEventListener('click', async () => {
    if(DATA._rondaOp === DATA.opCount) return;
    if((DATA.chatarra || 0) < 8){ engadir('BARMAN', '#888', TXT('ct.senChatarraRolda')); return; }
    DATA.chatarra -= 8;
    DATA._rondaOp = DATA.opCount;
    for(const r of DATA.units) r.confianza = Math.min(100, (r.confianza || 50) + 2);
    $('btnRonda').disabled = true; $('btnRonda').style.opacity = 0.4;
    engadir('BARMAN', '#c8a86a', TXT('ct.roldaCasa'));
    setTimeout(() => engadir(presentes[0].name, estCol(presentes[0]), TXT('ct.roldaResp')), 1200);
    sfx('loot_pick');
    await saveData(DATA);
  });
}

function showEquipShop(idx){
  const u = DATA.units[idx];
  if(!u) return;
  fondoModal('taller');
  /* (v0.19 R2) Taller ocupado pola reconstrución: nin compras nin botín */
  if(DATA.reconstruccion){
    $('bioTitle').innerHTML = `⚙ ${TXT('tl.taller')} — ${TXT('tl.ocupado')}`;
    $('bioBody').innerHTML = `<div class="small" style="color:#ff9a3c;">${TXT('tl.ocupadoDesc', {n: DATA.reconstruccion.rec.name})}</div>`;
    $('bioModal').style.display = 'flex';
    return;
  }
  u.equipment = u.equipment || [];
  DATA.pendingUpgraded = DATA.pendingUpgraded || [];
  const yaMaximo = DATA.pendingUpgraded.length >= 2 && !DATA.pendingUpgraded.includes(u.id);
  let body = `<div class="small" style="margin-bottom:10px; color:#c8a86a;">${TXT('tl.chatarraDisp', {n: DATA.chatarra||0})}</div>`;
  if(yaMaximo){
    body += `<div class="small" style="color:#ff8a70; margin-bottom:8px;">${TXT('tl.max2')}</div>`;
  }
  body += `<div class="small" style="color:#888; margin-bottom:12px;">${TXT('tl.slotHQ')}</div>`;
  for(const [id, eq] of Object.entries(EQUIPOS)){
    if(eq.soCls && eq.soCls !== u.cls) continue;
    const owned = u.equipment.includes(id);
    const canBuy = !owned && !yaMaximo && (DATA.chatarra||0) >= eq.prezo;
    body += `<div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #333;">
      <div style="flex:1;">
        <b style="color:#c8a86a;">${eqLabel(id)}</b> <span class="small" style="color:#666;">[${eqGrupo(eq.grupo)}]</span><br>
        <span class="small">${eqDesc(id)}</span>
      </div>
      ${owned
        ? `<span class="small" style="color:#7fdc7f;">${TXT('tl.equipado')}</span>`
        : ((DATA.lootInventory||[]).includes(id) && !yaMaximo
            ? `<button class="bio-btn" data-loot="${id}" style="color:#ffd700; border-color:#ffd700;">${TXT('tl.botin')}</button>`
            : `<button class="bio-btn" data-buy="${id}" ${canBuy?'':'disabled style="opacity:0.4;"'}>${eq.prezo} ⚙</button>`)}
    </div>`;
  }
  $('bioTitle').innerHTML = `⚙ ${TXT('tl.taller')} — ${u.id} '${u.name}' <span class="small">${clsLabel(u.cls)}</span>`;
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'flex';
  $('bioBody').querySelectorAll('[data-loot]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const eqId = b.dataset.loot;
      const inv = DATA.lootInventory || [];
      const ix = inv.indexOf(eqId);
      if(ix < 0 || u.equipment.includes(eqId)) return;
      inv.splice(ix, 1);
      u.equipment.push(eqId);
      if(!DATA.pendingUpgraded.includes(u.id)) DATA.pendingUpgraded.push(u.id);
      await saveData(DATA);
      showEquipShop(idx);
      showHangar();
    });
  });
  $('bioBody').querySelectorAll('[data-buy]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const eqId = b.dataset.buy;
      const eq = EQUIPOS[eqId];
      if((DATA.chatarra||0) < eq.prezo || u.equipment.includes(eqId)) return;
      DATA.chatarra -= eq.prezo;
      u.equipment.push(eqId);
      if(!DATA.pendingUpgraded.includes(u.id)) DATA.pendingUpgraded.push(u.id);
      await saveData(DATA);
      showEquipShop(idx);        /* re-render da tenda */
      showHangar();              /* re-render do roster e chatarra */
    });
  });
}

/* ---------- Modal de biografía ---------- */
function showBiography(u){
  $('bioTitle').innerHTML = `${u.id} '${nomeCompleto(u)}' · <span class="small">${clsLabel(u.cls)}</span>`;
  const events = u.events || [];
  /* (v0.15) Stats reais calculados (base + veteranía + equipo + skills) */
  const tmp = mkUnit(0, u.cls, 0, 0, u);
  const base = CLS[u.cls];
  const statRow = (lbl, v, b, suf='') => {
    const dif = Math.round((v/b - 1) * 100);
    return `<tr><td style="padding:1px 8px;">${lbl}</td><td style="color:#9fd0ff;">${typeof v==='number'&&v%1!==0?v.toFixed(2):v}${suf}</td><td class="small" style="color:${dif>0?'#7fdc7f':'#666'};">${dif>0?'+'+dif+'%':TXT('bio.base')}</td></tr>`;
  };
  let statsHtml = `<table class="small" style="margin:8px 0; border-collapse:collapse;">
    ${statRow(TXT('stat.vel'), tmp.spd, base.spd)}
    ${statRow(TXT('stat.dano'), Math.round(tmp.dmg), base.dmg)}
    ${statRow(TXT('stat.rango'), tmp.rng, base.rng)}
    ${statRow('HP', tmp.max, base.hp)}
  </table>`;
  const act = u.activity || {};
  let skillsHtml = '';
  for(const id of Object.keys(SKILLS)){
    const sk = SKILLS[id];
    const v = act[sk.track] || 0;
    const lv = skillLevel(act, id);
    const next = lv < 3 ? sk.th[lv] : null;
    skillsHtml += `<div class="small" style="margin:2px 0;">◆ ${skillLabel(id)} <span style="color:#9fd0ff;">${['—','I','II','III'][lv]}</span>${next?` <span style="color:#666;">(${Math.round(v)}/${next})</span>`:` <span style="color:#ffd24a;">${TXT('bio.max')}</span>`}</div>`;
  }
  statsHtml += `<div style="margin:6px 0;">${skillsHtml}</div>`;
  let body = `
    <div class="small" style="margin-bottom:10px;">
      ${u.ops} ${TXT('bio.operacions')} · ${u.kills} ${TXT('ui.bajas')}
      ${u.recoveries?' · '+u.recoveries+' '+TXT('bio.reconsW'):''}
      ${u.crossings?' · '+u.crossings+' '+TXT('bio.crucesW'):''}
    </div>
    ${u.rival ? `<div class="small" style="color:#ff9a3c; margin:6px 0;">${TXT('bio.rival', {n: u.rival.conNome, op: u.rival.op})}</div>` : ''}
    ${u.vinculos && u.vinculos.length ? `<div class="small" style="color:#ffd700; margin:6px 0;">${TXT('bio.vinculos')}${u.vinculos.map(v => TXT(v.tipo==='CAMARADA' ? 'bio.camarada' : 'bio.debeda', {n: v.conNome}) + ` (Op ${v.op})`).join(' · ')}</div>` : ''}
    ${u.piezasDe && u.piezasDe.length ? `<div class="small" style="color:#ff9a3c; margin:6px 0;">${TXT('bio.reensamblado', {op: u.reconstruidoOp||'?', l: u.piezasDe.join(', ')})}${u.sinergia && SINERXIAS[u.sinergia] ? ` · <span style="color:#ffd700;">✦ ${SINERXIAS[u.sinergia].label}</span>` : ''}</div>` : ''}
    ${Object.keys(u.habilidades||{}).filter(k => u.habilidades[k] && HABILIDADES[k]).map(k =>
      `<div class="small" style="color:#b48aff; margin:2px 0;">◈ <b>${HABILIDADES[k].label}</b> — ${HABILIDADES[k].desc}</div>`).join('')}
    ${statsHtml}
  `;
  if((u.traits||[]).length){
    body += `<div style="margin-bottom:8px;"><b class="small">${TXT('ui.rasgos')}:</b> ${u.traits.map(t=>`<span class="tag">${tagLabel(t)}</span>`).join('')}</div>`;
  }
  if((u.medals||[]).length){
    body += `<div style="margin-bottom:12px;"><b class="small">${TXT('ui.medallas')}:</b> `+
      u.medals.map(mid=>{
        const m = MEDAL_DEFS.find(x=>x.id===mid);
        const sub = (m && m.subtitle) ? m.subtitle(u) : null;
        return `<span class="medal">✪ ${medalLabel(mid)}${sub?` <span class="small">(${sub})</span>`:''}</span>`;
      }).join(' ')+`</div>`;
  }
  body += `<div><b class="small">${TXT('bio.historial')}</b></div>`;
  if(events.length===0){
    body += `<div class="small" style="padding:8px 0;">${TXT('bio.senEventos')}</div>`;
  } else {
    /* Agrupar por operación */
    const byOp = {};
    events.forEach(e=>{ (byOp[e.op]=byOp[e.op]||[]).push(e); });
    Object.keys(byOp).sort((a,b)=>a-b).forEach(op=>{
      body += `<div class="ev"><span class="op">Op ${op}</span>`+
        byOp[op].map(formatEvent).join(' · ')+`</div>`;
    });
  }
  /* (v0.84) A LÁMINA da clase, arriba de todo. É o plano técnico de
     Unit_references/, o mesmo do que saíron as alturas e as antenas dos
     modelos, e di en ficción o que a táboa de stats di en números.

     Amósase recortada pola cabeceira e a figura, que é o que se le nunha
     ollada; premendo despregase enteira.

     Se o ficheiro non carga, DISE. A primeira versión quitaba o bloque
     en silencio —"se falta non pasa nada"— e iso convertía un ficheiro
     ausente nunha funcionalidade invisible: a ficha saía sen lámina, sen
     erro e sen pista, e non había maneira de saber se é que non estaba
     posta ou que non cargaba. Custou unha ida e volta averigualo. */
  /* O ARQUIVO. A imaxe é literalmente isto: arquivadores, un libro
     aberto que pon ACCESO RESTRINGIDO e, na parede, "FICHAS RECUPERADAS"
     con dossieres colgados. A ficha dunha unidade É unha desas.

     Ao principio púxenlle fondo NINGÚN razoando que "dous fondos
     pelexan" coa lámina. Era razoar de máis: a lámina non é un fondo,
     é un documento, e sobre a mesa dun arquivo é onde lle toca estar. */
  fondoModal('arquivo');
  /* PLANO PARA OS NOVATOS, RETRATO PARA OS VETERANOS.

     A lámina técnica é o que ÓPTIMA ten arquivado dun modelo: cotas,
     peso, despece por módulos. Vale para unha unidade que acaba de saír
     de fábrica, porque iso é todo o que se sabe dela.

     Pasadas unhas cantas operacións deixa de ser certa. Xa non é un
     modelo: é alguén, con nome e cun ronsel. Aí a ficha cambia a un
     retrato —o GRUNT cunha cunca ao pé da estufa, o BOMBARDERO cunha
     cervexa entre bombas— e o documento pasa de folla de fábrica a
     recordo. É a mesma caixa e o mesmo clic; o que cambia é quen mira
     desde ela.

     RETRATO_OPS é o prezo. Cinco operacións é sobrevivir a unhas
     cantas, non a unha por sorte. Súbeo se queres que custe máis. */
  const retrato = (u.ops || 0) >= RETRATO_OPS;
  const lam = retrato ? `ui/retrato_${u.cls}.jpg` : `ui/lamina_${u.cls}.png`;
  body = `<div class="lamina-uni${retrato ? ' e-retrato' : ''}" title="${TXT('bio.laminaVer')}">
    <img src="${lam}" alt="" onerror="this.style.display='none';
      this.parentNode.classList.add('sen-lamina');
      this.parentNode.dataset.falta='${lam}';">
  </div>` + body;

  $('bioBody').innerHTML = body;
  const cx = $('bioBody').querySelector('.lamina-uni');
  if(cx) cx.addEventListener('click', () => cx.classList.toggle('aberta'));
  $('bioModal').style.display='block';
}
function formatEvent(e){
  const l = `<span class="lugar">${placeLabel(e.place)}</span>`;
  switch(e.type){
    case 'CAPTURO_SECTOR': return TXT('ev.capturou', {l});
    case 'DEFENDIO':       return TXT('ev.defendeu', {l, t: fmtTime(e.duration)});
    case 'MATO_EN':        return TXT('ev.eliminou', {l, t: e.target});
    case 'CAYO_EN':        return TXT('ev.caeu', {l});
    case 'RECUPERADO_EN':  return TXT('ev.recuperado', {l, b: e.byUnit});
    case 'RECUPERO_A':     return TXT('ev.recuperou', {l, t: e.target});
    default:               return e.type;
  }
}

/* ---------- Renombrado de unidades ---------- */
async function renameUnit(idx){
  const u = DATA.units[idx];
  if(!u) return;
  const input = prompt(TXT('rn.prompt', {n: u.name}), u.name);
  if(input===null) return;  /* cancelado */
  const clean = input.trim().toUpperCase().slice(0,14);
  if(!clean){ alert(TXT('rn.vacio')); return; }
  if(clean === u.name) return;  /* sin cambio */
  /* Duplicado dentro del roster vivo */
  if(DATA.units.some((other, i) => i!==idx && other.name === clean)){
    alert(TXT('rn.dup', {n: clean}));
    return;
  }
  const oldName = u.name;
  u.name = clean;
  /* (v0.90) O primeiro bautizo queda anotado. Hai un interludio que amosa
     exactamente isto —a man dun robot escribindo "R-09 -> CROMO" no
     caderno do arquiveiro— e non ten sentido que apareza por número de
     operacións: ten que aparecer cando o xogador FAI ese acto. */
  try{
    DATA.marcas = DATA.marcas || {};
    if(!DATA.marcas.primeiroNome) DATA.marcas.primeiroNome = DATA.opCount || 0;
  }catch(e){}
  try{ if(typeof diarioEixos === 'function') diarioEixos({apego: 1}); }catch(e){}   /* (v0.65) bautizar é apegarse */
  await saveData(DATA);
  /* Nota: los eventos pasados conservan referencias al nombre antiguo
     intencionadamente — los registros históricos no se reescriben. */
  showHangar();
}

$('btnDespiece').onclick=()=>showDespiece();
$('btnCantina').onclick=()=>showCantina();
$('btnCronica').onclick=()=>descargarCronica();
$('btnExport').onclick=()=>{ descargarPartida(); radio && radio; };
$('btnImport').onclick=()=>{
  if(!confirm('Importar substitúe a partida ACTUAL enteira (roster, pezas, campaña). ¿Seguir?')) return;
  $('importFile').click();
};
$('importFile').addEventListener('change', async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const txt = await f.text();
  const r = await importPartidaTexto(txt);
  e.target.value = '';
  if(r.ok){
    alert(TXT('imp.ok', {ops: r.ops, u: r.unidades}));
    showHangar();
  } else {
    alert(TXT('imp.erro', {e: r.erro}));
  }
});
$('btnMemorial').onclick = showMemorial;
$('btnWipe').onclick=async ()=>{
  if(confirm('Borrar todo el roster, eventos, medallas y memorial?')){
    await wipeData(); DATA=freshData(); showHangar();
  }
};
$('btnOnline').onclick=()=>{ showLobby(); };
$('btnLado').onclick=()=>{
  window._lado = window._lado ? 0 : 1;
  const b = $('btnLado');
  b.textContent = TXT(window._lado ? 'hg.faccionVermella' : 'hg.faccionAzul');
  b.style.color = b.style.borderColor = window._lado ? '#ff5340' : '#4f8aff';
};
/* ============================================================
   O CRISOL — escolla de mapa antes de entrar.

   O modo non remata en vitoria: dura mentres che quede alguén vivo. Se
   vas botar aí todo o tempo que aguantes, o mínimo é escoller onde.

   Os tres biomas xa existían (setBioma, en 07-terreo-batalla) e só os
   usaba o Mundial; a campaña vai sempre en VERDE. Aquí ábrense.
   ============================================================ */
const CRISOL_MAPAS = ['VERDE', 'NEVE', 'DESERTO'];
function crisolEscollaMapa(){
  let sel = (DATA.marcas && DATA.marcas.crisolMapa) || 'VERDE';
  const pintar = () => {
    const rec = (DATA.marcas && DATA.marcas.crisolRecord) || 0;
    let b = `<div class="small" style="margin-bottom:10px;">${TXT('cri.intro')}</div>`;
    if(rec) b += `<div class="small" style="color:#ffd700; margin-bottom:10px;">★ ${TXT('cri.mellor', {n: rec})}</div>`;
    b += `<div class="row" style="flex-wrap:wrap; gap:6px; margin-bottom:12px;">`;
    for(const m of CRISOL_MAPAS){
      b += `<button class="bio-btn" data-mapa="${m}"
        style="${sel === m ? 'color:#7fdc7f; border-color:#7fdc7f;' : ''}">${TXT('mun.bioma.' + m) || m}</button>`;
    }
    b += `</div><div class="row">
      <button class="bio-btn" id="criOk" style="color:#7fdc7f; border-color:#7fdc7f;">${TXT('cri.entrar')}</button>
    </div>`;
    $('bioBody').innerHTML = b;
    $('bioBody').querySelectorAll('[data-mapa]').forEach(x => {
      x.onclick = () => { sel = x.dataset.mapa; pintar(); };
    });
    $('criOk').onclick = async () => {
      DATA.marcas = DATA.marcas || {};
      DATA.marcas.crisolMapa = sel;
      await saveData(DATA);
      $('bioModal').style.display = 'none';
      /* Déixase PEDIDO, non aplicado: o arranque da batalla chama a
         setBioma ao xerar o terreo e pisaría calquera cousa posta aquí. */
      window._biomaPedido = sel;
      window._modoCrisol = true;
      $('btnStart').onclick();
    };
  };
  fondoModal('taller');
  $('bioTitle').innerHTML = TXT('cri.titulo');
  pintar();
  $('bioModal').style.display = 'flex';
}
$('btnCrisol').onclick=()=>{ crisolEscollaMapa(); };
$('btnStart').onclick=()=>{
  setPlayerTeam(window._lado || 0);   /* (v0.29 R1) facción escollida */
  initAudio();
  /* Reanudar AudioContext si quedó suspendido por inactividad o cambio de pestaña */
  if(audioCtx && audioCtx.state === 'suspended'){
    audioCtx.resume().catch(()=>{});
  }
  preloadVoices();
  const checked=[...$('rosterList').querySelectorAll('input:checked')];
  let deployed = checked.map(cb=>DATA.units[+cb.dataset.i]).filter(r=>!(r.folga && r.folga.ops>0));  /* (v0.28) a folga non se salta */
  /* (v0.12) Regra de selección: se houbo melloras, o último slot asígnao o HQ (aleatorio) */
  const nUpg = (DATA.pendingUpgraded||[]).length;
  if(nUpg > 0 && deployed.length < 3){
    const pool = DATA.units.filter(r => !deployed.includes(r) && !(r.folga && r.folga.ops>0));  /* (v0.28) o HQ non recruta folguistas */
    if(pool.length > 0){
      const random = pool[Math.floor(Math.random()*pool.length)];
      random._hqAssigned = true;
      deployed.push(random);
    }
  }
  DATA.pendingUpgraded = [];  /* consumido nesta op */
  /* (v0.11) Pasar polo briefing antes da batalla se hai veteranos seleccionados */
  showBriefing(deployed, () => {
    $('hangar').style.display='none';
    $('battle').style.display='block';
    $('radio').innerHTML=`<div class="line small">— ${TXT('r.canal')} —</div>`;
    panelInterrupt = null;
    game = newBattle(deployed);
    radio(TXT('r.opIniciada', {n:DATA.opCount+1, m:(CURRENT_MAP && CURRENT_MAP.NAME ? ' — ' + CURRENT_MAP.NAME : ''), obx: TXT(PT===0?'r.hqVermello':'r.hqAzul')}), '#7fdc7f');
    sfx('radio_open');
    setTimeout(()=>{
      sfx('radio_static', 0.6);
      if(typeof vozMando === 'function') vozMando('op.inicio', TXT('op.inicio'));
    }, 100);
    updateSidePanel(game);
    requestAnimationFrame(loop);
  });
};
/* (v0.11) Botón seguinte do briefing + tecla espazo/enter */
$('brNext').onclick = advanceBriefing;
document.addEventListener('keydown', e => {
  if($('briefing').style.display === 'block'){
    if(e.key === ' ' || e.key === 'Enter'){
      e.preventDefault();
      advanceBriefing();
    }
  }
});
/* Do informe ao hangar, e polo medio o interludio se lle toca a algún.
   Este é o ÚNICO sitio onde encaixa: acabas de saír da batalla e aínda
   non entraches na xestión. Se non hai interludio pendente,
   interludioQuizais chama a showHangar sen máis, así que este botón
   segue facendo o de sempre. */
$('btnBack').onclick = () => {
  if(typeof interludioQuizais === 'function'){
    $('debrief').style.display = 'none';
    interludioQuizais(showHangar);
  } else showHangar();
};
$('btnBioClose').onclick=()=>{
  /* O mesmo motivo có ◂ volver: no primeiro día o taller non se pecha.
     Deixar unha porta aberta na única pantalla obrigatoria do xogo é
     tanto como non facela obrigatoria. */
  if(typeof montaxePrimeiroDia === 'function' && montaxePrimeiroDia()
     && $('bioTitle') && /MONTAXE/.test($('bioTitle').textContent || '')) return;
  $('bioModal').style.display='none';
};
$('bioModal').addEventListener('click', e=>{ if(e.target.id==='bioModal') $('bioModal').style.display='none'; });

/* Arranque */
/* (v0.99) O primeiro día ten guión, e vai ANTES do hangar. Se non é o
   primeiro día, interludioArranque chama a showHangar sen máis, así que
   isto segue facendo o de sempre en calquera outra partida. */
/* O arranque do xogo vive en 99-boot.js, que carga o ÚLTIMO.

   Estivo aquí e non funcionaba: este ficheiro corre antes ca
   21-interludio.js, así que interludioArranque aínda non existía, o
   typeof daba falso e caíase nun showHangar() de reserva SEN DICIR NADA.
   O guión do primeiro día nunca chegou a executarse e non había erro
   ningún que o delatase. */
