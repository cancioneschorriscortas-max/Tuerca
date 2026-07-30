/* ============================================================
   TITORIAL — a primeira operación explícase soa.

   TUERCA ten sistemas fondos que ninguén pode adiviñar: que os sectores
   dan chatarra, que as unidades disparan soas, que un robot caído deixa
   pezas, que con esas pezas se reconstrúe a súa IA e que unha peza doutra
   clase lle cambia o que sabe facer. Todo iso estaba no xogo e en ningún
   sitio máis.

   NON é unha parede de texto nin unha pantalla aparte. Vai pola RADIO,
   que xa existe, xa é en ficción e xa deixa premer nunha liña para levar
   a cámara alí. O titorial é ÓPTIMA falando durante a primeira operación.

   TRES REGRAS, e as tres importan:

   1. Cada paso ten unha CONDICIÓN, non un temporizador. O que fala do
      movemento non aparece ata que hai algo seleccionado. Quen xa sabe
      xogar avanza rápido e non le case nada; quen non sabe recibe cada
      consello cando lle fai falla.
   2. Un paso por vez e con respiro entre eles. Seis liñas seguidas na
      radio non se len: pásanse.
   3. Só na operación 0 e fóra de PvP, Mundial e Crisol. Nunha partida
      contra outra persoa isto sería ruído.
   ============================================================ */

const TITORIAL = [
  { id: 'benvida',
    cando: () => true },

  { id: 'mover',
    cando: (g) => g.units.some(u => u.team === PT && u.sel && !u.dead) },

  { id: 'sectores',
    cando: (g) => g.units.some(u => u.team === PT && !u.dead &&
      (Math.abs((u.tx ?? u.x) - u.x) > 12 || Math.abs((u.ty ?? u.y) - u.y) > 12)) },

  { id: 'capturado',
    cando: (g) => (g.sectors || []).some(s => s.owner === PT) },

  { id: 'disparan',
    cando: (g) => g.units.some(u => u.team === ET && !u.dead && !u.inside &&
      g.units.some(a => a.team === PT && !a.dead &&
        Math.hypot(a.x - u.x, a.y - u.y) < (a.rng || 90))) },

  /* O paso que de verdade paga a pena: sen isto, un xogador novo ve
     morrer a alguén e non sabe que iso non é o final da súa historia. */
  { id: 'pezas',
    cando: (g) => g.units.some(u => u.team === PT && u.dead) },
];

/* Cantos ticks de respiro entre consellos. 90 son tres segundos: o que
   se tarda en ler unha liña sen présa. */
const TITORIAL_ESPERA = 90;

function titorialActivo(g){
  if(!g || g.over) return false;
  if(typeof DATA === 'undefined' || DATA.opCount !== 0) return false;
  if(g.modo === 'pvp' || g.modo === 'crisol') return false;
  if(window._mundialArranque || window._pvpArranque) return false;
  return true;
}

function tickTitorial(g){
  if(!titorialActivo(g)) return;
  const t = g._tit || (g._tit = { paso: 0, ata: 0 });
  if(t.paso >= TITORIAL.length) return;
  if(g.t < t.ata) return;

  const p = TITORIAL[t.paso];
  let listo = false;
  try{ listo = !!p.cando(g); }catch(e){ listo = false; }
  if(!listo) return;

  t.paso++;
  t.ata = g.t + TITORIAL_ESPERA;
  if(typeof radio === 'function') radio('ÓPTIMA: ' + TXT('tit.' + p.id), '#e8c060');
}
