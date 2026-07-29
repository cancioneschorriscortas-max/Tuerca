/* ============================================================
   SPRITES 3D — usar o banco renderizado en Blender no canto do
   debuxo procedural de drawRobot().

   O que había: dous fotogramas de andar e dúas direccións (espellando
   a mesma imaxe). Unha unidade que sube e outra que baixa víanse igual.
   O que hai agora: 8 direccións × 4 fases, e as poses saen dos modelos
   que xa cumpren as regras anatómicas de tools/regras.js.

   drawRobot() NON se borra. Segue aí como reserva: se o banco non
   cargou, o xogo píntase igual. E a tecla F9 alterna entre os dous en
   vivo, que é a única forma honesta de comparar — lado a lado engana.
   ============================================================ */

/* Preferencia do xogador. ?sprites=0 no URL para arrancar co vello. */
let SPR3D_ACTIVO = true;
try {
  const p = new URLSearchParams(location.search).get('sprites');
  if(p !== null) SPR3D_ACTIVO = p !== '0';
  else if(localStorage.getItem('tuerca.sprites3d') === '0') SPR3D_ACTIVO = false;
} catch(e){ /* file:// sen localStorage: queda activo */ }

const SPR3D = { listo: false, imx: {}, pendentes: 0 };

(function cargarBanco(){
  if(typeof BANCO3D === 'undefined') return;      /* build sen banco: fallback */
  for(const cls in BANCO3D.banco){
    for(const eq in BANCO3D.banco[cls]){
      const meta = BANCO3D.banco[cls][eq];
      const im = new Image();
      SPR3D.pendentes++;
      im.onload = () => { if(--SPR3D.pendentes === 0) SPR3D.listo = true; };
      im.onerror = () => { if(--SPR3D.pendentes === 0) SPR3D.listo = true; };
      im.src = meta.d;
      SPR3D.imx[cls + '|' + eq] = { im, ...meta };
    }
  }
})();

/* ---------- dirección ----------
   O modelo mira ao seu +z, e ese +z cae cara ao espectador, que na
   pantalla é cara abaixo. Invertendo o xiro:  yaw = atan2(dx, dy).

       0 abaixo (de fronte)   2 dereita   4 arriba (de costas)   6 esquerda

   Isto estivo mal e as tropas avanzaban co fusil apuntando cara atrás.
   A causa non era a fórmula: era que Blender xiraba a cámara ao revés
   de como vox3d xira o modelo, así que o mesmo índice daba direccións
   opostas segundo quen renderizase. Arranxouse no renderizador, e a
   regra L5 de tools/regras.js comproba agora os dous. */
function spr3dDir(dx, dy){
  if(!dx && !dy) return 0;
  const n = BANCO3D.dirs;
  return ((Math.round(Math.atan2(dx, dy) / (2*Math.PI/n)) % n) + n) % n;
}

/* Debuxa e devolve true. Se non pode (banco non listo, clase sen
   modelo), devolve false e quen chama píntao á vella. */
/* Canto sobe o sprite dunha clase por riba do punto onde pisa.

   Fai falla desde que cada clase ten a súa altura: os adornos que van
   ENRIBA da unidade —o nome, as medallas, a soldadura— levaban un
   desprazamento fixo de 14 píxeles, que era xusto o alto do robot cando
   todos medían o mesmo. Cun HEAVY de 32 píxeles o nome caíalle dentro
   da cabeza. A barra de vida non sofre: vai por debaixo dos pés.

   Se non hai banco cargado devolve o de antes, que segue valendo para o
   debuxo procedural. */
function spr3dAlto(cls){
  if(typeof BANCO3D === 'undefined' || !BANCO3D.banco) return 22;
  const a = BANCO3D.banco[cls];
  const v = a && (a['0'] || a[Object.keys(a)[0]]);
  return v ? v.ch : 22;
}

function spr3dAncho(cls){
  if(typeof BANCO3D === 'undefined' || !BANCO3D.banco) return 20;
  const a = BANCO3D.banco[cls];
  const v = a && (a['0'] || a[Object.keys(a)[0]]);
  return v ? v.cw : 20;
}

function spr3dDebuxar(ctx, cls, equipo, x, y, estado, dir, fase){
  if(!SPR3D_ACTIVO || !SPR3D.listo) return false;
  const a = SPR3D.imx[cls + '|' + equipo];
  if(!a) return false;
  const ix = BANCO3D.indice[estado] || BANCO3D.indice.REPOUSO;
  if(!ix) return false;
  const i = ix.base + dir*ix.fases + (fase % ix.fases);
  /* SEN INTERPOLAR. O lenzo de batalla ten o suavizado activo (é o valor
     por defecto), e con camZoom > 1 iso converte un sprite de 22 píxeles
     nunha mancha. O debuxo procedural non o sufría porque son fillRect,
     que non pasan polo escalador de imaxes. Restáurase despois para non
     cambiarlle o comportamento a ninguén máis. */
  const _suav = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  /* Os pés apóianse en y+8, que é onde os tiña o robot procedural: así
     cambiar de sprite non move as unidades respecto do terreo nin das
     sombras, e a comparación co F9 é limpa. */
  ctx.drawImage(a.im, i*a.cw, 0, a.cw, a.ch,
                Math.round(x - a.cw/2), Math.round(y + 8 - a.ch), a.cw, a.ch);
  ctx.imageSmoothingEnabled = _suav;
  return true;
}

/* F10: usa o camiño de MONTAXE POR PEZAS en vez do sprite da clase. As
   dúas vías deberían dar o mesmo cando as pezas son todas da mesma
   clase: é a proba de que compoñer funciona, feita no xogo real e non
   nunha táboa de números. */
let MON3D_ACTIVO = false;
addEventListener('keydown', (e) => {
  if(e.key !== 'F10') return;
  MON3D_ACTIVO = !MON3D_ACTIVO;
  if(typeof toast === 'function') toast(MON3D_ACTIVO ? 'montaxe por pezas' : 'sprite de clase');
  e.preventDefault();
});

/* F9: alterna en vivo. Guárdase para que sobreviva a un recargado. */
addEventListener('keydown', (e) => {
  if(e.key !== 'F9') return;
  SPR3D_ACTIVO = !SPR3D_ACTIVO;
  try { localStorage.setItem('tuerca.sprites3d', SPR3D_ACTIVO ? '1' : '0'); } catch(err){}
  if(typeof toast === 'function') toast(SPR3D_ACTIVO ? 'sprites 3D' : 'sprites clásicos');
  e.preventDefault();
});
