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

/* O punto máis baixo da montaxe, en unidades de mundo: onde pisa. Sae de
   sumar, por cada slot, onde monta no chasis e canto baixa a peza desde
   ese punto, e quedar co mínimo. */
const MON3D_SLOTS = ['CABEZA', 'CHASIS', 'BRAZO_DER', 'BRAZO_ESQ', 'PERNA_DER', 'PERNA_ESQ'];
function mon3dBaixo(m, am){
  let baixo = Infinity;
  for(const slot of MON3D_SLOTS){
    const b = PEZAS3D.baixo[slot + '|' + m[slot]];
    if(b === undefined) continue;
    const anc = am[slot];
    baixo = Math.min(baixo, (anc ? anc[1] : 0) + b);
  }
  return baixo;
}

/* Onde vai a ORIXE do modelo na pantalla para que os pés caian onde os
   pon o sprite de clase, que é en y+8: alí os tiña o robot procedural e
   así cambiar de vía non move as unidades respecto do terreo nin das
   sombras. A orixe do modelo non está nos pés senón á altura da cadeira,
   uns dez píxeles máis arriba, e ese desnivel tapábase cun +8 escrito a
   man no punto de chamada que deixou de valer ao cambiar a escala.

   Ancorando os pés, o asento sae de balde: unha montaxe con pernas máis
   longas ten o punto máis baixo máis lonxe da orixe e sobe soa. */
function mon3dPousada(m, dir){
  const am = PEZAS3D.ancorasMundo[m.CHASIS];
  const pxUnidade = (PEZAS3D.asentoPx && PEZAS3D.asentoPx[dir]) || -PEZAS3D.escala;
  const baixo = am ? mon3dBaixo(m, am) : NaN;
  return 8 - (isFinite(baixo) ? baixo : 0) * pxUnidade;
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

  /* Onde cae a orixe do modelo para que os pés pousen en y+8, igual que
     no camiño de clase. Leva dentro o asento das pernas de outra altura. */
  const pousada = mon3dPousada(m, dir);
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
    const py = y + dxy[1] + a.oy - P.orixe[1] + pousada;
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

/* A montaxe dun robot RECONSTRUÍDO. O reconstructor xa garda de que
   clase era o doador de cada peza (`deCls`), e os tipos de peza que usa
   —CABEZA, CHASIS, BRAZO_DER…— son exactamente os slots desta montaxe,
   así que non hai que traducir nada.

   Os ocos son recambio xenérico, e o recambio sae da clase do chasis:
   é o que xa di o xogo, que o chasis decide a clase. O resultado é que
   un robot reensamblado con pezas alleas VESE reensamblado —un brazo
   doutra cor, unha cabeza doutro tamaño— en vez de saír coa aparencia
   uniforme da clase, que era o que pasaba ata agora. */
function mon3dDeMontaxe(pezas, clsBase){
  const m = mon3dDeClase(clsBase);
  for(const slot of MON3D_SLOTS) if(pezas[slot]) m[slot] = pezas[slot];
  return m;
}

/* ============================================================
   VISTA PREVIA para os diálogos de montaxe.

   Nos dous diálogos que xa había —o RECONSTRUCTOR e a MONTAXE DESDE
   CERO— escóllese peza por peza nuns desplegables e non se ve o que sae.
   Sabíase o custo e a clase, non a pinta. Agora que hai un sprite por
   peza, amosalo é apilar.

   Debúxase pequeno e amplíase con drawImage sen suavizado: escalar o
   contexto antes de pintar deixaría os bordos borrosos, que é
   precisamente o que non se quere nun xogo de píxeles.
   ============================================================ */
function mon3dVista(cv, m, equipo, dirs, zoom){
  if(!cv || !MON3D.listo) return false;
  const Z = zoom || 4, D = dirs || [0, 5];
  const cel = 42;
  cv.width = cel*Z*D.length; cv.height = cel*Z;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  /* un lenzo temporal ao tamaño real do sprite, e despois amplíase */
  const t = document.createElement('canvas');
  t.width = cel; t.height = cel;
  const tc = t.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let algo = false;
  D.forEach((d, i) => {
    tc.clearRect(0, 0, cel, cel);
    if(mon3dDebuxar(tc, m, equipo, cel/2, cel - 12, 'REPOUSO', d, 0)) algo = true;
    ctx.drawImage(t, 0, 0, cel, cel, i*cel*Z, 0, cel*Z, cel*Z);
  });
  return algo;
}
