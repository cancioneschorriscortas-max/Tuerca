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

const DIAG = -14 * Math.PI / 180;   /* cruce leve: con brazo dobrado, os -38 orixinais (pensados para brazo colgando) mandaban a arma por riba da cabeza */
/* PULSO: inclinación FINAL que ten que levar o artiluxio, non o ángulo do
   pulso. 0 = horizontal. O ángulo real calcúlase restando o que xa
   acumulou a cadea do brazo, así que segue sendo horizontal en calquera
   pose e fase en vez de valer só para a que se axustou a man. */
const PULSO_ARMA = 0;

/* Cada peza: id (se articula), centro, tam, cor, piv, eixe.
   `ang` é o ángulo FIXO de montaxe; a pose súmase por riba. */
const ESQUELETO = {
  /* O GRUNT é a vara de medir: nin ancho nin estreito. Adelgazouno un
     chisco (o torso pasou de 1.00 a 0.86) para deixarlle sitio ao HEAVY
     por riba e ao SNIPER por baixo — con cinco clases, o que importa non
     é o ancho de cada unha senón que se distingan entre elas. */
  GRUNT: [
    { id:'perna_e', centro:[-0.28,-0.62,0],  tam:[0.26,0.90,0.32], cor:'azul',   piv:[-0.28,-0.17,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.28,-0.62,0],  tam:[0.26,0.90,0.32], cor:'azul',   piv:[ 0.28,-0.17,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.10, 0],     tam:[0.86,0.85,0.70], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[0, 0.38, 0.18],  tam:[0.62,0.16,0.32], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    /* Brazo longo abondo para que a man baixe do torso (A1): sen iso o
       membro fúndese no corpo e de perfil desaparece. */
    { id:'brazo_e',    centro:[-0.56,0.24,0.06],tam:[0.24,0.44,0.28], cor:'azul', piv:[-0.56,0.46,0],  eixe:'x' },
    { id:'brazo_d',    centro:[ 0.56,0.24,0.06],tam:[0.24,0.44,0.28], cor:'azul', piv:[ 0.56,0.46,0],  eixe:'x' },
    { id:'antebrazo_e',centro:[-0.56,-0.21,0.06],tam:[0.22,0.46,0.26],cor:'azul', piv:[-0.56,0.02,0], eixe:'x', pai:'brazo_e' },
    { id:'antebrazo_d',centro:[ 0.56,-0.21,0.06],tam:[0.22,0.46,0.26],cor:'azul', piv:[ 0.56,0.02,0], eixe:'x', pai:'brazo_d' },
    { id:'cabeza',  centro:[0, 0.86, 0],     tam:[0.68,0.58,0.62], cor:'metal',  piv:[0,0.60,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 0.90, 0.34],  tam:[0.46,0.18,0.12], cor:'ollo',   piv:[0,0.60,0],      eixe:'x' },
    /* Arma NA MAN dereita (A7) e fóra da liña media (A6). O pivote é o
       puño: aí agárrase e sobre aí xira. */
    { id:'arma',    centro:[0.54,-0.32,0.62],tam:[0.18,0.18,1.25], cor:'escuro', piv:[0.54,-0.32,0.10], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
    { id:'arma',    centro:[0.50,-0.34,0.20],tam:[0.30,0.26,0.26], cor:'escuro', piv:[0.54,-0.32,0.10], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
  ],
  /* O HEAVY xoga TODO á silueta. A 22 píxeles non se lle ven os detalles,
     así que o que ten que cantar é o contorno: hombreiras enormes que
     suben por riba da liña dos ombros, a cabeza afundida entre elas (sen
     pescozo, coma un boxeador cubríndose) e unha placa peitoral que o
     ensancha de fronte. Un bloque con esquinas, non un boneco máis gordo. */
  HEAVY: [
    { id:'perna_e', centro:[-0.44,-0.56,0],  tam:[0.42,0.82,0.46], cor:'azul',   piv:[-0.44,-0.15,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.44,-0.56,0],  tam:[0.42,0.82,0.46], cor:'azul',   piv:[ 0.44,-0.15,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.14, 0],     tam:[1.30,0.98,0.94], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    /* Placa peitoral: sobresae por diante e dálle ombreira recta de fronte. */
    { id:'torso',   centro:[0, 0.06, 0.42],  tam:[1.06,0.66,0.20], cor:'metal',  piv:[0,-0.30,0],     eixe:'x' },
    /* TAMBOR de munición ás costas. Entrou por unha regra e quedou por
       ser boa idea: L3 medía que de fronte ocupaba 1.55 veces o que de
       perfil, e o robot semellaba encoller ao xirar. Ensanchar as
       hombreiras non arranxaba nada porque de perfil unha tapa a outra e
       só conta unha; o que fai falla é volume no eixe do fondo, que non
       está duplicado. Un cargador ás costas dállo, e de paso lese como o
       que é: quen leva o cañón rotativo leva a munición. */
    { id:'torso',   centro:[0, 0.24,-0.60],  tam:[0.78,0.86,0.38], cor:'escuro', piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[0, 0.24,-0.80],  tam:[0.34,0.62,0.12], cor:'metal',  piv:[0,-0.30,0],     eixe:'x' },
    /* HOMBREIRAS. Son a marca da clase: anchas, altas e cadradas, e
       chegan máis lonxe cós propios brazos para que a silueta as amose
       aínda de perfil.

       O FONDO (1.02) non é decorativo: coas hombreiras planas, a regra L3
       cazaba que de fronte medía 1.56 veces o que de perfil, e o robot
       desaparecía ao xirar. Unha hombreira que sobresae ten que sobresaír
       en todas as direccións. */
    { id:'torso',   centro:[-0.86,0.52,0],   tam:[0.42,0.50,1.02], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[ 0.86,0.52,0],   tam:[0.42,0.50,1.02], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[-0.86,0.76,0],   tam:[0.34,0.14,0.86], cor:'metal',  piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[ 0.86,0.76,0],   tam:[0.34,0.14,0.86], cor:'metal',  piv:[0,-0.30,0],     eixe:'x' },
    { id:'brazo_e',    centro:[-0.82,0.13,0.06],tam:[0.32,0.42,0.36], cor:'azul', piv:[-0.82,0.34,0],  eixe:'x' },
    { id:'brazo_d',    centro:[ 0.82,0.13,0.06],tam:[0.32,0.42,0.36], cor:'azul', piv:[ 0.82,0.34,0],  eixe:'x' },
    { id:'antebrazo_e',centro:[-0.82,-0.32,0.06],tam:[0.30,0.48,0.34],cor:'azul', piv:[-0.82,-0.08,0],eixe:'x', pai:'brazo_e' },
    { id:'antebrazo_d',centro:[ 0.82,-0.32,0.06],tam:[0.30,0.48,0.34],cor:'azul', piv:[ 0.82,-0.08,0],eixe:'x', pai:'brazo_d' },
    /* Cabeza baixa e ancha: métese entre as hombreiras en vez de asomar. */
    { id:'cabeza',  centro:[0, 0.82, 0],     tam:[0.72,0.50,0.70], cor:'metal',  piv:[0,0.62,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 0.84, 0.38],  tam:[0.46,0.14,0.12], cor:'ollo',   piv:[0,0.62,0],      eixe:'x' },
    /* O cañón rotativo pesa: vai na man, non colgado do medio. */
    { id:'arma',    centro:[0.76,-0.36,0.72],tam:[0.30,0.30,1.50], cor:'escuro', piv:[0.76,-0.36,0.12], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
    { id:'arma',    centro:[0.72,-0.36,0.16],tam:[0.42,0.42,0.34], cor:'escuro', piv:[0.76,-0.36,0.12], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
  ],
  ENGINEER: [
    { id:'perna_e', centro:[-0.30,-0.60,0],  tam:[0.28,0.88,0.34], cor:'azul',   piv:[-0.30,-0.16,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.30,-0.60,0],  tam:[0.28,0.88,0.34], cor:'azul',   piv:[ 0.30,-0.16,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.10, 0],     tam:[0.88,0.82,0.74], cor:'azul',   piv:[0,-0.28,0],     eixe:'x' },
    { id:'torso',   centro:[0, 0.14,-0.50],  tam:[0.62,0.80,0.30], cor:'ambar',  piv:[0,-0.28,0],     eixe:'x' },
    { id:'brazo_e',    centro:[-0.58,0.23,0.06],tam:[0.24,0.42,0.28], cor:'azul', piv:[-0.58,0.44,0],  eixe:'x' },
    { id:'brazo_d',    centro:[ 0.58,0.23,0.06],tam:[0.24,0.42,0.28], cor:'azul', piv:[ 0.58,0.44,0],  eixe:'x' },
    { id:'antebrazo_e',centro:[-0.58,-0.20,0.06],tam:[0.22,0.44,0.26],cor:'azul', piv:[-0.58,0.02,0], eixe:'x', pai:'brazo_e' },
    { id:'antebrazo_d',centro:[ 0.58,-0.20,0.06],tam:[0.22,0.44,0.26],cor:'azul', piv:[ 0.58,0.02,0], eixe:'x', pai:'brazo_d' },
    { id:'cabeza',  centro:[0, 0.84, 0],     tam:[0.70,0.58,0.66], cor:'metal',  piv:[0,0.58,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 0.88, 0.36],  tam:[0.46,0.17,0.12], cor:'ollo',   piv:[0,0.58,0],      eixe:'x' },
    /* O SOPLETE só pode ir nunha man. Máis groso que antes: era tan fino
       que desaparecía en varias direccións (L1). E leva boquilla, que é
       o que o fai recoñecible como ferramenta e non como pau. */
    { id:'arma',    centro:[0.56,-0.30,0.44],tam:[0.20,0.22,0.72], cor:'ambar',  piv:[0.56,-0.30,0.08], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
    { id:'arma',    centro:[0.56,-0.30,0.84],tam:[0.14,0.14,0.26], cor:'metal',  piv:[0.56,-0.30,0.08], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
  ],
  /* O SNIPER é o oposto exacto do HEAVY, e a propósito: onde aquel é
     ancho e cadrado, este é alto e estreito. Con cinco clases xa non
     abonda con que cada unha sexa "recoñecible"; teñen que ocupar sitios
     distintos do mesmo eixe, que é o que mide a regra L4.

     A marca propia é o CANO: o máis longo de todas as clases con
     diferenza, e o visor prolongado por riba da cabeza. */
  SNIPER: [
    { id:'perna_e', centro:[-0.24,-0.66,0],  tam:[0.22,1.00,0.28], cor:'azul',   piv:[-0.24,-0.16,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.24,-0.66,0],  tam:[0.22,1.00,0.28], cor:'azul',   piv:[ 0.24,-0.16,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.14, 0],     tam:[0.72,0.86,0.58], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[0, 0.44, 0.10],  tam:[0.54,0.22,0.46], cor:'violeta',piv:[0,-0.30,0],     eixe:'x' },
    { id:'brazo_e',    centro:[-0.48,0.28,0.06],tam:[0.20,0.44,0.24], cor:'azul', piv:[-0.48,0.50,0],  eixe:'x' },
    { id:'brazo_d',    centro:[ 0.48,0.28,0.06],tam:[0.20,0.44,0.24], cor:'azul', piv:[ 0.48,0.50,0],  eixe:'x' },
    { id:'antebrazo_e',centro:[-0.48,-0.16,0.06],tam:[0.18,0.44,0.22],cor:'azul', piv:[-0.48,0.06,0], eixe:'x', pai:'brazo_e' },
    { id:'antebrazo_d',centro:[ 0.48,-0.16,0.06],tam:[0.18,0.44,0.22],cor:'azul', piv:[ 0.48,0.06,0], eixe:'x', pai:'brazo_d' },
    /* CASCO VIOLETA. É a marca da clase, e vai na cabeza por unha razón
       medible: probeino primeiro no colar, na cresta e na mira, e a cor
       quedaba entre o 0% e o 3% do sprite —nunha das oito direccións
       desaparecía de todo. A cabeza é a única peza que se ve desde as
       oito e que non tapa ningunha outra. */
    { id:'cabeza',  centro:[0, 0.86, 0],     tam:[0.58,0.54,0.56], cor:'violeta',piv:[0,0.60,0],      eixe:'x' },
    /* Visor alongado: sobresae por diante e por riba, e é o que se ve
       cando o robot mira de costas ou de perfil. */
    { id:'cabeza',  centro:[0, 0.92, 0.34],  tam:[0.36,0.14,0.30], cor:'ollo',   piv:[0,0.60,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 1.08, -0.08], tam:[0.12,0.30,0.12], cor:'violeta',piv:[0,0.60,0],      eixe:'x' },
    /* Cano longo e fino. É a clase á que se lle perdoa que sexa delgado
       porque mide case dous corpos de longo: iso lese en calquera das
       oito direccións. */
    { id:'arma',    centro:[0.46,-0.28,0.86],tam:[0.14,0.14,1.80], cor:'escuro', piv:[0.46,-0.28,0.08], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
    { id:'arma',    centro:[0.44,-0.30,0.18],tam:[0.24,0.22,0.28], cor:'escuro', piv:[0.46,-0.28,0.08], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
    { id:'arma',    centro:[0.46,-0.17,0.52],tam:[0.12,0.18,0.40], cor:'violeta',piv:[0.46,-0.28,0.08], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
  ],
  /* O BOMBARDEIRO ten que distinguirse do HEAVY, que é o seu veciño en
     corpulencia. Faino coa COR: dous depósitos laranxas ás costas, que
     son a única peza laranxa de todo o xogo e o fan recoñecible mesmo de
     costas — que é xusto cando o artiluxio non se ve.

     E o artiluxio é o contrario do cano do sniper: curto e groso. */
  BOMBARDERO: [
    { id:'perna_e', centro:[-0.34,-0.60,0],  tam:[0.32,0.88,0.38], cor:'azul',   piv:[-0.34,-0.16,0], eixe:'x' },
    { id:'perna_d', centro:[ 0.34,-0.60,0],  tam:[0.32,0.88,0.38], cor:'azul',   piv:[ 0.34,-0.16,0], eixe:'x' },
    { id:'torso',   centro:[0, 0.12, 0],     tam:[1.02,0.90,0.78], cor:'azul',   piv:[0,-0.30,0],     eixe:'x' },
    { id:'torso',   centro:[-0.40,0.30,-0.52],tam:[0.34,0.72,0.34], cor:'laranxa',piv:[0,-0.30,0],    eixe:'x' },
    { id:'torso',   centro:[ 0.40,0.30,-0.52],tam:[0.34,0.72,0.34], cor:'laranxa',piv:[0,-0.30,0],    eixe:'x' },
    { id:'torso',   centro:[0, 0.52,-0.44],  tam:[0.62,0.16,0.22], cor:'escuro', piv:[0,-0.30,0],     eixe:'x' },
    { id:'brazo_e',    centro:[-0.66,0.22,0.06],tam:[0.26,0.44,0.30], cor:'azul', piv:[-0.66,0.44,0],  eixe:'x' },
    { id:'brazo_d',    centro:[ 0.66,0.22,0.06],tam:[0.26,0.44,0.30], cor:'azul', piv:[ 0.66,0.44,0],  eixe:'x' },
    { id:'antebrazo_e',centro:[-0.66,-0.22,0.06],tam:[0.24,0.46,0.28],cor:'azul', piv:[-0.66,0.00,0], eixe:'x', pai:'brazo_e' },
    { id:'antebrazo_d',centro:[ 0.66,-0.22,0.06],tam:[0.24,0.46,0.28],cor:'azul', piv:[ 0.66,0.00,0], eixe:'x', pai:'brazo_d' },
    { id:'cabeza',  centro:[0, 0.84, 0],     tam:[0.66,0.54,0.62], cor:'metal',  piv:[0,0.58,0],      eixe:'x' },
    { id:'cabeza',  centro:[0, 0.86, 0.34],  tam:[0.42,0.16,0.12], cor:'ollo',   piv:[0,0.58,0],      eixe:'x' },
    /* Tubo curto e gordo, coa boca laranxa: a mesma cor cós depósitos,
       para que se lea que unha cousa alimenta a outra. */
    { id:'arma',    centro:[0.62,-0.32,0.40],tam:[0.34,0.34,0.66], cor:'escuro', piv:[0.62,-0.32,0.10], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
    { id:'arma',    centro:[0.62,-0.32,0.78],tam:[0.26,0.26,0.16], cor:'laranxa',piv:[0.62,-0.32,0.10], eixe:'y', ang:DIAG, pulso:PULSO_ARMA, pai:'antebrazo_d' },
  ],
};

/* ============================================================
   CINEMÁTICA INVERSA de dous ósos.

   Deixar de adiviñar ángulos. Dise ONDE ten que estar a man e saen os
   ángulos de ombro e cóbado, exactos. Se o punto queda fóra do alcance,
   o brazo estírase cara a el en vez de romper.

   O brazo articula nun só plano (o yz, eixe x), así que abonda coa lei
   do coseno. Non fai falla resolvedor iterativo ningún.
   ============================================================ */
/* `cara` escolle CARA ONDE apunta o cóbado. Sempre hai dúas solucións que
   deixan a man no mesmo sitio, e son moi distintas de ver: co cóbado
   arriba o robot parece encollerse de ombros, e co cóbado abaixo sostén
   a arma. Non é un axuste fino: é unha decisión anatómica, e por iso é un
   argumento con nome en vez de un signo escondido na fórmula. */
function ikBrazo(l1, l2, dy, dz, cobadoAbaixo = true){
  const s = cobadoAbaixo ? -1 : 1;
  const d = Math.min(Math.hypot(dy, dz), (l1 + l2) * 0.999);
  /* En repouso os ósos apuntan cara a -y (colgan). Cun xiro θ arredor de
     x, a punta vai a (-cos θ, -sin θ) en (y, z): θ POSITIVO leva a man
     cara atrás. Por iso o ángulo cara ao obxectivo leva signo negativo. */
  const cara = -Math.atan2(dz, -dy);
  /* Lei do coseno: apertura no ombro entre o óso alto e a liña recta ao
     obxectivo, e dobra do cóbado. */
  const cosA = Math.max(-1, Math.min(1, (l1*l1 + d*d - l2*l2) / (2*l1*d)));
  const cosB = Math.max(-1, Math.min(1, (l1*l1 + l2*l2 - d*d) / (2*l1*l2)));
  return { ombro: cara - s*Math.acos(cosA), cobado: s*(Math.PI - Math.acos(cosB)) };
}

/* Cinemática DIRECTA do mesmo brazo: onde acaba a man cos ángulos dados.
   Existe para poder COMPROBAR a IK en vez de xulgala mirando o render. */
function fkBrazo(l1, l2, ombro, cobado){
  const y1 = -l1*Math.cos(ombro), z1 = -l1*Math.sin(ombro);
  const t = ombro + cobado;
  return [y1 - l2*Math.cos(t), z1 - l2*Math.sin(t)];
}

/* ============================================================
   PULSO AUTOMÁTICO.

   Un artiluxio pendurado do antebrazo herda TODAS as rotacións en x da
   cadea, así que calquera ángulo de pulso fixo só vale para a pose coa
   que se axustou: en canto o brazo balancea andando ou retrocede
   disparando, a arma apunta ao ceo ou ao chan.

   Isto devolve o ángulo que fai falla para que a inclinación final sexa
   `pz.pulso`, sexa cal sexa a pose. A rotación propia da peza non conta
   se vai noutro eixe (o cruce da arma é en y e non a inclina).
   ============================================================ */
function pulsoAuto(esq, pz, total){
  let acc = 0, a = pz.pai;
  const vistos = new Set();
  while(a && !vistos.has(a)){
    vistos.add(a);
    const p = esq.find(q => q.id === a);
    if(!p) break;
    if((p.eixe || 'x') === 'x') acc += total[a] || 0;
    a = p.pai;
  }
  if((pz.eixe || 'x') === 'x') acc += (pz.ang || 0) + (total[pz.id] || 0);
  return (pz.pulso || 0) - acc;
}

/* Amplitude do balanceo por clase: o HEAVY move menos porque pesa. */
const BALANCEO = { GRUNT: 0.55, HEAVY: 0.42, ENGINEER: 0.50,
  /* O sniper move pouco porque camiña coidando o disparo; o bombardeiro
     leva depósitos ás costas e tampouco corre. */
  SNIPER: 0.46, BOMBARDERO: 0.44 };

/* ============================================================
   POSE BASE — a postura de garda. Aplícase SEMPRE, por debaixo de
   calquera estado.

   O motivo é de deseño, non técnico: o xogo só distingue "movéndose"
   e "quieto" (fi = move ? ciclo : 0). Non hai estado de disparo nin
   de repouso separados. Polo tanto a única pose que existe ten que
   valer para montar garda, apuntar e agardar ordes á vez.

   Cos brazos colgando lía como unha unidade de folga. Coa arma
   preparada le ben nas dúas situacións: un soldado andando coa arma
   arriba é normal; un soldado parado coa arma abaixo, non.

   Se algún día o xogo gaña estados de verdade, esta base baixa a
   REPOUSO e cada estado leva a súa.
   ============================================================ */
/* ONDE vai a man, non que ángulo leva o ombro. Estes son os únicos
   números que se escriben a man agora, e son medibles nun debuxo:
   "a man dereita á altura do peito, adiantada; a esquerda un pouco máis
   preto do corpo". Os ángulos saen da IK. */
const OBXECTIVO_MAN = {
  GRUNT:    { d: [-0.30, 0.46], e: [-0.34, 0.30] },   /* [y, z] respecto do ombro */
  HEAVY:    { d: [-0.34, 0.44], e: [-0.40, 0.26] },
  ENGINEER: { d: [-0.28, 0.44], e: [-0.38, 0.20] },
  /* O sniper leva a man dereita máis adiantada e a esquerda debaixo do
     cano: é o único que agarra con dúas mans, e nótase na pose. */
  SNIPER:   { d: [-0.26, 0.46], e: [-0.30, 0.40] },
  BOMBARDERO:{ d: [-0.32, 0.44], e: [-0.38, 0.24] },
};

function poseBaseIK(cls){
  const esq = ESQUELETO[cls];
  const obx = OBXECTIVO_MAN[cls];
  if(!obx) return {};
  const fóra = {};
  for(const lado of ['d', 'e']){
    const alto = esq.find(p => p.id === 'brazo_' + lado);
    const ante = esq.find(p => p.id === 'antebrazo_' + lado);
    if(!alto || !ante) continue;
    const r = ikBrazo(alto.tam[1], ante.tam[1], obx[lado][0], obx[lado][1]);
    fóra['brazo_' + lado] = r.ombro;
    fóra['antebrazo_' + lado] = r.cobado;
  }
  return fóra;
}

const TORSO_BASE = { GRUNT: 0.04, HEAVY: 0.03, ENGINEER: 0.05,
                     SNIPER: 0.06, BOMBARDERO: 0.03 };

const POSE_BASE = new Proxy({}, {
  get(_, cls){
    if(typeof cls !== "string" || !ESQUELETO[cls]) return undefined;
    return Object.assign(poseBaseIK(cls), { torso: TORSO_BASE[cls] || 0 });
  },
  has(_, cls){ return typeof cls === "string" && !!ESQUELETO[cls]; },
});

/* ============================================================
   POSE — devolve {articulación: radiáns}. NON sabe nada de caixas.
   Aquí é onde se engade un estado novo, e só aquí.
   ============================================================ */
function pose(cls, estado, fase){
  const A = BALANCEO[cls] || 0.5;
  const s = Math.sin(fase * 2 * Math.PI);

  switch(estado){
    case 'ANDAR':
      return { perna_e: s*A, perna_d: -s*A, brazo_e: -s*A*0.45, brazo_d: s*A*0.45 };

    case 'DISPARAR': {
      /* Retroceso: a arma vai cara atrás e volve. Nas oito direccións
         sae de balde — non hai que redebuxar nada. */
      const r = Math.max(0, Math.sin(fase * Math.PI));
      return { arma: r*0.22, antebrazo_d: -r*0.20, torso: -r*0.06 };
    }

    case 'CURAR': {
      /* O enxeñeiro inclínase sobre o paciente e baixa o soplete. O
         torso ten articulación no esqueleto precisamente para isto,
         aínda que o ciclo de andar non a use. */
      const t = 0.5 + 0.5*Math.sin(fase * 2 * Math.PI);
      return { torso: 0.28 + t*0.06, brazo_d: 0.30, antebrazo_d: 0.45 + t*0.12,
               cabeza: 0.18, arma: 0.35 };
    }

    case 'IMPACTO': {
      const k = Math.max(0, 1 - fase*2);
      return { torso: -k*0.30, cabeza: -k*0.22, brazo_e: k*0.25, brazo_d: k*0.20, antebrazo_d: k*0.20 };
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
  /* POSE BASE + estado. A base é a postura de garda, e vai SEMPRE:
     mentres o xogo non distinga entre estar quieto e combater, a única
     pose que hai ten que valer para as dúas cousas. */
  const b = POSE_BASE[cls] || {};
  const p = pose(cls, estado, fase);
  const total = {};
  for(const k of new Set([...Object.keys(b), ...Object.keys(p)])){
    total[k] = (b[k] || 0) + (p[k] || 0);
  }

  /* Índice de pivotes por articulación, para encadear pais. */
  const pivDe = {};
  for(const pz of esq) if(pz.id && pz.piv && !pivDe[pz.id]) pivDe[pz.id] = { piv: pz.piv, eixe: pz.eixe || 'x' };

  const r = new Robot();
  for(const pz of esq){
    if(sen && sen.includes(pz.id)) continue;
    const cor = (pz.cor === 'azul' && corEquipo) ? corEquipo : pz.cor;
    const xiros = [];
    /* A propia: ángulo de montaxe + o que diga a pose. */
    /* Muñeca primeiro: orienta o artiluxio respecto do antebrazo antes de
       aplicarlle o ángulo cruzado e as rotacións dos pais. */
    if(pz.piv && pz.pulso !== undefined) xiros.push({ piv: pz.piv, ang: pulsoAuto(esq, pz, total), eixe: 'x' });
    if(pz.piv) xiros.push({ piv: pz.piv, ang: (pz.ang || 0) + (total[pz.id] || 0), eixe: pz.eixe || x });
    /* E despois as dos pais, subindo pola cadea. Un artiluxio declara
       pai:'brazo_d' e así viaxa coa man en vez de quedar flotando. */
    let pai = pz.pai;
    const vistos = new Set();
    while(pai && pivDe[pai] && !vistos.has(pai)){
      vistos.add(pai);
      xiros.push({ piv: pivDe[pai].piv, ang: total[pai] || 0, eixe: pivDe[pai].eixe });
      pai = (esq.find(q => q.id === pai) || {}).pai;
    }
    r.caixa(pz.centro, pz.tam, cor, xiros);
  }
  return r;
}

/* ============================================================
   PUNTO POSADO — onde acaba un punto do esqueleto despois de aplicar
   base + estado + a cadea de pais. Serve para comprobar que a man e o
   agarre do artiluxio seguen xuntos en TODAS as fases, non só en
   repouso: sen parentesco, o brazo balancea e a arma queda no aire.
   ============================================================ */
function _xirar(p, piv, ang, eixe){
  const c = Math.cos(ang), s = Math.sin(ang);
  const [x, y, z] = [p[0]-piv[0], p[1]-piv[1], p[2]-piv[2]];
  let q;
  if(eixe === 'x') q = [x, y*c - z*s, y*s + z*c];
  else if(eixe === 'y') q = [x*c + z*s, y, -x*s + z*c];
  else q = [x*c - y*s, x*s + y*c, z];
  return [q[0]+piv[0], q[1]+piv[1], q[2]+piv[2]];
}

function puntoPosado(cls, estado, fase, punto, idPropio, pai, peza){
  const esq = ESQUELETO[cls];
  const b = POSE_BASE[cls] || {}, p = pose(cls, estado, fase);
  const ang = (id) => (b[id] || 0) + (p[id] || 0);
  const pivDe = {};
  for(const pz of esq) if(pz.id && pz.piv && !pivDe[pz.id]) pivDe[pz.id] = { piv: pz.piv, eixe: pz.eixe || 'x' };

  let q = punto;
  /* Mesma orde ca montar(): pulso, propia, e despois os pais. Sen isto a
     regra do nivelado mediría a arma SEN a compensación e daría falso. */
  if(peza && peza.pulso !== undefined && peza.piv){
    const total = {};
    for(const k of new Set([...Object.keys(b), ...Object.keys(p)])) total[k] = ang(k);
    q = _xirar(q, peza.piv, pulsoAuto(esq, peza, total), 'x');
  }
  if(idPropio && pivDe[idPropio]) q = _xirar(q, pivDe[idPropio].piv, ang(idPropio), pivDe[idPropio].eixe);
  let a = pai, vistos = new Set();
  while(a && pivDe[a] && !vistos.has(a)){
    vistos.add(a);
    q = _xirar(q, pivDe[a].piv, ang(a), pivDe[a].eixe);
    a = (esq.find(x => x.id === a) || {}).pai;
  }
  return q;
}

const ESTADOS = ['REPOUSO', 'ANDAR', 'DISPARAR', 'CURAR', 'IMPACTO'];
const CLASES = Object.keys(ESQUELETO);

module.exports = { ESQUELETO, BALANCEO, POSE_BASE, OBXECTIVO_MAN, ikBrazo, fkBrazo, pose, montar, puntoPosado, ESTADOS, CLASES, DIAG };
