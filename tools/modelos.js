/* ============================================================
   TUERCA — esqueletos e poses.

   O REFACTOR que pedía o documento de traspaso: separar o
   ESQUELETO (que caixas hai e onde articulan) da POSE (que ángulo
   leva cada articulación neste intre).

   Antes, cada modelo mesturaba as dúas cousas, e engadir un estado
   novo obrigaba a reescribir o modelo enteiro por clase.

   CRITERIO DE ACEPTACIÓN (do documento): engadir un estado debe ser
   escribir unha rama en pose() e NADA MÁIS. Se hai que tocar
   ESQUELETO, o refactor non está ben feito.

   Por iso o esqueleto declara TODAS as articulacións que poida
   querer mover calquera estado —incluído o torso, que o ciclo de
   andar non usa pero curar si— aínda que a maioría queden a cero.
   ============================================================ */
const { Robot } = require('./vox3d.js');

const DIAG = -38 * Math.PI / 180;   /* arma cruzada sobre o corpo */

/* Cada peza: id (se articula), centro, tam, cor, piv, eixe.
   `ang` é o ángulo FIXO de montaxe; a pose súmase por riba. */
const ESQUELETO = {
  GRUNT: [
    { id:'perna_e', centro:[-0.32,-0.62,0],  tam:[0.30,0.90,0.36], cor:'azul',   piv:[-0.32,-0.17,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.32,-0.62,0],  tam:[0.30,0.90,0.36], cor:'azul',   piv:[ 0.32,-0.17,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.10, 0],     tam:[1.00,0.85,0.80], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[0, 0.38, 0.20],  tam:[0.70,0.16,0.36], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    /* Brazo longo abondo para que a man baixe do torso (A1): sen iso o
       membro fúndese no corpo e de perfil desaparece. */
    { id:'brazo_e', centro:[-0.63,0.03,0.10],tam:[0.26,0.86,0.30], cor:'azul',   piv:[-0.63,0.46,0],  eixe:'x' },
    { id:'brazo_d', centro:[ 0.63,0.03,0.10],tam:[0.26,0.86,0.30], cor:'azul',   piv:[ 0.63,0.46,0],  eixe:'x' },
    { id:'cabeza',  centro:[0, 0.86, 0],     tam:[0.76,0.60,0.70], cor:'metal',  piv:[0,0.60,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 0.90, 0.38],  tam:[0.50,0.18,0.12], cor:'ollo',   piv:[0,0.60,0],      eixe:'x' },
    /* Arma NA MAN dereita (A7) e fóra da liña media (A6). O pivote é o
       puño: aí agárrase e sobre aí xira. */
    { id:'arma',    centro:[0.60,-0.32,0.62],tam:[0.18,0.18,1.25], cor:'escuro', piv:[0.60,-0.32,0.10], eixe:'y', ang:DIAG },
    { id:'arma',    centro:[0.56,-0.34,0.20],tam:[0.30,0.26,0.26], cor:'escuro', piv:[0.60,-0.32,0.10], eixe:'y', ang:DIAG },
  ],
  HEAVY: [
    { id:'perna_e', centro:[-0.42,-0.58,0],  tam:[0.38,0.86,0.42], cor:'azul',   piv:[-0.42,-0.15,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.42,-0.58,0],  tam:[0.38,0.86,0.42], cor:'azul',   piv:[ 0.42,-0.15,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.14, 0],     tam:[1.34,0.98,0.94], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[-0.76,0.44,0],   tam:[0.34,0.34,0.70], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[ 0.76,0.44,0],   tam:[0.34,0.34,0.70], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'brazo_e', centro:[-0.80,-0.05,0.10],tam:[0.28,0.78,0.32], cor:'azul',  piv:[-0.80,0.34,0],  eixe:'x' },
    { id:'brazo_d', centro:[ 0.80,-0.05,0.10],tam:[0.28,0.78,0.32], cor:'azul',  piv:[ 0.80,0.34,0],  eixe:'x' },
    { id:'cabeza',  centro:[0, 0.94, 0],     tam:[0.80,0.62,0.78], cor:'metal',  piv:[0,0.66,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 0.98, 0.42],  tam:[0.54,0.18,0.12], cor:'ollo',   piv:[0,0.66,0],      eixe:'x' },
    /* O cañón rotativo pesa: vai na man, non colgado do medio. */
    { id:'arma',    centro:[0.74,-0.36,0.72],tam:[0.28,0.28,1.50], cor:'escuro', piv:[0.74,-0.36,0.12], eixe:'y', ang:DIAG },
    { id:'arma',    centro:[0.70,-0.36,0.16],tam:[0.40,0.40,0.34], cor:'escuro', piv:[0.74,-0.36,0.12], eixe:'y', ang:DIAG },
  ],
  ENGINEER: [
    { id:'perna_e', centro:[-0.30,-0.60,0],  tam:[0.28,0.88,0.34], cor:'azul',   piv:[-0.30,-0.16,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.30,-0.60,0],  tam:[0.28,0.88,0.34], cor:'azul',   piv:[ 0.30,-0.16,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.10, 0],     tam:[0.88,0.82,0.74], cor:'azul',   piv:[0,-0.28,0],     eixe:'x' },
    { id:'torso',   centro:[0, 0.14,-0.50],  tam:[0.62,0.80,0.30], cor:'ambar',  piv:[0,-0.28,0],     eixe:'x' },
    { id:'brazo_e', centro:[-0.58,0.03,0.08],tam:[0.24,0.82,0.28], cor:'azul',   piv:[-0.58,0.44,0],  eixe:'x' },
    { id:'brazo_d', centro:[ 0.58,0.03,0.08],tam:[0.24,0.82,0.28], cor:'azul',   piv:[ 0.58,0.44,0],  eixe:'x' },
    { id:'cabeza',  centro:[0, 0.84, 0],     tam:[0.70,0.58,0.66], cor:'metal',  piv:[0,0.58,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 0.88, 0.36],  tam:[0.46,0.17,0.12], cor:'ollo',   piv:[0,0.58,0],      eixe:'x' },
    /* O SOPLETE só pode ir nunha man. Máis groso que antes: era tan fino
       que desaparecía en varias direccións (L1). E leva boquilla, que é
       o que o fai recoñecible como ferramenta e non como pau. */
    { id:'arma',    centro:[0.56,-0.30,0.44],tam:[0.20,0.22,0.72], cor:'ambar',  piv:[0.56,-0.30,0.08], eixe:'y', ang:DIAG },
    { id:'arma',    centro:[0.56,-0.30,0.84],tam:[0.14,0.14,0.26], cor:'metal',  piv:[0.56,-0.30,0.08], eixe:'y', ang:DIAG },
  ],
};

/* Amplitude do balanceo por clase: o HEAVY move menos porque pesa. */
const BALANCEO = { GRUNT: 0.55, HEAVY: 0.42, ENGINEER: 0.50 };

/* ============================================================
   POSE — devolve {articulación: radiáns}. NON sabe nada de caixas.
   Aquí é onde se engade un estado novo, e só aquí.
   ============================================================ */
function pose(cls, estado, fase){
  const A = BALANCEO[cls] || 0.5;
  const s = Math.sin(fase * 2 * Math.PI);

  switch(estado){
    case 'ANDAR':
      return { perna_e: s*A, perna_d: -s*A, brazo_e: -s*A*0.5, brazo_d: s*A*0.5 };

    case 'DISPARAR': {
      /* Retroceso: a arma vai cara atrás e volve. Nas oito direccións
         sae de balde — non hai que redebuxar nada. */
      const r = Math.max(0, Math.sin(fase * Math.PI));
      return { arma: r*0.22, brazo_d: -r*0.18, torso: -r*0.06 };
    }

    case 'CURAR': {
      /* O enxeñeiro inclínase sobre o paciente e baixa o soplete. O
         torso ten articulación no esqueleto precisamente para isto,
         aínda que o ciclo de andar non a use. */
      const t = 0.5 + 0.5*Math.sin(fase * 2 * Math.PI);
      return { torso: 0.28 + t*0.06, brazo_d: 0.55 + t*0.12,
               cabeza: 0.18, arma: 0.35 };
    }

    case 'IMPACTO': {
      const k = Math.max(0, 1 - fase*2);
      return { torso: -k*0.30, cabeza: -k*0.22, brazo_e: k*0.25, brazo_d: k*0.20 };
    }

    case 'REPOUSO':
    default:
      return {};
  }
}

/* ============================================================
   MONTAR — esqueleto + pose = Robot listo para renderizar.
   ============================================================ */
/* `sen` permite montar o modelo omitindo articulacións (por exemplo o
   artiluxio). Úsao a regra de lectura para medir canto aporta á imaxe:
   comparar dous renders é moito máis robusto que contar píxeles dunha
   cor, porque un artiluxio pode ter varias e taparse a si mesmo. */
function montar(cls, estado, fase, corEquipo, sen){
  const esq = ESQUELETO[cls];
  if(!esq) throw new Error('clase descoñecida: ' + cls);
  const p = pose(cls, estado, fase);
  const r = new Robot();
  for(const pz of esq){
    if(sen && sen.includes(pz.id)) continue;
    const cor = (pz.cor === 'azul' && corEquipo) ? corEquipo : pz.cor;
    const ang = (pz.ang || 0) + (p[pz.id] || 0);
    r.caixa(pz.centro, pz.tam, cor, pz.piv || null, ang, pz.eixe || 'x');
  }
  return r;
}

const ESTADOS = ['REPOUSO', 'ANDAR', 'DISPARAR', 'CURAR', 'IMPACTO'];
const CLASES = Object.keys(ESQUELETO);

module.exports = { ESQUELETO, BALANCEO, pose, montar, ESTADOS, CLASES, DIAG };
