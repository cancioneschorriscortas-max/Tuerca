/* ============================================================
   (v0.83) EFECTOS DE LECTURA — o que pasa e non se ve.

   Tres cousas que o xogo xa fai e non conta:
     · o enxeñeiro reparando (soldadura + marca no paciente)
     · o sniper abatendo lonxe, moitas veces fóra de cámara
     · o bombardeiro rebentando algo (faltáballe a ONDA)

   Non son sprites: son capa de FX. Iso significa que non
   multiplican follas por oito direccións, non dependen do
   pipeline 3D, e —o mellor— a capa de luz da v0.66 le os focos
   que se declaran aquí, así que unha soldadura ACENDE o chan
   sen escribir nada máis.

   Todo axustable en vivo desde a consola: EFX é global.
   ============================================================ */

const EFX = {
  cura: true,        /* soldadura + cruz no que se repara */
  sniper: true,      /* marca de abate a distancia */
  onda: true,        /* anel de choque das explosións */
  desmontaxe: true,  /* un robot que morre sáltase en pezas */
  curaCor: '#7fdc7f',    /* verde de curación; a cruz le ao instante */
  curaFrames: 20,        /* canto dura a marca tras o último tick de reparación */
};

/* Listas propias. Non se mesturan co _fx de partículas: estes teñen
   xeometría e duración distintas, e algúns queren dar luz. */
let _efxOndas = [];      /* {x,y,r,rMax,vida,max,big} */
let _efxMarcas = [];     /* {x,y,vida,max,tipo} */
let _efxPezas = [];      /* pezas voando; ver efxDesmontar */

/* ---------- Emisores (chámaos o motor) ---------- */

/* Soldadura no punto de contacto entre enxeñeiro e paciente. */
function efxCura(ux, uy, vx, vy){
  if(!EFX.cura) return;
  /* No medio dos dous: aí é onde está o arco. */
  const x = (ux + vx) / 2, y = (uy + vy) / 2;
  /* Reutilízase o sistema de chispas que xa existe; ademais, a capa de
     luz xa as le como focos, así que a soldadura ilumina soa. */
  if(typeof fxSparks === 'function' && Math.random() < 0.5) fxSparks(x, y, 0);
}

/* Marca de abate do sniper, no punto onde caeu o obxectivo. */
function efxSniper(x, y){
  if(!EFX.sniper) return;
  _efxMarcas.push({x, y, vida: 1.5, max: 1.5, tipo: 'sniper'});
  if(_efxMarcas.length > 24) _efxMarcas.shift();
}

/* Onda de choque dunha explosión. */
function efxOnda(x, y, big){
  if(!EFX.onda) return;
  _efxOndas.push({x, y, r: big ? 6 : 4, rMax: big ? 78 : 46,
                  vida: big ? 0.55 : 0.4, max: big ? 0.55 : 0.4, big: !!big});
  if(_efxOndas.length > 12) _efxOndas.shift();
}


/* ============================================================
   MORTE POR DESMONTAXE — un robot que cae sáltase en pezas.

   Ata agora unha unidade morta desaparecía. Agora as súas seis pezas
   sepáranse desde onde estaban montadas, voan, xiran, caen e apáganse.

   NON SE DEBUXA NADA NOVO. Os sprites xa existen: 19d-pezas.js ten un
   por (slot, peza, capa, bando), renderizados desde os mesmos modelos e
   coa mesma luz có robot enteiro. Eran 403 KB que só se usaban no banco
   de montaxe do taller. O activo máis caro do proxecto estaba parado.

   ISTO É CAPA DE FX, NON SIMULACIÓN. As pezas non chocan, non bloquean,
   non se seleccionan, non tocan a navegación e non entran en g.units nin
   en g.remains. Viven nesta lista e non saen dela.

   E POR ISO VAN CON Math.random() E NON CON rnd(). Parece ao revés do
   que se esperaría, pero é a convención do proxecto: o fluxo sementado é
   da simulación, e se o render tirase del o resultado dependería de
   cantos frames se debuxaron. Como isto é puramente visual, vai co azar
   solto e o determinismo non se entera.

   Cando as pezas sexan recollibles —outra fase— cambiarán de categoría e
   terán que usar rnd(). Non se mesturan as dúas cousas.
   ============================================================ */

/* Tope global de pezas vivas. Cada peza é un drawImage con rotación, que
   obriga a save/translate/rotate/restore: son os debuxos máis caros do
   cadro. 120 son vinte robots desfeitos á vez, moito máis do que pasa
   nunha batalla normal. */
const PEZAS_TOPE = 120;

/* Canto tempo queda unha peza no chan antes de esvaecer. Curto a
   mantenta: nesta fase non se poden recoller, e un campo cheo de
   chatarra permanente promete algo que non existe. */
const PEZA_QUIETA_MIN = 1.2, PEZA_QUIETA_MAX = 2.2;

/* Gravidade en píxeles por segundo ao cadrado, e canto conserva un
   rebote.

   ESTIVO EN 620 E ERA O ERRO GORDO. Coas velocidades que se lanzaban, o
   apoxeo dunha peza sae de v²/2g: o corpo dun GRUNT elevaba DOUS
   píxeles e a cabeza nove. A unidade mide vinte e dous. As pezas non
   saltaban, esvaraban, e por iso o efecto non se apreciaba — non era
   cuestión de estilo nin de duración.

   Con 230 o mesmo lanzamento arquea corenta píxeles e tarda algo máis
   dun segundo en caer. Iso xa é un salto que se ve. O rebote queda no
   0.32: máis alto e botan coma pelotas, e son chatarra. */
const PEZA_GRAV = 230, PEZA_REBOTE = 0.32;

/* Teito da velocidade vertical, e fai falla. Ao baixar a gravidade sen
   recortar os multiplicadores —que estaban calibrados para a vella—
   unha explosión mandaba as pezas a 536 píxeles de alto e catro
   segundos no aire. O mapa visible mide 540: a peza saía da pantalla, o
   xogador deixaba de vela, e volvía caer moito despois. Iso non lese
   como unha explosión, lese como un fallo de debuxo.

   235 dá un apoxeo de 120 píxeles e dous segundos: alto abondo para que
   unha bomba se distinga dun fusil, e non tanto como para perder a peza
   de vista. */
const PEZA_VZ_TOPE = 235;

/* Que capa representa cada slot. Sae de darlle a volta a MON3D_SLOT_DE
   en vez de escribila a man: se algún día se engade unha capa, isto
   segue. O chasis ten tres (torso, peito, mochila) e quédase coa
   primeira, que é a que ten masa. */
const _PEZA_CAPA = (function(){
  const m = {};
  if(typeof MON3D_SLOT_DE === 'undefined') return m;
  for(const capa in MON3D_SLOT_DE){
    const slot = MON3D_SLOT_DE[capa];
    if(!(slot in m)) m[slot] = capa;
  }
  return m;
})();

/* Canta enerxía leva cada peza ao saltar. Un robot non estoupa uniforme:
   a cabeza sae disparada, o chasis case non se move e as pernas caen
   onde estaban. Iso é o que fai que se lea como un corpo desfacéndose e
   non como un puñado de cousas saíndo dun punto. */
const _PEZA_FORZA = {
  CABEZA:    { imp: 1.35, alto: 1.6, xiro: 9 },
  CHASIS:    { imp: 0.55, alto: 1.0, xiro: 3 },
  BRAZO_DER: { imp: 1.15, alto: 1.1, xiro: 7 },
  BRAZO_ESQ: { imp: 1.15, alto: 1.1, xiro: 7 },
  PERNA_DER: { imp: 0.60, alto: 0.7, xiro: 4 },
  PERNA_ESQ: { imp: 0.60, alto: 0.7, xiro: 4 },
};

/* ============================================================
   COMO DESFAI CADA ARMA.

   O primeiro intento facía saltar todas as mortes igual, cunha
   asimetría fixa por peza. Funcionaba, pero mentía: un tiro de
   francotirador e un obús do tanque deixaban o mesmo estropicio.

   Agora o QUE TE MATOU decide COMO quedas, e iso convérteo de adorno en
   información: ves de lonxe se ao teu HEAVY llo levou un francotirador
   ou se lle caeu unha bomba enriba, sen ler nada.

   A causa sae de foe.deathCause, un campo que xa existía desde a v0.12
   para a memoria narrativa. Non fixo falla inventar nada: o xogo xa
   sabía quen matou a quen, só que ninguén llo preguntaba ao debuxar.

   Os números son multiplicadores sobre a forza base de cada peza:
     <slot>  para ese slot en concreto
     resto   para os que non se nomean
     todo    para todos á vez
     alto    canto sobe a explosión enteira
   ============================================================ */
const _PEZA_ESTILO = {
  /* Un tiro, un sitio. Vólalle a cabeza e o corpo cae case de pé: é a
     lectura de "morreu antes de saber que o vían". */
  SNIPER:     { CABEZA: 3.4, xiroCabeza: 4, resto: 0.14, alto: 0.9 },

  /* Explosivos: todo cara a todas partes e cara arriba. */
  BOMBARDERO: { todo: 1.9, alto: 1.9, cara: 2 },
  TANQUE:     { todo: 2.2, alto: 1.6, cara: 2 },

  /* Ametralladora pesada. Desfai o torso e os brazos; as pernas quedan
     onde estaban, que é o que pasa cando alguén cae acribillado. */
  HEAVY:      { CHASIS: 2.1, BRAZO_DER: 2.0, BRAZO_ESQ: 2.0, resto: 0.45 },

  /* Fogo fixo e sostido, sen a masa dun obús. */
  torreta:    { todo: 1.3, alto: 1.0 },

  /* O enxeñeiro case non mata, e cando o fai é de preto e a golpes. */
  ENGINEER:   { todo: 0.8, alto: 0.7 },
};
/* Fusil de infantería: o caso normal e a referencia de todos os demais.
   Non vai na táboa a propósito, para que se vexa que é o 1.0. */
const _PEZA_ESTILO_BASE = { todo: 1, alto: 1 };

function _pezaEstilo(causa){
  return (causa && _PEZA_ESTILO[causa]) || _PEZA_ESTILO_BASE;
}
/* Que multiplicador lle toca a este slot con esta arma. */
function _pezaFactor(est, slot){
  if(est[slot] !== undefined) return est[slot];
  if(est.todo !== undefined) return est.todo;
  if(est.resto !== undefined) return est.resto;
  return 1;
}

/* Orde de importancia. Se hai que soltar menos pezas por falta de sitio,
   sácanse polo final: mellor tres pezas en dez robots que seis en cinco
   e nada nos outros cinco. */
const _PEZA_ORDE = ['CABEZA', 'CHASIS', 'BRAZO_DER', 'BRAZO_ESQ', 'PERNA_DER', 'PERNA_ESQ'];

/* ============================================================
   PEZAS QUE VEÑEN CARA A TI.

   Nunha explosión, unha ou dúas pezas non arquean contra o chan: veñen
   dereitas á cámara. Medran, xiran e desaparecen ao pasar por diante.

   É un truco vello e funciona porque a escala é o sinal de
   profundidade máis forte que hai nun xogo plano. Un sprite que vai de
   1x a 4x en medio segundo lese como "iso pasoume rozando" sen que
   faga falla ningunha proxección. En arco contra o chan a mesma peza
   despraza vinte píxeles e pérdese entre o terreo.

   SÓ NAS EXPLOSIÓNS. Se o fixese cada morte, o campo sería un carrusel
   e deixaría de significar nada: o que ten que dicir é "isto foi unha
   BOMBA". E son unha ou dúas, non seis, porque o resto ten que seguir
   caendo ao chan para que se vexa de onde saíron.

   DEBÚXANSE POR RIBA DE TODO, ao revés cás outras. Están entre a cámara
   e o mundo: unha peza que che vén á cara non pode quedar tapada por un
   robot que está detrás dela. Por iso van no pase tardío de
   efxDebuxar() e non no de antes das unidades.
   ============================================================ */
const PEZA_CARA_DUR = 0.55;    /* o que tarda en pasar de longo */
const PEZA_CARA_ESC = 4.2;     /* canto medra antes de desaparecer */

function efxDesmontar(u, causa){
  if(!EFX.desmontaxe || !u) return;
  if(typeof MON3D === 'undefined' || !MON3D.listo) return;
  if(typeof PEZAS3D === 'undefined' || typeof mon3dDeClase !== 'function') return;

  /* Quen o matou. Pásase ao chamar; se non, tírase do campo que xa
     garda o xogo para a memoria narrativa. */
  const est = _pezaEstilo(causa || u.deathCause);
  const m = mon3dDeClase(u.cls);
  /* A dirección non é un campo da unidade: calcúlase ao debuxar e
     gárdase en u._dir3d. Se a unidade morreu sen chegar a debuxarse
     nunca —pasa se cae no mesmo frame en que aparece— non existe, e
     entón vale 0, que é de fronte. */
  const dir = ((u._dir3d | 0) % (PEZAS3D.dirs || 8) + 8) % 8;
  const ix = PEZAS3D.indice.REPOUSO;
  const cadro = ix ? ix.base + dir * ix.fases : 0;
  const equipo = u.team;

  /* Cantas pezas caben. Nunca cero: unha morte sen efecto lese como un
     fallo do xogo, non como unha decisión. */
  const oco = PEZAS_TOPE - _efxPezas.length;
  const cantas = Math.max(2, Math.min(_PEZA_ORDE.length, oco));

  for(let i = 0; i < cantas; i++){
    const slot = _PEZA_ORDE[i];
    const capa = _PEZA_CAPA[slot];
    if(!capa) continue;
    const a = MON3D.imx[`${slot}|${m[slot]}|${capa}|${equipo}`]
           || MON3D.imx[`${slot}|${m[slot]}|${capa}|0`];
    if(!a || !a.im) continue;

    /* Onde estaba montada. As áncoras xa veñen proxectadas a píxeles e
       por dirección, así que abonda con sumar: nunha proxección
       ortográfica, trasladar en 3D é trasladar en 2D. */
    const anc = (PEZAS3D.ancoras[m.CHASIS] || {})[slot];
    const dxy = anc ? anc[dir] : [0, 0];
    const f = _PEZA_FORZA[slot] || _PEZA_FORZA.CHASIS;

    /* Radial desde o centro do corpo, para que cada peza saia cara a
       onde xa apuntaba. Se cae xusto no centro, dáselle unha dirección
       calquera para que non quede quieta no aire. */
    let rx = dxy[0], ry = dxy[1] - 6;
    const d = Math.hypot(rx, ry) || 1;
    if(d < 0.5){ const t = Math.random() * 6.283; rx = Math.cos(t); ry = Math.sin(t); }
    const mult = _pezaFactor(est, slot);
    const disp = 0.6 + Math.random() * 0.8;
    const vel = 46 * f.imp * mult * disp;

    _efxPezas.push({
      im: a.im, sx: cadro * a.w, sw: a.w, sh: a.h,
      /* o encadre do atlas: mesma aritmética que mon3dDebuxar */
      ox: a.ox - PEZAS3D.orixe[0], oy: a.oy - PEZAS3D.orixe[1],
      x: u.x + dxy[0], y: u.y + dxy[1],
      z: 6 + Math.random() * 6,
      vx: (rx / d) * vel + (Math.random() - 0.5) * 18,
      vy: (ry / d) * vel * 0.6 + (Math.random() - 0.5) * 14,
      vz: Math.min(PEZA_VZ_TOPE,
            82 * f.alto * (est.alto || 1) * Math.min(2, mult) * (0.8 + Math.random() * 0.6)),
      ang: 0, vang: (Math.random() - 0.5) * f.xiro
             * (slot === 'CABEZA' && est.xiroCabeza ? est.xiroCabeza : 1),
      chan: u.y + dxy[1],
      quieta: 0, parada: PEZA_QUIETA_MIN + Math.random() * (PEZA_QUIETA_MAX - PEZA_QUIETA_MIN),
    });
  }
  /* As de fronte escóllense DESPOIS, entre as que xa saíron, para que
     sexan pezas de verdade deste robot e non un adorno aparte. */
  if(est.cara){
    const novas = _efxPezas.slice(-cantas);
    for(let k = 0; k < Math.min(est.cara, novas.length); k++){
      const p = novas[Math.floor(Math.random() * novas.length)];
      if(!p || p.cara) continue;
      p.cara = 0;                       /* progreso de 0 a 1 */
      p.esc = 1;
      /* Un pouco de deriva para que non medre no sitio: unha peza que
         se infla sen moverse lese como un erro de escala. */
      p.dx = (Math.random() - 0.5) * 90;
      p.dy = 30 + Math.random() * 70;   /* cara abaixo: vén ao espectador */
      p.vang = (Math.random() - 0.5) * 7;
    }
  }
  /* Se aínda así se pasou, van as máis vellas. */
  while(_efxPezas.length > PEZAS_TOPE) _efxPezas.shift();
}

/* Debúxase en coordenadas de MUNDO e por BAIXO das unidades vivas: unha
   peza voando non pode tapar un robot que che importa. Por iso non vai
   dentro de efxDebuxar(), que se chama ao final de todo. */
function efxPezasDebuxar(g, dt){
  if(!_efxPezas.length) return;
  dt = Math.min(0.05, dt || 0.016);

  for(const p of _efxPezas){
    if(p.cara !== undefined){
      /* Vén á cámara: nin gravidade nin chan. Só medra e márchase. */
      p.cara += dt / PEZA_CARA_DUR;
      p.esc = 1 + (PEZA_CARA_ESC - 1) * p.cara * p.cara;   /* acelera ao achegarse */
      p.x += p.dx * dt; p.y += p.dy * dt;
      p.ang += p.vang * dt;
      continue;
    }
    if(p.z > 0 || p.vz !== 0){
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz -= PEZA_GRAV * dt;
      p.z += p.vz * dt;
      p.ang += p.vang * dt;
      if(p.z <= 0){
        p.z = 0;
        if(Math.abs(p.vz) > 40){
          /* un rebote curto e amortecido, e para */
          p.vz = -p.vz * PEZA_REBOTE;
          p.vx *= 0.5; p.vy *= 0.5; p.vang *= 0.4;
        } else {
          p.vz = 0; p.vx = 0; p.vy = 0; p.vang = 0;
        }
      }
    } else {
      p.quieta += dt;
    }
  }
  _efxPezas = _efxPezas.filter(p => (p.cara !== undefined ? p.cara < 1 : p.quieta < p.parada));

  const suav = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  for(const p of _efxPezas){
    if(p.cara !== undefined) continue;    /* esas van no pase de arriba */
    /* O último medio segundo esvaece. Non desaparecen de golpe: un
       sprite que se apaga lese como que rematou, un que salta lese como
       un fallo de debuxo. */
    const resto = p.parada - p.quieta;
    ctx.globalAlpha = resto < 0.5 ? Math.max(0, resto / 0.5) : 1;
    ctx.save();
    ctx.translate(p.x, p.y - p.z);
    if(p.ang) ctx.rotate(p.ang);
    ctx.drawImage(p.im, p.sx, 0, p.sw, p.sh, p.ox, p.oy, p.sw, p.sh);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = suav;
}

/* As que veñen de fronte, por riba de todo. Chámase desde efxDebuxar(),
   que é o último pase do mundo. */
function efxPezasCara(){
  if(!_efxPezas.length) return;
  const suav = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  for(const p of _efxPezas){
    if(p.cara === undefined) continue;
    /* Esváese no último terzo: unha peza que desaparece de golpe a
       catro aumentos lese como un fallo de debuxo. */
    ctx.globalAlpha = p.cara > 0.66 ? Math.max(0, (1 - p.cara) / 0.34) : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    ctx.scale(p.esc, p.esc);
    ctx.drawImage(p.im, p.sx, 0, p.sw, p.sh, p.ox, p.oy, p.sw, p.sh);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = suav;
}

/* ---------- Focos para a capa de luz ----------
   Devolve fontes en coordenadas de MUNDO, coma luzFontes(). O destello
   dunha explosión é o efecto máis barato e máis satisfactorio que hai:
   ilumina o mapa enteiro durante tres frames. */
function efxFocos(){
  const F = [];
  for(const o of _efxOndas){
    const t = o.vida / o.max;
    if(t < 0.55) continue;                 /* só o comezo: é un destello */
    F.push({x: o.x, y: o.y, r: o.big ? 150 : 90, c: '#ffcf7a',
            a: (t - 0.55) / 0.45 * (o.big ? 0.95 : 0.6)});
  }
  return F;
}

/* ---------- Debuxo (mundo) ----------
   Chámase ao final de draw(), por riba de todo. */
function efxDebuxar(g, dt){
  dt = Math.min(0.05, dt || 0.016);

  /* Pezas que veñen á cámara: primeiro de todo o pase tardío, para que
     queden por riba do mundo pero por baixo das ondas e das marcas, que
     son lectura pura. */
  try{ efxPezasCara(); }catch(e){ console.error('[pezas cara]', e); }

  /* --- Ondas de choque --- */
  for(const o of _efxOndas){
    o.vida -= dt;
    const t = 1 - o.vida / o.max;              /* 0 -> 1 */
    o.r = 4 + (o.rMax - 4) * (1 - (1 - t) * (1 - t));   /* rápido e frea */
  }
  _efxOndas = _efxOndas.filter(o => o.vida > 0);
  for(const o of _efxOndas){
    const a = Math.max(0, o.vida / o.max);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,200,130,${a * 0.7})`;
    ctx.lineWidth = o.big ? 2.5 * a + 0.5 : 1.5 * a + 0.5;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.stroke();
    ctx.restore();
  }

  /* --- Marcas de sniper --- */
  for(const m of _efxMarcas) m.vida -= dt;
  _efxMarcas = _efxMarcas.filter(m => m.vida > 0);
  for(const m of _efxMarcas){
    const t = 1 - m.vida / m.max;
    const a = Math.min(1, m.vida / m.max * 2);
    /* O círculo DEBÚXASE, non aparece: dous arcos pechando. Léese como
       unha mira que se fixa, non como un adorno que parpadea. */
    const r = 13 - 5 * Math.min(1, t * 3);
    const ang = Math.min(1, t * 3) * Math.PI;
    ctx.save();
    ctx.strokeStyle = `rgba(255,240,200,${a})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(m.x, m.y, r, -Math.PI/2, -Math.PI/2 + ang); ctx.stroke();
    ctx.beginPath(); ctx.arc(m.x, m.y, r, Math.PI/2, Math.PI/2 + ang); ctx.stroke();
    if(t > 0.28){
      const c = Math.min(1, (t - 0.28) * 4) * r * 0.75;
      ctx.beginPath();
      ctx.moveTo(m.x - c, m.y); ctx.lineTo(m.x + c, m.y);
      ctx.moveTo(m.x, m.y - c); ctx.lineTo(m.x, m.y + c);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* --- Quen está a ser reparado ---
     A marca vai no PACIENTE, non no enxeñeiro: o dato que importa é
     "esta unidade estase a recuperar", non "aquel está a traballar". */
  if(EFX.cura && g.units){
    for(const v of g.units){
      if(v.dead || v.inside) continue;
      if(!v._curandoT || g.t - v._curandoT > EFX.curaFrames) continue;
      const pulso = 0.55 + 0.45 * Math.sin(g.t * 0.25);
      ctx.save();
      ctx.globalAlpha = pulso;
      ctx.fillStyle = EFX.curaCor;
      /* Cruz pequena por riba da cabeza. Tres píxeles de groso: a esta
         escala menos non se ve e máis tapa a unidade. */
      const cx = Math.round(v.x), cy = Math.round(v.y) - 17;
      ctx.fillRect(cx - 1, cy - 3, 3, 7);
      ctx.fillRect(cx - 3, cy - 1, 7, 3);
      ctx.restore();
    }
  }
}

/* ---------- Debuxo (pantalla) ----------
   Chámase DESPOIS de restaurar a cámara. Se un abate cae fóra da vista,
   unha frecha no bordo di cara a onde. Sen isto o efecto pérdese
   precisamente cando máis falta fai. */
function efxHUD(g){
  if(!EFX.sniper || !_efxMarcas.length) return;
  const z = (typeof camZoom === 'number' ? camZoom : 1);
  const cx0 = (typeof cam === 'object' && cam) ? cam.x : 0;
  const cy0 = (typeof cam === 'object' && cam) ? cam.y : 0;
  const W2 = cv.width, H2 = cv.height, M = 18;
  for(const m of _efxMarcas){
    const sx = (m.x - cx0) * z, sy = (m.y - cy0) * z;
    if(sx >= 0 && sx <= W2 && sy >= 0 && sy <= H2) continue;   /* xa se ve */
    const a = Math.max(0, Math.min(1, m.vida / m.max));
    const px = Math.max(M, Math.min(W2 - M, sx));
    const py = Math.max(M, Math.min(H2 - M, sy));
    const ang = Math.atan2(sy - H2/2, sx - W2/2);
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = `rgba(255,240,200,${a})`;
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/* Ao cambiar de batalla non se arrastran efectos da anterior. */
function efxLimpar(){ _efxOndas = []; _efxMarcas = []; }

/* ============================================================
   A PORTADA VIVA (v0.84)

   O fondo do menú é unha nave de montaxe onde xa hai xente soldando: a
   arte ten dous puntos de solda pintados, un no mech da esquerda e outro
   no operario da dereita. Isto non inventa nada novo — pon chispas
   ENCIMA deses dous puntos, que é o que fai que a imaxe deixe de
   parecer un cadro.

   O TRUCO QUE IMPORTA é como se atopan eses puntos. O fondo vai con
   `center/cover`, así que segundo a fiestra recórtase por arriba ou
   polos lados. Se as chispas fosen a unha posición fixa da pantalla,
   despegaríanse do soldador en canto alguén cambiase o tamaño. Gárdanse
   como FRACCIÓNS DA IMAXE e refaise a conta do `cover` en cada redimensión.

   Só corre na portada (body.no-hangar) e párase en canto se sae: unha
   animación que segue debuxando detrás dunha batalla é traballo tirado.
   ============================================================ */
const PORTADA = {
  /* Onde solda cada quen, en fraccións da imaxe de fondo. Sacadas
     mirando a propia imaxe, non a ollo sobre a pantalla. */
  puntos: [
    /* Os dous soldadores que a arte xa ten pintados. Con moita
       resolución vense; cunha fiestra normal quedan detrás do roster. */
    { x: 0.253, y: 0.680, forza: 1.0 },
    { x: 0.816, y: 0.760, forza: 0.8 },
    /* E dous nas MARXES, que é a parte do fondo que se ve sempre: o
       roster ocupa o centro. Sen estes, o efecto está pero non se ve, que
       é o mesmo que non estar. Tamén caen sobre maquinaria da imaxe. */
    { x: 0.055, y: 0.620, forza: 0.7 },
    { x: 0.945, y: 0.545, forza: 0.6 },
  ],
  chispas: [], cv: null, ctx: null, im: null, t: 0, ultimo: 0, corre: false,
};

function _portadaCaixa(){
  /* A mesma conta que fai `background-size: cover`. */
  const P = PORTADA, W = P.cv.width, H = P.cv.height;
  const iw = (P.im && P.im.naturalWidth) || 1672;
  const ih = (P.im && P.im.naturalHeight) || 941;
  const k = Math.max(W/iw, H/ih);
  return { x: (W - iw*k)/2, y: (H - ih*k)/2, w: iw*k, h: ih*k };
}

function _portadaChispa(p, caixa){
  const P = PORTADA;
  const x = caixa.x + p.x*caixa.w, y = caixa.y + p.y*caixa.h;
  /* As chispas de solda saen cara arriba e cara os lados e caen. Un cono
     estreito parecería unha fonte; o que se busca é metralla. */
  const ang = -Math.PI/2 + (Math.random() - 0.5) * 2.4;
  const v = 60 + Math.random()*190;
  P.chispas.push({
    x, y, px: x, py: y, vx: Math.cos(ang)*v, vy: Math.sin(ang)*v,
    vida: 0.35 + Math.random()*0.75, idade: 0,
    quente: Math.random() < 0.3,
  });
}

function efxPortadaPaso(ms){
  const P = PORTADA;
  if(!P.cv) return;
  const dt = Math.min(0.05, (ms - P.ultimo)/1000 || 0);
  P.ultimo = ms; P.t += dt;

  const cv = P.cv, ctx = P.ctx;
  if(cv.width !== cv.clientWidth || cv.height !== cv.clientHeight){
    cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  }
  const caixa = _portadaCaixa();
  ctx.clearRect(0, 0, cv.width, cv.height);

  /* Emisión a rachas: soldar non é un chorro continuo, son tiradas
     curtas con pausas. Sen as pausas parece unha fervenza. */
  for(const p of P.puntos){
    const fase = (P.t * 0.55 + p.x*7) % 1;
    const soldando = fase < 0.42;
    /* O son vai ao EMPEZAR a racha, non por chispa: soaría un rebumbio.
       O ambiente do hangar xa leva os golpes de metal; isto só engade a
       faísca eléctrica por riba. */
    if(soldando && !p._soaba && typeof sfx === 'function'){
      try{ sfx('solda'); }catch(e){}
    }
    p._soaba = soldando;
    /* Dúas ou tres por fotograma mentres solda. Con menos, nun instante
       calquera case non hai ningunha na pantalla e o efecto non se le. */
    if(soldando) for(let k = 0; k < 3; k++)
      if(Math.random() < p.forza * 0.8) _portadaChispa(p, caixa);
    if(soldando){
      /* fulgor da solda: o que de verdade vende que hai alguén traballando */
      const r = (10 + Math.random()*7) * p.forza;
      const g = ctx.createRadialGradient(
        caixa.x + p.x*caixa.w, caixa.y + p.y*caixa.h, 0,
        caixa.x + p.x*caixa.w, caixa.y + p.y*caixa.h, r*3);
      g.addColorStop(0, 'rgba(255,214,150,0.50)');
      g.addColorStop(0.4, 'rgba(255,150,60,0.16)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(caixa.x + p.x*caixa.w - r*3, caixa.y + p.y*caixa.h - r*3, r*6, r*6);
    }
  }

  for(let i = P.chispas.length - 1; i >= 0; i--){
    const c = P.chispas[i];
    c.idade += dt;
    if(c.idade >= c.vida){ P.chispas.splice(i, 1); continue; }
    c.px = c.x; c.py = c.y;
    c.vy += 420*dt;                 /* gravidade */
    c.vx *= (1 - 1.2*dt);           /* rozamento: as chispas frean axiña */
    c.x += c.vx*dt; c.y += c.vy*dt;
    const k = 1 - c.idade/c.vida;
    /* RISCO e non punto. Un píxel solto pérdese contra un fondo tan
       cargado como este; unha chispa real deixa rastro, e é o rastro o
       que a fai lexible. De branco a laranxa segundo arrefría. */
    ctx.strokeStyle = c.quente
      ? `rgba(255,${200 + 40*k|0},${150*k|0},${k})`
      : `rgba(255,${130 + 90*k|0},${50*k|0},${k*0.9})`;
    ctx.lineWidth = c.quente ? 1.6 : 1;
    /* O risco debúxase máis longo do que se moveu neste fotograma: a
       distancia dun cadro son dous píxeles e non se ve nada. Extrapólase
       cara atrás pola velocidade, que é o que dá a sensación de traza. */
    ctx.beginPath();
    ctx.moveTo(c.x - c.vx*0.045, c.y - c.vy*0.045);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }

  if(P.corre) requestAnimationFrame(efxPortadaPaso);
}

/* Acende ou apaga segundo se estea na portada. Chámase desde o mesmo
   observador de 99-boot.js que xa sabe cando se ve o hangar. */
function efxPortada(activa){
  const P = PORTADA;
  if(activa && !P.corre){
    P.cv = document.getElementById('portadaFx');
    if(!P.cv) return;
    P.ctx = P.cv.getContext('2d');
    if(!P.im){
      P.im = new Image();
      P.im.src = 'ui/fondo_menu.jpg';   /* só para saber o seu tamaño real */
    }
    P.corre = true; P.ultimo = performance.now();
    requestAnimationFrame(efxPortadaPaso);
  } else if(!activa && P.corre){
    P.corre = false; P.chispas.length = 0;
    if(P.ctx) P.ctx.clearRect(0, 0, P.cv.width, P.cv.height);
  }
}

/* ============================================================
   (v1.05) DANOS — o estado dunha unidade, na propia unidade.

   POR QUE UNHA CAPA E NON MÁIS SPRITES. O banco son 3 cores × 5 estados
   × 8 direccións × 4 fases por clase; meterlle dous niveis de dano
   triplicaríao, e habería que renderizar todo outra vez cada vez que se
   toque unha pose. Isto debúxase por riba do sprite que xa hai, así que
   vale para as cinco clases, os cinco estados e as oito direccións sen
   renderizar un só cadro máis — e funciona igual co debuxo procedural
   de reserva.

   POR QUE FAI FALLA. A vida dunha unidade só se ve na barriña de
   debaixo, que mide dezaseis píxeles e está a carón doutras dez iguais.
   Nunha refrega non hai tempo de lelas. Un robot que fuma vese sen
   ler nada, que é o que ten que pasar cando alguén está a piques de
   caer.

   DETERMINISTA. As marcas de queimadura saen do id da unidade, non do
   azar: se cambiasen cada fotograma serían un fervedoiro. O que si se
   move é o fume e as faíscas, que é o que ten que moverse.

     > 0.55 de vida    nada
     0.55 a 0.30       tisnadura e algunha faísca
     < 0.30            fume constante, máis tisnadura, faíscas a miúdo
   ============================================================ */
const DANO = { activo: true, limiarLeve: 0.55, limiarGrave: 0.30 };

function debuxarDano(ctx, u, g){
  if(!DANO.activo || u.dead || u.inerte || u.extraido || u.inside) return;
  const pct = u.hp / u.max;
  if(pct > DANO.limiarLeve) return;
  const grave = pct < DANO.limiarGrave;
  const t = (g && g.t) || 0;

  /* Semente estable por unidade: as mesmas marcas sempre no mesmo sitio. */
  let h = 0;
  for(const c of String(u.id || 'x')) h = ((h << 5) - h + c.charCodeAt(0)) >>> 0;
  const rr = (n) => { const s = Math.sin(h * 0.0001 + n * 12.9898) * 43758.5453; return s - Math.floor(s); };

  ctx.save();
  /* --- Tisnadura: manchas fixas sobre o corpo --- */
  const n = grave ? 5 : 3;
  for(let i = 0; i < n; i++){
    const dx = Math.round((rr(i) - 0.5) * 11);
    const dy = Math.round((rr(i + 20) - 0.5) * 13) - 3;
    ctx.fillStyle = i % 2 ? 'rgba(18,14,12,0.62)' : 'rgba(40,30,24,0.50)';
    ctx.fillRect(u.x + dx, u.y + dy, 2 + Math.round(rr(i + 40) * 2), 2);
  }

  /* --- Faíscas: curtas, e SÓ ás veces. Unha faísca constante lese como
         un adorno; unha que salta de cando en vez lese como avaría. --- */
  const cadencia = grave ? 11 : 27;
  if((t + (h % cadencia)) % cadencia < (grave ? 3 : 2)){
    const sx = u.x + Math.round((rr(t % 7 + 60) - 0.5) * 9);
    const sy = u.y + Math.round((rr(t % 5 + 70) - 0.5) * 9) - 2;
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(sx, sy, 2, 1);
    ctx.fillStyle = 'rgba(255,160,60,0.75)';
    ctx.fillRect(sx - 1, sy + 1, 1, 1);
    ctx.fillRect(sx + 2, sy - 1, 1, 1);
  }

  /* --- Fume: só en estado grave, e sobe. É o único que se ve de lonxe,
         e é o que fai que mires a esa unidade sen que ninguén cho diga. --- */
  if(grave){
    for(let i = 0; i < 3; i++){
      /* Cada bocanada leva o seu desfase para que non suban en bloque. */
      const fase = ((t * 0.9 + i * 26 + (h % 40)) % 78) / 78;
      const sube = fase * 15;
      const a = 0.42 * (1 - fase);
      if(a <= 0.02) continue;
      const r = 1.8 + fase * 3.4;
      const ox = Math.sin(fase * 3.1 + i) * 2.4;
      const cx2 = u.x + ox + (rr(i + 90) - 0.5) * 3, cy2 = u.y - 8 - sube;
      /* CLARO, non escuro. A primeira versión pintaba o fume en gris
         escuro (58,54,50), e nun interior —chan escuro e luz baixa— non
         se vía absolutamente nada: era gris sobre gris. Un penacho ten
         que destacar do chan, e o chan deste xogo é escuro case sempre.
         Leva un anel escuro por fóra para que tampouco desapareza nun
         mapa claro coma o deserto ou a neve. */
      ctx.fillStyle = `rgba(18,16,14,${a * 0.5})`;
      ctx.beginPath(); ctx.arc(cx2, cy2, r + 1, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(172,164,152,${a})`;
      ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}
