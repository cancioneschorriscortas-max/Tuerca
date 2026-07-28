/* ============================================================
   MONTAR UN ROBOT POR PEZAS.

   Un robot que fai o xogador é unha combinación de pezas, e as
   combinacións non se poden precociñar: con cinco pezas en seis slots
   son 15.625. O que se precociña son as PEZAS, e aquí apílanse.

   Tres datos xerados, cada un porque se mediu que facía falla:

     19d-pezas.js   un sprite por peza e capa, todos á MESMA escala e
                    no mesmo encadre. Se cada un viñese recortado polo
                    seu contorno, non se poderían apilar.
     19c-orde.js    en que orde van as capas, por estado e dirección.
                    Non é fixa: de fronte a mochila vai debaixo de todo
                    e o brazo dereito enriba; de costas, ao revés. É o
                    mesmo que gardan os ficheiros COF de Diablo II.
     ancoras        onde monta cada slot no chasis, xa proxectado a
                    píxeles por dirección. Nunha proxección ortográfica
                    trasladar en 3D é trasladar en 2D, así que abonda
                    con sumar.

   O que NON se fai aquí é decidir a orde: iso xa está resolto fóra.
   Calculala en vivo pediría a profundidade de cada píxel, que é
   precisamente o que se quixo evitar.
   ============================================================ */

const MON3D = { listo: false, imx: {}, pendentes: 0 };

(function cargarPezas(){
  if(typeof PEZAS3D === 'undefined') return;
  for(const clave in PEZAS3D.banco){
    const meta = PEZAS3D.banco[clave];
    const im = new Image();
    MON3D.pendentes++;
    im.onload = im.onerror = () => { if(--MON3D.pendentes === 0) MON3D.listo = true; };
    im.src = meta.d;
    MON3D.imx[clave] = { im, ...meta };
  }
  if(MON3D.pendentes === 0) MON3D.listo = true;
})();

/* Que slot achega cada capa. É a volta de SLOT_CAPAS de tools/pezas.js,
   escrita aquí para non ter que enviar aquel ficheiro. */
const MON3D_SLOT_DE = {
  CABEZA: 'CABEZA', TORSO: 'CHASIS', PEITO: 'CHASIS', MOCHILA: 'CHASIS',
  BRAZO_D: 'BRAZO_DER', BRAZO_E: 'BRAZO_ESQ',
  PERNA_D: 'PERNA_DER', PERNA_E: 'PERNA_ESQ',
};

/* Cantas unidades de mundo hai que subir a montaxe para que pise onde
   pisa o seu chasis. A altura total é variable —pernas longas, pernas
   curtas— así que sen isto cada robot quedaría a distinta altura. */
function mon3dAsento(m){
  const P = PEZAS3D;
  const am = P.ancorasMundo[m.CHASIS];
  if(!am) return 0;
  let baixo = Infinity;
  for(const slot of ['CABEZA', 'CHASIS', 'BRAZO_DER', 'BRAZO_ESQ', 'PERNA_DER', 'PERNA_ESQ']){
    const b = P.baixo[slot + '|' + m[slot]];
    if(b === undefined) continue;
    const anc = am[slot];
    baixo = Math.min(baixo, (anc ? anc[1] : 0) + b);
  }
  if(!isFinite(baixo)) return 0;
  return (P.chan[m.CHASIS] || 0) - baixo;
}

/* Debuxa a montaxe. Devolve true se puido. */
function mon3dDebuxar(ctx, m, equipo, x, y, estado, dir, fase){
  if(!MON3D.listo || typeof PEZAS3D === 'undefined' || typeof ORDE3D === 'undefined') return false;
  const P = PEZAS3D;
  const ix = P.indice[estado] || P.indice.REPOUSO;
  if(!ix) return false;
  const cadro = ix.base + dir*ix.fases + (fase % ix.fases);
  const orde = ORDE3D[estado + '/' + dir] || ORDE3D['REPOUSO/' + dir];
  if(!orde) return false;

  /* O asento é un desprazamento no MUNDO, e cun pitch subir unha unidade
     non move un píxel senón cos(pitch). O factor xa vén proxectado por
     dirección desde o xerador: aquí só se multiplica. */
  const asento = mon3dAsento(m) * ((P.asentoPx && P.asentoPx[dir]) || -P.escala);
  const suav = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  let algo = false;
  for(const capa of orde){
    const slot = MON3D_SLOT_DE[capa];
    const peza = m[slot];
    if(!peza) continue;
    /* A cor de equipo: unha peza sen pezas de bando (unha cabeza de
       metal e visor) só ten a variante 0, así que se cae nela. */
    const a = MON3D.imx[`${slot}|${peza}|${capa}|${equipo}`]
           || MON3D.imx[`${slot}|${peza}|${capa}|0`];
    if(!a) continue;
    const anc = (P.ancoras[m.CHASIS] || {})[slot];
    const dxy = anc ? anc[dir] : [0, 0];
    /* orixe do encadre + ancora + recorte do atlas + asento */
    const px = x + dxy[0] + a.ox - P.orixe[0];
    const py = y + dxy[1] + a.oy - P.orixe[1] + asento;
    ctx.drawImage(a.im, cadro*a.w, 0, a.w, a.h, Math.round(px), Math.round(py), a.w, a.h);
    algo = true;
  }
  ctx.imageSmoothingEnabled = suav;
  return algo;
}

/* Unha montaxe a partir dunha clase: todas as pezas da mesma. Serve para
   probar o camiño completo sen tocar a progresión do xogo. */
function mon3dDeClase(cls){
  return { CABEZA: cls, CHASIS: cls, NUCLEO: cls, BRAZO_DER: cls,
           BRAZO_ESQ: cls, PERNA_DER: cls, PERNA_ESQ: cls };
}
