/* ============================================================
   (v0.71) PANEL DE ESTADO DO HANGAR

   Non inventa nada: todo o que amosa xa o levaba calculando o
   xogo e non se vía en ningures. Contadores do escuadrón, a
   última baixa, a reensamblaxe en curso e un comunicado de
   ÓPTIMA derivado do estado real (non un texto de adorno).

   LIMITACIÓN COÑECIDA: DATA.fallen garda FRASES xa formateadas,
   non fichas estruturadas — e no idioma que estivese activo ao
   escribilas. Por iso a última baixa amósase tal cal, sen
   recompoñer. Estruturar `fallen` sería unha migración de datos
   e vai aparte.
   ============================================================ */

/* ---------- Axuda do hangar ----------
   Era un parágrafo monoespazado de catro liñas que aínda anunciaba
   "NOVO en v0.3" — cambios de hai setenta versións. E deixaba fóra
   teclas que si existen: E para saír dun vehículo, e L/K da capa de
   luz, que non estaban documentadas en ningures. */
const AXUDA_TECLAS = [
  ['ax.kArrastrar', 'ax.aSeleccionar'],
  ['ax.kClic',      'ax.aMover'],
  ['ax.kDobre',     'ax.aMesmoTipo'],
  ['1 – 8',         'ax.aProducir'],
  ['F',             'ax.aFormacion'],
  ['E',             'ax.aSair'],
  ['M',             'ax.aSon'],
  ['L',             'ax.aLuz'],
  ['K',             'ax.aHora'],
  ['ax.kRoda',      'ax.aZoom'],
];

/* Se a entrada leva punto é unha clave do dicionario; se non, é a tecla
   literal (F, M, 1-8...), que non se traduce. */
const _axTxt = (s) => (s.indexOf('.') > 0 ? TXT(s) : s);

function axudaRender(){
  const el = document.getElementById('hgHelp');
  if(!el) return;
  el.innerHTML = `
    <p class="ax-despregue">${TXT('ax.despregue')}</p>
    <div class="ax-cols">
      <section>
        <h4>${TXT('ax.controis')}</h4>
        <dl class="ax-teclas">
          ${AXUDA_TECLAS.map(([k, a]) =>
            `<div><dt>${_axTxt(k)}</dt><dd>${TXT(a)}</dd></div>`).join('')}
        </dl>
      </section>
      <section>
        <h4>${TXT('ax.obxectivo')}</h4>
        <p class="ax-obx">${TXT('ax.obxTexto')}</p>
      </section>
    </div>`;
}

function estadoContadores(){
  const u = (window.DATA && DATA.units) || [];
  return {
    activas: u.length,
    veteranos: u.filter(r => (r.ops || 0) > 0).length,
    reconstruidos: u.filter(r => r.renacido || r.reensamblado).length,
    folga: u.filter(r => r.folga && r.folga.ops > 0).length,
  };
}

/* A voz de ÓPTIMA, pero dicindo algo certo: sae dos contadores. */
function estadoOptima(c){
  if(!c.activas) return TXT('est.optSenRoster');
  if(c.folga) return TXT('est.optFolga', {n: c.folga});
  if(c.reconstruidos) return TXT('est.optRecon', {n: c.reconstruidos});
  return TXT('est.optNominal');
}

function _estFila(etiqueta, valor, clase){
  return `<div class="est-fila"><span>${etiqueta}</span>` +
         `<b class="${clase || ''}">${valor}</b></div>`;
}

function estadoRender(){
  const cont = document.getElementById('estadoPanel');
  if(!cont || !window.DATA) return;
  const c = estadoContadores();

  /* Última baixa: a máis recente da lista, tal e como se escribiu. */
  const baixas = DATA.fallen || [];
  const ultima = baixas.length ? baixas[baixas.length - 1] : null;

  /* Reensamblaxe: entrégase cando pasa unha operación máis. */
  const R = DATA.reconstruccion;
  const ops = (window.DATA && DATA.opCount) || 0;
  const enCurso = R && R.rec && ops <= R.encargadaOp;

  cont.innerHTML = `
    <section class="est-bloque">
      <h3>${TXT('est.titulo')}</h3>
      ${_estFila(TXT('est.activas'), c.activas)}
      ${_estFila(TXT('est.veteranos'), c.veteranos)}
      ${_estFila(TXT('est.reconstruidos'), c.reconstruidos, c.reconstruidos ? 'v-bronce' : '')}
      ${_estFila(TXT('est.folga'), c.folga, c.folga ? 'v-alerta' : '')}
    </section>

    <section class="est-bloque">
      <h3 class="h-baixa">${TXT('est.ultimaBaixa')}</h3>
      ${ultima
        ? `<p class="est-baixa">${ultima}</p>`
        : `<p class="est-baleiro">${TXT('est.senBaixas')}</p>`}
    </section>

    <section class="est-bloque">
      <h3>${TXT('est.reensamblaxe')}</h3>
      ${enCurso
        ? `<div class="est-recon">
             <!-- 100x120 é o tamaño para o que está feito drawPortrait (o
                  mesmo que usa o arquivo). A 52x62 debuxaba fóra do lenzo
                  e saía en negro. Redúcese por CSS. -->
             <div class="portrait-frame"><canvas id="estReconRetrato" width="100" height="120"></canvas></div>
             <div>
               <b>${R.rec.name}</b>
               <span class="est-sub">${R.rec.cls}</span>
               <span class="est-sub">${TXT('est.listoTras')}</span>
             </div>
           </div>`
        : `<p class="est-baleiro">${TXT('est.senReensamblaxe')}</p>`}
    </section>

    <section class="est-bloque est-optima">
      <h3>${TXT('est.comunicado')}</h3>
      <p>${estadoOptima(c)}</p>
      <span class="est-firma">${TXT('br.optima')}</span>
    </section>
  `;

  /* O retrato usa o mesmo debuxante que o resto do xogo. */
  if(enCurso){
    const cv2 = document.getElementById('estReconRetrato');
    if(cv2 && typeof drawPortrait === 'function'){
      try{
        /* R.rec xa é unha ficha completa: pasala enteira en vez de
           recompoñer un obxecto mínimo ao que lle faltan campos. */
        drawPortrait(cv2, Object.assign({}, R.rec, {hp: 1, max: 1, team: PT}));
      }catch(e){ console.error('[estado retrato]', e); }
    }
  }
}
