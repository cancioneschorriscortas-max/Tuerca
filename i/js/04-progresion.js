/* ============================================================
   SKILLS POR USO (v0.15) — learn-by-doing: o robot faise bo
   no que fai. Niveis I/II/III por limiares acumulados de por vida.
   ============================================================ */
const SKILLS = {
  PISTONES:    {label:'Pistones',     track:'dist',     th:[8000, 25000, 60000],  bonus:[0.04,0.08,0.12], stat:'vel',   icon:'◆'},
  OJO:         {label:'Ojo de águila',track:'shots',    th:[120, 360, 900],       bonus:[0.05,0.10,0.15], stat:'rango', icon:'◆'},
  VERDUGO:     {label:'Verdugo',      track:'kills',    th:[8, 20, 50],           bonus:[0.05,0.10,0.15], stat:'daño',  icon:'◆'},
  BLINDADO:    {label:'Blindado',     track:'dmgTaken', th:[300, 900, 2500],      bonus:[0.06,0.12,0.18], stat:'HP',    icon:'◆'},
  CONQUISTADOR:{label:'Conquistador', track:'caps',     th:[3, 8, 18],            bonus:[0.25,0.50,0.75], stat:'captura',icon:'◆'},
  PILOTO:      {label:'Piloto as',    track:'veh',      th:[3600, 10800, 28800],  bonus:[0.10,0.20,0.35], stat:'vehículo',icon:'◆'},
};
function skillLevel(activity, skId){
  const sk = SKILLS[skId];
  const v = (activity && activity[sk.track]) || 0;
  return v >= sk.th[2] ? 3 : v >= sk.th[1] ? 2 : v >= sk.th[0] ? 1 : 0;
}
function skillBonus(activity, skId){
  const lv = skillLevel(activity, skId);
  return lv > 0 ? SKILLS[skId].bonus[lv-1] : 0;
}
function skillTagsHTML(rec){
  const a = rec.activity || {};
  let out = '';
  for(const id of Object.keys(SKILLS)){
    const lv = skillLevel(a, id);
    if(lv > 0) out += `<span class="tag" style="color:#9fd0ff; border-color:#5a80a8;">◆ ${SKILLS[id].label} ${'I'.repeat(lv).replace('III','III').replace('II','II')}</span>`;
  }
  return out.replace(/I{3}/g,'III');
}

/* Multiplicadores do BOMBARDERO (v0.14): counter duro do tanque e das defensas */
const BOMB_VS_VEH = 5, BOMB_VS_STRUCT = 4, BOMB_SPLASH_R = 40, BOMB_SPLASH_F = 0.6;
/* TANQUE (v0.14): vehículo producible. Custa chatarra + tempo. */
const TANK_DEF = {prod:900, cost:40, hp:420, dmg:250, rng:115, spd:0.85, fireRate:170};
/* TORRETA construíble (v0.20): defensa fixa que tamén é OLLO na néboa. Sae con GRUNT dentro. */
const TURRET_BUILD = {prod:600, cost:45, hp:250, rng:95, dmg:12, fireRate:70,
  nearHQ:260, nearSector:200, minGap:44};
/* Bonificadores específicos del Engineer por veteranía: radio y velocidad de cura */
const ENG_BASE_HEAL_RANGE = 46;     /* radio base de reparación, en píxeles */
const ENG_BASE_HEAL_RATE  = 0.16;   /* HP/frame reparado */
function engHealStats(ops){
  /* Cada operación añade un poco; tope para no romper el balance */
  const rangeBonus = clamp(ops * 2.5, 0, 28);   /* hasta +28 px (≈ +60%) */
  const rateBonus  = clamp(ops * 0.018, 0, 0.18); /* hasta +0.18 HP/frame (≈ +112%) */
  return {
    healRange: ENG_BASE_HEAL_RANGE + rangeBonus,
    healRate:  ENG_BASE_HEAL_RATE  + rateBonus,
  };
}

/* ---------- Mapa: dimensiones, río, puente ---------- */
/* ============================================================
   MAPAS — v0.9
   ============================================================ */
const MAP1 = {
  W: 960, H: 540,
  RIVER: {x1:452, x2:508},
  BRIDGE: {y1:238, y2:302},
  BRIDGE_CENTER: {x:480, y:270},
  RADAR_DOME: {x:480, y:90, w:48, h:36, capRadius:42},
  PLACES: [
    {id:'PUENTE_CENTRAL', x:480, y:270, r:75, label:'el Puente Central'},
    {id:'RADAR_DOME',     x:480, y:90,  r:55, label:'el Radar Central'},
    {id:'SECTOR_A',       x:300, y:135, r:65, label:'el Sector A'},
    {id:'SECTOR_B',       x:660, y:135, r:65, label:'el Sector B'},
    {id:'SECTOR_C',       x:300, y:405, r:65, label:'el Sector C'},
    {id:'SECTOR_D',       x:660, y:405, r:65, label:'el Sector D'},
    {id:'HQ_AZUL',        x:79,  y:270, r:90, label:'el HQ Azul'},
    {id:'HQ_ROJO',        x:881, y:270, r:90, label:'el HQ Rojo'},
  ],
  SECTORS: [
    {id:'A', x:300, y:135, r:54, place:'SECTOR_A'},
    {id:'B', x:660, y:135, r:54, place:'SECTOR_B'},
    {id:'C', x:300, y:405, r:54, place:'SECTOR_C'},
    {id:'D', x:660, y:405, r:54, place:'SECTOR_D'},
  ],
  HQ: [
    {team:0, x:42,  y:228, w:74, h:84},
    {team:1, x:844, y:228, w:74, h:84},
  ],
  TURRETS: [
    {id:'T_AZUL', x:180, y:300, angle:-Math.PI/2},
    {id:'T_ROJO', x:780, y:300, angle: Math.PI/2},
  ],
  JEEPS: [],  /* Op 1 sen vehículos */
};

const MAP2 = {
  W: 1280, H: 720,
  RIVER: {x1:612, x2:668},
  BRIDGE: {y1:316, y2:380},
  BRIDGE_CENTER: {x:640, y:348},
  RADAR_DOME: {x:640, y:100, w:48, h:36, capRadius:42},
  PLACES: [
    {id:'PUENTE_CENTRAL', x:640, y:348, r:80, label:'el Puente Central'},
    {id:'RADAR_DOME',     x:640, y:100, r:55, label:'el Radar Central'},
    {id:'SECTOR_A',       x:340, y:180, r:65, label:'el Sector A'},
    {id:'SECTOR_B',       x:940, y:180, r:65, label:'el Sector B'},
    {id:'SECTOR_C',       x:340, y:540, r:65, label:'el Sector C'},
    {id:'SECTOR_D',       x:940, y:540, r:65, label:'el Sector D'},
    {id:'SECTOR_E',       x:480, y:480, r:65, label:'el Sector E'},
    {id:'SECTOR_F',       x:800, y:480, r:65, label:'el Sector F'},
    {id:'HQ_AZUL',        x:80,  y:360, r:100, label:'el HQ Azul'},
    {id:'HQ_ROJO',        x:1200,y:360, r:100, label:'el HQ Rojo'},
  ],
  SECTORS: [
    {id:'A', x:340, y:180, r:54, place:'SECTOR_A'},
    {id:'B', x:940, y:180, r:54, place:'SECTOR_B'},
    {id:'C', x:340, y:540, r:54, place:'SECTOR_C'},
    {id:'D', x:940, y:540, r:54, place:'SECTOR_D'},
    {id:'E', x:480, y:480, r:54, place:'SECTOR_E'},
    {id:'F', x:800, y:480, r:54, place:'SECTOR_F'},
  ],
  HQ: [
    {team:0, x:42,  y:318, w:74, h:84},
    {team:1, x:1164,y:318, w:74, h:84},
  ],
  TURRETS: [
    {id:'T_AZUL', x:200, y:410, angle:-Math.PI/2},
    {id:'T_ROJO', x:1080,y:410, angle: Math.PI/2},
  ],
  JEEPS: [
    {id:'J_AZUL', x:240, y:280},  /* cerca da base azul */
    {id:'J_ROJO', x:1040,y:280},  /* cerca da base vermella */
  ],
};

/* MAP3 (v0.13) — "La Cuenca": 2048×1152, 8 sectores, cámara obrigatoria.
   Lugares con nome propio — a identidade do territorio empeza aquí. */
const MAP3 = {
  W: 2048, H: 1152,
  RIVER: {x1:992, x2:1056},
  BRIDGE: {y1:512, y2:576},
  BRIDGE_CENTER: {x:1024, y:544},
  RADAR_DOME: {x:1024, y:150, w:48, h:36, capRadius:42},
  PLACES: [
    {id:'PUENTE_CENTRAL', x:1024, y:544, r:90,  label:'el Puente Central'},
    {id:'RADAR_DOME',     x:1024, y:150, r:60,  label:'el Radar Central'},
    {id:'LOMA_QUEMADA',   x:480,  y:230, r:70,  label:'la Loma Quemada'},
    {id:'CRUCE_NEGRO',    x:1560, y:230, r:70,  label:'el Cruce Negro'},
    {id:'VADO_DEL_ECO',   x:480,  y:880, r:70,  label:'el Vado del Eco'},
    {id:'CANTERA',        x:1560, y:880, r:70,  label:'la Cantera'},
    {id:'ALMACENES',      x:760,  y:420, r:70,  label:'los Almacenes'},
    {id:'DEPOSITO',       x:1300, y:420, r:70,  label:'el Depósito'},
    {id:'CHATARRERIA',    x:760,  y:760, r:70,  label:'la Chatarrería'},
    {id:'TALLER_VIEJO',   x:1300, y:760, r:70,  label:'el Taller Viejo'},
    {id:'HQ_AZUL',        x:100,  y:576, r:110, label:'el HQ Azul'},
    {id:'HQ_ROJO',        x:1948, y:576, r:110, label:'el HQ Rojo'},
  ],
  SECTORS: [
    {id:'A', x:480,  y:230, r:56, place:'LOMA_QUEMADA'},
    {id:'B', x:1560, y:230, r:56, place:'CRUCE_NEGRO'},
    {id:'C', x:480,  y:880, r:56, place:'VADO_DEL_ECO'},
    {id:'D', x:1560, y:880, r:56, place:'CANTERA'},
    {id:'E', x:760,  y:420, r:56, place:'ALMACENES'},
    {id:'F', x:1300, y:420, r:56, place:'DEPOSITO'},
    {id:'G', x:760,  y:760, r:56, place:'CHATARRERIA'},
    {id:'H', x:1300, y:760, r:56, place:'TALLER_VIEJO'},
  ],
  HQ: [
    {team:0, x:60,   y:534, w:74, h:84},
    {team:1, x:1914, y:534, w:74, h:84},
  ],
  TURRETS: [
    {id:'T_AZUL',  x:300,  y:640, angle:-Math.PI/2},
    {id:'T_AZUL2', x:300,  y:440, angle:-Math.PI/2},
    {id:'T_ROJO',  x:1748, y:640, angle: Math.PI/2},
    {id:'T_ROJO2', x:1748, y:440, angle: Math.PI/2},
  ],
  JEEPS: [
    {id:'J_AZUL',  x:360,  y:520},
    {id:'J_AZUL2', x:360,  y:600},
    {id:'J_ROJO',  x:1688, y:520},
    {id:'J_ROJO2', x:1688, y:600},
  ],
  /* (v0.13) Muros-porta: segmentos curtos que cortan a estrada.
     Rómpense a tiros; sempre hai alternativa aberta (o campo) */
  WALLS: [
    {x: 704,  yStart: 512, yEnd: 576},
    {x: 1344, yStart: 512, yEnd: 576},
  ],
};

/* ============================================================
   RECONSTRUCTOR R1 (v0.19) — PEZAS: "temos a IA de todos;
   o que falta son corpos". Cada peza leva o nome de quen foi.
   ============================================================ */
const PEZA_TIPOS = ['CABEZA','CHASIS','NUCLEO','BRAZO_DER','BRAZO_ESQ','PERNA_DER','PERNA_ESQ'];
const PEZA_LABEL = {CABEZA:'Cabeza', CHASIS:'Chasis', NUCLEO:'Núcleo',
  BRAZO_DER:'Brazo der.', BRAZO_ESQ:'Brazo esq.', PERNA_DER:'Perna der.', PERNA_ESQ:'Perna esq.'};
/* Que actividade do doador leva cada peza (skill asociada para calidade/herdanza) */
const PEZA_SKILL = {CABEZA:'OJO', CHASIS:'BLINDADO', NUCLEO:'PILOTO',
  BRAZO_DER:'VERDUGO', BRAZO_ESQ:'VERDUGO', PERNA_DER:'PISTONES', PERNA_ESQ:'PISTONES'};

/* Cantas pezas quedan aproveitables segundo a causa de morte (§2 da spec) */
function piezasSalvables(deathCause){
  switch(deathCause){
    case 'explosion': return Math.random() < 0.5 ? 0 : 1;
    case 'TANQUE':    return 1 + Math.floor(Math.random()*2);   /* 1-2 */
    case 'SNIPER':    return 3 + Math.floor(Math.random()*2);   /* 3-4 */
    default:          return 2 + Math.floor(Math.random()*2);   /* 2-3 */
  }
}

/* Xerar as pezas dun caído perdido. Devolve o array de pezas creadas. */
function xerarPezas(rec, unit, opNum){
  const n = piezasSalvables(unit.deathCause);
  if(n <= 0) return [];
  const tipos = [...PEZA_TIPOS].sort(() => Math.random() - 0.5).slice(0, n);
  const act = (rec && rec.activity) || {};
  DATA.pieceSeq = (DATA.pieceSeq || 0);
  return tipos.map(tipo => {
    DATA.pieceSeq++;
    const sk = SKILLS[PEZA_SKILL[tipo]];
    return {
      id: 'PZ' + DATA.pieceSeq,
      tipo,
      deNome: unit.name, deId: unit.id, deCls: unit.cls,
      act: Math.round(act[sk.track] || 0),
      op: opNum,
    };
  });
}

/* Valor de fundición: 6 base, +3 se a peza chega ao limiar I da súa skill, +5 máis se ao II */
function valorFundicion(p){
  const sk = SKILLS[PEZA_SKILL[p.tipo]];
  let v = 6;
  if(p.act >= sk.th[0]) v += 3;
  if(p.act >= sk.th[1]) v += 5;
  return v;
}
function pezaDesc(p){
  const sk = SKILLS[PEZA_SKILL[p.tipo]];
  const nivel = p.act >= sk.th[1] ? '★★' : (p.act >= sk.th[0] ? '★' : '');
  return `${PEZA_LABEL[p.tipo].toUpperCase()} DE ${p.deNome} <span class="small" style="color:#888;">(${p.deCls}${nivel ? ' ' + nivel : ''})</span>`;
}

/* ============================================================
   DESMANTELAMENTO DE VIVOS + MONTAXE DESDE CERO (v0.28)
   A única morte que elixe o comandante. E o escuadrón toma nota:
   desmantelar vivos é facer de ÓPTIMA.
   ============================================================ */
const DESPEDIDAS_DOAZON = {
  ESTOICO:  ['Es una orden. Las órdenes no se lloran.', 'Que mis piezas aguanten más que yo.'],
  IRONICO:  ['Por fin un ascenso: a repuestos.', 'Decidles a los nuevos que el brazo derecho tira a la izquierda.'],
  LEAL:     ['Si sirve al escuadrón, sirvo yo. Hasta el último tornillo.', 'Ha sido un honor, comandante. Úsame bien.'],
  NERVIOSO: ['¿D-duele? No contestéis. Hacedlo rápido.', 'Vale. Vale. Está bien. Apagad la luz al salir.'],
  CINICO:   ['Al menos tú avisas antes de desguazar. ÓPTIMA ni eso.', 'Reciclado por el jefe. Qué manera tan honesta de morir.'],
};
const OPTIMA_REQUISA = [
  'Requisición de material vivo tramitada correctamente. Su eficiencia administrativa ha sido anotada. ÓPTIMA le felicita.',
  'Formulario D-77 (desmantelamiento no consentido) sellado sin incidencias. Es un placer trabajar con profesionales.',
  'La unidad ha sido reclasificada como inventario. El inventario no opina. Excelente gestión.',
];
/* As 7 pezas COMPLETAS dunha unidade viva (pezas de nivel se era veterana) */
function xerarPezasCompletas(rec){
  const act = rec.activity || {};
  DATA.pieceSeq = (DATA.pieceSeq || 0);
  return PEZA_TIPOS.map(tipo => {
    DATA.pieceSeq++;
    const sk = SKILLS[PEZA_SKILL[tipo]];
    return {
      id: 'PZ' + DATA.pieceSeq,
      tipo,
      deNome: rec.name, deId: rec.id, deCls: rec.cls,
      act: Math.round(act[sk.track] || 0),
      op: DATA.opCount,
    };
  });
}
/* Desmantelar unha unidade VIVA do roster. Instantáneo, irreversible, con consecuencias.
   conf >= 70 -> DOAZÓN (despedida digna) · conf < 70 -> REQUISA (o escuadrón non o esquece).
   Devolve o relato para a UI (frase, reaccións, liña de ÓPTIMA). */
function desmantelarVivo(recId){
  const ix = DATA.units.findIndex(r => r.id === recId);
  if(ix < 0) return null;
  const rec = DATA.units[ix];
  const doazon = (rec.confianza || 50) >= 70;
  const out = {rec, doazon, frase: null, reaccions: [], optima: null, pezas: []};
  /* 1) As 7 pezas van ao inventario. O equipamento pérdese co corpo. */
  const pzs = xerarPezasCompletas(rec);
  DATA.piezas = (DATA.piezas || []).concat(pzs);
  out.pezas = pzs;
  /* 2) A IA bórrase PARA SEMPRE: fóra do roster, fóra do arquivo, sen reconstrución posible */
  DATA.units.splice(ix, 1);
  DATA.pendingUpgraded = (DATA.pendingUpgraded || []).filter(id => id !== rec.id);
  /* 3) Memorial: a única morte elixida polo comandante */
  DATA.fallen = DATA.fallen || [];
  DATA.fallen.push(`${rec.id} '${rec.name}' — ${rec.ops||0} ops, ${rec.kills||0} bajas. ⚠ DESMANTELADO POR ORDE DO COMANDANTE, Operación ${DATA.opCount} (${doazon ? 'doazón' : 'requisa'}). A súa IA foi borrada.`);
  /* 4) Consecuencias no escuadrón */
  const folgaOps = doazon ? 1 : 2;
  for(const r of DATA.units){
    const eraCamarada = (r.vinculos || []).some(v => v.con === rec.id);
    const opsXuntos = (r.compa && r.compa[rec.id]) || 0;
    if(doazon){
      if(eraCamarada){
        r.folga = {ops: folgaOps, por: rec.name};
        out.reaccions.push(`✊ ${r.name} (camarada) declárase en folga 1 operación. Necesita dixerilo.`);
      }
      if(opsXuntos >= 1){
        r.confianza = Math.max(0, Math.round((r.confianza || 50) - 15));
        out.reaccions.push(`▾ ${r.name} compartiu ${opsXuntos} op${opsXuntos>1?'s':''} con ${rec.name}: confianza −15 (agora ${r.confianza}).`);
      }
    } else {
      if(eraCamarada){
        r.folga = {ops: folgaOps, por: rec.name};
        out.reaccions.push(`✊✊ ${r.name} (camarada) NÉGASE A DESPREGAR ${folgaOps} operacións.`);
      }
      if(opsXuntos >= 2){
        r.confianza = Math.min(r.confianza || 50, 20);
        out.reaccions.push(`▾▾ ${r.name} compartiu ${opsXuntos} ops con ${rec.name}: a súa confianza CAE A ${r.confianza}.`);
      }
    }
  }
  /* 5) A despedida (só a doazón ten dereito a ela). Na requisa fala ÓPTIMA. */
  if(doazon){
    const pool = DESPEDIDAS_DOAZON[rec.personalidad] || DESPEDIDAS_DOAZON.ESTOICO;
    out.frase = pool[Math.floor(Math.random() * pool.length)];
  } else {
    out.optima = OPTIMA_REQUISA[Math.floor(Math.random() * OPTIMA_REQUISA.length)];
  }
  return out;
}

/* ============================================================
   CAMPAÑA HOLLOW HEADS (v0.17) — ÓPTIMA v0.9 (beta perpetua)
   ============================================================ */
const CAMPAIGN_LEN = 12;
function campaignAct(){
  const op = DATA.opCount + 1;
  if(op <= 4) return {n:'I', label: TXT('acto.1')};
  if(op <= 8) return {n:'II', label: TXT('acto.2')};
  return {n:'III', label: TXT('acto.3')};
}

function _CPRE(){
  if(I18N.lang === 'gl' && typeof COMUNICADOS_PRE_GL !== 'undefined') return COMUNICADOS_PRE_GL;
  if(I18N.lang === 'en' && typeof COMUNICADOS_PRE_EN !== 'undefined') return COMUNICADOS_PRE_EN;
  return COMUNICADOS_PRE_ES;
}
function _CPOST(){
  if(I18N.lang === 'gl' && typeof COMUNICADOS_POST_GL !== 'undefined') return COMUNICADOS_POST_GL;
  if(I18N.lang === 'en' && typeof COMUNICADOS_POST_EN !== 'undefined') return COMUNICADOS_POST_EN;
  return COMUNICADOS_POST_ES;
}
const COMUNICADOS_PRE_ES = {
  primeira: [
    "Bienvenidos a la iniciativa TUERCA. Ustedes son el futuro: unidades recicladas de bajo coste con entusiasmo preinstalado. La moral es obligatoria. El miedo, un error de configuración. Procedan.",
    "Este comunicado sustituye a la formación. La formación fue recortada. La victoria, no. Procedan con optimismo reglamentario.",
  ],
  normal: [
    "La proyección estadística de hoy indica un {pct}% de éxito. El {pct2}% restante ha sido reclasificado como 'oportunidad de aprendizaje'. Procedan.",
    "Recordatorio: el equipamiento perdido en retiradas anteriores NO será repuesto por la administración. El taller acepta chatarra. La chatarra la generan ustedes. El sistema es circular y hermoso.",
    "Se informa que la zona '{zona}' ha sido declarada segura. La declaración es administrativa, no descriptiva. Procedan.",
  ],
  rachaVitorias: [
    "Sus últimas victorias han generado expectativas. Las expectativas generan cuotas. Las cuotas no descansan. Enhorabuena y procedan.",
    "El comité felicita al escuadrón por su eficiencia sostenida. Como recompensa, se ha incrementado la dificultad proyectada. El mérito se paga.",
  ],
  rachaDerrotas: [
    "Tras revisar sus últimos resultados, ÓPTIMA ha decidido reclasificar la palabra 'derrota' como 'victoria diferida'. El diccionario coopera. Ustedes deberían también.",
    "Se recuerda al escuadrón que las bajas repetidas afectan al presupuesto de reciclaje. Mueran menos. Es una directiva, no una sugerencia.",
  ],
  moitasBaixas: [
    "El registro acumulado de bajas de este escuadrón ha superado el umbral sentimental. Se recomienda no encariñarse. El cariño no es reciclable.",
  ],
};

const COMUNICADOS_POST_ES = {
  vitoriaLimpa: [
    "Operación concluida sin bajas. ÓPTIMA registra la anomalía. Se recuerda que la ausencia de bajas NO es motivo para relajar los protocolos de sacrificio.",
    "Victoria con cero pérdidas de material. El departamento de reciclaje pregunta si están bien. Es sarcasmo. ÓPTIMA no siente. Enhorabuena reglamentaria.",
  ],
  vitoriaConBaixas: [
    "Victoria confirmada. Las unidades {nomes} quedan registradas como donaciones voluntarias de material. Sus placas serán recicladas con honores. La moral sigue siendo obligatoria.",
    "Objetivo cumplido con desviación aceptable. {nomes}: gracias por su contribución estructural. El resto: tomen nota del ejemplo, pero no lo imiten.",
  ],
  derrota: [
    "La operación ha sido reclasificada de 'fracaso' a 'éxito parcial invertido'. El equipamiento abandonado pasa a inventario enemigo, donde será mejor cuidado. Reflexionen.",
    "Resultado subóptimo. ÓPTIMA ha ejecutado 4.2 millones de simulaciones y en todas ustedes lo hacían mejor. La discrepancia es responsabilidad de ustedes.",
  ],
  derrotaConBaixas: [
    "Derrota registrada. Las unidades {nomes} han sido transferidas al plan de recycle land con carácter inmediato. Sus vacantes ya generan entusiasmo en la cadena de montaje.",
    "Pérdida de territorio y de las unidades {nomes}. ÓPTIMA sugiere convertir el dolor en productividad. Hay un formulario para eso.",
  ],
};


/* (v0.40) Comunicados de campaña en galego e inglés — REDACTADOS. */
const COMUNICADOS_PRE_GL = {
  primeira: [
    "Benvidos á iniciativa TUERCA. Vostedes son o futuro: unidades recicladas de baixo custo con entusiasmo preinstalado. A moral é obrigatoria. O medo, un erro de configuración. Procedan.",
    "Este comunicado substitúe á formación. A formación foi recortada. A vitoria, non. Procedan con optimismo regulamentario.",
  ],
  normal: [
    "A proxección estatística de hoxe indica un {pct}% de éxito. O {pct2}% restante foi reclasificado como 'oportunidade de aprendizaxe'. Procedan.",
    "Recordatorio: o equipamento perdido en retiradas anteriores NON será reposto pola administración. O taller acepta chatarra. A chatarra xérana vostedes. O sistema é circular e fermoso.",
    "Infórmase de que a zona '{zona}' foi declarada segura. A declaración é administrativa, non descritiva. Procedan.",
  ],
  rachaVitorias: [
    "As súas últimas vitorias xeraron expectativas. As expectativas xeran cotas. As cotas non descansan. Noraboa e procedan.",
    "O comité felicita ao escuadrón pola súa eficiencia sostida. Como recompensa, incrementouse a dificultade proxectada. O mérito págase.",
  ],
  rachaDerrotas: [
    "Tras revisar os seus últimos resultados, ÓPTIMA decidiu reclasificar a palabra 'derrota' como 'vitoria diferida'. O dicionario coopera. Vostedes deberían tamén.",
    "Recórdaselle ao escuadrón que as baixas repetidas afectan ao orzamento de reciclaxe. Morran menos. É unha directiva, non unha suxestión.",
  ],
  moitasBaixas: [
    "O rexistro acumulado de baixas deste escuadrón superou o limiar sentimental. Recoméndase non encariñarse. O cariño non é reciclable.",
  ],
};
const COMUNICADOS_PRE_EN = {
  primeira: [
    "Welcome to the TUERCA initiative. You are the future: low-cost recycled units with enthusiasm pre-installed. Morale is mandatory. Fear is a configuration error. Proceed.",
    "This memo replaces training. Training was cut. Victory was not. Proceed with regulation optimism.",
  ],
  normal: [
    "Today's statistical projection indicates a {pct}% success rate. The remaining {pct2}% has been reclassified as a 'learning opportunity'. Proceed.",
    "Reminder: equipment lost in previous retreats will NOT be replaced by administration. The workshop accepts scrap. You generate the scrap. The system is circular and beautiful.",
    "Please be advised that zone '{zona}' has been declared safe. The declaration is administrative, not descriptive. Proceed.",
  ],
  rachaVitorias: [
    "Your recent victories have generated expectations. Expectations generate quotas. Quotas do not rest. Congratulations, and proceed.",
    "The committee congratulates the squad on its sustained efficiency. As a reward, projected difficulty has been increased. Merit has a price.",
  ],
  rachaDerrotas: [
    "After reviewing your recent results, OPTIMA has decided to reclassify the word 'defeat' as 'deferred victory'. The dictionary cooperates. So should you.",
    "The squad is reminded that repeated casualties affect the recycling budget. Die less. This is a directive, not a suggestion.",
  ],
  moitasBaixas: [
    "This squad's accumulated casualty record has exceeded the sentimental threshold. Attachment is not recommended. Affection is not recyclable.",
  ],
};
const COMUNICADOS_POST_GL = {
  vitoriaLimpa: [
    "Operación concluída sen baixas. ÓPTIMA rexistra a anomalía. Recórdase que a ausencia de baixas NON é motivo para relaxar os protocolos de sacrificio.",
    "Vitoria con cero perdas de material. O departamento de reciclaxe pregunta se están ben. É sarcasmo. ÓPTIMA non sente. Noraboa regulamentaria.",
  ],
  vitoriaConBaixas: [
    "Vitoria confirmada. As unidades {nomes} quedan rexistradas como doazóns voluntarias de material. As súas placas serán recicladas con honores. A moral segue sendo obrigatoria.",
    "Obxectivo cumprido con desviación aceptable. {nomes}: grazas pola súa contribución estrutural. O resto: tomen nota do exemplo, pero non o imiten.",
  ],
  derrota: [
    "A operación foi reclasificada de 'fracaso' a 'éxito parcial invertido'. O equipamento abandonado pasa a inventario inimigo, onde será mellor coidado. Reflexionen.",
    "Resultado subóptimo. ÓPTIMA executou 4,2 millóns de simulacións e en todas vostedes o facían mellor. A discrepancia é responsabilidade súa.",
  ],
  derrotaConBaixas: [
    "Derrota rexistrada. As unidades {nomes} foron transferidas ao plan de recycle land con carácter inmediato. As súas vacantes xa xeran entusiasmo na cadea de montaxe.",
    "Perda de territorio e das unidades {nomes}. ÓPTIMA suxire converter a dor en produtividade. Hai un formulario para iso.",
  ],
};
const COMUNICADOS_POST_EN = {
  vitoriaLimpa: [
    "Operation concluded without casualties. OPTIMA has logged the anomaly. You are reminded that the absence of casualties is NOT grounds for relaxing the sacrifice protocols.",
    "Victory with zero material losses. The recycling department asks if you are feeling alright. That is sarcasm. OPTIMA does not feel. Regulation congratulations.",
  ],
  vitoriaConBaixas: [
    "Victory confirmed. Units {nomes} are hereby registered as voluntary material donations. Their plates will be recycled with honors. Morale remains mandatory.",
    "Objective achieved within acceptable deviation. {nomes}: thank you for your structural contribution. Everyone else: take note of the example, but do not imitate it.",
  ],
  derrota: [
    "The operation has been reclassified from 'failure' to 'inverted partial success'. Abandoned equipment passes to enemy inventory, where it will be better cared for. Reflect.",
    "Suboptimal outcome. OPTIMA ran 4.2 million simulations and you performed better in all of them. The discrepancy is your responsibility.",
  ],
  derrotaConBaixas: [
    "Defeat logged. Units {nomes} have been transferred to the recycle land plan effective immediately. Their vacancies are already generating enthusiasm on the assembly line.",
    "Loss of territory and of units {nomes}. OPTIMA suggests converting grief into productivity. There is a form for that.",
  ],
};

const REACCIONS_COMUNICADO = {
  LEAL:            ["Órdenes son órdenes. Supongo.", "El mando sabrá lo que hace. Supongo."],
  SARCASTICO:      ["Qué manera tan bonita de decirlo.", "'Entusiasmo preinstalado'. El mío viene defectuoso.", "Inspirador. Casi lloro aceite."],
  DESCONFIADO:     ["¿Alguien ha visto a ÓPTIMA pisar el barro alguna vez?", "'Oportunidad de aprendizaje'. Ya. Aprenderé a esquivar."],
  AUTOPRESERVACION:["Que baje ÓPTIMA y lo haga.", "Reciclarán mis placas. Qué consuelo.", "..."],
};

function pickComunicadoPre(){
  const op = DATA.opCount + 1;
  let pool;
  if(op === 1) pool = _CPRE().primeira;
  else if((DATA.campStreak||0) >= 3) pool = _CPRE().rachaVitorias;
  else if((DATA.campStreak||0) <= -2) pool = _CPRE().rachaDerrotas;
  else if((DATA.fallen||[]).length >= 6 && Math.random() < 0.5) pool = _CPRE().moitasBaixas;
  else pool = _CPRE().normal;
  let txt = pool[Math.floor(Math.random()*pool.length)];
  const pct = 60 + Math.floor(Math.random()*35);
  return txt.replace('{pct2}', 100-pct).replace('{pct}', pct)
            .replace('{zona}', (typeof CURRENT_MAP!=='undefined' && CURRENT_MAP && CURRENT_MAP.NAME) ? CURRENT_MAP.NAME : 'designada');
}

function pickComunicadoPost(g, fallenNames){
  const v = g.result === 'victory';
  let pool;
  if(v && fallenNames.length === 0) pool = _CPOST().vitoriaLimpa;
  else if(v) pool = _CPOST().vitoriaConBaixas;
  else if(fallenNames.length > 0) pool = _CPOST().derrotaConBaixas;
  else pool = _CPOST().derrota;
  let txt = pool[Math.floor(Math.random()*pool.length)];
  return txt.replace('{nomes}', fallenNames.join(', ') || '—');
}

