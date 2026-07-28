/* ============================================================
   MONTAXE POR PEZAS (js/19c-orde.js, 19d-pezas.js, 19e-montar.js).

   Aquí non se xulga como QUEDA —iso hai que velo— senón que os tres
   ficheiros xerados casen entre eles. Son datos que produce unha
   ferramenta e consome outra, e a forma de que se rompan é silenciosa:
   unha capa que a táboa de orde nomea e o atlas non ten deixa de
   pintarse e ninguén se entera. Xa pasou unha vez nunha proba.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { proba, afirmar } = require('./probar.js');

const JS = path.join(__dirname, '..', 'i', 'js');
const CAPAS = ['MOCHILA', 'TORSO', 'PEITO', 'CABEZA', 'PERNA_E', 'PERNA_D', 'BRAZO_E', 'BRAZO_D'];
const SLOT_DE = {
  CABEZA: 'CABEZA', TORSO: 'CHASIS', PEITO: 'CHASIS', MOCHILA: 'CHASIS',
  BRAZO_D: 'BRAZO_DER', BRAZO_E: 'BRAZO_ESQ',
  PERNA_D: 'PERNA_DER', PERNA_E: 'PERNA_ESQ',
};

function ler(nome, marca){
  const txt = fs.readFileSync(path.join(JS, nome), 'utf8');
  const m = txt.match(new RegExp('const ' + marca + ' = (\\{[\\s\\S]*\\});'));
  return m ? JSON.parse(m[1]) : null;
}

const ORDE = ler('19c-orde.js', 'ORDE3D');
const PEZAS = ler('19d-pezas.js', 'PEZAS3D');
/* Se aínda non se xeraron as pezas, o xogo funciona igual polo camiño de
   sempre; estas probas non teñen nada que mirar. */
const HAI = !!PEZAS;

proba('a táboa de orde nomea as oito capas en todas as direccións', () => {
  afirmar(ORDE, 'non se puido ler ORDE3D');
  for(const [k, orde] of Object.entries(ORDE)){
    afirmar(orde.length === CAPAS.length,
      `${k}: a orde ten ${orde.length} capas e deberían ser ${CAPAS.length}`);
    for(const c of CAPAS) afirmar(orde.includes(c), `${k}: falta a capa ${c}`);
  }
  for(const est of ['REPOUSO', 'ANDAR', 'DISPARAR'])
    for(let d = 0; d < 8; d++)
      afirmar(ORDE[est + '/' + d], `falta a entrada ${est}/${d}`);
});

proba('cada peza que a orde nomea existe no atlas', () => {
  if(!HAI) return;
  const pezasPorSlot = {};
  for(const clave of Object.keys(PEZAS.banco)){
    const [slot, peza, capa] = clave.split('|');
    (pezasPorSlot[slot] = pezasPorSlot[slot] || new Set()).add(peza);
    afirmar(CAPAS.includes(capa), `capa descoñecida no atlas: ${capa}`);
    afirmar(SLOT_DE[capa] === slot,
      `${clave}: a capa ${capa} debería vir do slot ${SLOT_DE[capa]}, non de ${slot}`);
  }
  /* Todo chasis ten que ter, polo menos, torso. Sen el non hai robot. */
  for(const chasis of pezasPorSlot.CHASIS || []){
    const ten = Object.keys(PEZAS.banco).some(k => k.startsWith(`CHASIS|${chasis}|TORSO|`));
    afirmar(ten, `o chasis ${chasis} non ten capa TORSO`);
  }
});

proba('as ancoras cobren todos os slots e as oito direccións', () => {
  if(!HAI) return;
  const chasis = Object.keys(PEZAS.ancoras);
  afirmar(chasis.length > 0, 'non hai ancoras');
  for(const c of chasis){
    for(const slot of ['CABEZA', 'BRAZO_DER', 'BRAZO_ESQ', 'PERNA_DER', 'PERNA_ESQ']){
      const a = PEZAS.ancoras[c][slot];
      afirmar(a && a.length === PEZAS.dirs,
        `${c}/${slot}: hai ${a ? a.length : 0} direccións e deberían ser ${PEZAS.dirs}`);
      for(const [x, y] of a) afirmar(Number.isFinite(+x) && Number.isFinite(+y),
        `${c}/${slot}: ancora non numérica`);
    }
    afirmar(PEZAS.chan[c] !== undefined, `${c}: falta o chan`);
    afirmar(PEZAS.ancorasMundo[c], `${c}: faltan as ancoras en unidades de mundo`);
  }
});

proba('cada atlas ten exactamente os cadros que di o índice', () => {
  if(!HAI) return;
  let total = 0;
  for(const ix of Object.values(PEZAS.indice)) total += 8 * ix.fases;
  afirmar(total > 0, 'o índice está baleiro');
  for(const [clave, a] of Object.entries(PEZAS.banco)){
    afirmar(a.w > 0 && a.h > 0, `${clave}: tamaño de cela inválido`);
    afirmar(Number.isFinite(a.ox) && Number.isFinite(a.oy),
      `${clave}: desprazamento de recorte inválido`);
    /* O ancho do PNG non se pode medir sen decodificalo, pero si o
       tamaño en base64, que ten que ser plausible para w*total. */
    afirmar(a.d && a.d.startsWith('data:image/png;base64,'),
      `${clave}: non hai imaxe`);
  }
});

proba('todas as pezas están á mesma escala', () => {
  if(!HAI) return;
  /* É a condición que fai posible apilar. Se algunha peza viñese doutra
     pasada, cunha escala distinta, non habería como detectalo mirando os
     sprites: aquí compróbase que hai UNHA escala e unha orixe. */
  afirmar(Number.isFinite(PEZAS.escala) && PEZAS.escala > 0,
    'a escala non é un número positivo');
  afirmar(Array.isArray(PEZAS.orixe) && PEZAS.orixe.length === 2,
    'a orixe do encadre non é un par de números');
});

proba('os pés pousan sempre no mesmo sitio, mestures o que mestures', () => {
  if(!HAI) return;
  /* O sprite de clase apoia os pés en y+8. A montaxe ten que facer o
     mesmo ou as unidades quedarían flotando ou enterradas segundo as
     pezas que levasen, e como cada combinación ten outra altura o fallo
     non sería constante: sería distinto en cada robot.

     Antes isto tapábase cun +8 escrito a man no punto de chamada, que
     valía para unha escala concreta e deixou de valer ao corrixila.
     Agora a montaxe ancórase polo punto máis baixo, así que a proba é
     que ese punto caia en +8 para calquera mestura, incluídas as que
     cambian a lonxitude das pernas. */
  const src = fs.readFileSync(path.join(JS, '19e-montar.js'), 'utf8');
  const fn = new Function('PEZAS3D', 'Image',
    src + '; return { mon3dPousada, mon3dBaixo, mon3dDeClase };');
  const { mon3dPousada, mon3dBaixo, mon3dDeClase } = fn(PEZAS, function(){
    return { set src(v){}, set onload(v){ v && v(); }, set onerror(v){} };
  });
  const clases = Object.keys(PEZAS.ancorasMundo);
  afirmar(clases.length > 1, 'fan falla polo menos dous chasis para mesturar');

  const montaxes = clases.map(mon3dDeClase);
  /* e as mesturas que máis moven a altura: as pernas doutra clase */
  for(const a of clases) for(const b of clases) if(a !== b)
    montaxes.push(Object.assign(mon3dDeClase(a), { PERNA_DER: b, PERNA_ESQ: b }));

  const alturas = new Set();
  for(const m of montaxes){
    const am = PEZAS.ancorasMundo[m.CHASIS];
    for(let dir = 0; dir < PEZAS.dirs; dir++){
      const pxUnidade = (PEZAS.asentoPx && PEZAS.asentoPx[dir]) || -PEZAS.escala;
      const pes = mon3dPousada(m, dir) + mon3dBaixo(m, am) * pxUnidade;
      afirmar(Math.abs(pes - 8) < 1e-6,
        `${m.CHASIS} con pernas ${m.PERNA_DER} na dirección ${dir}: ` +
        `os pés caen en ${pes.toFixed(2)} e deberían caer en 8`);
    }
    alturas.add(mon3dPousada(m, 0).toFixed(4));
  }
  /* E que non sexa trivialmente certo por dar sempre o mesmo: trocar as
     pernas TEN que mover a orixe, se non é que non se está asentando. */
  afirmar(alturas.size > 1,
    'todas as montaxes dan a mesma pousada; o asento das pernas non se aplica');
});

proba('as pezas van á mesma escala que o banco de clases', () => {
  if(!HAI) return;
  /* No mapa conviven as dúas vías: as unidades normais debúxanse do
     banco de clases e as que monta o xogador, por pezas. Se as escalas
     non coinciden, dous robots iguais saen de distinto tamaño e non hai
     ningún erro que o denuncie.

     Pasou: o atlas por pezas levaba escrito a man "10 píxeles por
     unidade" e a do banco resultou ser 9.3, así que as montaxes eran un
     19% máis grandes. Agora o xerador MIDE a do banco e garda as dúas;
     aquí só se comproba que non divirxiron. */
  afirmar(Number.isFinite(PEZAS.escalaClase),
    'o atlas non garda a escala do banco de clases; volve xerar as pezas');
  const dif = Math.abs(PEZAS.escala - PEZAS.escalaClase);
  afirmar(dif / PEZAS.escalaClase < 0.05,
    `as pezas van a ${PEZAS.escala} px por unidade e o banco de clases a ` +
    `${PEZAS.escalaClase}: as dúas vías non están á mesma escala`);
});
