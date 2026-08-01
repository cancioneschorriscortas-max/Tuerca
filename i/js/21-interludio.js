/* ============================================================
   INTERLUDIOS — o que pasa ENTRE as operacións.

   TUERCA contábase enteiro dentro da batalla e do hangar. Faltaba o
   respiro: o momento en que baixas do combate e alguén che di onde
   estás. Isto é ese momento.

   DÚAS VOCES, e o contraste é todo o contido:

     ÓPTIMA   a empresa. Fala en plural, en imperativo e sempre
              agradecida. Chámalle "material reasignado" ao teu
              compañeiro reconstruído e non o di con maldade: dío
              porque para ela é iso.
     TUERCA   o arquiveiro. Escribe en primeira persoa, a man, e
              cóntache o mesmo feito desde o outro lado.

   O reparto non se inventou: as imaxes de art/ xa viñan escritas nesas
   dúas voces —"PRODUCIMOS. PROTEGEMOS. PRESERVAMOS." fronte a "NINGÚN
   ROBOT ES DESECHABLE"— e cada interludio usa a súa.

   CATRO REGRAS:

   1. UN POR OPERACIÓN como moito. Dous seguidos xa non se len.
   2. Cada un dispárase UNHA vez e polo que che PASOU, non por un
      contador: o da sala de veteranos non aparece ata que morre
      alguén. Quen non perde a ninguén non o ve, e está ben.
   3. AS VOCES ALTÉRNANSE. Cando hai dous candidatos, gaña o que non
      fale coa mesma voz có anterior. Se sempre falase ÓPTIMA
      convertíase en publicidade; se sempre falase o arquiveiro,
      en queixa.
   4. Só na campaña. En PvP, Mundial e Crisol isto sería un corte.

   O ÚLTIMO É A REVELACIÓN. O laboratorio v0.9β explica por que os
   robots teñen nome e memoria —é un fallo de firmware que ÓPTIMA nunca
   soubo arranxar— e non se amosa ata moi tarde. Antes de saber iso hai
   que ter perdido a alguén; se non, non significa nada.
   ============================================================ */

const INTERLUDIOS = [
  /* ÓPTIMA felicítate pola primeira vitoria. É o primeiro que se ve e
     está posto a mantenta: primeiro a empresa parece razoable. */
  { id: 'optima', imaxe: 'optima', voz: 'OPTIMA',
    cando: (D, op) => op && op.result === 'victory' },

  /* A primeira baixa. Non se conta cun número: cóntase cun nicho. */
  { id: 'veteranos', imaxe: 'saladeveteranos', voz: 'TUERCA',
    cando: (D) => (D.fallen || []).length >= 1 },

  /* O primeiro reensamblado, visto pola contabilidade. O xogador acaba
     de facer algo que sente como resurrección; ÓPTIMA rexístrao como
     movemento de almacén. */
  { id: 'chatarra', imaxe: 'almacendechatarra', voz: 'OPTIMA',
    cando: (D) => (D.units || []).some(r => r.renacido || r.reensamblado) },

  { id: 'radar', imaxe: 'radar', voz: 'OPTIMA',
    cando: (D) => (D.opCount || 0) >= 3 },

  /* A resposta da resistencia á vixilancia: os catro principios. */
  { id: 'principios', imaxe: 'principiosdetuerca', voz: 'TUERCA',
    cando: (D) => (D.opCount || 0) >= 5 },

  { id: 'estratexia', imaxe: 'saladeestratexia', voz: 'OPTIMA',
    cando: (D) => (D.opCount || 0) >= 8 },

  /* Quen escribe o diario do xogo é o sétimo arquiveiro. Aquí dise. */
  { id: 'arquiveiros', imaxe: 'registrodearchiveros', voz: 'TUERCA',
    cando: (D) => (D.opCount || 0) >= 11 },

  /* A revelación. Pide dúas cousas á vez: tempo xogado E mortos
     propios. Sen as dúas non pesa. */
  { id: 'firmware', imaxe: 'historiafirmware09b', voz: 'TUERCA',
    cando: (D) => (D.opCount || 0) >= 15 && (D.fallen || []).length >= 3 },
];

function interludioEstado(){
  if(typeof DATA === 'undefined') return null;
  if(!DATA.interludios) DATA.interludios = { vistos: [], ultimaVoz: null };
  if(!Array.isArray(DATA.interludios.vistos)) DATA.interludios.vistos = [];
  return DATA.interludios;
}

/* Cal toca, se é que toca algún. Devolve o obxecto ou null. */
function interludioEscoller(op){
  if(typeof DATA === 'undefined') return null;
  if(op && (op.modo === 'pvp' || op.modo === 'mundial' || op.modo === 'crisol')) return null;
  const est = interludioEstado();
  if(!est) return null;

  const candidatos = INTERLUDIOS.filter(it => {
    if(est.vistos.indexOf(it.id) >= 0) return false;
    try{ return !!it.cando(DATA, op); }catch(e){ return false; }
  });
  if(!candidatos.length) return null;

  /* Regra 3: se hai máis dun, prefírese o que cambie de voz. Se todos
     falan coa mesma que o anterior, vai o primeiro igual — alternar
     importa, pero non tanto como para calar un interludio. */
  const outraVoz = candidatos.find(it => it.voz !== est.ultimaVoz);
  return outraVoz || candidatos[0];
}

/* Debuxa e amosa. `remate` chámase ao premer seguir. */
function interludioAmosar(it, remate){
  const cx = document.getElementById('interludio');
  if(!cx){ if(remate) remate(); return; }

  /* Ruta ABSOLUTA. Un url() relativo nunha variable de CSS resólvese
     contra a folla de estilos que a consome e non contra o documento,
     e con css/ aparte pedíase css/ui/... e non cargaba nada. */
  const rota = new URL(`ui/fondo_${it.imaxe}.jpg`, document.baseURI).href;
  cx.style.setProperty('--fondo', `url("${rota}")`);
  cx.dataset.voz = it.voz;

  const tit = document.getElementById('intTitulo');
  const txt = document.getElementById('intTexto');
  if(tit) tit.textContent = TXT('int.' + it.id + '.tit');
  /* O texto vén nunha soa clave con saltos de liña: así o tradutor ve o
     parágrafo enteiro e non liñas soltas sen contexto. */
  if(txt){
    txt.innerHTML = String(TXT('int.' + it.id + '.txt') || '')
      .split('\n')
      .filter(l => l.trim())
      .map(l => `<p>${l.trim()}</p>`)
      .join('');
  }
  /* A etiqueta do botón NON se pon aquí: vai na táboa I18N_CHROME, que é
     o mecanismo da casa e o que segue o idioma se se cambia coa pantalla
     aberta. Poñela nos dous sitios sería ter dúas verdades. */
  const seguir = document.getElementById('intSeguir');

  cx.style.display = 'flex';
  const pechar = () => {
    cx.style.display = 'none';
    if(seguir) seguir.onclick = null;
    document.removeEventListener('keydown', tecla);
    if(remate) remate();
  };
  const tecla = (e) => { if(e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') pechar(); };
  if(seguir) seguir.onclick = pechar;
  document.addEventListener('keydown', tecla);
}

/* A porta de entrada: chámase ao volver do informe ao hangar. Se non
   toca ningún, executa `remate` sen máis, así que quen chama non ten que
   saber nada disto. */
function interludioQuizais(remate){
  let it = null;
  try{ it = interludioEscoller(window._ultimaOp || null); }catch(e){ console.error('[interludio]', e); }
  if(!it){ if(remate) remate(); return false; }

  const est = interludioEstado();
  est.vistos.push(it.id);
  est.ultimaVoz = it.voz;
  /* Gárdase ANTES de amosalo. Se se gardase ao pechar, saír da páxina co
     interludio aberto faría que volvese aparecer na seguinte partida. */
  try{ if(typeof saveData === 'function') saveData(DATA); }catch(e){}

  interludioAmosar(it, remate);
  return true;
}
