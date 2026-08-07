/* ============================================================
   A CAMPAÑA — o contido.

   22-operacions.js é a MAQUINARIA (obxectivos, gatillos, inertes,
   diálogos). Isto é o que se conta. Van á parte a propósito: unha
   operación nova ten que ser escribir datos aquí e nada máis.

   OPERACIÓN 1 · «PRIMEIRO DÍA»

   O que ten que conseguir, por orde de importancia:

   1. Que o xogador non empece matando. Empeza RECUPERANDO, e o primeiro
      disparo do xogo vai contra uns cascallos. Non hai un só hostil no
      mapa: se houbese, as unidades disparan soas e xa non sería certo
      que aínda non matou a ninguén. Cero, non poucos.
   2. Que entenda quen é sen que ninguén llo explique. Ninguén lle di
      "es un administrador de campo": danlle un traballo, e o traballo
      dío todo.
   3. Que remate escribindo un nome. Ese é o primeiro clic emocional do
      xogo, e non é disparar.

   A ORDE DE SAÍDA é a peza que máis traballa, e é do dono:

     «Houbo unha explosión na fundición. Non responde ninguén.
      Mandamos a unidade máis barata, por se hai algo perigoso.»

   Aí está o sistema de valores de ÓPTIMA enteiro, dito como logística.
   E fai que o final pese o dobre: mandaches o prescindible e volveu
   sendo alguén.
   ============================================================ */

const OP1 = {
  id: 'op1', planta: 'NAVE',
  /* Sen sectores, sen bases, sen radar: iso xa o fai opIniciar. */
  obxectivo: {tipo: 'RESCATE', n: 5,
    /* Dito para esta misión: aquí non hai ENGINEER, vas cun GRUNT só, e
       o que fai falla é chegar e quedar quieto ao lado. */
    titulo: '◈ Atopar aos que non responden',
    desc: 'Achégate e non te movas. Os que teñan cascallos enriba, quítallos'},
  /* UN GRUNT E NADA MÁIS. É literalmente o que di a orde de saída. */
  escuadron: {cls: 'GRUNT', n: 1},
  /* Aquí non hai ENGINEER ningún: érguese chegando e quedando
     quieto ao lado. O ENGINEER preséntase na operación 3. */
  erguen: 'calquera',
  /* CERO GARNICIÓN. Non é un descoido. */
  garnicion: [],
  inertes: [
    /* Cinco desconectados. Os estados non son decoración: cada un pide
       unha cousa distinta ao xogador —chegar, interceptar, escavar— e
       iso é toda a variedade que precisa unha primeira misión.

       O último non está atrapado: estaba INTENTANDO liberar a outro, e
       non podía porque non ten arma. Colócase pegado a el a propósito.
       Non se explica en ningures; véselle facendo desde lonxe. */
    {cls: 'GRUNT', n: 5, onde: 'NAVE',
     estados: ['PERDIDA', 'ASUSTADA', 'ATRAPADA', 'ATRAPADA', 'AXUDANDO']},
  ],
  /* Restos vellos de camiño á saída. Non son obxectivo e non se poden
     recuperar: están para que o xogador se pregunte que pasou aquí. */
  escenario: {restos: 7, onde: 'DEPENDENCIAS'},
  entrada: [
    {voz: 'HQ', txt: 'Houbo unha explosión na fundición. Non responde ninguén.'},
    {voz: 'HQ', txt: 'Mandamos a unidade máis barata, por se hai algo perigoso.'},
  ],
  gatillos: [
    /* A primeira leción, dita cando fai falla e non antes: os cascallos
       rómpense a tiros. É o primeiro disparo do xogo. */
    {cando: 'tras:25', facer: [{radio: '▲ Hai unidades sen sinal por toda a nave.', cor: '#c8a86a'}]},
    {cando: 'rescatados:1', facer: [{radio: '▲ Sinal recuperada. Xa é dos nosos.', cor: '#7fdc7f'}]},
    /* Cando xa levas un, a que fuxía deixa de fuxir del. Dicíllelo ao
       xogador só despois de que poida pasar, non antes. */
    {cando: 'rescatados:2', facer: [{dicir: 'TUERCA', txt: 'Dos que xa erguiches non foxen. Xa non es un descoñecido se vas con alguén dos seus.'}]},
    {cando: 'rescatados:5', facer: [{dicir: 'TUERCA', txt: 'Non estabamos sós.'}]},
  ],
};

/* ============================================================
   O TALLER — despois do informe.

   O debrief de ÓPTIMA péchase, e o que queda é isto. O caderno está
   GASTADO e cheo de páxinas: iso di, sen unha soa liña de lore, que
   xa pasou moitas veces con outros antes ca ti. É a revelación do
   sétimo arquiveiro entregada na primeira misión sen revelar nada.

   E o enxeñeiro non pon o nome. O enxeñeiro faiche entender que agora
   o merece. A diferenza é toda: no primeiro caso o xogo dáche un dato,
   no segundo pídeche un acto.

   O enxeñeiro leva DESIGNACIÓN e non alias. É o que pon nomes e non ten
   un. Non se comenta nunca.
   ============================================================ */
const ENXENEIRO = {id: 'T-04', cls: 'ENGINEER'};

function dataDoXogo(){
  /* A campaña vai en 2090. A data non se inventa cada vez: sae do
     número de operación, así que o caderno avanza contigo. */
  const dia = 14 + ((DATA && DATA.opCount) || 0) * 3;
  const mes = 8 + Math.floor(dia / 30);
  return '2090.' + String(mes).padStart(2, '0') + '.' + String(dia % 30 || 1).padStart(2, '0');
}

async function escenaTaller(rec, remate){
  /* Primeiro o enxeñeiro fala. Para a imaxe: é o que hai que mirar. */
  await new Promise((r) => {
    if(typeof opDialogo !== 'function') return r();
    opDialogo([
      {voz: 'ENXENEIRO', txt: TXT('op1.engFala')},
      {voz: 'ENXENEIRO', txt: TXT('op1.engPide')},
    ], r);
  });
  /* E despois a páxina. O texto da marxe explica o que acaba de pasar
     sen dicir o que hai que facer. */
  if(typeof bautizoObrigatorio === 'function'){
    await bautizoObrigatorio(rec, {data: dataDoXogo(), texto: TXT('op1.eng')});
  }
  if(remate) remate();
}

/* ============================================================
   LANZAR
   ============================================================ */
function campanaOperacion(n){
  if(n !== 1) return null;
  return JSON.parse(JSON.stringify(OP1));
}

/* Chámase ao rematar a operación 1 con vitoria, desde o botón de volver
   ao hangar. Se non é a operación 1, non fai nada e o xogo segue igual. */
function campanaPeche(g, remate){
  if(!g || !g.operacion || g.operacion.id !== 'op1' || g.result !== 'victory'){
    if(remate) remate();
    return false;
  }
  /* A unidade que saíu contigo: a que ten que levar nome. */
  const heroe = (DATA.units || []).find(u => u.cls === 'GRUNT') || (DATA.units || [])[0];
  if(!heroe){ if(remate) remate(); return false; }
  escenaTaller(heroe, remate);
  return true;
}
