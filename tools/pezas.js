/* ============================================================
   CATÁLOGO DE PEZAS — o que o xogador combina.

   Dous vocabularios que se estaban a confundir, e non son o mesmo:

     SLOT     o que se rapiña e se intercambia. Son os sete de
              04-progresion.js, e definen a economía do xogo: cada
              caído deixa sete pezas.
     CAPA     o que se renderiza por separado para poder apilalo. Son
              oito, porque un CHASIS achega tres (o corpo, a placa
              peitoral e a mochila) e o NUCLEO non achega ningunha.

   Un slot pode dar varias capas. Iso non é unha inconsistencia: é o que
   permite meter accesorios sen tocar a economía. E o NUCLEO sen
   xeometría cadra co que é — a IA, o que lembra. O que fai que unha
   peza sexa de alguén non se ve.

   ANCORAS: para poder montar un brazo de SNIPER nun torso de HEAVY, as
   pezas non se gardan en coordenadas absolutas senón RESPECTO DA SÚA
   ARTICULACIÓN. O torso di onde ten os ombros, as cadeiras e o pescozo;
   cada peza tráese a ese punto. Sen isto, mesturar clases deixa os
   brazos flotando ou metidos no corpo, porque o HEAVY é 0.44 máis ancho
   có SNIPER.
   ============================================================ */
const { ESQUELETO, CLASES } = require('./modelos.js');

/* slot do xogo -> capas de render que achega */
const SLOT_CAPAS = {
  CABEZA:     ['CABEZA'],
  CHASIS:     ['TORSO', 'PEITO', 'MOCHILA'],
  NUCLEO:     [],                       /* a IA non se ve */
  BRAZO_DER:  ['BRAZO_D'],              /* co seu artiluxio dentro */
  BRAZO_ESQ:  ['BRAZO_E'],
  PERNA_DER:  ['PERNA_D'],
  PERNA_ESQ:  ['PERNA_E'],
};
const SLOTS = Object.keys(SLOT_CAPAS);

/* capa -> slot, que é a dirección que fai falla ao repartir un esqueleto */
const CAPA_SLOT = {};
for(const [s, capas] of Object.entries(SLOT_CAPAS)) for(const c of capas) CAPA_SLOT[c] = s;

/* En que capa cae cada peza do esqueleto. Mesmo criterio que
   tools/proba_capas.js, que é onde se mediu que funciona. */
function capaDe(peza){
  if(peza.slot) return peza.slot;
  const id = peza.id;
  if(id === 'cabeza') return 'CABEZA';
  if(id === 'torso') return 'TORSO';
  if(id === 'arma' || id === 'brazo_d' || id === 'antebrazo_d') return 'BRAZO_D';
  if(id === 'brazo_e' || id === 'antebrazo_e') return 'BRAZO_E';
  if(id === 'perna_e') return 'PERNA_E';
  if(id === 'perna_d') return 'PERNA_D';
  return 'TORSO';
}

/* ---------- ancoras ----------
   SUPERFICIES, non pivotes. A primeira versión usaba os pivotes, que é o
   que o esqueleto xa declara, e a mestura rompía: unha cabeza de SNIPER
   nun chasis de HEAVY afundíase 0.47 no corpo. Normal — un pivote é un
   centro de rotación, e onde hai que apoiar unha cabeza é na cara de
   arriba do torso. Con pivotes, cada clase os ten a distinta altura
   respecto da súa propia superficie, e a diferenza vaise ao oco.

   Así que o chasis declara ONDE SE APOIA cada cousa, e cada peza declara
   CON QUE CARA se apoia. Montar é facer coincidir esas dúas. */
const _lim = (caixas, eixe, extremo) => {
  const vals = caixas.map(p => p.centro[eixe] + extremo*p.tam[eixe]/2);
  return extremo > 0 ? Math.max(...vals) : Math.min(...vals);
};

function ancoras(cls){
  const esq = ESQUELETO[cls];
  const corpo = esq.filter(p => capaDe(p) === 'TORSO');
  const arriba = _lim(corpo, 1, +1), abaixo = _lim(corpo, 1, -1);
  const lado = _lim(corpo, 0, +1);
  const pivY = (id) => { const p = esq.find(q => q.id === id); return p && p.piv ? p.piv[1] : 0; };
  const pernaX = (id) => { const p = esq.find(q => q.id === id); return p ? p.centro[0] : 0; };
  /* A distinción que faltaba: hai dous tipos de unión e non se aliñan
     igual. Un OMBRO e unha CADEIRA son ARTICULACIÓNS — o que ten que
     coincidir é o eixe de xiro, e que a raíz do membro quede metida na
     pelve é correcto. Un PESCOZO é un APOIO: a cabeza pousa na cara de
     arriba do corpo.
     Tratar todo como superficie baixaba as pernas 0.15 e rompía a
     proporción; tratar todo como pivote afundía a cabeza 0.47. */
  const piv3 = (id) => { const p = esq.find(q => q.id === id); return p && p.piv ? p.piv : [0,0,0]; };
  return {
    pescozo:  [0, arriba, 0],
    ombroD:   piv3('brazo_d'),
    ombroE:   piv3('brazo_e'),
    /* A CADEIRA é mixta, e é o que máis custou ver. En horizontal é
       articulación: a perna vai onde o chasis ten a cadeira. En vertical
       é apoio: a perna colga do FONDO da pelve. Tratándoa como pivote
       puro, unha perna ancha colgada da cadeira estreita dun SNIPER
       quedaba dentro do corpo — 80 píxeles sen orde posible, o maior
       conflito da mestura con diferenza. */
    cadeiraD: [piv3('perna_d')[0], abaixo, piv3('perna_d')[2]],
    cadeiraE: [piv3('perna_e')[0], abaixo, piv3('perna_e')[2]],
  };
}

/* Con que cara se apoia cada peza. É a operación simétrica: onde a peza
   ten o seu punto de contacto, expresado nas súas propias coordenadas. */
/* A RAÍZ dun membro é a caixa dese membro, non "a primeira que teña
   pivote". No HEAVY a hombreira vai no slot do brazo e leva o pivote do
   TORSO: collela como raíz desprazaba o brazo enteiro 0.82. */
const RAIZ_DE = { BRAZO_DER:'brazo_d', BRAZO_ESQ:'brazo_e',
                  PERNA_DER:'perna_d', PERNA_ESQ:'perna_e' };

function apoioDe(slot, caixas){
  if(!caixas.length) return [0, 0, 0];
  switch(slot){
    /* a cabeza apóiase pola súa cara de abaixo, centrada en x */
    case 'CABEZA': return [0, _lim(caixas, 1, -1), 0];
    /* brazos e pernas polo seu PIVOTE: son articulacións */
    case 'BRAZO_DER': case 'BRAZO_ESQ': {
      const raiz = caixas.find(c => c.id === RAIZ_DE[slot]) || caixas[0];
      return raiz.piv || raiz.centro;
    }
    case 'PERNA_DER': case 'PERNA_ESQ': {
      const raiz = caixas.find(c => c.id === RAIZ_DE[slot]) || caixas[0];
      const p = raiz.piv || raiz.centro;
      /* x e z do pivote; y da súa cara de arriba */
      return [p[0], _lim(caixas, 1, +1), p[2]];
    }
    default: return [0, 0, 0];
  }
}

/* Que ancora usa cada slot ao montarse */
const ANCORA_DE = {
  CABEZA: 'pescozo', BRAZO_DER: 'ombroD', BRAZO_ESQ: 'ombroE',
  PERNA_DER: 'cadeiraD', PERNA_ESQ: 'cadeiraE',
};

const resta = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const suma  = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];

/* ---------- catálogo ----------
   A primeira versión sae das cinco clases que xa existen: cada unha
   achega unha peza por slot. Non é un atallo — son as únicas pezas do
   proxecto que xa pasan as 22 regras, así que serven de patrón e
   permiten probar a mestura antes de debuxar nada novo. */
function catalogo(){
  const cat = {};
  for(const s of SLOTS) cat[s] = [];
  for(const cls of CLASES){
    const esq = ESQUELETO[cls], anc = ancoras(cls);
    for(const s of SLOTS){
      const capas = SLOT_CAPAS[s];
      if(!capas.length){ cat[s].push({ id: cls, de: cls, caixas: [] }); continue; }
      const propias = esq.filter(p => capas.includes(capaDe(p)));
      /* A peza gárdase respecto do SEU punto de apoio, non do pivote do
         chasis do que saíu: así pode montarse en calquera outro. */
      const orixe = apoioDe(s, propias);
      const caixas = propias.map(p => ({
        ...p,
        centro: resta(p.centro, orixe),
        piv: p.piv ? resta(p.piv, orixe) : undefined,
      }));
      if(caixas.length) cat[s].push({ id: cls, de: cls, caixas });
    }
  }
  return cat;
}

/* ---------- montaxe ----------
   `sel` é {slot: idDaPeza}. Devolve un esqueleto do mesmo formato que
   ESQUELETO, listo para montar() e para as regras. */
function esqueletoDe(sel, cat){
  cat = cat || catalogo();
  const chasis = (cat.CHASIS.find(p => p.id === sel.CHASIS) || cat.CHASIS[0]);
  /* As ancoras do chasis mandan: todo o demais tráese a elas. */
  const anc = ancoras(chasis.de);
  const fóra = [];
  for(const s of SLOTS){
    const peza = (cat[s] || []).find(p => p.id === sel[s]) || (cat[s] || [])[0];
    if(!peza || !peza.caixas.length) continue;
    const destino = ANCORA_DE[s] ? anc[ANCORA_DE[s]] : [0, 0, 0];
    for(const c of peza.caixas){
      fóra.push({
        ...c,
        centro: suma(c.centro, destino),
        piv: c.piv ? suma(c.piv, destino) : undefined,
      });
    }
  }
  /* ASENTAR NO CHAN. Nun sistema de pezas a altura total é variable por
     definición: pernas longas, pernas curtas, un chasis máis alto. Se non
     se asenta, cada montaxe queda a distinta altura e as que se pasan
     sáense do cadro de render (a regra L2 cázao).
     A referencia é o chan do propio chasis, así que unha montaxe feita
     toda dunha clase pisa exactamente onde pisa esa clase. */
  const chan = Math.min(...ESQUELETO[chasis.de].map(p => p.centro[1] - p.tam[1]/2));
  const meu  = Math.min(...fóra.map(p => p.centro[1] - p.tam[1]/2));
  const dy = chan - meu;
  if(Math.abs(dy) > 1e-9) for(const p of fóra){
    p.centro = [p.centro[0], p.centro[1] + dy, p.centro[2]];
    if(p.piv) p.piv = [p.piv[0], p.piv[1] + dy, p.piv[2]];
  }
  return fóra;
}

module.exports = { SLOT_CAPAS, SLOTS, CAPA_SLOT, capaDe, ancoras, catalogo, esqueletoDe, ANCORA_DE };
