/* ============================================================
   O BUILD (i/build.py).

   Esta proba existe por un fallo concreto: build.py tiña a lista de
   scripts escrita a man, distinta da do index.html. Engadíronse dous
   ficheiros ao index e non á lista, e como o paso de ensamblado borra
   TODAS as etiquetas <script src="js/..."> para poñer o seu paquete, os
   dous novos desapareceron. Non houbo erro: a aserción de "non quedan
   scripts externos" seguía a cumprirse porque non quedaba ningún.

   Resultado: servido funcionaba e o ficheiro que se distribúe non. É o
   peor xeito de fallar que hai, porque probar en desenvolvemento non o
   destapa. De aí que isto compare o dist co index e non consigo mesmo.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { proba, afirmar } = require('./probar.js');

const I = path.join(__dirname, '..', 'i');
const INDEX = path.join(I, 'index.html');
const DIST = path.join(I, 'dist', 'tuerca.html');

/* Un anaco do medio do ficheiro: o principio adoita ser comentario de
   cabeceira e podería repetirse, e o final pode ser unha chave solta. */
function miolo(txt){
  const limpo = txt.replace(/\r\n/g, '\n');
  const medio = Math.floor(limpo.length / 2);
  return limpo.slice(medio, medio + 120);
}

proba('o build reconstrúe sen erros', () => {
  execFileSync('python', ['build.py'], { cwd: I, stdio: 'pipe' });
  afirmar(fs.existsSync(DIST), 'build.py non escribiu dist/tuerca.html');
});

proba('o dist leva TODOS os scripts que declara o index', () => {
  const index = fs.readFileSync(INDEX, 'utf8');
  const dist = fs.readFileSync(DIST, 'utf8').replace(/\r\n/g, '\n');
  const decl = [...index.matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m => m[1]);
  afirmar(decl.length > 0, 'o index non declara scripts en js/');

  const ausentes = [];
  for(const f of decl){
    const ruta = path.join(I, 'js', f);
    afirmar(fs.existsSync(ruta), `o index referencia js/${f}, que non existe`);
    const txt = fs.readFileSync(ruta, 'utf8');
    if(txt.trim() && !dist.includes(miolo(txt))) ausentes.push(f);
  }
  afirmar(ausentes.length === 0,
    `o dist non contén ${ausentes.length} script(s) que o index si declara: ${ausentes.join(', ')}`);
});

proba('o dist non deixa referencias externas sen absorber', () => {
  const dist = fs.readFileSync(DIST, 'utf8');
  afirmar(!dist.includes('<script src='), 'quedaron scripts externos no dist');
  afirmar(!dist.includes('<link rel="stylesheet"'), 'quedou a folla de estilos sen absorber');
});

proba('o banco de sprites 3D chega ao dist', () => {
  /* Non abonda con que estea o cargador: sen os atlas, o xogo cae na
     reserva procedural e ninguén se entera de que faltan.

     E non abonda con buscar "BANCO3D": o cargador nómbrao no seu propio
     código, así que esta proba pasaba en verde cando se quitou o banco
     do build a propósito para comprobala. Búscase a ASIGNACIÓN, que só
     está no ficheiro xerado, e mídense os atlas polo seu tamaño — a
     interface ten as súas imaxes en base64 e enchían a conta. */
  const dist = fs.readFileSync(DIST, 'utf8');
  afirmar(/(?:const|var|let)\s+BANCO3D\s*=/.test(dist), 'o dist non leva o banco de sprites');
  afirmar(dist.includes('spr3dDebuxar'), 'o dist non leva o debuxante de sprites');
  const grandes = (dist.match(/data:image\/png;base64,[A-Za-z0-9+/=]{3000,}/g) || []).length;
  afirmar(grandes >= 9, `esperábanse polo menos 9 atlas (3 clases × 3 equipos) e hai ${grandes}`);
});

proba('o arnés de probas carga os mesmos módulos que o index', () => {
  /* O arnés ten a súa propia lista de ficheiros e o seu comentario pide
     "manter as dúas listas en sintonía" — pero iso era unha promesa, non
     unha regra. Un módulo novo no index que non se engada aquí non dá
     erro: simplemente non se proba, e as probas seguen verdes mentres o
     xogo real leva código que ninguén exercita.

     As exclusións son deliberadas e van NOMEADAS: os bancos de sprites
     son megas de base64 e o arnés non ten lenzo onde debuxalos. Se algún
     día fai falla algún, quítase de aquí e xa está. */
  const { FICHEIROS } = require('./arnes.js');
  const idx = [...fs.readFileSync(INDEX, 'utf8')
    .matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m => m[1]);
  afirmar(idx.length > 10, `só se atoparon ${idx.length} scripts no index`);

  const FORA_DO_ARNES = new Set([
    '19-sprites.js',    /* debuxo a lenzo: nada que simular sen canvas */
    '19b-banco.js',     /* banco de sprites por clase, megas de base64 */
    '19c-orde.js',      /* táboa de orde de capas */
    '19d-pezas.js',     /* atlas por peza, tamén en base64 */
    '19e-montar.js',    /* compón sobre lenzo; próbase aparte en montaxe.test.js */
  ]);

  const esperados = idx.filter(f => !FORA_DO_ARNES.has(f));
  const faltan = esperados.filter(f => !FICHEIROS.includes(f));
  const sobran = FICHEIROS.filter(f => !idx.includes(f));
  afirmar(faltan.length === 0,
    `o arnés non carga ${faltan.join(', ')}: eses módulos non se están probando`);
  afirmar(sobran.length === 0,
    `o arnés carga ${sobran.join(', ')} e o index xa non os ten`);
});
