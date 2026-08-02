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

/* ============================================================
   OS TRAMOS — o arco da campaña.

   Ata v0.89 os interludios eran unha lista con condicións soltas. Vale
   para oito; para quince xa non, porque o TON non estaba escrito en
   ningures: estaba implícito nos limiares, e engadir unha imaxe nova
   obrigaba a recalculalos todos.

   Agora cada interludio declara a que tramo pertence, e o tramo é o que
   di como se sente esa parte da campaña:

     MAQUINA  o principio. Barro, restos, propaganda. Aquí as unidades
              son números e a que fala máis é ÓPTIMA.
     NOME     o xiro. Un único interludio, e non se dispara polo tempo
              senón porque o xogador BAUTIZA a alguén por primeira vez.
              A imaxe é literalmente iso: unha man escribindo
              "R-09 -> CROMO" no caderno do arquiveiro.
     XENTE    o final. Robots sentados ao solpor, cunca na man. É onde
              van todas as imaxes de xente que veñan despois: as cartas,
              os dardos, a televisión.
     EPILOGO  unha soa, ao final de todo.

   E hai unha cousa que non se ve na táboa pero que é o máis importante
   dela: ÓPTIMA FALA CADA VEZ MENOS. No primeiro tramo leva a metade das
   voces; no terceiro non aparece. Ninguén o anuncia, pero segundo os
   robots se converten en xente, a empresa deixa de ter algo que dicir.
   ============================================================ */
/* (v0.99) ARRANQUE vai por diante de todo e é o único que pode saír
   SEN ter xogado unha operación. O resto do sistema dispárase ao volver
   do informe; este dispárase ao entrar no hangar por primeira vez, que é
   onde ten que empezar a historia: no taller, antes do primeiro tiro.

   Todo o demais segue igual, incluída a regra de que o tramo manda sobre
   a alternancia de voces. */
const TRAMOS = ['ARRANQUE', 'MAQUINA', 'NOME', 'XENTE', 'EPILOGO'];

const INTERLUDIOS = [
  /* ---------- 0 · O ARRANQUE ---------- */

  /* O PRIMEIRO QUE VE O XOGADOR, e a escena xa estaba pintada.

     A imaxe é o laboratorio v0.9β: na parede, o rexistro de probas da
     serie D-07 á D-12 con seis ERROR seguidos e "CAUSA: DESCONOCIDA", e
     as observacións de "comportamento inestable, fallos aleatorios no
     núcleo". Diante, ÓPTIMA dá a benvida e remata dicindo que non se
     rexistraron incidencias relevantes.

     Non hai que subliñar a mentira. Está escrita na parede de detrás.

     Isto estivo un tempo no tramo da XENTE, como revelación tardía e coa
     voz do arquiveiro descubríndoo. Movéuse porque a historia empeza
     aquí: o xogador non tropeza cun fallo, entra na sala onde o fallo
     naceu. */
  { id: 'firmware', imaxe: 'historiafirmware09b', voz: 'OPTIMA', tramo: 'ARRANQUE',
    cando: () => true },

  /* ---------- I · A MÁQUINA ---------- */

  /* ÓPTIMA felicítate pola primeira vitoria. Vai primeiro a mantenta:
     ao principio a empresa parece razoable. */
  { id: 'optima', imaxe: 'optima', voz: 'OPTIMA', tramo: 'MAQUINA',
    cando: (D, op) => op && op.result === 'victory' },

  /* A primeira derrota, contada por ÓPTIMA. Na imaxe hai un robot morto
     na lama e, por riba, unha valla do MUNDIAL ÓPTIMA con robots
     relucentes. A empresa fala do torneo. Non fai falla dicir máis. */
  { id: 'ultimatransmision', imaxe: 'ultimatransmision', voz: 'OPTIMA', tramo: 'MAQUINA',
    cando: (D, op) => op && op.result !== 'victory' },

  /* A primeira baixa. Non se conta cun número: cóntase cun nicho. */
  { id: 'veteranos', imaxe: 'saladeveteranos', voz: 'TUERCA', tramo: 'MAQUINA',
    cando: (D) => (D.fallen || []).length >= 1 },

  /* Recuperar restos do campo. Dous levando a un terceiro nunha padiola. */
  { id: 'restos', imaxe: 'recuperacionderestos', voz: 'TUERCA', tramo: 'MAQUINA',
    cando: (D) => (D.piezas || []).length >= 1 },

  /* O primeiro reensamblado, visto pola contabilidade. Acabas de facer
     algo que sente como resurrección; ÓPTIMA rexístrao como movemento
     de almacén. */
  { id: 'chatarra', imaxe: 'almacendechatarra', voz: 'OPTIMA', tramo: 'MAQUINA',
    cando: (D) => (D.units || []).some(r => r.renacido || r.reensamblado) },

  /* ...e a resposta, no mesmo taller: "Se reconstruyen chasis. Las
     historias continúan." Vai despois do de ÓPTIMA porque é a réplica. */
  { id: 'taller', imaxe: 'reconstrucciondetaller', voz: 'TUERCA', tramo: 'MAQUINA',
    cando: (D) => (D.units || []).some(r => r.renacido || r.reensamblado) &&
                  (D.opCount || 0) >= 6 },

  { id: 'radar', imaxe: 'radar', voz: 'OPTIMA', tramo: 'MAQUINA',
    cando: (D) => (D.opCount || 0) >= 3 },

  /* Volta ao hangar ao solpor, un sentado sen forzas. ÓPTIMA chámalle
     "rendemento rexistrado". */
  { id: 'regreso', imaxe: 'regresoacasa', voz: 'OPTIMA', tramo: 'MAQUINA',
    cando: (D) => (D.opCount || 0) >= 4 },

  /* A resposta da resistencia á vixilancia: os catro principios. */
  { id: 'principios', imaxe: 'principiosdetuerca', voz: 'TUERCA', tramo: 'MAQUINA',
    cando: (D) => (D.opCount || 0) >= 5 },

  { id: 'estratexia', imaxe: 'saladeestratexia', voz: 'OPTIMA', tramo: 'MAQUINA',
    cando: (D) => (D.opCount || 0) >= 8 },

  /* Quen escribe o diario do xogo é o sétimo arquiveiro. Aquí dise. */
  { id: 'arquiveiros', imaxe: 'registrodearchiveros', voz: 'TUERCA', tramo: 'MAQUINA',
    cando: (D) => (D.opCount || 0) >= 11 },

  /* ---------- II · O NOME ---------- */

  /* NON vai por operacións. Vai porque o xogador premeu RENOMEAR e lle
     puxo nome a alguén: fixo o mesmo que amosa a imaxe. É o único
     interludio que responde a un ACTO e non ao paso do tempo, e por iso
     é o eixo do arco. */
  { id: 'primernombre', imaxe: 'primernombre', voz: 'TUERCA', tramo: 'NOME',
    cando: (D) => !!(D.marcas && D.marcas.primeiroNome !== undefined) },

  /* ---------- III · A XENTE ---------- */

  /* A REVELACIÓN, e agora non é un descubrimento senón un recordo: 07K
     lembra o día en que lle deron o caderno. A imaxe son dúas mans, unha
     que entrega e outra que recibe, e na parede "A MEMORIA NON É UNHA
     ORDE, É UNHA PROMESA".

     Pide tempo E mortos propios. Saber que isto xa pasou seis veces
     antes non significa nada ata que perdiches a alguén. */
  { id: 'entrega', imaxe: 'entregadediariodetuerca', voz: 'TUERCA', tramo: 'XENTE',
    cando: (D) => (D.opCount || 0) >= 15 && (D.fallen || []).length >= 3 },

  /* A primeira vez en todo o xogo que alguén está a gusto. */
  { id: 'descanso', imaxe: 'robotsdescansando', voz: 'TUERCA', tramo: 'XENTE',
    cando: (D) => (D.opCount || 0) >= 18 },

  /* ---------- EPÍLOGO ---------- */

  /* O mesmo campo de batalla anos despois, comido pola herba, con flores
     e sol, e unha pedra que pon POR LOS CAÍDOS, POR LOS QUE VOLVERÁN.
     É a última imaxe do xogo e non hai outra candidata. */
  { id: 'pradera', imaxe: 'praderadecaidos', voz: 'TUERCA', tramo: 'EPILOGO',
    cando: (D) => (D.opCount || 0) >= 25 && (D.fallen || []).length >= 5 },
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

  /* O TRAMO MANDA SOBRE A VOZ. Primeiro quédase co tramo máis temperán
     que teña algo pendente, e só despois se escolle dentro del.

     Sen isto, a alternancia de voces podía adiantar un interludio do
     final para non repetir voz: verías o epílogo —o campo comido pola
     herba— antes de que che rematase a parte escura. Alternar é un
     acabado; a orde do arco é a historia. */
  const tramo = TRAMOS.find(t => candidatos.some(it => it.tramo === t));
  const desteTramo = candidatos.filter(it => it.tramo === tramo);

  /* Dentro do tramo si: prefírese o que cambie de voz. Se todos falan
     coa mesma que o anterior, vai o primeiro igual — alternar importa,
     pero non tanto como para calar un interludio. */
  const outraVoz = desteTramo.find(it => it.voz !== est.ultimaVoz);
  return outraVoz || desteTramo[0];
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

  /* O selector de idioma só no tramo de arranque: despois xa está o do
     hangar, e telo nos quince interludios sería ruído. Ao trocar,
     repíntase o propio interludio para que se vexa o cambio no acto. */
  const idi = document.getElementById('intIdioma');
  if(idi){
    const arranque = it.tramo === 'ARRANQUE';
    idi.style.display = arranque ? 'flex' : 'none';
    if(arranque) idi.querySelectorAll('[data-lang]').forEach(b => {
      b.onclick = () => {
        try{
          if(typeof setLang === 'function') setLang(b.dataset.lang);
          else if(typeof I18N !== 'undefined'){ I18N.lang = b.dataset.lang; aplicarIdioma(); }
        }catch(e){ console.error('[idioma]', e); }
        interludioAmosar(it, remate);
      };
    });
  }

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

/* ¿Estamos no primeiro día? Sen operacións e sen ninguén no roster: o
   momento no que o xogador acaba de abrir o xogo por primeira vez. */
function interludioPrimeiroDia(){
  if(typeof DATA === 'undefined') return false;
  return (DATA.opCount || 0) === 0 && !(DATA.units || []).length;
}

/* O guión do primeiro día, que se dispara ao entrar no hangar e non ao
   volver dunha operación —porque aínda non houbo ningunha—.

   Chámase soa desde o arranque do hangar. Se non hai nada pendente do
   tramo ARRANQUE, non fai nada e non se entera ninguén. */
function interludioArranque(remate){
  if(!interludioPrimeiroDia()){ if(remate) remate(); return false; }
  return interludioQuizais(remate);
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
