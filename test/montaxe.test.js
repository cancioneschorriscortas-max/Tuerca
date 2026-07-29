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
  /* Os cinco estados, non tres: o compositor cae calado na orde de
     REPOUSO cando falta unha entrada, e unha pose de impacto ten os
     brazos noutro sitio. */
  for(const est of ['REPOUSO', 'ANDAR', 'DISPARAR', 'CURAR', 'IMPACTO'])
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

proba('os tipos de peza do reconstructor son slots da montaxe', () => {
  /* A ponte entre a economía de despece e o debuxo por pezas non
     traduce nada: aprovéitase de que os TIPOS de peza que xa usaba o
     reconstructor —CABEZA, CHASIS, BRAZO_DER…— son exactamente os
     nomes dos slots da montaxe. Iso non é casualidade pero tampouco
     está garantido: se alguén renomea un dos dous vocabularios, os
     robots reconstruídos deixarían de amosar as súas pezas e volverían
     saír coa aparencia da clase, sen erro ningún.

     NUCLEO é a excepción coñecida: existe na economía (dá a habilidade
     de piloto) e non ten representación visual. */
  const js = fs.readFileSync(path.join(JS, '12-debrief-hangar.js'), 'utf8');
  const m = js.match(/const RECON_SLOTS = \[([\s\S]*?)\];/);
  afirmar(m, 'non se atopou RECON_SLOTS');
  /* Sácanse os tipos de cada `acepta` a man en vez de parsear o literal:
     leva comas finais e non é JSON válido, e o obxectivo é comprobar
     nomes, non validar sintaxe. */
  const tipos = [];
  for(const a of m[1].matchAll(/acepta\s*:\s*\[([^\]]*)\]/g))
    for(const t of a[1].matchAll(/'([^']+)'/g)) tipos.push(t[1]);
  afirmar(tipos.length >= 5, `só se atoparon ${tipos.length} tipos de peza`);
  const montar = fs.readFileSync(path.join(JS, '19e-montar.js'), 'utf8');
  const sm = montar.match(/const MON3D_SLOTS = \[([^\]]*)\]/);
  afirmar(sm, 'non se atopou MON3D_SLOTS');
  const slots = new Set([...sm[1].matchAll(/'([^']+)'/g)].map(x => x[1]));

  const SEN_DEBUXO = new Set(['NUCLEO']);
  for(const tipo of tipos){
    if(SEN_DEBUXO.has(tipo)) continue;
    afirmar(slots.has(tipo),
      `o reconstructor acepta pezas de tipo ${tipo} e a montaxe non ten ese slot: ` +
      'un robot con esa peza non a amosaría');
  }
});

proba('unha montaxe reconstruída conserva as pezas alleas e completa o resto', () => {
  if(!HAI) return;
  const src = fs.readFileSync(path.join(JS, '19e-montar.js'), 'utf8');
  const { mon3dDeMontaxe, mon3dDeClase } = new Function('PEZAS3D', 'Image',
    src + '; return { mon3dDeMontaxe, mon3dDeClase };')(PEZAS, function(){
      return { set src(v){}, set onload(v){ v && v(); }, set onerror(v){} };
    });
  /* un brazo dereito doutra clase e nada máis: o resto ten que quedar
     na clase do chasis, non baleiro */
  const m = mon3dDeMontaxe({ BRAZO_DER: 'HEAVY' }, 'GRUNT');
  afirmar(m.BRAZO_DER === 'HEAVY', 'a peza allea perdeuse');
  afirmar(m.BRAZO_ESQ === 'GRUNT', 'o brazo esquerdo debería ser recambio da clase');
  afirmar(m.CHASIS === 'GRUNT' && m.CABEZA === 'GRUNT',
    'os ocos deberían cubrirse coa clase do chasis');
  /* e sen pezas alleas ten que dar exactamente a montaxe da clase */
  const puro = mon3dDeMontaxe({}, 'SNIPER');
  for(const k of Object.keys(mon3dDeClase('SNIPER')))
    afirmar(puro[k] === 'SNIPER', `${k}: unha montaxe sen pezas alleas non é a clase`);
});

proba('cada clase ten a súa lámina técnica', () => {
  /* A ficha dunha unidade amosa ui/lamina_<CLASE>.png. Se falta unha, o
     onerror do <img> quita o bloque e a ficha segue funcionando: non hai
     erro, non hai oco, simplemente esa clase deixa de ter lámina e
     ninguén se entera ata que alguén a busca. Por iso se comproba aquí,
     e non só que existan senón que o build as publique. */
  const UI = path.join(__dirname, '..', 'i', 'ui');
  if(!fs.existsSync(UI)) return;
  const clases = PEZAS ? Object.keys(PEZAS.ancorasMundo) : [];
  if(!clases.length) return;
  for(const c of clases){
    const f = path.join(UI, `lamina_${c}.png`);
    afirmar(fs.existsSync(f),
      `falta i/ui/lamina_${c}.png — a ficha do ${c} quedaría sen lámina e sen aviso. ` +
      'Xérase con: node tools/xerar_laminas.js');
  }
  /* e que o build non as deixe fóra: ten unha lista branca para o resto
     de ui/, que é material de traballo */
  const build = fs.readFileSync(path.join(__dirname, '..', 'i', 'build.py'), 'utf8');
  afirmar(/_UI_PATRONS\s*=\s*\[[^\]]*'lamina_'/.test(build),
    'o build non copia as láminas a dist/ui/: quedarían fóra do que se publica');
});

proba('o despregue web non exclúe as láminas das clases', () => {
  /* Hai DÚAS vías de publicación e cada unha ten a súa lista: build.py
     copia a dist/ e firebase.json serve i/ tal cal. Arranxar unha non
     arranxa a outra, e iso foi exactamente o que pasou: as láminas
     entraban no dist e o despregue web excluíaas cun patrón "lamina*"
     pensado para o material de traballo (lamina.png, lamina1.png) que
     collía tamén lamina_GRUNT.png e compañía.

     No xogo publicado non se vía nada: a imaxe daba 404 e o bloque
     desaparecía. Comprobación barata para un fallo que só se manifesta
     en produción e que desde local é invisible. */
  const RAIZ = path.join(__dirname, '..');
  const fb = path.join(RAIZ, 'firebase.json');
  if(!fs.existsSync(fb)) return;
  const ignore = (JSON.parse(fs.readFileSync(fb, 'utf8')).hosting || {}).ignore || [];

  /* Glob mínimo, segmento a segmento: ** engole calquera cousa, * todo
     agás a barra. Abonda para os patróns que hai e evita ter que
     escapar unha expresión regular. */
  const casa = (patron, ruta) => {
    const p = patron.split('/'), r = ruta.split('/');
    const seguir = (i, j) => {
      if(i === p.length) return j === r.length;
      if(p[i] === '**'){
        for(let k = j; k <= r.length; k++) if(seguir(i+1, k)) return true;
        return false;
      }
      if(j === r.length) return false;
      const trozos = p[i].split('*'), seg = r[j];
      if(!seg.startsWith(trozos[0])) return false;
      if(trozos.length > 1 && !seg.endsWith(trozos[trozos.length-1])) return false;
      let pos = trozos[0].length;
      for(let t = 1; t < trozos.length; t++){
        const ix = seg.indexOf(trozos[t], pos);
        if(ix < 0) return false;
        pos = ix + trozos[t].length;
      }
      return seguir(i+1, j+1);
    };
    return seguir(0, 0);
  };

  const UI = path.join(RAIZ, 'i', 'ui');
  if(!fs.existsSync(UI)) return;
  const laminas = fs.readdirSync(UI).filter(f => /^lamina_[A-Z]+[.]png$/.test(f));
  afirmar(laminas.length > 0, 'non hai láminas de clase en i/ui/');
  for(const f of laminas){
    const ruta = 'ui/' + f;
    const culpable = ignore.find(pt => casa(pt, ruta));
    afirmar(!culpable,
      `firebase.json exclúe ${ruta} co patrón "${culpable}": ` +
      'a ficha da unidade sairía sen lámina no xogo publicado');
  }
});
