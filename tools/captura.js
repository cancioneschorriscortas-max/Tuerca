#!/usr/bin/env node
/* ============================================================
   CAPTURA — renderiza o xogo de verdade e garda un PNG.

   Usa Edge (ou Chrome) en modo sen cabeceira: mesmo motor que o
   navegador do xogador, JS executado, CSS aplicado. Serve para ver
   o que se está a facer sen ter que abrir nada a man, e para
   comparar antes/despois dun cambio visual.

   Uso:
     node tools/captura.js hangar
     node tools/captura.js batalla
     node tools/captura.js batalla --hora 18 --pasos 3000
     node tools/captura.js batalla --sen-luz --saida antes.png

   Opcións:
     --hora N      forza a hora do día (9..19) na capa de luz
     --pasos N     pasos de simulación antes de debuxar (defecto 1800)
     --sen-luz     apaga a capa de luz e as sombras (para o A/B)
     --lingua X    gl | es | en, para revisar as traducións
     --efectos     dispara os efectos de lectura para poder velos
     --saida RUTA  onde gardar (defecto: capturas/<modo>.png)
     --ancho N --alto N   tamaño da ventá

   Cero dependencias: só o navegador que xa está instalado.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const I = path.join(RAIZ, 'i');

/* ---------- Argumentos ---------- */
const argv = process.argv.slice(2);
const modo = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'hangar';
const op = (nome, defecto) => {
  const i = argv.indexOf('--' + nome);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : defecto;
};
const ten = (nome) => argv.includes('--' + nome);

const hora = op('hora', null);
const pasos = parseInt(op('pasos', '1800'), 10);
const ancho = parseInt(op('ancho', '1280'), 10);
const alto = parseInt(op('alto', modo === 'batalla' ? '900' : '760'), 10);
const senLuz = ten('sen-luz');
const lingua = op('lingua', null);   /* gl | es | en — para revisar traducións */
const saida = path.resolve(op('saida', path.join(RAIZ, 'capturas', modo + '.png')));

/* ---------- Navegador ---------- */
function atoparNavegador() {
  const candidatos = [
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of candidatos) { if (c && fs.existsSync(c)) return c; }
  throw new Error('non atopei Chrome nin Edge; pasa a ruta en CAPTURA_NAVEGADOR');
}
const navegador = process.env.CAPTURA_NAVEGADOR || atoparNavegador();

/* ---------- Sonda ----------
   Unha copia de index.html cun script engadido ao final. Vai DENTRO de
   i/ para que as rutas relativas a js/ e css/ sigan valendo, e bórrase
   ao rematar. Está en .gitignore por se algunha vez queda orfa. */
const arranque = modo === 'batalla' ? `
<script>
/* sonda de captura — non forma parte do xogo */
window.addEventListener('load', function(){
  setTimeout(function(){
    try{
      var roster = [];
      var clases = ['GRUNT','HEAVY','ENGINEER'];
      for(var i = 0; i < 3; i++){
        roster.push({
          id: 'C-0' + (i+1), name: pickName(DATA, roster), cls: clases[i],
          ops: 3, kills: 2, traits: [], events: [], medals: [],
          crossings: 0, recoveries: 0, criticalSurvivals: 0, captures: 0,
          personalidad: pickPersonalidad(clases[i]), confianza: 55,
          activity: {dist:0, shots:0, kills:0, dmgTaken:0, caps:0, veh:0}
        });
      }
      DATA.opCount = 2;   /* mapa procedural, o máis representativo */
      ${op('semente', null) != null ? `window._semente = ${Number(op('semente', 0)) >>> 0};` : ''}
      document.getElementById('hangar').style.display = 'none';
      document.getElementById('battle').style.display = 'block';
      game = newBattle(roster);
      ${senLuz ? 'LUZ.activa = false; SOMBRA.activa = false;' : 'LUZ.activa = true; SOMBRA.activa = true;'}
      ${hora != null ? 'LUZ.horaForzada = ' + Number(hora) + ';' : ''}
      for(var s = 0; s < ${pasos}; s++) simStep(game);
      ${ten('todas-as-clases') ? `
      /* Unha de cada clase, en fila. Para revisar arte non serve agardar
         a que a partida fabrique un sniper: pode tardar media hora ou non
         chegar nunca. Póñense DESPOIS de simular para que non se movan
         nin morran antes da captura. */
      (function(){
        var base = game.units.filter(function(u){ return !u.dead && u.team === 0; })[0];
        if(!base) return;
        var clases = ['GRUNT','HEAVY','ENGINEER','SNIPER','BOMBARDERO'];
        game.units = game.units.filter(function(u){ return u.team !== 0; });
        clases.forEach(function(c, i){
          var u = mkUnit(0, c, base.x + i*46, base.y, null);
          u.tx = u.x; u.ty = u.y;      /* quietos: pose de garda */
          game.units.push(u);
        });
      })();` : ''}
      ${ten('sprites-vellos') ? 'SPR3D_ACTIVO = false;' : ''}
      ${ten('pezas') ? 'MON3D_ACTIVO = true;' : ''}
      ${ten('reensamblado') ? `
      /* Dálle a cada unidade unha montaxe con pezas doutras clases, como
         se saíse do reconstructor. É o único xeito de ver no xogo o que
         só se podía ver no banco de probas: un robot que se PARECE ao
         que está feito, en vez de saír coa aparencia uniforme da clase. */
      (function reensamblar(){
        var mesturas = [
          { BRAZO_DER: 'HEAVY' },
          { CABEZA: 'BOMBARDERO', BRAZO_ESQ: 'SNIPER' },
          { PERNA_DER: 'HEAVY', PERNA_ESQ: 'HEAVY' },
          { CABEZA: 'SNIPER', BRAZO_DER: 'ENGINEER' },
        ];
        game.units.filter(function(u){ return u.team === 0; }).forEach(function(u, i){
          u.montaxe = mesturas[i % mesturas.length];
          u._mont3d = null;
        });
      })();` : ''}
      ${ten('enfocar') ? `
      /* Centra a cámara nas propias tropas e achégaa. Sen isto cada
         captura encadra un anaco distinto do mapa segundo onde acabase
         a cámara, e un A/B de dúas imaxes con distinto encadre non
         demostra nada. */
      (function fixar(){
        var vivos = game.units.filter(function(u){ return !u.dead && u.team === 0; });
        if(vivos.length){
          var mx = 0, my = 0;
          vivos.forEach(function(u){ mx += u.x; my += u.y; });
          mx /= vivos.length; my /= vivos.length;
          /* Cada fotograma: o xogo recalcula o zoom pola súa conta e
             pisa calquera valor posto unha soa vez. */
          camZoom = ${Number(op('zoom', '1.8'))};
          cam.x = mx - cv.width/(2*camZoom);
          cam.y = my - cv.height/(2*camZoom);
        }
        requestAnimationFrame(fixar);
      })();` : ''}
      requestAnimationFrame(loop);
      ${ten('efectos') ? `
      /* Dispara os efectos de lectura preto da cámara para poder velos:
         caducan en menos dun segundo, así que hai que ir renovándoos. */
      var _bt = 0;
      (function bombardeo(){
        /* Cada 26 frames, non cada un: disparando en continuo superpóñense
           unha ducia de fogonazos e a captura mente sobre a intensidade
           real, que é UN por explosión e apágase en cuartos de segundo. */
        if((_bt++ % 26) === 0){
          var cx = cam.x + cv.width/(2*camZoom), cy = cam.y + cv.height/(2*camZoom);
          efxOnda(cx - 150, cy - 60, true);
          efxOnda(cx + 90, cy + 40, false);
          efxSniper(cx + 200, cy - 90);
          efxSniper(cx + 1400, cy);            /* fóra de cámara: frecha no bordo */
        }
        for(var i = 0; i < 3 && i < game.units.length; i++){
          game.units[i]._curandoT = game.t;    /* cruz de reparación, continua */
        }
        requestAnimationFrame(bombardeo);
      })();` : ''}
    }catch(e){
      document.body.innerHTML = '<pre style="color:#ff6a5a;font:14px monospace;padding:20px">'
        + 'ERRO NA SONDA\\n' + (e && e.stack || e) + '</pre>';
    }
  }, 60);
});
</script>
` : '';

/* Hangar con datos: cun roster baleiro o panel de estado sae todo a cero
   e non se ve nada do que se está a facer. --sementar enche DATA cun
   escuadrón, unha baixa e unha reensamblaxe en curso. */
const FICHA = op('ficha', null);
const MONTAXE = ten('montaxe');
const CONSELLO = ten('consello');
const semente = (modo === 'hangar' && (ten('sementar') || FICHA || MONTAXE || CONSELLO)) ? `
<script>
var MONTAXE = ${MONTAXE};
var CONSELLO = ${CONSELLO};
var FICHA = ${FICHA ? JSON.stringify(FICHA) : 'null'};
window.addEventListener('load', function(){
  setTimeout(function(){
    try{
      var clases = ['GRUNT','HEAVY','ENGINEER','SNIPER','GRUNT','HEAVY','ENGINEER'];
      DATA.units = clases.map(function(cls, i){
        return {
          id: 'R-0' + (i+1), name: pickName(DATA, []), cls: cls,
          ops: i < 5 ? 2 + i : 0, kills: i, traits: [], events: [], medals: [],
          crossings: 0, recoveries: 0, criticalSurvivals: 0, captures: 0,
          personalidad: pickPersonalidad(cls), confianza: 50,
          renacido: i < 2 ? {opsLeft: 3} : null,
          folga: i === 6 ? {ops: 2, por: 'MARTELO'} : null,
          activity: {dist:0, shots:0, kills:0, dmgTaken:0, caps:0, veh:0}
        };
      });
      DATA.chatarra = 124;
      DATA.opCount = 13;
      /* Dúas unidades comparables para ver as marcas: unha normal e unha
         reensamblada con pezas alleas, coas súas habilidades cruzadas. */
      DATA.units[1].habilidades = {antimuro:true, cazapilotos:true};
      DATA.units[1].piezasDe = ['MARTELO','BIELA'];
      DATA.units[1].reconstruidoOp = 11;
      DATA.units[1].renacido = {opsLeft:3};
      DATA.units[2].desdeCero = true;
      /* --ficha abre a biografía dunha unidade, que é onde vai a lámina
         técnica da clase. Sen isto non hai xeito de capturala: a ficha
         só se abre premendo, e a captura non preme. */
      if(MONTAXE){
        /* Pezas no inventario e o diálogo de montaxe aberto, con algunhas
           escollidas: é a única maneira de capturar a vista previa, que
           só aparece cando hai algo escollido. */
        var _n = 0;
        DATA.piezas = [];
        [['CABEZA','SNIPER','CROMO'], ['CHASIS','GRUNT','FORXA'],
         ['BRAZO_DER','HEAVY','REMACHE'], ['BRAZO_ESQ','ENGINEER','LIMA'],
         ['PERNA_DER','HEAVY','EIXE'], ['PERNA_ESQ','GRUNT','BRIDA'],
         ['NUCLEO','BOMBARDERO','CHISPA']].forEach(function(t){
          DATA.piezas.push({ id:'p'+(_n++), tipo:t[0], deCls:t[1], deNome:t[2], act:120 });
        });
        setTimeout(function(){
          /* dentro do temporizador: a semente pon unha reensamblaxe en
             curso DESPOIS deste bloque, e con ela o diálogo non abre */
          DATA.reconstruccion = null;
          showMontaxe();
          setTimeout(function(){
            var sels = document.querySelectorAll('#bioBody select[data-slot]');
            sels.forEach(function(sel){ if(sel.options.length > 1) sel.selectedIndex = 1; });
            sels[0] && sels[0].dispatchEvent(new Event('change'));
          }, 120);
        }, 400);
      }
      if(FICHA){
        var _u = DATA.units.find(function(x){ return x.cls === FICHA; }) || DATA.units[0];
        setTimeout(function(){ showBiography(_u); }, 400);
      }
      DATA.fallen = [TXT('deb.fallenLine', {id:'R-08', n:'MARTELO', ops:9, k:14,
        l:'a Ponte', op:13, reason: TXT('deb.restosPerdidos')})];
      DATA.reconstruccion = {rec: DATA.units[0], pezas: [], encargadaOp: 13, sinergia: null};
      ${lingua ? "setLang('" + lingua + "', {persist:false});" : ""}
      estadoRender();
      /* E o ROSTER, que non se repintaba: a semente enche DATA despois
         de que showHangar() xa pintase a lista, así que quedaba dicindo
         "roster baleiro" con sete unidades dentro. Hai que gardar antes
         de repintar porque showHangar empeza cun loadData(). */
      /* --consello deixa o estado no que ÓPTIMA explica as pezas: hai
         pezas no inventario, unha IA no arquivo e o taller libre. */
      if(CONSELLO){
        DATA.piezas = [{id:'p1', tipo:'CABEZA', deCls:'HEAVY', deNome:'MARTELO', act:100},
                       {id:'p2', tipo:'BRAZO_DER', deCls:'SNIPER', deNome:'CROMO', act:80}];
        DATA.iaArquivo = [{id:'R-09', name:'MARTELO', cls:'GRUNT', ops:9, activity:{}}];
        DATA.reconstruccion = null;
        DATA.units.forEach(function(u){ delete u.reconstruidoOp; });
      }
      saveData(DATA).then(function(){ showHangar(); });
    }catch(e){
      document.body.innerHTML = '<pre style="color:#ff6a5a;font:14px monospace;padding:20px">'
        + 'ERRO NA SEMENTE\\n' + (e && e.stack || e) + '</pre>';
    }
  }, 700);   /* despois de que showHangar() resolva o seu loadData */
});
</script>
` : '';

/* --dist captura o HTML ENSAMBLADO en vez do index de desenvolvemento.
   Existe porque xa fallou: engadíronse dous scripts ao index e non á
   lista do build, así que servido funcionaba e o ficheiro que se
   distribúe non. Comprobar só o index non demostra que o xogo funcione.
   A sonda vai ao lado do orixinal para que as rutas relativas (ui/,
   voces/) sigan resolvendo igual. */
const usarDist = ten('dist');
const orixe = usarDist ? path.join(I, 'dist', 'tuerca.html') : path.join(I, 'index.html');
if(!fs.existsSync(orixe)) throw new Error('non existe ' + orixe + (usarDist ? ' — corre antes build.py' : ''));
const sonda = path.join(path.dirname(orixe), '_captura_tmp.html');
let html = fs.readFileSync(orixe, 'utf8');
html = html.replace('</body>', arranque + semente + '</body>');
fs.writeFileSync(sonda, html, 'utf8');

/* ---------- Disparo ----------
   --user-data-dir é OBRIGATORIO: sen el, se o navegador xa está aberto,
   o executable limítase a pasarlle o encargo á instancia existente e
   devolve o control ao instante. O proceso "remata" antes de cargar
   nada, e a sonda bórrase debaixo dos pés (ERR_FILE_NOT_FOUND). Cun
   perfil propio arranca unha instancia illada que si agarda. */
fs.mkdirSync(path.dirname(saida), { recursive: true });
const perfil = path.join(require('os').tmpdir(), 'tuerca-captura-' + process.pid);
try { fs.unlinkSync(saida); } catch (_) {}

try {
  execFileSync(navegador, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--hide-scrollbars', '--user-data-dir=' + perfil,
    '--screenshot=' + saida,
    '--window-size=' + ancho + ',' + alto,
    '--virtual-time-budget=8000',
    'file:///' + sonda.replace(/\\/g, '/'),
  ], { stdio: 'ignore', timeout: 60000 });
} catch (e) {
  /* Chromium devolve códigos raros aínda cando a captura sae ben. */
}

/* O executable devolve o control ANTES de escribir o PNG, así que non
   vale con mirar se existe nada máis rematar: hai que agardar a que
   apareza e a que deixe de medrar. E a sonda non se pode borrar antes,
   ou o navegador atópaa xa borrada (ERR_FILE_NOT_FOUND). */
function agardarPolaSaida(ruta, msMax) {
  const dorme = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  const t0 = Date.now();
  let anterior = -1;
  while (Date.now() - t0 < msMax) {
    dorme(300);
    if (fs.existsSync(ruta)) {
      const tam = fs.statSync(ruta).size;
      if (tam > 0 && tam === anterior) return true;   /* tamaño estable */
      anterior = tam;
    }
  }
  return fs.existsSync(ruta);
}
const saiu = agardarPolaSaida(saida, 45000);

try { fs.unlinkSync(sonda); } catch (_) {}
try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (_) {}

if (!saiu) { console.error('non se xerou a captura'); process.exit(1); }
console.log(`${saida}  (${Math.round(fs.statSync(saida).size / 1024)} KB)`);
