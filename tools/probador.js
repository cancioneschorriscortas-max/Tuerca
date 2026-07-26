#!/usr/bin/env node
/* ============================================================
   PROBADOR DE MODELOS — un HTML autocontido para xulgar os sprites
   EN MOVEMENTO, que é como se ven no xogo.

   A folla de contacto (banco.js) serve para mirar cadros quietos. Pero
   un ciclo de andar non se xulga cadro a cadro: xúlgase vendo se o
   boneco patina, se baila, se se lle vai a arma. Iso precisa movemento.

   Xera as tres clases cos DOUS renderizadores e empaqueta todo nun só
   ficheiro: ábrese cun dobre clic, sen servidor.

   A tecla importante é o A/B: cambia entre Blender e o rasterizador sen
   mover nada máis. Comparar dúas imaxes lado a lado engana; velas
   alternarse no mesmo sitio, non.

   Uso:
     node tools/probador.js
     node tools/probador.js --reusar        (non volve renderizar)
     node tools/probador.js --alt 22 --res 256
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { sprite } = require('./vox3d.js');
const { montar, ESTADOS, CLASES } = require('./modelos.js');
const { escribir } = require('./png.js');
const { xerar } = require('./sprites_blender.js');

const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const ALT = parseInt(op('alt', '22'), 10);
const RES = parseInt(op('res', '256'), 10);
const REUSAR = argv.includes('--reusar');
const DIRS = 8, FASES = 4;

/* ---------- que cadros fan falla ----------
   8 direccións × 4 fases × 5 estados. REPOUSO tamén se xera nas catro
   fases aínda que non se mova: así o reprodutor non ten que saber de
   casos especiais e a animación de repouso pode gañar vida sen tocar
   nada por aquí. */
const cadros = [];
for(const est of ESTADOS)
  for(let d = 0; d < DIRS; d++)
    for(let f = 0; f < FASES; f++)
      cadros.push({ nome: `${est}_${d}_${f}`, estado: est, fase: f/FASES, yaw: d*2*Math.PI/DIRS });

/* ---------- atlas ---------- */
/* Unha grella de celas do mesmo tamaño. Os sprites de Blender xa saen
   todos iguais (encadre común); os de vox3d recórtanse cadro a cadro, así
   que se centran e apóianse no chan da cela — que é o que fai o xogo. */
function atlas(mapa, cols){
  const cel = Object.values(mapa);
  const cw = Math.max(...cel.map(s => s.ancho)), ch = Math.max(...cel.map(s => s.alto));
  const filas = Math.ceil(cadros.length / cols);
  const px = Buffer.alloc(cols*cw * filas*ch * 4);
  const W = cols*cw;
  cadros.forEach((c, i) => {
    const s = mapa[c.nome];
    const ox = (i % cols)*cw + ((cw - s.ancho) >> 1);
    const oy = Math.floor(i / cols)*ch + (ch - s.alto);
    for(let y = 0; y < s.alto; y++)
      s.px.copy(px, ((oy+y)*W + ox)*4, y*s.ancho*4, (y+1)*s.ancho*4);
  });
  return { ancho: W, alto: filas*ch, px, cw, ch };
}

const COLS = FASES * DIRS;   /* unha fila por estado, lexible ao depurar */
const bancos = {};
for(const cls of CLASES){
  process.stdout.write(`  ${cls}: Blender (${cadros.length} cadros)... `);
  const bl = xerar(cls, cadros, { alt: ALT, res: RES, reusar: REUSAR });
  process.stdout.write('vox3d... ');
  const vx = {};
  for(const c of cadros) vx[c.nome] = sprite(montar(cls, c.estado, c.fase), ALT, c.yaw);
  bancos[cls] = { blender: atlas(bl, COLS), vox3d: atlas(vx, COLS) };
  console.log('ok');
}

/* ---------- empaquetado ---------- */
const dir = path.join(__dirname, '..', 'capturas');
const b64 = {};
for(const cls of CLASES){
  b64[cls] = {};
  for(const r of ['blender', 'vox3d']){
    const f = path.join(dir, `_atlas_${cls}_${r}.png`);
    escribir(f, bancos[cls][r]);
    b64[cls][r] = { d: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'),
                    cw: bancos[cls][r].cw, ch: bancos[cls][r].ch };
    fs.unlinkSync(f);
  }
}

const DATOS = JSON.stringify({
  clases: CLASES, estados: ESTADOS, dirs: DIRS, fases: FASES, cols: COLS, atlas: b64,
});

const html = `<!doctype html>
<html lang="gl"><head><meta charset="utf-8">
<title>TUERCA — probador de modelos</title>
<style>
  :root{ --tinta:#e8e4d8; --fondo:#14170f; --panel:#1d2117; --liña:#39402c; --acento:#c8b45a; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--fondo); color:var(--tinta);
        font:14px/1.5 ui-monospace,Consolas,monospace; }
  header{ padding:10px 16px; border-bottom:1px solid var(--liña); display:flex;
          align-items:baseline; gap:14px; flex-wrap:wrap; }
  h1{ font-size:15px; margin:0; letter-spacing:.14em; color:var(--acento); }
  header span{ opacity:.55; font-size:12px; }
  main{ display:flex; gap:16px; padding:16px; align-items:flex-start; flex-wrap:wrap; }
  .panel{ background:var(--panel); border:1px solid var(--liña); padding:12px; }
  canvas{ display:block; image-rendering:pixelated; }
  .mandos{ width:250px; }
  .mandos h2{ font-size:11px; letter-spacing:.14em; opacity:.5; margin:14px 0 6px;
              text-transform:uppercase; font-weight:400; }
  .mandos h2:first-child{ margin-top:0; }
  .grupo{ display:flex; flex-wrap:wrap; gap:4px; }
  button{ font:inherit; font-size:12px; padding:4px 9px; cursor:pointer;
          background:#262b1c; color:var(--tinta); border:1px solid var(--liña); }
  button:hover{ border-color:var(--acento); }
  button[aria-pressed="true"]{ background:var(--acento); color:#14170f; border-color:var(--acento); }
  label{ display:flex; align-items:center; gap:8px; font-size:12px; margin:5px 0; }
  input[type=range]{ flex:1; accent-color:var(--acento); }
  kbd{ background:#262b1c; border:1px solid var(--liña); padding:0 5px; font-size:11px; }
  .pista{ font-size:11px; opacity:.5; margin-top:12px; line-height:1.7; }
  .rotulo{ font-size:11px; letter-spacing:.1em; opacity:.55; margin-bottom:8px; }
</style></head><body>
<header>
  <h1>TUERCA · PROBADOR</h1>
  <span>A/B con <kbd>espazo</kbd> · dirección coas <kbd>frechas</kbd> · <kbd>1</kbd>-<kbd>3</kbd> clase</span>
</header>
<main>
  <div class="panel mandos">
    <h2>Clase</h2><div class="grupo" id="mClase"></div>
    <h2>Estado</h2><div class="grupo" id="mEstado"></div>
    <h2>Renderizador</h2><div class="grupo" id="mRender"></div>
    <h2>Axustes</h2>
    <label>zoom <input type="range" id="zoom" min="2" max="16" value="8"><b id="vZoom">8</b></label>
    <label>fps <input type="range" id="fps" min="2" max="24" value="8"><b id="vFps">8</b></label>
    <label>xiro <input type="range" id="xiro" min="0" max="7" value="0"><b id="vXiro">0</b></label>
    <label><input type="checkbox" id="orbita"> xirar só</label>
    <label><input type="checkbox" id="reixa"> reixa de píxel</label>
    <h2>Fondo</h2><div class="grupo" id="mFondo"></div>
    <p class="pista">A tecla <kbd>espazo</kbd> alterna Blender e vox3d sen mover
    nada máis. Comparar dúas imaxes lado a lado engana; velas alternarse no
    mesmo sitio, non.</p>
  </div>

  <div class="panel">
    <div class="rotulo" id="rotAmp">ampliado</div>
    <canvas id="lupa" width="400" height="400"></canvas>
  </div>

  <div class="panel">
    <div class="rotulo">patrulla · as tres clases xuntas, velocidade real</div>
    <canvas id="campo" width="440" height="400"></canvas>
  </div>
</main>
<div style="padding:0 16px 16px">
  <div class="panel" style="display:inline-block">
    <div class="rotulo">as 8 direccións · arriba BLENDER, abaixo vox3d · e a tamaño de xogo</div>
    <canvas id="oito" width="1100" height="230"></canvas>
  </div>
</div>
<script>
const D = ${DATOS};
const imx = {};
let listas = 0, total = D.clases.length * 2;
for(const c of D.clases) for(const r of ['blender','vox3d']){
  const im = new Image(); im.src = D.atlas[c][r].d;
  im.onload = () => { if(++listas === total) arrancar(); };
  imx[c + '|' + r] = im;
}

const est = { clase: D.clases[0], estado: 'ANDAR', render: 'blender',
              zoom: 8, fps: 8, xiro: 0, orbita: false, reixa: false,
              fondo: [77,106,42] };

/* Un cadro do atlas: fila = estado, columna = dirección × fase. */
function fonte(clase, render, estado, dir, fase){
  const a = D.atlas[clase][render];
  const i = D.estados.indexOf(estado) * (D.dirs*D.fases) + dir*D.fases + fase;
  return { im: imx[clase+'|'+render], sx: (i % D.cols)*a.cw, sy: Math.floor(i/D.cols)*a.ch,
           w: a.cw, h: a.ch };
}
function pintar(cx, clase, render, estado, dir, fase, x, y, z){
  const f = fonte(clase, render, estado, dir, fase);
  cx.drawImage(f.im, f.sx, f.sy, f.w, f.h, Math.round(x), Math.round(y), f.w*z, f.h*z);
}
const cor = (c) => 'rgb(' + c.join(',') + ')';

/* ---------- mandos ---------- */
function botons(id, vals, get, set, etq){
  const cn = document.getElementById(id);
  cn.innerHTML = '';
  for(const v of vals){
    const b = document.createElement('button');
    b.textContent = etq ? etq(v) : v;
    b.setAttribute('aria-pressed', String(get() === v));
    b.onclick = () => { set(v); refrescar(); };
    cn.appendChild(b);
  }
}
const FONDOS = { herba:[77,106,42], area:[132,116,78], pedra:[86,88,92], noite:[26,30,38] };
function refrescar(){
  botons('mClase',  D.clases,  () => est.clase,  v => est.clase = v);
  botons('mEstado', D.estados, () => est.estado, v => est.estado = v);
  botons('mRender', ['blender','vox3d'], () => est.render, v => est.render = v);
  botons('mFondo',  Object.keys(FONDOS), () => Object.keys(FONDOS).find(k => FONDOS[k] === est.fondo),
         v => est.fondo = FONDOS[v]);
  document.getElementById('rotAmp').textContent =
    est.clase + ' · ' + est.estado + ' · ' + est.render + ' · ×' + est.zoom;
}
for(const [id, campo] of [['zoom','zoom'],['fps','fps'],['xiro','xiro']]){
  const e = document.getElementById(id);
  e.oninput = () => { est[campo] = +e.value; document.getElementById('v'+id[0].toUpperCase()+id.slice(1)).textContent = e.value; };
}
document.getElementById('orbita').onchange = e => est.orbita = e.target.checked;
document.getElementById('reixa').onchange  = e => est.reixa  = e.target.checked;
addEventListener('keydown', e => {
  if(e.code === 'Space'){ est.render = est.render === 'blender' ? 'vox3d' : 'blender'; refrescar(); e.preventDefault(); }
  else if(e.key === 'ArrowRight'){ est.xiro = (est.xiro+1) % D.dirs; document.getElementById('xiro').value = est.xiro; }
  else if(e.key === 'ArrowLeft'){ est.xiro = (est.xiro+D.dirs-1) % D.dirs; document.getElementById('xiro').value = est.xiro; }
  else if('123'.includes(e.key)){ const i = +e.key-1; if(D.clases[i]){ est.clase = D.clases[i]; refrescar(); } }
  document.getElementById('vXiro').textContent = est.xiro;
});

/* ---------- patrulla ----------
   Catro unidades dando voltas. Serve para ver o que un cadro quieto
   nunca ensina: se o boneco patina, se baila de tamaño, ou se a
   dirección salta de golpe ao cambiar de sprite. */
const tropa = Array.from({length: 6}, (_, i) => ({
  clase: D.clases[i % D.clases.length],
  a: i * Math.PI/3, r: 58 + (i%3)*14, v: 0.5 + (i%3)*0.14,
}));

function arrancar(){
  refrescar();
  const lupa = document.getElementById('lupa').getContext('2d');
  const oito = document.getElementById('oito').getContext('2d');
  const campo = document.getElementById('campo').getContext('2d');
  for(const c of [lupa, oito, campo]) c.imageSmoothingEnabled = false;
  let t0 = performance.now();

  function reixa(cx, w, h, z){
    if(!est.reixa) return;
    cx.strokeStyle = 'rgba(255,255,255,.06)'; cx.lineWidth = 1;
    cx.beginPath();
    for(let x = 0; x <= w; x += z){ cx.moveTo(x+.5, 0); cx.lineTo(x+.5, h); }
    for(let y = 0; y <= h; y += z){ cx.moveTo(0, y+.5); cx.lineTo(w, y+.5); }
    cx.stroke();
  }

  function bucle(agora){
    const t = (agora - t0)/1000;
    const fase = Math.floor(t * est.fps) % D.fases;
    const dir = est.orbita ? Math.floor(t*1.1) % D.dirs : est.xiro;

    /* ampliado */
    lupa.fillStyle = cor(est.fondo); lupa.fillRect(0,0,400,400);
    const a = D.atlas[est.clase][est.render];
    pintar(lupa, est.clase, est.render, est.estado, dir, fase,
           200 - a.cw*est.zoom/2, 215 - a.ch*est.zoom/2, est.zoom);
    reixa(lupa, 400, 400, est.zoom);

    /* as oito direccións: os DOUS renderizadores un enriba do outro, para
       que a comparación non dependa de lembrar como era o outro. O paso
       calcúlase da cela, que non é igual nas dúas — a 50 fixos solapaban. */
    oito.fillStyle = cor(est.fondo); oito.fillRect(0,0,1100,230);
    const paso = Math.max(D.atlas[est.clase].blender.cw, D.atlas[est.clase].vox3d.cw)*3 + 42;
    for(let d = 0; d < D.dirs; d++){
      const x = 10 + d*paso;
      pintar(oito, est.clase, 'blender', est.estado, d, fase, x, 8, 3);
      pintar(oito, est.clase, 'vox3d',   est.estado, d, fase, x, 86, 3);
      pintar(oito, est.clase, est.render, est.estado, d, fase, x + 24, 170, 1);
    }

    /* patrulla */
    campo.fillStyle = cor(est.fondo); campo.fillRect(0,0,440,400);
    const orde = tropa.map(u => {
      const ang = u.a + t*u.v;
      return { u, x: 220 + Math.cos(ang)*u.r*1.6, y: 200 + Math.sin(ang)*u.r*0.75,
               /* a dirección sae da tanxente do círculo, non do ángulo:
                  se non, a unidade mira ao centro en vez de a onde vai */
               d: (Math.round((ang + Math.PI/2) / (2*Math.PI) * D.dirs) % D.dirs + D.dirs) % D.dirs };
    }).sort((p, q) => p.y - q.y);      /* pintar de fondo a diante */
    for(const p of orde){
      const ap = D.atlas[p.u.clase][est.render];
      campo.fillStyle = 'rgba(0,0,0,.22)';
      campo.beginPath(); campo.ellipse(p.x, p.y+2, 10, 4, 0, 0, 7); campo.fill();
      pintar(campo, p.u.clase, est.render, 'ANDAR', p.d, fase, p.x - ap.cw*1.5, p.y - ap.ch*3 + 6, 3);
    }
    requestAnimationFrame(bucle);
  }
  requestAnimationFrame(bucle);
}
</script></body></html>`;

const saida = path.join(dir, 'probador.html');
fs.writeFileSync(saida, html, 'utf8');
console.log(`\n  ${cadros.length} cadros × ${CLASES.length} clases × 2 renderizadores`);
console.log(`  ${saida}  (${(Buffer.byteLength(html)/1024/1024).toFixed(1)} MB, autocontido)\n`);
