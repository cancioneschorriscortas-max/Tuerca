/* ============================================================
   TORRETAS OCUPABLES (v0.8)
   ============================================================ */
function tickTurrets(g){
  for(const tu of g.turrets){
    if(tu.destroyed) continue;
    if(tu.cool>0) tu.cool--;
    /* Procesar intento de entrada: unidade aliada cerca con intent */
    for(const u of g.units){
      if(u.dead) continue;
      if(u.intentEnterTurret === tu){
        const d = Math.hypot(u.x-tu.x, u.y-tu.y);
        if(d < 14 && !tu.occupant && !tu.destroyed){
          /* Ocupar — calquera equipo se a torreta está baleira; o team aliña ao novo dono */
          tu.occupant = u;
          tu.team = u.team;
          u.inside = tu;
          u.x = tu.x; u.y = tu.y;
          u.intentEnterTurret = null;
          /* Transferir selección á estructura */
          if(u.sel){ u.sel = false; tu.sel = true; }
          if(u.team===PT){
            radio(`${u.name} ocupou a torreta.`, '#7fdc7f');
            if(typeof sfx==='function') sfx('order_confirm');
          }
        } else if(tu.occupant && tu.occupant.team !== u.team){
          /* Outro equipo xa a ocupou — cancelar */
          u.intentEnterTurret = null;
        }
      }
    }
    /* Se está ocupada, disparar a inimigos en rango */
    if(tu.occupant && !tu.occupant.dead && tu.team>=0){
      let foe = null, fd = 1e9;
      for(const v of g.units){
        if(v.dead || v.team===tu.team) continue;
        if(v.inside) continue;  /* non disparar a unidades dentro doutra torreta */
        const d = Math.hypot(v.x-tu.x, v.y-tu.y);
        if(d < fd && d <= tu.rng){ foe = v; fd = d; }
      }
      /* Rotar suavemente cara o obxectivo (sprite natural apunta cara sur = π/2) */
      if(foe){
        const angleToFoe = Math.atan2(foe.y - tu.y, foe.x - tu.x);
        const target = angleToFoe - Math.PI/2;
        /* Camiño máis curto na circunferencia */
        let diff = target - tu.angle;
        while(diff > Math.PI) diff -= 2*Math.PI;
        while(diff < -Math.PI) diff += 2*Math.PI;
        tu.angle += diff * 0.18;
        /* Só dispara cando o cañón está case aliñado (±20°) */
        const aligned = Math.abs(diff) < 0.35;
        if(aligned && tu.cool<=0){
          tu.cool = tu.fireRate; sfxT('shot_turret', 85);
          const _dCobT = enCobertura(foe, {x:tu.x, y:tu.y, cls:''}, g) ? tu.dmg * 0.75 : tu.dmg;
          foe.hp -= _dCobT;
          if(foe.act) foe.act.dmgTaken += _dCobT;
          /* Boca do cañón: 18px desde o centro na dirección do foe */
          const mx = tu.x + Math.cos(angleToFoe) * 18;
          const my = tu.y + Math.sin(angleToFoe) * 18;
          g.tracers.push({x1:mx,y1:my,x2:foe.x,y2:foe.y,t:8,team:tu.team});
          if(foe.hp<=0 && !foe.dead && !cheatDeath(foe, g)){
            foe.dead = true;
            foe.deathCause = 'torreta';  /* (v0.12) memoria */
            if(tu.occupant) tu.occupant.kills++;
            g.kills[tu.team]++;
            if(foe.team !== PT) dropScrap(g, foe.x, foe.y, CHATARRA_VALUES[foe.cls] || 5);
            if(foe.team===PT){
              const place = (typeof placeAt==='function')?placeAt(foe.x,foe.y):'campo';
              g.remains.push({ x:foe.x, y:foe.y, unit:foe, timer:90*60, secured:false, place });
            }
          }
        }
      }
      /* (v0.17.1) Sen infantería en rango: atacar VEHÍCULOS inimigos (anti spawn-camp) */
      if(!foe && g.vehicles && tu.cool <= 0){
        let vf = null, vd = 1e9;
        for(const vv of g.vehicles){
          if(vv.destroyed || vv.team === tu.team || vv.team === -1) continue;
          const d = Math.hypot(vv.x - tu.x, vv.y - tu.y);
          if(d <= tu.rng && d < vd){ vf = vv; vd = d; }
        }
        if(vf){
          const ang = Math.atan2(vf.y - tu.y, vf.x - tu.x);
          let df = (ang - Math.PI/2) - tu.angle;
          while(df > Math.PI) df -= 2*Math.PI;
          while(df < -Math.PI) df += 2*Math.PI;
          tu.angle += df * 0.18;
          if(Math.abs(df) < 0.35){
            tu.cool = tu.fireRate; sfxT('shot_turret', 85);
            const sp = vf.tipo === 'TANQUE' ? 0.85 : 0.70;
            if(vf.occupant && !vf.occupant.dead){
              vf.hp -= tu.dmg * sp;
              vf.occupant.hp -= tu.dmg * (1 - sp);
              if(vf.occupant.hp <= 0){
                const dead = vf.occupant;
                dead.dead = true; dead.deathCause = 'torreta';
                g.kills[tu.team]++;
                vf.occupant = null;
                if(dead.team !== PT) dropScrap(g, vf.x, vf.y, CHATARRA_VALUES[dead.cls] || 5);
              }
            } else vf.hp -= tu.dmg;
            const mx = tu.x + Math.cos(ang) * 18, my = tu.y + Math.sin(ang) * 18;
            g.tracers.push({x1:mx, y1:my, x2:vf.x, y2:vf.y, t:8, team:tu.team});
          }
        }
      }
    }
    /* (O dano contra a torreta xestiónase desde tickUnits, na IA de cada unidade) */
    /* Se a torreta cae → roll de supervivencia do ocupante (v0.12) */
    if(tu.hp <= 0 && !tu.destroyed){
      tu.destroyed = true;
      sfxT('expl_struct', 150); addShake(g, 5.5);
      dropScrap(g, tu.x, tu.y, CHATARRA_VALUES.torreta);
      if(tu.occupant){
        const u = tu.occupant;
        tu.occupant = null;
        tu.sel = false;
        resolveEjection(u, tu.x, tu.y, 'da torreta', g);
      }
      tu.team = -1;
    }
  }
  /* IA inimiga: monitoriza continuamente a torreta vermella e reasigna canto quede baleira */
  if(g.modo === 'pvp') return;   /* (v0.35) en duelo, as torretas ocúpaas o XOGADOR 2, non a IA */
  const tRed = g.turrets.find(t=>t.id.startsWith('T_ROJO') && !t.destroyed && !t.occupant);
  if(tRed && !tRed.occupant && g.t > 60*4){
    /* ¿Algunha unidade vermella xa vai cara a torreta? */
    const someoneGoing = g.units.some(u =>
      u.team===ET && !u.dead && !u.inside && u.intentEnterTurret === tRed
    );
    if(!someoneGoing){
      /* Asignar a unidade vermella libre máis cercana */
      const candidates = g.units.filter(u =>
        u.team===ET && !u.dead && !u.inside && !u.intentEnterTurret
      );
      if(candidates.length >= 1){
        const closest = candidates.sort((a,b)=>dist(a,tRed)-dist(b,tRed))[0];
        closest.intentEnterTurret = tRed;
        if(typeof orderMove==='function') orderMove(closest, tRed.x, tRed.y);
      }
    }
  }
}

/* ============================================================
   VEHÍCULOS OCUPABLES (v0.10) — Jeeps móbiles
   ============================================================ */
function tickVehicles(g){
  if(!g.vehicles) return;
  for(const v of g.vehicles){
    if(v.destroyed) continue;
    if(v.cool > 0) v.cool--;

    /* Procesar intent de entrada (mesma lóxica das torretas) */
    for(const u of g.units){
      if(u.dead) continue;
      if(u.intentEnterVehicle === v){
        const d = Math.hypot(u.x-v.x, u.y-v.y);
        if(d < 18 && !v.occupant && !v.destroyed){
          /* Ocupar — calquera equipo pode tomar un vehículo baleiro */
          v.occupant = u;
          v.team = u.team;
          u.inside = v;
          u.x = v.x; u.y = v.y;
          u.intentEnterVehicle = null;
          /* Transferir selección á estructura para que o xogador vexa o panel do jeep */
          if(u.sel){ u.sel = false; v.sel = true; }
          if(u.team === PT){
            radio(`${u.name} ocupou o jeep.`, '#7fdc7f');
            if(typeof sfx==='function') sfx('order_confirm');
          }
        } else if(v.occupant && v.occupant.team !== u.team){
          u.intentEnterVehicle = null;
        }
      }
    }

    /* Se está ocupado: pode moverse e dispara a inimigos en rango */
    if(v.occupant && !v.occupant.dead && v.team >= 0){
      /* Se hai waypoints e chegou ao actual, pasar ao seguinte */
      if(v.waypoints && v.waypoints.length > 0){
        const w = v.waypoints[0];
        if(Math.hypot(v.x - w.x, v.y - w.y) < 18){
          v.waypoints.shift();
          if(v.waypoints.length > 0){
            v.tx = v.waypoints[0].x;
            v.ty = v.waypoints[0].y;
          }
        }
      }
      /* Movemento: se hai destino (tx, ty) e non está xa alí, móvese cara el */
      const dx = v.tx - v.x, dy = v.ty - v.y;
      const dst = Math.hypot(dx, dy);
      const moving = dst > 5;
      /* (v0.17.2) O TANQUE avanza á parte: só cara ADIANTE, tras encarar (ver abaixo) */
      if(dst > 3 && v.tipo !== 'TANQUE'){
        /* Non entrar en auga */
        const nx = v.x + (dx/dst) * v.spd;
        const ny = v.y + (dy/dst) * v.spd;
        const vbw = inWall(g, nx, ny);
        if(vbw){ v._blockingWall = vbw; }
        else if(!inWater(nx, ny)){
          v._blockingWall = null;
          v.x = nx; v.y = ny;
          /* O piloto vai dentro: actualiza tamén a súa posición */
          v.occupant.x = v.x; v.occupant.y = v.y;
        } else {
          /* Auga no medio: parar (o xogador terá que reorientar) */
          v.tx = v.x; v.ty = v.y;
        }
      }
      /* Buscar foe en rango */
      let foe = null, fd = 1e9;
      for(const e of g.units){
        if(e.dead || e.team === v.team || e.inside) continue;
        const d = Math.hypot(e.x - v.x, e.y - v.y);
        if(d < fd && d <= v.rng){ foe = e; fd = d; }
      }
      /* Rotación intencionada:
         - Movendo: capó cara o destino. Como o sprite ten orientación natural
           "capó cara OESTE", v.angle = atan2(destino) + π fai que o sprite
           rote π e o capó pase a apuntar ao destino correcto.
         - Parado con foe: metralleta cara o foe. A metralleta está na
           traseira (lado leste do sprite natural), así que v.angle = atan2(foe)
           pon o sprite sen rotación adicional e a metralleta apunta ao foe. */
      /* (v0.20.1) TANQUE anti-vehículo: o blindado inimigo é a prioridade máxima */
      let vfoe = null, vfd = 1e9;
      if(v.tipo === 'TANQUE'){
        for(const w of g.vehicles){
          if(w === v || w.destroyed || w.team === v.team || w.team === -1) continue;
          const d = Math.hypot(w.x - v.x, w.y - v.y);
          if(d <= v.rng && d < vfd){ vfoe = w; vfd = d; }
        }
      }
      /* (v0.17.1) Obxectivo estructural do TANQUE se non hai foe de infantería */
      let structT = null, structType = null;
      if(v.tipo === 'TANQUE' && !foe && !vfoe){
        let sd = 1e9;
        for(const tt of g.turrets){
          if(tt.destroyed || tt.team === v.team || tt.team === -1) continue;
          const d = Math.hypot(tt.x - v.x, tt.y - v.y);
          if(d <= v.rng && d < sd){ structT = tt; structType = 'tur'; sd = d; }
        }
        if(!structT){
          const hqF = g.hq[1 - v.team];
          const d = Math.hypot(hqF.x + hqF.w/2 - v.x, hqF.y + hqF.h/2 - v.y);
          if(d <= v.rng + 30){ structT = hqF; structType = 'hq'; }
        }
        if(!structT && v._blockingWall && !v._blockingWall.destroyed){
          const d = Math.hypot(v._blockingWall.x - v.x, v._blockingWall.y - v.y);
          if(d <= v.rng + 12){ structT = v._blockingWall; structType = 'wall'; }
        }
      }
      let targetAngle = v.angle;
      if(v.tipo === 'TANQUE'){
        /* (v0.17.2/v0.20.1) A torre é FIXA: xira o tanque enteiro cara ao que importa.
           Prioridade: VEHÍCULO inimigo > infantería > estructura > rumbo. */
        if(vfoe){
          targetAngle = Math.atan2(vfoe.y - v.y, vfoe.x - v.x);
        } else if(foe){
          targetAngle = Math.atan2(foe.y - v.y, foe.x - v.x);
        } else if(structT){
          const sx2 = structType === 'hq' ? structT.x + structT.w/2 : structT.x;
          const sy2 = structType === 'hq' ? structT.y + structT.h/2 : structT.y;
          targetAngle = Math.atan2(sy2 - v.y, sx2 - v.x);
        } else if(moving){
          targetAngle = Math.atan2(dy, dx);
        }
      } else if(moving){
        /* O sprite do jeep mira ao OESTE (+π) */
        targetAngle = Math.atan2(dy, dx) + Math.PI;
      } else if(foe){
        targetAngle = Math.atan2(foe.y - v.y, foe.x - v.x);
      }
      let diff = targetAngle - v.angle;
      while(diff > Math.PI) diff -= 2*Math.PI;
      while(diff < -Math.PI) diff += 2*Math.PI;
      v.angle += diff * (v.tipo==='TANQUE' ? 0.05 * (1 + ((v.occupant && v.occupant.skillVehFire)||0)*2) : 0.18);

      /* (v0.17.2) Avance do TANQUE: sempre cara ADIANTE no sentido do cañón.
         Só avanza se está aproximadamente encarado co destino e sen combate en rango
         (con inimigo diante, detense e bate; o xiro lento é a súa debilidade). */
      if(v.tipo === 'TANQUE' && dst > 3 && !foe && !vfoe && !structT && Math.abs(diff) < 0.5){
        const nx = v.x + Math.cos(v.angle) * v.spd;
        const ny = v.y + Math.sin(v.angle) * v.spd;
        const vbw2 = inWall(g, nx, ny);
        if(vbw2){ v._blockingWall = vbw2; }
        else if(!inWater(nx, ny)){
          v._blockingWall = null;
          v.x = nx; v.y = ny;
          v.occupant.x = v.x; v.occupant.y = v.y;
        } else {
          v.tx = v.x; v.ty = v.y;
        }
      }

      /* (v0.17.1) TANQUE: só dispara coa torreta encarada (±20°). Xiro lento = flanqueo real */
      const encarado = v.tipo !== 'TANQUE' || Math.abs(diff) < 0.35;
      /* (v0.20.1) Duelo de blindados: dano completo, split 85/15 ao piloto (70/30 se jeep) */
      if(vfoe && v.cool <= 0 && encarado){
        v.cool = Math.round(v.fireRate / (1 + ((v.occupant && v.occupant.skillVehFire) || 0)));
        const sp = vfoe.tipo === 'TANQUE' ? 0.85 : 0.70;
        if(vfoe.occupant && !vfoe.occupant.dead){
          vfoe.hp -= v.dmg * sp;
          vfoe.occupant.hp -= v.dmg * (1 - sp);
          if(vfoe.occupant.hp <= 0){
            const dead = vfoe.occupant;
            dead.dead = true; dead.deathCause = 'TANQUE';
            g.kills[v.team]++;
            vfoe.occupant = null;
            if(dead.team !== PT) dropScrap(g, vfoe.x, vfoe.y, CHATARRA_VALUES[dead.cls] || 5);
            if(dead.team === 0) radioSay('fallen', dead, {place: placeAt(dead.x, dead.y)}, '#ff5340');
          }
        } else {
          vfoe.hp -= v.dmg * sp;
        }
        const bx = v.x + Math.cos(v.angle) * 28, by = v.y + Math.sin(v.angle) * 28;
        g.tracers.push({x1:bx, y1:by, x2:vfoe.x, y2:vfoe.y, t:8, team:v.team});
        v._revealT = g.t;
        sfxT('shot_tank', 110);
        addShake(g, 2.2);
      }
      /* Ataque a estructuras do TANQUE: 50% de dano */
      if(structT && v.cool <= 0 && encarado){
        v.cool = Math.round(v.fireRate / (1 + ((v.occupant && v.occupant.skillVehFire) || 0))); sfxT(v.tipo==='TANQUE'?'shot_tank':'shot_jeep', 110); v._revealT = g.t; if(v.tipo==='TANQUE') addShake(g, 2.2);
        const dS = v.dmg * 0.5;
        if(structType === 'wall'){
          damageWall(g, structT, dS);
        } else if(structType === 'hq'){
          const hqIdx2 = g.hq.indexOf(structT);
          if(hqEscudado(g, hqIdx2)){ avisoEscudo(g, hqIdx2, v.team); }
          else { structT.hp -= dS; structT.lastDamageT = g.t; }
        } else {
          if(structT.occupant && !structT.occupant.dead){
            structT.hp -= dS * 0.7;
            structT.occupant.hp -= dS * 0.3;
            if(structT.occupant.hp <= 0){
              const dead = structT.occupant;
              dead.dead = true; dead.deathCause = 'TANQUE';
              g.kills[v.team]++;
              structT.occupant = null;
              if(dead.team !== PT) dropScrap(g, structT.x, structT.y, CHATARRA_VALUES[dead.cls] || 5);
            }
          } else structT.hp -= dS;
        }
        const sx2 = structType === 'hq' ? structT.x + structT.w/2 : structT.x;
        const sy2 = structType === 'hq' ? structT.y + structT.h/2 : structT.y;
        const bx = v.x + Math.cos(v.angle) * 28, by = v.y + Math.sin(v.angle) * 28;
        g.tracers.push({x1:bx, y1:by, x2:sx2, y2:sy2, t:8, team:v.team});
      }
      if(foe && v.cool <= 0 && encarado){
        v.cool = Math.round(v.fireRate / (1 + ((v.occupant && v.occupant.skillVehFire) || 0))); sfxT(v.tipo==='TANQUE'?'shot_tank':'shot_jeep', 110); v._revealT = g.t; if(v.tipo==='TANQUE') addShake(g, 2.2);
        const _dCobV = enCobertura(foe, {x:v.x, y:v.y, cls:''}, g) ? v.dmg * 0.75 : v.dmg;
        foe.hp -= _dCobV;
        if(foe.act) foe.act.dmgTaken += _dCobV;
        /* Boca do cañón: punta do tubo coa rotación real (28px no tanque) */
        const barrel = v.tipo === 'TANQUE' ? 28 : 16;
        const mx = v.x + Math.cos(v.angle) * barrel;
        const my = v.y + Math.sin(v.angle) * barrel;
        g.tracers.push({x1:mx, y1:my, x2:foe.x, y2:foe.y, t:8, team:v.team});
        if(foe.hp <= 0 && !foe.dead && !cheatDeath(foe, g)){
          foe.dead = true;
          foe.deathCause = (v.tipo==='TANQUE') ? 'TANQUE' : 'jeep';  /* (v0.12) memoria */
          if(v.occupant) v.occupant.kills++;
          g.kills[v.team]++;
          if(foe.team !== PT) dropScrap(g, foe.x, foe.y, CHATARRA_VALUES[foe.cls] || 5);
          if(foe.team === PT){
            const place = (typeof placeAt === 'function') ? placeAt(foe.x, foe.y) : 'campo';
            g.remains.push({ x:foe.x, y:foe.y, unit:foe, timer:90*60, secured:false, place });
          }
        }
      }
    }

    /* Se o vehículo cae → destruír, roll de supervivencia do ocupante (v0.12) */
    if(v.hp <= 0 && !v.destroyed){
      v.destroyed = true;
      sfxT('expl_struct', 150); addShake(g, 5.5);
      dropScrap(g, v.x, v.y, CHATARRA_VALUES.jeep);
      if(v.occupant){
        const u = v.occupant;
        v.occupant = null;
        v.sel = false;
        v.tx = v.x; v.ty = v.y;
        resolveEjection(u, v.x, v.y, 'do jeep', g);
      }
      v.team = -1;
    }
  }

  /* IA inimiga: monitoriza J_ROJO igual ca T_ROJO */
  const jRed = g.vehicles ? g.vehicles.find(j => j.id.startsWith('J_ROJO') && !j.destroyed && !j.occupant) : null;
  if(jRed && !jRed.occupant && g.t > 60*5 && g.modo !== 'pvp'){   /* (v0.35) o jeep é do xogador 2 */
    const someoneGoing = g.units.some(u =>
      u.team === ET && !u.dead && !u.inside && u.intentEnterVehicle === jRed
    );
    if(!someoneGoing){
      const candidates = g.units.filter(u =>
        u.team === ET && !u.dead && !u.inside && !u.intentEnterTurret && !u.intentEnterVehicle
      );
      if(candidates.length >= 1){
        const closest = candidates.sort((a,b) => dist(a, jRed) - dist(b, jRed))[0];
        closest.intentEnterVehicle = jRed;
        if(typeof orderMove === 'function') orderMove(closest, jRed.x, jRed.y);
      }
    }
  }
  /* Cando un jeep inimigo está ocupado, dálle ó condutor un destino útil:
     un sector inimigo cercano ou o HQ aliado */
  if(g.vehicles && g.modo !== 'pvp'){   /* (v0.35) en duelo conduce o xogador 2, non a IA */
    for(const veh of g.vehicles){
      if(veh.destroyed || !veh.occupant || veh.team !== ET) continue;
      /* Cada 90 frames asignar novo destino */
      if(g.t % 90 !== 0) continue;
      /* Buscar sector non controlado polo equipo 1 cercano */
      let targetX = g.hq[PT].x + g.hq[PT].w/2, targetY = g.hq[PT].y + g.hq[PT].h/2;
      let bestD = 1e9;
      for(const s of g.sectors){
        if(s.owner === ET) continue;
        const d = Math.hypot(s.x - veh.x, s.y - veh.y);
        if(d < bestD){ bestD = d; targetX = s.x; targetY = s.y; }
      }
      /* Se require cruzar río, vai pola ponte primeiro */
      if(crossesRiver(veh.x, targetX)){
        veh.waypoints = [{x:BRIDGE_CENTER.x, y:BRIDGE_CENTER.y}, {x:targetX, y:targetY}];
        veh.tx = BRIDGE_CENTER.x; veh.ty = BRIDGE_CENTER.y;
      } else {
        veh.waypoints = [];
        veh.tx = targetX; veh.ty = targetY;
      }
    }
  }
}

function tickSectors(g){
  for(const s of g.sectors){
    let n0=0, n1=0, e0=0;
    let capturing0 = null;  /* unidad propia para registrar evento */
    for(const u of g.units){
      if(u.dead) continue;
      if(dist(u,s)<s.r){
        if(u.team===PT){ n0++; if(u.eng)e0+=2; capturing0=capturing0||u; }
        else n1++;
      }
    }
    const prevOwner = s.owner;
    if(n0>0 && n1===0){
      s.prog += (n0+e0)*0.18;
      /* (v0.15) CONQUISTADOR: as unidades coa skill capturan máis rápido */
      for(const cu of g.units){
        if(!cu.dead && cu.team===PT && !cu.inside && cu.skillCap && dist(cu,s)<s.r) s.prog += 0.18 * cu.skillCap;
      }
      if(s.prog>=100 && s.owner!==PT){
        s.owner=PT; s.prog=100;
        sfx('order_confirm');
        if(prevOwner!==PT && capturing0){
          radioSay('captured_sector', capturing0, {place:s.place, sectorId:s.id}, '#7fdc7f');
          /* Registrar evento en todas las unidades azules dentro del sector */
          for(const u of g.units){
            if(u.dead||u.team!==PT) continue;
            if(dist(u,s)<s.r){
              logEvent(u, {type:'CAPTURO_SECTOR', place:s.place});
              if(u.team === PT) sfx('capture');
              u.capturesThisOp = (u.capturesThisOp||0) + 1;
              if(u.act) u.act.caps++;
            }
          }
        }
      }
    } else if(n1>0 && n0===0){
      s.prog -= n1*0.18;
      if(s.prog<=-100 && s.owner!==ET){
        s.owner=ET; s.prog=-100;
        radioSay('sector_lost', null, {sectorId:s.id}, '#ff5340');
      }
    }
    s.prog=clamp(s.prog,-100,100);
  }
}

function tickRadar(g){
  const r = g.radar;
  /* Quién hay en el radio de captura */
  let n0 = 0, n1 = 0;
  for(const u of g.units){
    if(u.dead) continue;
    const d = Math.hypot(u.x - r.x, u.y - r.y);
    if(d < r.capRadius){
      if(u.team === PT) n0 += (u.eng ? 2 : 1);
      else             n1 += (u.eng ? 2 : 1);
    }
  }
  const prevOwner = r.owner;
  if(n0 > 0 && n1 === 0){
    r.prog += n0 * 0.22;
    if(r.prog >= 100 && r.owner !== PT){
      r.owner = PT; r.prog = 100;
      radioSay('radar_captured_blue', null, {}, '#7fdc7f');
      sfx('order_confirm');
      playSysVoice('radar_us');
      announceRecurring(g);
    }
  } else if(n1 > 0 && n0 === 0){
    r.prog -= n1 * 0.22;
    if(r.prog <= -100 && r.owner !== ET){
      r.owner = ET; r.prog = -100;
      if(prevOwner === 0){
        radioSay('radar_captured_red', null, {}, '#ff5340');
        playSysVoice('radar_them');
      } else {
        radioSay('radar_neutral', null, {}, '#ff8');
      }
    }
  }
  r.prog = clamp(r.prog, -100, 100);
}

/* Anuncia los enemigos recurrentes en el campo cuando el bando azul tiene el radar */
function announceRecurring(g){
  const recurrentEnemies = g.units.filter(u =>
    u.team === ET && !u.dead && u.traits.includes('VUELVE_A_POR_TI')
  );
  for(const r of recurrentEnemies){
    radioSay('recurring_announce', null, {name: r.name, appearances: r.appearances}, '#ffd24a');
  }
}

function tickEnd(g){
  if(g.over) return;
  if(g.hq[ET].hp<=0){ g.over=true; g.result='victory'; }
  else if(g.hq[PT].hp<=0){ g.over=true; g.result='defeat'; }
  if(g.over) setTimeout(()=>endBattle(g), 700);
}

/* ---------- Render ---------- */
const cv=$('cv'), ctx=cv.getContext('2d');
function draw(g){
  /* Fondo: terreno por celdas (cache estático + ondas de agua animadas) */
  if(TERRAIN_CACHE){
    ctx.drawImage(TERRAIN_CACHE, 0, 0);
    drawWaterRipples(ctx, TERRAIN_GRID, g);
  } else {
    ctx.fillStyle='#161d12';
    ctx.fillRect(0,0,W,H);
  }
  /* Sectores */
  for(const s of g.sectors){
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,7);
    ctx.strokeStyle = s.owner===0?'#4f8aff': s.owner===1?'#ff5340':'#777';
    ctx.lineWidth=2; ctx.stroke(); ctx.lineWidth=1;
    ctx.fillStyle='#999'; ctx.font='bold 13px Courier New';
    ctx.fillText('SECTOR '+s.id, s.x-32, s.y-s.r-6);
    if(Math.abs(s.prog)>2 && Math.abs(s.prog)<100){
      ctx.fillStyle='#000'; ctx.fillRect(s.x-26,s.y+s.r+4,52,5);
      ctx.fillStyle=s.prog>0?'#4f8aff':'#ff5340';
      ctx.fillRect(s.x-26,s.y+s.r+4,52*Math.abs(s.prog)/100,5);
    }
  }
  /* HQs */
  for(const h of g.hq){
    const cx = h.x + h.w/2, cy = h.y + h.h/2;
    const img = h.team===0 ? ASSETS.hqBlue : ASSETS.hqRed;
    if(img){
      /* Sprite escalado para que cuadre coa hitbox h.w x h.h, con un pouco máis de altura */
      const sw = h.w * 1.45, sh = h.h * 1.35;
      ctx.drawImage(img, cx - sw/2, cy - sh/2 - 4, sw, sh);
    } else {
      /* Fallback rectángulo da v0.4 */
      ctx.fillStyle = h.team===0?'#27406e':'#6e2a22';
      ctx.fillRect(h.x,h.y,h.w,h.h);
      ctx.strokeStyle=h.team===0?'#4f8aff':'#ff5340'; ctx.strokeRect(h.x,h.y,h.w,h.h);
      ctx.fillStyle='#ddd'; ctx.font='11px Courier New';
      ctx.fillText('HQ', h.x+h.w/2-8, h.y+h.h/2+4);
    }
    /* Barra de HP encima */
    ctx.fillStyle='#000'; ctx.fillRect(h.x,h.y-10,h.w,5);
    ctx.fillStyle=h.team===0?'#4f8aff':'#ff5340';
    ctx.fillRect(h.x,h.y-10,h.w*Math.max(0,h.hp)/h.max,5);
  }
  /* Radar Central */
  const r = g.radar;
  /* Radio de captura */
  ctx.beginPath(); ctx.arc(r.x, r.y, r.capRadius, 0, 7);
  ctx.strokeStyle = r.owner===0?'#4f8aff':(r.owner===1?'#ff5340':'#777');
  ctx.lineWidth = 1; ctx.stroke();
  /* Sprite do Radar segundo dono */
  const radarImg = r.owner===0 ? ASSETS.radarBlue : (r.owner===1 ? ASSETS.radarRed : ASSETS.radarNeutral);
  if(radarImg){
    const sw = r.w * 1.4, sh = r.h * 2.6;  /* máis alto para incluír antena */
    ctx.drawImage(radarImg, r.x - sw/2, r.y - sh/2 + 6, sw, sh);
  } else {
    /* Fallback debuxo da v0.4 */
    ctx.fillStyle = r.owner===0?'#27406e':(r.owner===1?'#6e2a22':'#3a3530');
    ctx.fillRect(r.x - r.w/2, r.y - r.h/2, r.w, r.h);
    ctx.strokeStyle = r.owner===0?'#4f8aff':(r.owner===1?'#ff5340':'#999');
    ctx.lineWidth = 2; ctx.strokeRect(r.x - r.w/2, r.y - r.h/2, r.w, r.h);
    ctx.fillStyle = r.owner>=0?'#ffd24a':'#888';
    ctx.fillRect(r.x - 2, r.y - r.h/2 - 14, 4, 14);
    ctx.save();
    ctx.translate(r.x, r.y - r.h/2 - 14);
    const rot = (g.t / 60) % (Math.PI*2);
    ctx.rotate(rot);
    ctx.fillStyle = r.owner===0?'#4f8aff':(r.owner===1?'#ff5340':'#aaa');
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  /* Etiqueta */
  ctx.fillStyle = '#999'; ctx.font='10px Courier New';
  ctx.fillText('RADAR', r.x-15, r.y + r.h/2 + 18);
  /* Barra de progreso */
  if(Math.abs(r.prog)>2 && Math.abs(r.prog)<100){
    ctx.fillStyle='#000'; ctx.fillRect(r.x-22, r.y + r.h/2 + 24, 44, 5);
    ctx.fillStyle = r.prog>0?'#4f8aff':'#ff5340';
    ctx.fillRect(r.x-22, r.y + r.h/2 + 24, 44*Math.abs(r.prog)/100, 5);
  }
  /* (v0.23) Marcadores de subquests: diamante violeta pulsante */
  if(g.subquests){
    for(const q of g.subquests){
      if(q._gone || q.done || q.failed) continue;
      const pulso = 0.5 + 0.5 * Math.sin(g.t * 0.12);
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.4 * pulso;
      ctx.strokeStyle = '#b48aff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - 14); ctx.lineTo(q.x + 10, q.y); ctx.lineTo(q.x, q.y + 14); ctx.lineTo(q.x - 10, q.y);
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      /* a caixa da tecnoloxía */
      if(q.tipo === 'TECNOLOXIA' && !q.done){
        ctx.fillStyle = '#4a4058';
        ctx.fillRect(q.x - 7, q.y - 5, 14, 10);
        ctx.strokeStyle = '#b48aff'; ctx.lineWidth = 1;
        ctx.strokeRect(q.x - 7, q.y - 5, 14, 10);
        if(q.progress > 0){
          ctx.fillStyle = '#333'; ctx.fillRect(q.x - 9, q.y - 12, 18, 3);
          ctx.fillStyle = '#b48aff'; ctx.fillRect(q.x - 9, q.y - 12, Math.round(18 * q.progress / q.progressMax), 3);
        }
      }
    }
  }
  /* (v0.22) Pantasma de colocación do muro */
  if(g.wallPlacing){
    const r = cv.getBoundingClientRect();
    if(r.width > 0){
      const mx = (_mouseClient.x - r.left) * (cv.width / r.width) + cam.x;
      const my = (_mouseClient.y - r.top) * (cv.height / r.height) + cam.y;
      const ok = validWallSpot(mx, my, g);
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = ok ? '#5a5a4a' : '#6e2a22';
      ctx.fillRect(mx - 8, my - 8, 16, 16);
      ctx.strokeStyle = ok ? '#7fdc7f' : '#ff5340';
      ctx.strokeRect(mx - 8, my - 8, 16, 16);
      ctx.restore();
    }
  }
  /* (v0.22) Obras en curso: contorno + barra de progreso */
  for(const u of g.units){
    if(u.dead || !u.buildTask) continue;
    const bt = u.buildTask;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#c8a86a';
    ctx.setLineDash([3,3]);
    ctx.strokeRect(bt.x - 8, bt.y - 8, 16, 16);
    ctx.setLineDash([]);
    if(bt.progress > 0){
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#333';
      ctx.fillRect(bt.x - 9, bt.y - 14, 18, 3);
      ctx.fillStyle = '#c8a86a';
      ctx.fillRect(bt.x - 9, bt.y - 14, Math.round(18 * bt.progress / WALL_BUILD.frames), 3);
    }
    ctx.restore();
  }
  /* (v0.20) Pantasma de colocación da torreta */
  if(g.turretPending > 0){
    const r = cv.getBoundingClientRect();
    if(r.width > 0){
      const mx = (_mouseClient.x - r.left) * (cv.width / r.width) + cam.x;
      const my = (_mouseClient.y - r.top) * (cv.height / r.height) + cam.y;
      const ok = validTurretSpot(mx, my, g);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ok ? '#3a6e3a' : '#6e2a22';
      ctx.fillRect(mx - 12, my - 12, 24, 24);
      ctx.strokeStyle = ok ? '#7fdc7f' : '#ff5340';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, TURRET_BUILD.rng, 0, 7); ctx.stroke();
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(mx, my, VISION.TURRET, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  /* (v0.20) Círculo de visión das unidades seleccionadas (mostra o sniper asentándose) */
  for(const u of g.units){
    if(u.dead || u.inside || !u.sel || u.team !== PT) continue;
    let vr;
    if(u.cls === 'SNIPER'){
      vr = (g.t - (u._movedT || 0) > VISION.SNIPER_STILL_FRAMES) ? VISION.SNIPER_STILL : VISION.SNIPER_MOVE;
    } else vr = VISION[u.cls] || 150;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#8ac0ff';
    ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.arc(u.x, u.y, vr, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  /* (v0.26.2) CAMPO DE FORZA do escudo de subministro: cúpula translúcida */
  for(let hi = 0; hi < g.hq.length; hi++){
    if(g.hq[hi].hp <= 0 || !hqEscudado(g, hi)) continue;
    const h = g.hq[hi];
    const cx2 = h.x + h.w/2, cy2 = h.y + h.h/2;
    const R = Math.max(h.w, h.h) * 0.85;
    const col = hi === 0 ? '110,170,255' : '255,140,110';
    const p = 0.5 + 0.3 * Math.sin(g.t * 0.07);
    ctx.save();
    /* cúpula: recheo translúcido con dobre bordo */
    const grad = ctx.createRadialGradient(cx2, cy2, R * 0.5, cx2, cy2, R);
    grad.addColorStop(0, `rgba(${col},0.04)`);
    grad.addColorStop(0.8, `rgba(${col},0.10)`);
    grad.addColorStop(1, `rgba(${col},${0.20 * p})`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(cx2, cy2, R, R * 0.8, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.55 * p})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx2, cy2, R, R * 0.8, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},0.25)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx2, cy2, R - 4, (R - 4) * 0.8, 0, 0, 7); ctx.stroke();
    /* faísca hexagonal viaxeira: o campo está VIVO */
    const a1 = (g.t * 0.03) % 6.283;
    ctx.strokeStyle = `rgba(${col},0.8)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx2, cy2, R, R * 0.8, 0, a1, a1 + 0.5); ctx.stroke();
    ctx.font = 'bold 9px Courier New';
    ctx.fillStyle = `rgba(${col},0.9)`;
    ctx.fillText('⛨ ESCUDO DE SUMINISTRO', cx2 - 62, cy2 - R * 0.8 - 6);
    ctx.restore();
  }
  /* (v0.26) Cráteres: as cicatrices do chan */
  if(g.craters){
    for(const cr of g.craters){
      ctx.save();
      ctx.fillStyle = 'rgba(18,14,10,0.5)';
      ctx.beginPath(); ctx.ellipse(cr.x, cr.y, cr.r, cr.r*0.72, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(60,48,36,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cr.x, cr.y, cr.r, cr.r*0.72, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
  /* (v0.13) Muros */
  if(g.walls){
    for(const w of g.walls){
      if(w.destroyed){
        ctx.fillStyle = '#3a352c';
        ctx.fillRect(w.x-7, w.y-4, 5, 4); ctx.fillRect(w.x+1, w.y-2, 6, 5);
        continue;
      }
      const dmg = 1 - w.hp / w.max;
      ctx.fillStyle = '#5a5a62';
      ctx.fillRect(w.x-8, w.y-8, 16, 16);
      ctx.fillStyle = '#43434a';
      ctx.fillRect(w.x-8, w.y-8, 16, 4);
      ctx.fillRect(w.x-8, w.y+4, 16, 4);
      if(dmg > 0.3){ ctx.fillStyle = '#2a2a30'; ctx.fillRect(w.x-4, w.y-6, 3, 10); }
      if(dmg > 0.6){ ctx.fillStyle = '#1a1a20'; ctx.fillRect(w.x+2, w.y-7, 4, 12); }
    }
  }
  /* (v0.12) Chatarra no chan */
  if(g.scrap){
    for(const s of g.scrap){
      if(s.collected) continue;
      if(!posVisible(s.x, s.y)) continue;   /* (v0.20) néboa */
      if(s.peza){
        /* Peza dun caído: vermello-dourado pulsante con engrenaxe */
        const pulse = 0.65 + 0.35*Math.sin(g.t*0.18);
        ctx.fillStyle = `rgba(255,120,60,${pulse})`;
        ctx.fillRect(s.x-6, s.y-6, 12, 12);
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1;
        ctx.strokeRect(s.x-9, s.y-9, 18, 18);
        ctx.fillStyle = '#ffd700'; ctx.font='9px Courier New';
        ctx.fillText('⚙', s.x-4, s.y+3);
        continue;
      }
      if(s.loot){
        /* Botín: peza dourada pulsante */
        const pulse = 0.7 + 0.3*Math.sin(g.t*0.15);
        ctx.fillStyle = `rgba(255,215,0,${pulse})`;
        ctx.fillRect(s.x-5, s.y-5, 10, 10);
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1;
        ctx.strokeRect(s.x-8, s.y-8, 16, 16);
        ctx.fillStyle = '#ffd700'; ctx.font='8px Courier New';
        ctx.fillText('★', s.x-3, s.y+14);
        continue;
      }
      /* montonciño de pezas gris/ferruxe */
      ctx.fillStyle = '#6a5a48';
      ctx.fillRect(s.x-5, s.y-3, 10, 6);
      ctx.fillStyle = '#8a7a60';
      ctx.fillRect(s.x-3, s.y-6, 6, 4);
      ctx.fillStyle = '#4a3a30';
      ctx.fillRect(s.x+1, s.y-1, 5, 4);
      ctx.fillStyle = '#c8a86a';
      ctx.font='8px Courier New';
      ctx.fillText('+'+s.amount, s.x-6, s.y+12);
    }
  }
  /* Restos */
  for(const r of g.remains){
    if(r.expired) continue;
    /* Color según estado */
    ctx.fillStyle = r.secured ? '#ffd24a' : '#5a3a30';
    ctx.fillRect(r.x-7, r.y-7, 14, 14);
    ctx.strokeStyle = r.secured ? '#ffd24a' : '#8a4a40';
    ctx.strokeRect(r.x-7, r.y-7, 14, 14);
    /* Cruz */
    ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.moveTo(r.x-5,r.y-5); ctx.lineTo(r.x+5,r.y+5);
    ctx.moveTo(r.x+5,r.y-5); ctx.lineTo(r.x-5,r.y+5); ctx.stroke();
    /* Timer si no asegurado */
    if(!r.secured){
      const pct = r.timer/(90*60);
      ctx.fillStyle='#000'; ctx.fillRect(r.x-8, r.y+9, 16, 3);
      ctx.fillStyle = pct>0.5?'#7fdc7f':(pct>0.25?'#ffd24a':'#ff5340');
      ctx.fillRect(r.x-8, r.y+9, 16*pct, 3);
    }
    /* Etiqueta */
    ctx.fillStyle = r.secured ? '#ffd24a' : '#aa6a60';
    ctx.font='9px Courier New';
    ctx.fillText(r.unit.name, r.x - r.unit.name.length*2.5, r.y-12);
  }
  /* Torretas (v0.8) — pequenas, rotan cara o obxectivo */
  for(const tu of g.turrets){
    if(tu.destroyed) continue;
    let img = null;
    if(tu.occupant && tu.team===0) img = ASSETS.turretBlueManned;
    else if(tu.occupant && tu.team===1) img = ASSETS.turretRedManned;
    else if(tu.team===0) img = ASSETS.turretBlueEmpty;
    else if(tu.team===1) img = ASSETS.turretRedEmpty;
    else img = ASSETS.turretNeutral;
    const sw = 32, sh = 32;
    if(img){
      ctx.save();
      ctx.translate(tu.x, tu.y);
      ctx.rotate(tu.angle || 0);
      ctx.drawImage(img, -sw/2, -sh/2, sw, sh);
      ctx.restore();
    } else {
      ctx.fillStyle = tu.team===0?'#27406e':(tu.team===1?'#6e2a22':'#3a3a3a');
      ctx.beginPath(); ctx.arc(tu.x, tu.y, 14, 0, 7); ctx.fill();
      ctx.strokeStyle = '#bbb'; ctx.stroke();
    }
    /* HP bar (cinza se está baleira, verde/amarela/vermella se ocupada ou neutral) */
    const hpFrac = Math.max(0, tu.hp/tu.max);
    const empty = !tu.occupant && tu.team>=0;  /* baleira pero ten cor de equipo */
    ctx.fillStyle = '#000'; ctx.fillRect(tu.x-15, tu.y-22, 30, 3);
    if(empty){
      ctx.fillStyle = '#666';
    } else {
      ctx.fillStyle = hpFrac>0.5?'#7fdc7f':(hpFrac>0.25?'#ffd24a':'#ff5340');
    }
    ctx.fillRect(tu.x-15, tu.y-22, 30*hpFrac, 3);
    /* Anel de selección */
    if(tu.sel){
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(tu.x, tu.y, 20, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    /* Etiqueta: LIBRE (neutral) ou VACIA (cor pero sen piloto) */
    if(!tu.occupant && !tu.destroyed){
      ctx.font = '8px Courier New';
      ctx.textAlign = 'center';
      if(tu.team===-1){
        ctx.fillStyle = '#bbb';
        ctx.fillText('LIBRE', tu.x, tu.y + 26);
      } else {
        /* Pulsar a etiqueta para chamar a atención */
        const pulse = 0.5 + 0.5*Math.sin(g.t * 0.15);
        ctx.fillStyle = tu.team===0 ? `rgba(127,176,255,${0.55+0.45*pulse})` : `rgba(255,127,127,${0.55+0.45*pulse})`;
        ctx.fillText('VACIA', tu.x, tu.y + 26);
      }
      ctx.textAlign = 'start';
    }
  }
  /* Vehículos JEEP (v0.9) — móbiles. Render parecido ás torretas */
  if(g.vehicles){
    for(const v of g.vehicles){
      if(v.destroyed) continue;
      if(v.team === ET && !vehVisible(v, g)) continue;   /* (v0.20) néboa */
      if(v.tipo === 'TANQUE'){
        /* (v0.17.2) Sprite do tanque: cañón cara ao SUR na imaxe →
           rotar por (v.angle - π/2) para que o cañón apunte na dirección real */
        const timg = v.team===0 ? ASSETS.tankBlue : (v.team===1 ? ASSETS.tankRed : ASSETS.tankNeutral);
        if(timg && timg.complete){
          ctx.save();
          ctx.translate(v.x, v.y);
          ctx.rotate((v.angle || 0) - Math.PI/2);
          ctx.drawImage(timg, -timg.width/2, -timg.height/2);
          ctx.restore();
        } else {
          /* Fallback mínimo se o sprite non cargou */
          ctx.fillStyle = v.team===0 ? '#2f5a96' : (v.team===1 ? '#a03028' : '#7a7a7a');
          ctx.fillRect(v.x-16, v.y-16, 32, 32);
        }
        /* HP + selección + etiqueta reutilizan o código común de abaixo */
      }
      let img = null;
      if(v.tipo !== 'TANQUE'){
        if(v.team === 0) img = ASSETS.jeepBlue;
        else if(v.team === 1) img = ASSETS.jeepRed;
        else img = ASSETS.jeepNeutral;
      }
      /* Sprite natural cara LESTE → ángulo 0 = leste */
      const sw = 44, sh = 36;
      if(img){
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle || 0);
        ctx.drawImage(img, -sw/2, -sh/2, sw, sh);
        ctx.restore();
      } else if(v.tipo !== 'TANQUE'){
        /* Fallback */
        ctx.fillStyle = v.team===0?'#27406e':(v.team===1?'#6e2a22':'#3a3a3a');
        ctx.fillRect(v.x-22, v.y-18, 44, 36);
      }
      /* HP bar */
      const hpFrac = Math.max(0, v.hp/v.max);
      const empty = !v.occupant && v.team>=0;
      ctx.fillStyle = '#000'; ctx.fillRect(v.x-22, v.y-26, 44, 3);
      ctx.fillStyle = empty ? '#666' : (hpFrac>0.5?'#7fdc7f':(hpFrac>0.25?'#ffd24a':'#ff5340'));
      ctx.fillRect(v.x-22, v.y-26, 44*hpFrac, 3);
      /* Selección */
      if(v.sel){
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.arc(v.x, v.y, 28, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
      }
      /* Etiqueta LIBRE/VACIA */
      if(!v.occupant && !v.destroyed){
        ctx.font = '8px Courier New';
        ctx.textAlign = 'center';
        if(v.team === -1){
          ctx.fillStyle = '#bbb';
          ctx.fillText('LIBRE', v.x, v.y + 32);
        } else {
          const pulse = 0.5 + 0.5*Math.sin(g.t * 0.15);
          ctx.fillStyle = v.team===0 ? `rgba(127,176,255,${0.55+0.45*pulse})` : `rgba(255,127,127,${0.55+0.45*pulse})`;
          ctx.fillText('VACIO', v.x, v.y + 32);
        }
        ctx.textAlign = 'start';
      }
    }
  }
  /* Tracers */
  /* (v0.25) Explosións: anel expansivo */
  if(g.booms){
    for(const b of g.booms){
      b.t--;
      const prog = 1 - b.t / 14;
      const r = prog * (b.big ? 34 : 16);
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.t / 14);
      ctx.strokeStyle = b.big ? '#ffb050' : '#ff8a50';
      ctx.lineWidth = b.big ? 3 : 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.stroke();
      if(prog < 0.4){
        ctx.fillStyle = '#fff2c8';
        ctx.beginPath(); ctx.arc(b.x, b.y, (b.big ? 8 : 4) * (1 - prog*2), 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    g.booms = g.booms.filter(b => b.t > 0);
  }
  for(const t of g.tracers){
    /* (v0.25) fogonazo de boca nos 2 primeiros frames */
    if(t.t >= 7){
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff7d0';
      ctx.beginPath(); ctx.arc(t.x1, t.y1, 3, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = t.team===0?'#bdf':'#fb9';
    ctx.beginPath(); ctx.moveTo(t.x1,t.y1); ctx.lineTo(t.x2,t.y2); ctx.stroke();
    t.t--;
  }
  g.tracers=g.tracers.filter(t=>t.t>0);
  /* Unidades */
  for(const u of g.units){
    if(u.dead) continue;
    if(u.inside) continue;  /* dentro dunha torreta — non debuxar */
    if(u.team === ET && !foeVisible(u, g)) continue;   /* (v0.20) néboa */
    const c = u.team===0?'#4f8aff':(u.team===2?'#b8bcc0':'#ff5340');
    ctx.fillStyle=c;
    /* (v0.24.1) Veterano de VOLT: nome vermello — sabes a quen estás matando */
    if(u._voltVet && !u.dead){
      ctx.fillStyle = '#ff7a5a';
      ctx.font = '8px Courier New';
      ctx.fillText(u.name, u.x - 12, u.y - 14);
      ctx.fillStyle = c;
    }
    /* (v0.23.2) Acentos de identidade: medalla (pixel dourado fixo) + soldadura (reensamblado) */
    if(u.team === PT && u.medalsN > 0){
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(u.x + 6, u.y - 9, 2, 2);
      if(u.medalsN >= 3) ctx.fillRect(u.x + 6, u.y - 6, 2, 2);
      ctx.fillStyle = c;
    }
    if(u.team === PT && u.reensamblado){
      ctx.strokeStyle = '#ff9a3c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(u.x - 5, u.y + 2); ctx.lineTo(u.x + 5, u.y - 1);
      ctx.stroke();
    }
    /* (v0.21 R2) Vínculo activo: estrela dourada */
    if(u._vinculoActivo && !u.dead && u.team === PT){
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(u.x - 1, u.y - 15, 3, 3);
      ctx.fillRect(u.x - 3, u.y - 14, 7, 1);
      ctx.fillStyle = c;
    }
    if(u._pezaPortada && !u.dead){
      const pp = 0.5 + 0.5*Math.sin(g.t*0.2);
      ctx.fillStyle = `rgba(255,150,60,${pp})`;
      ctx.fillRect(u.x-3, u.y-16, 6, 4);
      ctx.fillStyle = c;
    }
    if(u.cls==='HEAVY'){ ctx.fillRect(u.x-7,u.y-6,14,12); }
    else if(u.cls==='ENGINEER'){ ctx.fillRect(u.x-5,u.y-5,10,10); ctx.fillRect(u.x+4,u.y-8,4,4); }
    else if(u.cls==='SNIPER'){
      /* Delgado e alto, con cañón longo e visor teal */
      ctx.fillRect(u.x-3,u.y-8,6,16);
      ctx.fillRect(u.x+3,u.y-5,11,2);          /* cañón longo */
      ctx.fillStyle='#7fe8e8'; ctx.fillRect(u.x-1,u.y-7,3,3);  /* visor */
      ctx.fillStyle=c;
    }
    else if(u.cls==='BOMBARDERO'){
      /* Ancho, con mochila de bombas laranxa */
      ctx.fillRect(u.x-6,u.y-5,12,11);
      ctx.fillStyle='#ff9a3c';
      ctx.fillRect(u.x-8,u.y-8,5,5); ctx.fillRect(u.x+3,u.y-8,5,5);  /* bombas */
      ctx.fillStyle=c;
    }
    else { ctx.fillRect(u.x-5,u.y-6,10,12); }
    ctx.fillStyle='#fff'; ctx.fillRect(u.x-2,u.y-9,4,4);
    if(u.sel){ ctx.strokeStyle='#fff'; ctx.strokeRect(u.x-10,u.y-12,20,24); }
    if(u.ops>=3){ ctx.fillStyle='#ffd24a'; ctx.fillRect(u.x-8,u.y-12,3,3); }
    /* Marca de enemigo recurrente: corona pequeña sobre la cabeza */
    if(u.team===ET && u.traits && u.traits.includes('VUELVE_A_POR_TI')){
      ctx.fillStyle='#ff8050';
      ctx.fillRect(u.x-4, u.y-14, 8, 2);
      ctx.fillRect(u.x-2, u.y-16, 4, 2);
    }
    ctx.fillStyle='#000'; ctx.fillRect(u.x-8,u.y+9,16,3);
    ctx.fillStyle=u.hp>u.max*0.34?'#7fdc7f':'#ff5340';
    ctx.fillRect(u.x-8,u.y+9,16*Math.max(0,u.hp)/u.max,3);
    if(u.sel || (u.warned && u.team===PT && !u.dead)){
      ctx.fillStyle='#ffd24a'; ctx.font='10px Courier New';
      ctx.fillText(u.name, u.x-u.name.length*3, u.y-16);
    }
  }
  /* Caja de selección */
  if(g.drag){
    ctx.strokeStyle='#fff'; ctx.setLineDash([4,4]);
    ctx.strokeRect(g.drag.x, g.drag.y, g.drag.x2-g.drag.x, g.drag.y2-g.drag.y);
    ctx.setLineDash([]);
  }
  /* Info producción */
  const p=g.prod[PT];
  $('prodinfo').textContent = p
    ? `Fabricando ${p.cls}… ${Math.ceil(p.left/60)}s  (sectores: ${g.sectors.filter(s=>s.owner===PT).length} → ${Math.round((1-prodFactor(g,PT))*100)}% más rápido)`
    : `Cola libre · sectores propios: ${g.sectors.filter(s=>s.owner===PT).length}`;
  /* (v0.22) Botón de muro: só visible con ENGINEER seleccionado */
  $('pMuro').style.display = g.units.some(u => u.team===PT && !u.dead && !u.inside && u.sel && u.eng) ? '' : 'none';
  /* (v0.11) Indicador de formación */
  const formInfo = $('forminfo');
  if(formInfo){
    if(formacionAtiva){
      formInfo.style.color = '#7fdc7f';
      formInfo.style.borderColor = '#7fdc7f';
      formInfo.textContent = '⫷ FORMACIÓN: ON  (F)';
    } else {
      formInfo.style.color = '#888';
      formInfo.style.borderColor = '#555';
      formInfo.textContent = '⫷ FORMACIÓN: OFF  (F)';
    }
  }
  /* Indicador del radar central */
  const radarInfo = $('radarinfo');
  if(g.radar.owner === PT){
    radarInfo.style.color = '#4f8aff';
    radarInfo.style.borderColor = '#4f8aff';
    radarInfo.textContent = '◉ RADAR: TUYO';
  } else if(g.radar.owner === ET){
    radarInfo.style.color = '#ff5340';
    radarInfo.style.borderColor = '#ff5340';
    radarInfo.textContent = '◉ RADAR: ENEMIGO — IA LEE TUS VETERANOS';
  } else {
    radarInfo.style.color = '#8a6200';
    radarInfo.style.borderColor = '#8a6200';
    radarInfo.textContent = '◉ RADAR: NEUTRAL';
  }
}

