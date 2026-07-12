/* ============================================================
   (v0.31 R3) BATALLA SINCRONIZADA — host-autoritaria.
   HOST: simula todo, publica snap ~5/s, consome as ordes do rival,
         e ao rematar publica o informe final (fin).
   CONVIDADO: renderiza o snap, calcula a SÚA néboa en local,
         manda ordes de movemento/produción, e procesa o seu
         roster co informe final na súa máquina.
   ============================================================ */
window._pvp = null;   /* {rol, net, sala, snapPend, ordenBuf, procesadas, finFeito, unsub} */
/* (v0.37) TELEMETRÍA: fitos do protocolo, visibles en consola e gardados */
function pvpLog(msg){
  window._pvpTrace = window._pvpTrace || [];
  window._pvpTrace.push(Date.now() + ' ' + msg);
  if(window._pvpTrace.length > 40) window._pvpTrace.shift();
  console.log('[PVP]', msg);
}
/* (v0.39) Desmontaxe SÓ da batalla: morren os listeners de snap/orden/fin
   e o estado de combate, pero a SALA e o LOBBY seguen vivos — a serie continúa. */
function pvpDesmontarBatalla(){
  pvpLog('desmontaxe de batalla (a serie segue)');
  const P = window._pvp;
  if(P && P.unsub) P.unsub.forEach(f => { try{ f && f(); }catch(e){} });
  if(window._pvpVixia){ clearTimeout(window._pvpVixia); window._pvpVixia = null; }
  window._pvp = null;
}

/* (v0.39) PANEL DE REVANCHA — entre batallas: elixe escuadrón, LISTO, conta atrás */
function showPvpRevancha(datos, rol){
  let el = document.getElementById('pvpRevancha');
  if(!el){
    el = document.createElement('div');
    el.id = 'pvpRevancha';
    el.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); z-index:250;' +
      'background:#101418; border:2px solid #ffd24a; padding:10px 16px; font-family:Courier New,monospace;' +
      'color:#cfe0ff; box-shadow:0 0 18px rgba(255,210,74,0.25); text-align:center; min-width:430px;';
    document.body.appendChild(el);
  }
  const n = datos.n || 2;
  const rival = rol === 'host' ? (datos.guest && datos.guest.nome) : (datos.host && datos.host.nome);
  const eu = datos[rol] || {};
  const rivalFoi = rol === 'host' ? !datos.guest : !datos.host;
  /* conta atrás única por rolda */
  if(window._pvpRevN !== n){
    window._pvpRevN = n;
    window._pvpRevDeadline = Date.now() + 90000;
    window._pvpRevAuto = false;
    if(window._pvpRevInt) clearInterval(window._pvpRevInt);
    window._pvpRevInt = setInterval(() => {
      const s = Math.max(0, Math.ceil((window._pvpRevDeadline - Date.now()) / 1000));
      const sp = document.getElementById('pvpRevSeg');
      if(sp) sp.textContent = s;
      if(s <= 0 && !window._pvpRevAuto){
        window._pvpRevAuto = true;
        if(_lobby) _lobby.listo();
        const b = document.getElementById('pvpRevListo');
        if(b){ b.disabled = true; b.textContent = TXT('serie.tempo'); }
      }
    }, 500);
  }
  if(rivalFoi){
    el.innerHTML = `<b style="color:#ff7a5a;">${TXT('serie.marchou')}</b><br>
      <button id="pvpRevPechar" style="margin-top:8px;">${TXT('serie.pechar')}</button>`;
    document.getElementById('pvpRevPechar').onclick = () => { pvpLimpar(); hidePvpRevancha(); radio(TXT('serie.pechada'), '#888'); };
    return;
  }
  const seg = Math.max(0, Math.ceil((window._pvpRevDeadline - Date.now()) / 1000));
  el.innerHTML = `<b style="color:#ffd24a;">${TXT('serie.vs', {rival: rival || '?'})}</b> — ${TXT('serie.proxima', {n})}<br>
    <span class="small">${TXT('serie.elixe', {s: `<b id="pvpRevSeg">${seg}</b>`})}</span><br>
    <button id="pvpRevListo" style="margin-top:8px;" ${eu.listo ? 'disabled' : ''}>${eu.listo ? TXT('serie.agardando') : TXT('serie.listo')}</button>
    <button id="pvpRevSair" style="margin-top:8px; color:#ff8a70;">${TXT('serie.sair')}</button>`;
  document.getElementById('pvpRevListo').onclick = function(){
    this.disabled = true; this.textContent = TXT('serie.agardando');
    if(_lobby) _lobby.listo();
  };
  document.getElementById('pvpRevSair').onclick = () => { pvpLimpar(); hidePvpRevancha(); radio(TXT('serie.saiches'), '#888'); };
}
function hidePvpRevancha(){
  if(window._pvpRevInt){ clearInterval(window._pvpRevInt); window._pvpRevInt = null; }
  window._pvpRevN = null;
  const el = document.getElementById('pvpRevancha');
  if(el) el.remove();
}

/* (v0.37) LIMPEZA TOTAL tras cada duelo — sen isto, o estado global pegado
   (window._pvp, listeners, vixía) impedía crear unha SEGUNDA sala sen recargar */
function pvpLimpar(){
  pvpLog('limpeza de estado pvp');
  const P = window._pvp;
  if(P && P.unsub) P.unsub.forEach(f => { try{ f && f(); }catch(e){} });
  if(window._pvpVixia){ clearTimeout(window._pvpVixia); window._pvpVixia = null; }
  window._pvp = null;
  window._pvpRivalFoi = false;
  window._pvpDeployFeito = null;
  try{ hidePvpRevancha(); }catch(e){}
  /* (v0.40) restaurar o idioma do xogador ao pechar a serie */
  if(window._langAntesPvp){
    try{ setLang(window._langAntesPvp, {persist: false}); }catch(e){}
    window._langAntesPvp = null;
  }
  if(_lobby){ try{ _lobby.sair(); }catch(e){} _lobby = null; }
}

function pvpSerRec(r){
  /* (v0.34.2) LISTA BRANCA: só o que mkUnit consome para o xogo. A lista negra
     deixaba pasar campos descoñecidos (grandes ou circulares) que estouraban a
     RTDB con "Maximum call stack size exceeded". */
  const act = r.activity || {};
  const hab = {};
  if(r.habilidades) for(const k in r.habilidades) if(r.habilidades[k]) hab[k] = true;
  return {
    id: String(r.id||''), name: String(r.name||'ROBOT'), alcume: r.alcume || null,
    cls: r.cls || 'GRUNT', ops: r.ops||0, kills: r.kills||0,
    personalidad: r.personalidad || 'ESTOICO',
    confianza: (typeof r.confianza === 'number') ? r.confianza : 50,
    equipment: (r.equipment||[]).filter(x=>typeof x==='string').slice(0,8),
    traits: (r.traits||[]).filter(x=>typeof x==='string').slice(0,12),
    medals: (r.medals||[]).filter(x=>typeof x==='string').slice(0,12),
    activity: {dist:act.dist||0, shots:act.shots||0, kills:act.kills||0,
               dmgTaken:act.dmgTaken||0, caps:act.caps||0, veh:act.veh||0},
    habilidades: Object.keys(hab).length ? hab : null,
    sinergia: r.sinergia || null,
    renacido: r.renacido ? {opsLeft: r.renacido.opsLeft||0} : null,
    piezasClases: Array.isArray(r.piezasClases) ? r.piezasClases.filter(x=>typeof x==='string').slice(0,8) : null,
    crossings: r.crossings||0, recoveries: r.recoveries||0,
    criticalSurvivals: r.criticalSurvivals||0, captures: r.captures||0,
    appearances: r.appearances||1, reensamblado: r.reensamblado ? 1 : 0,
  };
}
function pvpSerU(u){
  return {id:u.id, name:u.name, cls:u.cls, team:u.team,
    x:Math.round(u.x), y:Math.round(u.y), hp:Math.round(u.hp), max:u.max,
    dead:!!u.dead, inside:u.inside?1:0, warned:u.warned?1:0, eng:u.eng?1:0,
    medalsN:u.medalsN||0, reensamblado:u.reensamblado?1:0, ops:u.ops||0};
}
function pvpSerFinU(u){
  return {id:u.id, name:u.name, cls:u.cls, team:u.team, x:Math.round(u.x), y:Math.round(u.y),
    hp:Math.round(u.hp), max:u.max, dead:!!u.dead, deathCause:u.deathCause||null,
    kills:u.kills||0, act:u.act||null, capturesThisOp:u.capturesThisOp||0,
    eventBuffer:u.eventBuffer||null, eng:u.eng?1:0, ops:u.ops||0,
    persisted:u.persisted?1:0, warned:u.warned?1:0};
}
function pvpRadioET(g, txt, color){
  g._radioET = g._radioET || [];
  g._radioETn = (g._radioETn || 0) + 1;
  g._radioET.push({n: g._radioETn, txt, color: color || '#9ab0c8'});
  if(g._radioET.length > 6) g._radioET.shift();
}
function pvpSnapshot(g){
  return {
    t: g.t, over: !!g.over,
    clima: g.clima ? {id:g.clima.id||'CLARO', label:g.clima.label||'', vis:(g.clima.vis !== undefined ? g.clima.vis : 1), tint:g.clima.tint||null} : null,
    units: g.units.map(pvpSerU),
    vehicles: (g.vehicles||[]).map(v => ({id:v.id, tipo:v.tipo||'JEEP', team:v.team, x:Math.round(v.x), y:Math.round(v.y),
      hp:Math.round(v.hp), max:v.max, destroyed:!!v.destroyed, occ:v.occupant?v.occupant.id:null, angle:Math.round((v.angle||0)*100)/100})),
    turrets: (g.turrets||[]).map(t => ({id:t.id, team:t.team, x:t.x, y:t.y, hp:Math.round(t.hp), max:t.max,
      destroyed:!!t.destroyed, occ:t.occupant?t.occupant.id:null})),
    wallsHp: (g.walls||[]).map(w => Math.round(w.hp)),
    sectors: g.sectors.map(s => ({owner:s.owner, prog:Math.round(s.prog)})),
    radar: {owner:g.radar.owner, prog:Math.round(g.radar.prog)},
    hq: g.hq.map(h => ({hp:Math.round(h.hp), ldt:h.lastDamageT||0})),
    prod: g.prod.map(p => p ? {cls:p.cls, left:Math.round(p.left), total:p.total} : null),
    scrap: (g.scrap||[]).filter(s=>!s.peza && !s.loot).map(s => ({x:Math.round(s.x), y:Math.round(s.y), amount:s.amount})),
    remains: (g.remains||[]).map(r => ({x:Math.round(r.x), y:Math.round(r.y), id:r.unit?r.unit.id:null, name:r.unit?r.unit.name:'', team:r.unit?r.unit.team:-1, secured:!!r.secured})),
    kills: g.kills, chatET: g._chatarraET || 0,
    tPendET: g._turretPendingET || 0,
    radioET: g._radioET || [],
  };
}
function pvpHostFrame(g){
  const P = window._pvp;
  if(!P) return;
  /* consumir ordes novas do convidado */
  if(P.ordenPend){
    const ordes = P.ordenPend; P.ordenPend = null;
    const consumidas = [];
    for(const k of Object.keys(ordes)){
      if(P.procesadas.has(k)) continue;
      P.procesadas.add(k);
      consumidas.push(k);
      const o = ordes[k];
      if(o.tipo === 'move' && Array.isArray(o.lista)){
        for(const it of o.lista){
          const u = g.units.find(x => x.team === ET && !x.dead && x.id === it.id);
          if(u && typeof it.x === 'number' && typeof it.y === 'number') orderMove(u, it.x, it.y);
        }
      } else if(o.tipo === 'prod' && o.cls){
        queueUnit(ET, o.cls);
      } else if(o.tipo === 'entrar' && o.id && o.tid){
        const u = g.units.find(x => x.team === ET && !x.dead && !x.inside && x.id === o.id);
        if(u){
          if(o.kind === 'torreta'){
            const tu = g.turrets.find(t => t.id === o.tid && !t.destroyed && !t.occupant);
            if(tu){ u.intentEnterTurret = tu; u.intentEnterVehicle = null; orderMove(u, tu.x, tu.y); }
          } else {
            const v = (g.vehicles||[]).find(x => x.id === o.tid && !x.destroyed && !x.occupant);
            if(v){ u.intentEnterVehicle = v; u.intentEnterTurret = null; orderMove(u, v.x, v.y); }
          }
        }
      } else if(o.tipo === 'sair' && o.tid){
        const tu = g.turrets.find(t => t.id === o.tid && t.team === ET && t.occupant);
        const v = !tu ? (g.vehicles||[]).find(x => x.id === o.tid && x.team === ET && x.occupant) : null;
        const est = tu || v;
        if(est){
          const oc = est.occupant;
          oc.inside = null; oc.x = est.x + 22; oc.y = est.y + 22;
          est.occupant = null;
          if(tu) est.team = -1;
          pvpRadioET(g, `${oc.name} baixou.`, '#7fb0ff');
        }
      } else if(o.tipo === 'muro' && o.id){
        const eng = g.units.find(x => x.team === ET && !x.dead && !x.inside && x.eng && x.id === o.id);
        if(eng && comoEquipo(ET, () => validWallSpot(o.x, o.y, g))){
          eng.buildTask = {x: o.x, y: o.y, progress: 0};
          orderMove(eng, o.x + 14, o.y);
          pvpRadioET(g, `⌂ ${eng.name} vai levantar un muro.`, '#c8a86a');
        } else if(eng){
          pvpRadioET(g, '⌂ Posición inválida para o muro.', '#ff8');
        }
      } else if(o.tipo === 'torreta'){
        if((g._turretPendingET||0) > 0 && comoEquipo(ET, () => validTurretSpot(o.x, o.y, g))){
          placeTurret(o.x, o.y, g, ET);
        } else {
          pvpRadioET(g, '⌂ Posición inválida para a torreta (territorio teu, chan libre).', '#ff8');
        }
      } else if(o.tipo === 'movJeep' && o.tid){
        const v = (g.vehicles||[]).find(x => x.id === o.tid && x.team === ET && x.occupant && !x.destroyed);
        if(v){
          if(crossesRiver(v.x, o.x)){
            v.waypoints = [{x:BRIDGE_CENTER.x, y:BRIDGE_CENTER.y}, {x:o.x, y:o.y}];
            v.tx = BRIDGE_CENTER.x; v.ty = BRIDGE_CENTER.y;
          } else {
            v.waypoints = []; v.tx = o.x; v.ty = o.y;
          }
        }
      }
    }
    /* (v0.35) BORRAR as ordes consumidas: sen isto o nó medra sen límite e a RTDB
       re-entrega TODO o historial en cada push → caída cuadrática (os 4fps do log) */
    if(consumidas.length){
      for(const k of consumidas) P.net.remove(`salas/${P.sala}/orden/${k}`).catch(()=>{});
    }
    if(P.procesadas.size > 400) P.procesadas = new Set([...P.procesadas].slice(-200));
  }
  /* (v0.32) RADIO DO RIVAL POR DIFFS — sen tocar o código de combate */
  if(!P.vivosET){
    P.vivosET = new Set(g.units.filter(u => u.team === ET && !u.dead).map(u => u.id));
    P.sectPrev = g.sectors.map(s => s.owner);
    P.radarPrev = g.radar.owner;
  }
  for(const u of g.units){
    if(u.team !== ET) continue;
    if(!u.dead){ P.vivosET.add(u.id); }
    else if(P.vivosET.has(u.id)){
      P.vivosET.delete(u.id);
      pvpRadioET(g, `✝ ${u.name} caeu no campo.`, '#ff5340');
      /* (v0.33) BUG R3: sen isto, os caídos do rival non deixaban restos
         (nin arquivo, nin pezas, nin memorial no seu peche) */
      const _lug = (typeof placeAt === 'function') ? placeAt(u.x, u.y) : 'campo';
      g.remains.push({x: u.x, y: u.y, unit: u, timer: 90*60, secured: false, place: _lug});
    }
  }
  g.sectors.forEach((s, i) => {
    if(s.owner !== P.sectPrev[i]){
      if(s.owner === ET) pvpRadioET(g, '▣ Sector asegurado polos teus.', '#7fdc7f');
      else if(P.sectPrev[i] === ET) pvpRadioET(g, '▣ Perdiches un sector.', '#ff9a3c');
      P.sectPrev[i] = s.owner;
    }
  });
  if(g.radar.owner !== P.radarPrev){
    if(g.radar.owner === ET) pvpRadioET(g, '◉ RADAR baixo o teu control.', '#7fdc7f');
    else if(P.radarPrev === ET) pvpRadioET(g, '◉ Perdiches o RADAR.', '#ff9a3c');
    P.radarPrev = g.radar.owner;
  }
  /* (v0.38 LATENCIA) publicar snap a ~10/s — a metade do atraso estrutural */
  if(g.t % 6 === 0){
    /* (v0.34.1) COMO CADEA JSON: a RTDB borra arrays baleiros e nulos dentro de
       arrays (scrap:[], remains:[], prod:[null,null] desaparecían do 1º snap e
       o convidado estoupaba en s.prod.map → loop morto → pantalla conxelada) */
    try{
      P.net.write(`salas/${P.sala}/snap`, {j: JSON.stringify(pvpSnapshot(g))}).catch(e=>console.error('[snap]', e));
      if(!P._snap1){ P._snap1 = true; pvpLog('primeiro snap enviado'); }
    }
    catch(e){ console.error('[snap ser]', e); }
  }
}
function pvpAplicarSnap(g){
  const P = window._pvp;
  if(!P || !P.snapPend) return;
  const s = P.snapPend; P.snapPend = null;
  const sel = new Set(g.units.filter(u => u.sel).map(u => u.id));
  const prev = new Map(g.units.map(u => [u.id, u]));
  g.units = s.units.map(u => {
    const p0 = prev.get(u.id);
    return {...u, sel: sel.has(u.id) && !u.dead, inside: u.inside ? {} : null,
      rng: (CLS[u.cls] && CLS[u.cls].rng) || 60, spd: 1, act: null, traits: [], waypoints: [],
      /* (v0.32) interpolación: renderizamos desde a posición previa cara ao obxectivo do snap */
      x: (p0 && !u.dead) ? p0.x : u.x, y: (p0 && !u.dead) ? p0.y : u.y, _sx: u.x, _sy: u.y};
  });
  if(g.vehicles) (s.vehicles||[]).forEach((sv, i) => { const v = g.vehicles.find(x=>x.id===sv.id) || g.vehicles[i];
    if(v){ v._sx=sv.x; v._sy=sv.y; if(sv.destroyed){ v.x=sv.x; v.y=sv.y; } v.hp=sv.hp; v.team=sv.team; v.destroyed=sv.destroyed; v.angle=sv.angle;
      v.occupant = sv.occ ? (g.units.find(u=>u.id===sv.occ) || v.occupant) : null; } });
  if(g.turrets) (s.turrets||[]).forEach((st, i) => { const t = g.turrets.find(x=>x.id===st.id) || g.turrets[i];
    if(t){ t.hp=st.hp; t.team=st.team; t.destroyed=st.destroyed;
      t.occupant = st.occ ? (g.units.find(u=>u.id===st.occ) || t.occupant) : null; } });
  if(g.walls && s.wallsHp) s.wallsHp.forEach((hp, i) => { if(g.walls[i]) g.walls[i].hp = hp; });
  (s.sectors||[]).forEach((ss, i) => { if(g.sectors[i]){ g.sectors[i].owner = ss.owner; g.sectors[i].prog = ss.prog; } });
  if(s.radar){ g.radar.owner = s.radar.owner; g.radar.prog = s.radar.prog; }
  (s.hq||[]).forEach((sh, i) => { g.hq[i].hp = sh.hp; g.hq[i].lastDamageT = sh.ldt || 0; });
  g.prod = Array.isArray(s.prod) ? s.prod.map(p => p ? {...p} : null) : [null, null];
  g.scrap = (s.scrap || []).map(x => ({...x}));
  g.remains = (s.remains || []).map(r => ({x:r.x, y:r.y, secured:r.secured, unit:{id:r.id, name:r.name, team:r.team}}));
  g.kills = s.kills || g.kills;
  if(s.clima) g.clima = {...(g.clima||{}), ...s.clima};
  g._chatarraET = s.chatET || 0;
  g._turretPendingET = s.tPendET || 0;
  /* (v0.32) radio propia: mensaxes novas por número de secuencia */
  if(s.radioET && window._pvp){
    for(const m of s.radioET){
      if(m.n > (window._pvp.radioN || 0)){
        radio(m.txt, m.color);
        window._pvp.radioN = m.n;
      }
    }
  }
}
/* (v0.33) ABANDONO: o host marchou — vitoria por retirada, SEN botín de pezas
   (para non premiar forzar desconexións). Os supervivintes suman a operación. */
function pvpAbandono(){
  if(!game || !window._pvp || window._pvp.finFeito) return;
  window._pvp.finFeito = true;
  radio(TXT('pvp.abandonou'), '#ffd24a');
  const g = game;
  g.over = true;
  g.result = 'victory';
  g.units = g.units.filter(u => u.team === PT);
  g.remains = [];
  g.chatarraGanada = g._chatarraET || 0;
  setTimeout(() => endBattle(g), 1200);
}
/* (v0.38 LATENCIA) Predición + reconciliación:
   - As unidades PROPIAS do convidado avanzan LOCALMENTE cara ao último clic
     (sensación instantánea) e o snap do host só as corrixe suave (0.15).
   - As alleas van con blend forte (0.4) cara ao snap: chegan en ~4 frames.
   - Diverxencia >90px = o host manda: teleport. */
function pvpInterpolar(g){
  for(const u of g.units){
    if(u._sx === undefined) continue;
    if(u.dead){ u.x = u._sx; u.y = u._sy; u._pred = null; continue; }
    const dSnap = Math.hypot(u._sx - u.x, u._sy - u.y);
    if(dSnap > 90){ u.x = u._sx; u.y = u._sy; u._pred = null; continue; }
    const propia = u.team === PT;
    if(propia && u._pred && !u.inside){
      const dx = u._pred.x - u.x, dy = u._pred.y - u.y;
      const d = Math.hypot(dx, dy);
      const sp = (CLS[u.cls] && CLS[u.cls].spd) || 1;
      if(d > 4){ u.x += (dx / d) * sp; u.y += (dy / d) * sp; }
      else u._pred = null;
      u.x += (u._sx - u.x) * 0.15;
      u.y += (u._sy - u.y) * 0.15;
    } else {
      u.x += (u._sx - u.x) * 0.4;
      u.y += (u._sy - u.y) * 0.4;
    }
  }
  for(const v of (g.vehicles||[])){
    if(v._sx === undefined || v.destroyed) continue;
    v.x += (v._sx - v.x) * 0.4;
    v.y += (v._sy - v.y) * 0.4;
  }
}
function pvpFlushOrdes(){
  const P = window._pvp;
  if(!P || P.rol !== 'guest' || !P.ordenBuf.length) return;
  /* (v0.35) coalescer por unidade (a última orde gaña) e enviar como moito
     cada 6 frames — antes era 1 push por frame arrastrando o rato */
  P._flushT = (P._flushT || 0) + 1;
  if(P._flushT < 2) return;
  P._flushT = 0;
  const porUnidade = new Map();
  for(const o of P.ordenBuf) porUnidade.set(o.id, o);
  P.ordenBuf.length = 0;
  const lista = [...porUnidade.values()].slice(0, 40);
  P.net.push(`salas/${P.sala}/orden`, {tipo:'move', lista, ts: Date.now()}).catch(()=>{});
}
/* --- envoltorios: as ordes do convidado viaxan ao host --- */
const _pvpOrderMovePendente = [];
function _pvpEnvolver(){
  const _om = orderMove;
  orderMove = function(u, tx, ty){
    if(window._pvp && window._pvp.rol === 'guest' && u && u.team === PT && !u.dead){
      window._pvp.ordenBuf.push({id: u.id, x: Math.round(tx), y: Math.round(ty)});
      u._pred = {x: tx, y: ty};   /* (v0.38) predición: móvete XA; o host corrixe */
    }
    return _om(u, tx, ty);   /* óptica local inmediata; o snap do host corrixe */
  };
  const _qu = queueUnit;
  queueUnit = function(team, cls){
    if(window._pvp && window._pvp.rol === 'guest' && team === PT){
      if(cls === 'TORRETA'){
        if((DATA.chatarra||0) < TURRET_BUILD.cost){ radio(TXT('r.senChatarraTorreta', {c:TURRET_BUILD.cost}), '#ff8'); return; }
        DATA.chatarra -= TURRET_BUILD.cost; saveData(DATA);
      }
      if(cls === 'TANQUE'){
        if((DATA.chatarra||0) < TANK_DEF.cost){ radio(TXT('r.senChatarraTanque', {c:TANK_DEF.cost}), '#ff8'); return; }
        DATA.chatarra -= TANK_DEF.cost; saveData(DATA);
      }
      window._pvp.net.push(`salas/${window._pvp.sala}/orden`, {tipo:'prod', cls, ts: Date.now()}).catch(()=>{});
      radio(TXT('pvp.fabrica', {c:cls}), '#7fdc7f');
      return;
    }
    return _qu(team, cls);
  };
}
/* _pvpEnvolver() chámase en 99-boot.js, cando orderMove/queueUnit xa existen */

/* --- spawn dos rivais no host, cos veteranos REAIS do convidado --- */
function pvpSpawnRivais(g, deployRival){
  const _edx = (d) => ET === 1 ? HQ[1].x - d : HQ[0].x + HQ[0].w + d;
  (deployRival || []).forEach((rec, i) => {
    g.units.push(mkUnit(ET, rec.cls, _edx(30), HQ[ET].y - 28 + i*40, rec));
  });
  g.units.push(mkUnit(ET, 'GRUNT',    _edx(35), HQ[ET].y + HQ[ET].h + 20, null));
  g.units.push(mkUnit(ET, 'ENGINEER', _edx(40), HQ[ET].y + HQ[ET].h + 60, null));
}
/* --- arranque desde o lobby --- */
function pvpDeployLocal(){
  const checked = [...$('rosterList').querySelectorAll('input:checked')];
  return checked.map(cb => DATA.units[+cb.dataset.i])
    .filter(r => r && !(r.folga && r.folga.ops > 0))
    .slice(0, 3);
}
function pvpParseLista(dep){
  if(!dep) return [];
  try{ return dep.j ? JSON.parse(dep.j) : (dep.lista || []); }catch(e){ return []; }
}
function pvpArrancar(datos, rol){
  const net = _lobby && _lobby.sala ? window._pvpNet : null;
  if(!net) return;
  /* (v0.39) SERIE: clave por ROLDA (sala#n) — cada batalla rearma os candados */
  const clave = _lobby.sala + '#' + (datos.n || 1);
  window._pvpN = datos.n || 1;
  if(datos.host || datos.guest){
    window._pvpNomes = {azul: (datos.host && datos.host.nome) || 'AZUL',
                        vermello: (datos.guest && datos.guest.nome) || 'VERMELLO'};
    window._pvpRivalNome = rol === 'host'
      ? ((datos.guest && datos.guest.nome) || window._pvpRivalNome)
      : ((datos.host && datos.host.nome) || window._pvpRivalNome);
  }
  /* (v0.39) ENTRE BATALLAS: panel de revancha; nada máis mentres se elixe */
  if(datos.estado === 'entrebatallas'){
    if(window._pvp) pvpDesmontarBatalla();
    showPvpRevancha(datos, rol);
    return;
  }
  if(datos.estado === 'listo' || datos.estado === 'batalla') hidePvpRevancha();
  /* 1) publicar o meu despregue — unha vez por sala. Os veteranos son OPCIONAIS:
     sen eles despregas cos novatos de oficio, como na campaña. Se a serialización
     falla por calquera cousa, publícase igual o sobre e vas con novatos. */
  if((datos.estado === 'listo' || datos.estado === 'batalla') && window._pvpDeployFeito !== clave){
    window._pvpDeployFeito = clave;   /* (v0.39) o sobre publícase EN LISTO: le a selección final do hangar */
    pvpLog('publicando despregue na sala ' + _lobby.sala);
    let lista = null;
    try{
      lista = JSON.parse(JSON.stringify(pvpDeployLocal().map(pvpSerRec)));
    }catch(e){
      console.error('[pvp deploy]', e);
      radio('⚠ Non puiden serializar os veteranos (' + (e.message||e) + ') — despregas con novatos.', '#ff9a3c');
    }
    net.update(`salas/${_lobby.sala}/${rol}`, {deploy: {ok: true, j: (lista && lista.length) ? JSON.stringify(lista) : null}})
      .catch(e => {
        console.error('[pvp deploy]', e);
        radio('⚠ Erro ao publicar o despregue: ' + (e.message||e), '#ff5340');
        window._pvpDeployFeito = null;   /* permitir reintento no seguinte update da sala */
      });
  }
  const dHost = datos.host && datos.host.deploy;
  const dGuest = datos.guest && datos.guest.deploy;
  /* 2) host: cos dous sobres, promove xa; sen o do rival, VIXÍA DE 6s que forza
     o arranque igualmente (o rival vai con novatos). Imposible quedar en DESPREGANDO. */
  if(rol === 'host' && datos.estado === 'listo'){
    if(dHost && dGuest && window._pvpPromovido !== clave){
      window._pvpPromovido = clave;   /* (v0.39) promover unha vez por ROLDA */
      pvpLog('estado → batalla (host promove, rolda ' + (datos.n || 1) + ')');
      const seed = (datos.n || 1) >= 2 ? (1 + Math.floor(Math.random() * 899999999)) : 0;
      window._pvpMapaSeed = seed;
      net.update(`salas/${_lobby.sala}`, {estado: 'batalla', mapa: {seed}}).catch(()=>{});
      pvpIniciarBatalla('host', pvpParseLista(dHost), pvpParseLista(dGuest));
    } else if(!window._pvpVixia){
      window._pvpVixia = setTimeout(async () => {
        window._pvpVixia = null;
        if(window._pvp || !_lobby) return;   /* xa arrancou ou saímos */
        let d = null;
        try{ d = await net.once(`salas/${_lobby.sala}`); }catch(e){}
        if(!d || window._pvp) return;
        radio(TXT('pvp.forzando'), '#ff9a3c');
        const seed2 = (d.n || 1) >= 2 ? (1 + Math.floor(Math.random() * 899999999)) : 0;
        window._pvpMapaSeed = seed2;
        net.update(`salas/${_lobby.sala}`, {estado: 'batalla', mapa: {seed: seed2}}).catch(()=>{});
        pvpIniciarBatalla('host',
          pvpParseLista(d.host && d.host.deploy),
          pvpParseLista(d.guest && d.guest.deploy));
      }, 6000);
    }
  }
  /* 3) convidado: co estado batalla arranca SEMPRE, con ou sen sobre propio */
  if(rol === 'guest' && datos.estado === 'batalla'){
    window._pvpMapaSeed = (datos.mapa && datos.mapa.seed) || 0;   /* (v0.39) o mesmo mapa có host */
    pvpIniciarBatalla('guest', pvpParseLista(dGuest), null);
  }
}
function pvpIniciarBatalla(rol, meus, rivais){
  if(window._pvp) return;   /* xa arrancada */
  /* (v0.40) PvP EN INGLÉS por defecto: os DOUS lados ven o mesmo idioma
     (radio cruzada coherente). Restáurase o do xogador en pvpLimpar. */
  if(!window._langAntesPvp && typeof setLang === 'function' && I18N.lang !== 'en'){
    window._langAntesPvp = I18N.lang;
    setLang('en', {persist: false});
  }
  setPlayerTeam(rol === 'host' ? 0 : 1);
  const net = window._pvpNet;
  window._pvp = {rol, net, sala: _lobby.sala, snapPend: null, ordenPend: null,
                 ordenBuf: [], procesadas: new Set(), finFeito: false};
  initAudio();
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  preloadVoices();
  $('bioModal').style.display = 'none';
  $('hangar').style.display = 'none';
  $('battle').style.display = 'block';
  $('radio').innerHTML = `<div class="line small">— ${TXT('r.canal')} —</div>`;
  panelInterrupt = null;
  DATA.pendingUpgraded = [];
  window._pvpArranque = true;
  game = newBattle(meus.map(r => ({...r})));
  window._pvpArranque = false;
  game.modo = 'pvp';
  window._pvp.unsub = [];
  pvpLog('batalla iniciada como ' + rol + ' na sala ' + window._pvp.sala);
  if(rol === 'host'){
    window._pvp.rivais = rivais || [];   /* (v0.33) recs do rival, para xerar pezas con procedencia */
    pvpSpawnRivais(game, rivais);
    window._pvp.unsub.push(net.onValue(`salas/${window._pvp.sala}/orden`, v => { if(window._pvp) window._pvp.ordenPend = v || null; }));
  } else {
    window._pvp.unsub.push(net.onValue(`salas/${window._pvp.sala}/snap`, v => {
      if(!window._pvp) return;
      try{
        window._pvp.snapPend = v ? (v.j ? JSON.parse(v.j) : v) : null;
        if(v && !window._pvp._snap1){ window._pvp._snap1 = true; pvpLog('primeiro snap recibido'); }
      }
      catch(e){ console.error('[snap parse]', e); }
    }));
    window._pvp.unsub.push(net.onValue(`salas/${window._pvp.sala}/fin`, v => {
      if(!v) return;
      try{ pvpLog('fin recibido'); pvpRecibirFin(v.j ? JSON.parse(v.j) : v); }
      catch(e){ console.error('[fin parse]', e); }
    }));
  }
  radio(TXT('pvp.inicio', {lado: TXT(rol === 'host' ? 'pvp.azul' : 'pvp.vermello')}), '#ffd24a');
  sfx('radio_open');
  setTimeout(() => { sfx('radio_static', 0.6); playSysVoice('op_start'); }, 100);
  updateSidePanel(game);
  requestAnimationFrame(loop);
}
/* --- final: o host publica o informe; o convidado procesa o SEU roster --- */
function pvpPublicarFin(g){
  const P = window._pvp;
  if(!P || P.rol !== 'host' || P.finFeito) return;
  P.finFeito = true;
  /* (v0.33) PEAXE — "o campo é do gañador": as pezas dos caídos NON ASEGURADOS
     do perdedor requísaas o gañador, con PROCEDENCIA (p.deRival). A IA nunca
     cambia de mans: os caídos van sempre ao arquivo do seu dono. */
  let pezasBotin = [];
  if(g.result === 'defeat'){
    /* gañou o convidado: as miñas pezas perdidas viaxan no fin */
    for(const r of g.remains.filter(x => x.unit && x.unit.team === PT && (!x.secured || x.expired))){
      const rec = DATA.units.find(rr => rr.id === r.unit.id);
      pezasBotin = pezasBotin.concat(
        xerarPezas(rec, r.unit, DATA.opCount).map(p => ({...p, deRival: window._pvpEuNome || 'RIVAL'})));
    }
  } else if(g.result === 'victory'){
    /* gañei eu: requiso as pezas dos caídos do rival */
    let botin = [];
    for(const r of g.remains.filter(x => x.unit && x.unit.team === ET && (!x.secured || x.expired))){
      const rec = (P.rivais || []).find(rr => rr.id === r.unit.id) || null;
      botin = botin.concat(
        xerarPezas(rec, r.unit, DATA.opCount).map(p => ({...p, deRival: window._pvpRivalNome || 'RIVAL'})));
    }
    if(botin.length){
      DATA.piezas = (DATA.piezas || []).concat(botin);
      g._pvpBotinInfo = ` · <span style="color:#ffd24a;">⚑ BOTÍN DE GUERRA: ${botin.length} pezas requisadas a ${window._pvpRivalNome || 'o rival'}</span>`;
    }
  }
  const fin = {
    result: g.result,
    unidades: g.units.filter(u => u.team === ET).map(pvpSerFinU),
    remains: g.remains.filter(r => r.unit && r.unit.team === ET)
      .map(r => ({x:r.x, y:r.y, id:r.unit.id, secured:!!r.secured, expired:!!r.expired})),
    kills: g.kills, chatET: g._chatarraET || 0,
    pezasBotin,
  };
  try{
    P.net.write(`salas/${P.sala}/snap`, {j: JSON.stringify(pvpSnapshot(g))}).catch(()=>{});
    P.net.write(`salas/${P.sala}/fin`, {j: JSON.stringify(fin)}).catch(e=>console.error('[fin]', e));
  }catch(e){ console.error('[fin ser]', e); }
}
function pvpRecibirFin(fin){
  const P = window._pvp;
  if(!P || P.rol !== 'guest' || P.finFeito || !game) return;
  P.finFeito = true;
  const g = game;
  g.over = true;
  g.result = fin.result === 'victory' ? 'defeat' : (fin.result === 'defeat' ? 'victory' : fin.result);
  g.units = (fin.unidades || []).map(u => ({...u, inside: null, traits: [], waypoints: []}));
  g.remains = (fin.remains || []).map(r => ({x:r.x, y:r.y, secured:r.secured, expired:r.expired,
    unit: g.units.find(u => u.id === r.id) || {id:r.id, team:PT, name:'?', cls:'GRUNT'}}));
  g.kills = fin.kills || g.kills;
  g.chatarraGanada = fin.chatET || 0;
  if(g.result === 'victory' && fin.pezasBotin && fin.pezasBotin.length){
    DATA.piezas = (DATA.piezas || []).concat(fin.pezasBotin);
    g._pvpBotinInfo = ` · <span style="color:#ffd24a;">⚑ BOTÍN DE GUERRA: ${fin.pezasBotin.length} pezas requisadas a ${window._pvpRivalNome || 'o rival'}</span>`;
  }
  setTimeout(() => endBattle(g), 400);
}

/* ---------- UI do lobby (reutiliza o bioModal) ---------- */
function showLobby(){
  const nomePrev = window._nomeOnline || '';
  $('bioTitle').innerHTML = `🌐 DUELO ONLINE <span class="small" style="color:#7fdc7f;">${TUERCA_V}</span>`;
  $('bioBody').innerHTML = `
    <div class="small" style="margin-bottom:10px;">Crea unha sala e pásalle a CLAVE ao teu rival, ou métete na súa.
    O creador xoga como <b style="color:#4f8aff;">AZUL</b> e o convidado como <b style="color:#ff5340;">VERMELLO</b>.
    <br>Cada quen xoga co SEU roster e a SÚA persistencia local.</div>
    <div style="margin-bottom:8px;">NOME: <input id="lbNome" maxlength="14" value="${nomePrev}"
      style="background:#111; color:#cfe0ff; border:1px solid #555; font-family:inherit; padding:3px 6px; text-transform:uppercase;"></div>
    <div class="row">
      <button class="bio-btn" id="lbCrear" style="color:#4f8aff; border-color:#4f8aff;">▸ CREAR SALA</button>
      <span class="small" style="align-self:center;">ou</span>
      <input id="lbClave" maxlength="5" placeholder="CLAVE"
        style="background:#111; color:#cfe0ff; border:1px solid #555; font-family:inherit; padding:3px 6px; width:78px; text-transform:uppercase;">
      <button class="bio-btn" id="lbUnir" style="color:#ff5340; border-color:#ff5340;">▸ UNIRSE</button>
    </div>
    <div id="lbStatus" class="small" style="margin-top:10px; color:#c8a86a;"></div>
    <div id="lbSala" style="margin-top:10px;"></div>`;
  $('bioModal').style.display = 'flex';
  const status = (t) => { const e = $('lbStatus'); if(e) e.textContent = t; };
  const arrancar = async (accion) => {
    const nome = (($('lbNome').value || '').trim().toUpperCase() || 'COMANDANTE').slice(0, 14);
    window._nomeOnline = nome;
    try{
      const {db} = await ensureFirebase(status);
      status('Conectado ✓ (' + _fb.url.replace('https://','').split('.')[0] + ')');
      window._pvpNet = fbNet(db);
      _lobby = mkLobby(window._pvpNet, {estado: pintarSala, salaPechada: () => {
        if(window._pvp){
          pvpAbandono();   /* (v0.33) vitoria por retirada, sen botín */
          return;
        }
        status('⚠ A sala pechou (o creador saíu ou caeu a conexión).');
        const e = $('lbSala'); if(e) e.innerHTML = '';
        _lobby = null;
      }});
      await accion(nome);
    }catch(err){
      if(err.message === 'SEN_CONEXION'){
        status('');
        $('lbSala').innerHTML = `<div style="border:1px solid #a05a50; padding:10px 14px; color:#ff9a3c;" class="small">
          ⚠ NON HAI CONEXIÓN COA BASE DE DATOS. O máis probable é que aínda non estea creada:<br><br>
          1. Vai a <b>console.firebase.google.com</b> → proxecto <b>tuerca-ad47a</b><br>
          2. Menú <b>Compilación → Realtime Database → Crear base de datos</b><br>
          3. Rexión: <b>Bélxica (europe-west1)</b> · Modo: <b>de proba</b><br>
          4. Recarga esta páxina e volve intentalo.<br><br>
          Se xa existe noutra rexión, dime a URL que aparece arriba na pestana "Datos" e axústoa.</div>`;
      } else if(err.message === 'SALA_INEXISTENTE'){ status('⚠ Non existe ningunha sala con esa clave.'); }
      else if(err.message === 'SALA_CHEA'){ status('⚠ Esa sala xa está chea.'); }
      else { status('⚠ Erro: ' + err.message); }
    }
  };
  $('lbCrear').addEventListener('click', () => arrancar(async (nome) => {
    const clave = await _lobby.crear(nome);
    status('Sala creada. Pásalle a clave ao teu rival:');
  }));
  $('lbUnir').addEventListener('click', () => arrancar(async (nome) => {
    await _lobby.unirse(nome, $('lbClave').value);
    status('Dentro da sala.');
  }));
}
function pintarSala(datos, rol){
  const cont = $('lbSala');
  if(!cont) return;
  const chat = datos.chat ? Object.values(datos.chat).sort((a,b)=>a.ts-b.ts).slice(-8) : [];
  const eu = rol === 'host' ? datos.host : datos.guest;
  const listoTexto = (datos.estado === 'listo' || datos.estado === 'batalla')
    ? `<div style="border:1px solid #7fdc7f; padding:10px 14px; margin-top:8px; color:#7fdc7f;">
        ★ OS DOUS COMANDANTES LISTOS — DESPREGANDO. Os veteranos marcados no hangar van contigo.<br>
        <span class="small" style="color:#9ab0c8;">despregue AZUL: ${datos.host && datos.host.deploy ? '✓ recibido' : '… agardando'} ·
        despregue VERMELLO: ${datos.guest && datos.guest.deploy ? '✓ recibido' : '… agardando'}</span></div>`
    : '';
  if(datos.estado === 'listo' || datos.estado === 'batalla'){
    window._pvpEuNome    = rol === 'host' ? (datos.host && datos.host.nome) : (datos.guest && datos.guest.nome);
    window._pvpRivalNome = rol === 'host' ? (datos.guest && datos.guest.nome) : (datos.host && datos.host.nome);
    pvpArrancar(datos, rol);
  }
  /* (v0.33) o host detecta a marcha do rival en plena batalla */
  if(window._pvp && window._pvp.rol === 'host' && !datos.guest && !window._pvpRivalFoi){
    window._pvpRivalFoi = true;
    radio(TXT('pvp.desconectou'), '#ff9a3c');
  }
  cont.innerHTML = `
    <div style="border:1px solid #555; padding:10px 14px;">
      <div>CLAVE DA SALA: <b style="color:#ffd24a; font-size:18px; letter-spacing:4px;">${_lobby ? _lobby.sala : ''}</b></div>
      <div style="margin-top:6px;">
        <span style="color:#4f8aff;">■ AZUL:</span> ${datos.host ? datos.host.nome : '—'} ${datos.host && datos.host.v ? `<span class="small" style="color:#666;">${datos.host.v}</span>` : ''} ${datos.host && datos.host.listo ? '✓ LISTO' : ''}<br>
        <span style="color:#ff5340;">■ VERMELLO:</span> ${datos.guest ? datos.guest.nome : '<span class="small" style="color:#888;">agardando rival…</span>'} ${datos.guest && datos.guest.v ? `<span class="small" style="color:#666;">${datos.guest.v}</span>` : ''} ${datos.guest && datos.guest.listo ? '✓ LISTO' : ''}
      </div>
      ${datos.host && datos.guest && datos.host.v && datos.guest.v && datos.host.v !== datos.guest.v
        ? `<div style="border:1px solid #ff5340; padding:8px 12px; margin-top:8px; color:#ff9a3c;" class="small">⚠ VERSIÓNS DISTINTAS (${datos.host.v} vs ${datos.guest.v}) — un dos dous ten a build vella en caché. Os dous: Ctrl+Shift+R e volver entrar.</div>`
        : ''}
      <div style="display:none;">
      </div>
      ${listoTexto}
      <div class="small" style="margin-top:8px; border-top:1px dashed #444; padding-top:6px; min-height:20px;">
        ${chat.map(m => `<div><b style="color:#c8a86a;">${m.de}:</b> ${m.txt}</div>`).join('') || '<span style="color:#666;">— canal aberto —</span>'}
      </div>
      <div class="row" style="margin-top:6px;">
        <input id="lbChatIn" maxlength="80" placeholder="mensaxe…"
          style="background:#111; color:#cfe0ff; border:1px solid #555; font-family:inherit; padding:3px 6px; flex:1;">
        <button class="bio-btn" id="lbChatBtn">▸</button>
        ${!eu || eu.listo ? '' : `<button class="bio-btn" id="lbListo" style="color:#7fdc7f; border-color:#7fdc7f;">✓ LISTO</button>`}
        <button class="bio-btn" id="lbSair" style="color:#ff7a5a; border-color:#ff7a5a;">✕ SAÍR</button>
      </div>
    </div>`;
  /* facción automática segundo o rol — o alicerce da R3 */
  window._lado = rol === 'host' ? 0 : 1;
  const enviar = () => { const i = $('lbChatIn'); if(i && i.value.trim()){ _lobby.chat(i.value.trim()); i.value = ''; } };
  const cb = $('lbChatBtn'); if(cb) cb.addEventListener('click', enviar);
  const ci = $('lbChatIn'); if(ci) ci.addEventListener('keydown', e => { if(e.key === 'Enter') enviar(); });
  const bl = $('lbListo'); if(bl) bl.addEventListener('click', () => _lobby.listo());
  const bs = $('lbSair'); if(bs) bs.addEventListener('click', async () => {
    if(window._pvp){ pvpLimpar(); }
    else { try{ await _lobby.sair(); }catch(e){} _lobby = null; window._pvpDeployFeito = null; }
    $('bioModal').style.display = 'none';
  });
}

/* ============================================================
   (v0.29 R1) FACCIÓN DO XOGADOR — PT = o teu equipo, ET = o rival.
   Toda a lóxica de batalla é relativa a PT; as CORES e SPRITES
   quedan absolutos por facción (azul=0, vermello=1).
   ============================================================ */
/* PT/ET decláranse en 00-preambulo.js (orde de carga multi-ficheiro) */
function setPlayerTeam(t){ PT = t ? 1 : 0; ET = 1 - PT; }

/* (v0.36.1) VERSIÓN ÚNICA + OVERLAY DE ERROS: calquera excepción sen capturar
   píntase en pantalla coa versión — adeus a depurar builds rancias ás cegas. */
const TUERCA_V = 'v0.40';
function _tuercaOverlay(msg){
  try{
    let o = document.getElementById('tuercaErr');
    if(!o){
      o = document.createElement('div');
      o.id = 'tuercaErr';
      o.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#3a0e0a;border:2px solid #ff5340;color:#ffb0a0;font:12px "Courier New",monospace;padding:8px 12px;white-space:pre-wrap;cursor:pointer;';
      o.title = 'clic para pechar';
      o.addEventListener('click', () => o.remove());
      document.body.appendChild(o);
    }
    o.textContent = '⚠ ERRO (' + TUERCA_V + ') — captura isto e mándallelo a Claude:\n' + String(msg).slice(0, 500);
  }catch(_){}
}
window.addEventListener('error', e => _tuercaOverlay((e.message||e) + (e.lineno ? ' @' + e.lineno : '')));
window.addEventListener('unhandledrejection', e => _tuercaOverlay('Promise: ' + ((e.reason && (e.reason.stack||e.reason.message)) || e.reason)));
setTimeout(() => { const v = document.getElementById('vHangar'); if(v) v.textContent = TUERCA_V; }, 0);

function freshData(){ return {units:[], fallen:[], opCount:0, nextId:1, recurringEnemies:[], version:'0.3'}; }
/* Migración: rosters anteriores se cargan y se les añaden los campos nuevos */
function migrate(d){
  if(!d.units) d.units=[];
  if(!d.recurringEnemies) d.recurringEnemies=[];
  d.units.forEach(u=>{
    if(!u.events) u.events=[];
    if(!u.medals) u.medals=[];
    if(typeof u.crossings!=='number') u.crossings=0;
    if(typeof u.recoveries!=='number') u.recoveries=0;
    if(typeof u.criticalSurvivals!=='number') u.criticalSurvivals=0;
    if(typeof u.captures!=='number') u.captures=0;
    /* Engineer tracking */
    if(typeof u.totalRepairs!=='number') u.totalRepairs=0;
    if(typeof u.unitsRecovered!=='number') u.unitsRecovered=0;
    if(!u.recoveredFrom) u.recoveredFrom={};
  });
  d.version='0.3';
  return d;
}

/* ---------- Nombres procedurales ---------- */
const NAMES = ['TUERCA','MARTILLO','CHISPA','RADAR','VEGA','BULON','PERNO','REMACHE',
  'FUSIBLE','DINAMO','PISTON','BIELA','CROMO','OXIDO','VATIO','TORNO','YUNQUE','FORJA',
  'CABLE','NIQUEL','SOLDADOR','ZINC','ACERO','GATO','LIMA','BRIDA','RUEDA','EJE'];
/* Pool separado para veteranos enemigos — tonos más amenazantes */
const ENEMY_VETERAN_NAMES = ['CUERVO','CIEMPIES','ESPECTRO','GUADAÑA','COLMILLO',
  'OSCURO','BUITRE','HORDA','SARCOMA','TUMBA','HERRUMBRE','MILANO','VIBORA','HACHA',
  'ESCORIA','LUTO','CENIZA','GARFIO','HIENA','CARROÑA'];
function pickName(data, battleUnits){
  const used = new Set(data.units.map(u=>u.name));
  battleUnits.forEach(u=>{ if(u.team===PT) used.add(u.name); });
  const free = NAMES.filter(n=>!used.has(n));
  return free.length ? free[Math.floor(Math.random()*free.length)]
                     : NAMES[Math.floor(Math.random()*NAMES.length)];
}

/* ---------- Clases de unidad ---------- */
const CLS = {
  GRUNT:    {hp:100, dmg:9,  rng:72,  spd:1.30, prod:360,  heavy:false, eng:false, col:'#cfd8cf', fireCool:46},
  HEAVY:    {hp:200, dmg:22, rng:88,  spd:0.72, prod:660,  heavy:true,  eng:false, col:'#9fae9f', fireCool:46},
  ENGINEER: {hp:62,  dmg:3,  rng:46,  spd:1.50, prod:300,  heavy:false, eng:true,  col:'#e8d8a0', fireCool:46},
  SNIPER:   {hp:70,  dmg:42, rng:190, spd:1.15, prod:520,  heavy:false, eng:false, col:'#b0c8e8', fireCool:115},
  BOMBARDERO:{hp:90, dmg:25, rng:135, spd:0.95, prod:560,  heavy:false, eng:false, col:'#d8a86a', fireCool:130}
};
