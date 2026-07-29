#!/usr/bin/env node
/* ============================================================
   ¿RECOÑÉCESE UNHA CLASE POLA SILUETA?

   A regra L4 xa esixe que dúas clases non se vexan igual, pero conta
   tamén a COR, e a cor é o primeiro que se perde: baixo choiva, na néboa
   de guerra, para un daltónico, ou simplemente cando as dúas unidades
   son do mesmo bando. O que queda entón é o recorte contra o terreo.

   Isto mídeo por separado. Para cada par de clases e cada unha das oito
   direccións, cantos píxeles de sprite difiren:

     silueta   só a máscara: o que verías se todo fose negro
     completo  máscara e cor, que é o que ve o xogador con boa luz

   Mídese sobre o BANCO DE CLASES, que é o que o xogo debuxa de verdade,
   e non sobre unha versión ampliada: as unidades teñen 22 píxeles e a
   pregunta é se se distinguen A ESE TAMAÑO. Aliñanse polos pés e polo
   centro, que é como aparecen no mapa unha ao lado da outra.

   Dúas fontes, e a diferenza importa:

     por defecto   o BANCO de sprites, que é o que o xogo debuxa hoxe.
                   Ollo: o banco normaliza cada clase a 22 píxeles, así
                   que ESCONDE as diferenzas de altura entre clases.
     --modelo      as caixas de modelos.js, renderizadas ao voo e todas
                   á MESMA escala. É o único xeito de ver se un cambio de
                   proporcións funciona sen agardar unha hora de render,
                   e o único que respecta que un robot sexa máis alto.

   Uso:
     node tools/proba_siluetas.js            matriz e os peores pares
     node tools/proba_siluetas.js --modelo   sobre as caixas, escala común
     node tools/proba_siluetas.js --imaxe    escríbeas para mirar
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ler, escribir } = require('./png.js');

const RAIZ = path.join(__dirname, '..');
const JS = path.join(RAIZ, 'i', 'js');

const BANCO3D = (() => {
  const t = fs.readFileSync(path.join(JS, '19b-banco.js'), 'utf8');
  return JSON.parse(t.match(/(?:const|var|let)\s+BANCO3D\s*=\s*(\{[\s\S]*\});/)[1]);
})();

/* ---------- descodificar o banco ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tuerca-siluetas-'));
const atlas = {};
for(const [cls, eqs] of Object.entries(BANCO3D.banco)){
  const a = eqs['0'];                       /* bando azul; a forma non depende del */
  const f = path.join(tmp, cls + '.png');
  fs.writeFileSync(f, Buffer.from(a.d.split(',')[1], 'base64'));
  atlas[cls] = Object.assign(ler(f), a);
}
const CLASES = Object.keys(atlas);

/* Un cadro solto, recortado do atlas e aliñado polos PÉS e polo centro
   horizontal: é como se ven no mapa, unha ao lado da outra pisando o
   mesmo chan. Aliñar polo centro da caixa faría trampa —desprazaría
   unha clase alta para facela coincidir coa baixa. */
/* O lenzo ten que caber a clase MÁIS GRANDE, se non recórtaa e a medida
   mente: coa cela do HEAVY en 42×32, un lenzo de 40 estaba cortándoo e
   dando menos diferenza da real. Sae do propio banco. */
const LENZO = Math.max(48, ...Object.values(atlas).map(a => Math.max(a.cw, a.ch) + 8));

/* A mesma medida pero renderizando as caixas ao voo, todas coa mesma
   escala. O rasterizador propio abonda: aquí só interesa a forma, e é
   instantáneo fronte aos minutos que leva Blender. */
const VIVO = process.argv.includes('--modelo');
function cadroVivo(cls, estado, dir, fase){
  const { render } = require('./vox3d.js');
  const { montar } = require('./modelos.js');
  const SS = 4, W = LENZO*SS;
  /* Escala común para todas as clases: tantos píxeles de render por
     unidade de mundo como use o xogo. Se se normalizase por clase, un
     robot máis alto sairía igual de alto e a medida non valería nada. */
  const esc = 9.3*SS;
  const yaw = dir*2*Math.PI/8;
  const r = render(montar(cls, estado, fase), W, W, esc, yaw);
  const masc = new Uint8Array(LENZO*LENZO), col = new Uint8Array(LENZO*LENZO*3);
  /* baixar a supermostra e aliñar polos pés e o centro, igual que o banco */
  const g = new Uint8Array(LENZO*LENZO);
  let x0 = LENZO, x1 = -1, y1 = -1;
  for(let y = 0; y < LENZO; y++) for(let x = 0; x < LENZO; x++){
    let n = 0, cr = 0, cg = 0, cb = 0;
    for(let sy = 0; sy < SS; sy++) for(let sx = 0; sx < SS; sx++){
      const i = (y*SS+sy)*W + x*SS+sx;
      if(!r.masc[i]) continue;
      n++; cr += r.col[i*3]; cg += r.col[i*3+1]; cb += r.col[i*3+2];
    }
    if(n*2 < SS*SS) continue;
    g[y*LENZO+x] = 1;
    col[(y*LENZO+x)*3] = cr/n|0; col[(y*LENZO+x)*3+1] = cg/n|0; col[(y*LENZO+x)*3+2] = cb/n|0;
    if(x < x0) x0 = x; if(x > x1) x1 = x; if(y > y1) y1 = y;
  }
  if(x1 < 0) return { masc, col };
  const dx = Math.round(LENZO/2 - (x0+x1)/2), dy = LENZO - 3 - y1;
  const col2 = new Uint8Array(LENZO*LENZO*3);
  for(let y = 0; y < LENZO; y++) for(let x = 0; x < LENZO; x++){
    if(!g[y*LENZO+x]) continue;
    const X = x+dx, Y = y+dy;
    if(X < 0 || Y < 0 || X >= LENZO || Y >= LENZO) continue;
    masc[Y*LENZO+X] = 1;
    for(let k = 0; k < 3; k++) col2[(Y*LENZO+X)*3+k] = col[(y*LENZO+x)*3+k];
  }
  return { masc, col: col2 };
}

function cadro(cls, estado, dir, fase){
  if(VIVO) return cadroVivo(cls, estado, dir, fase);
  const a = atlas[cls];
  const ix = BANCO3D.indice[estado] || BANCO3D.indice.REPOUSO;
  const c = ix.base + dir*ix.fases + (fase % ix.fases);
  const masc = new Uint8Array(LENZO*LENZO), col = new Uint8Array(LENZO*LENZO*3);
  let x0 = a.cw, x1 = -1, y1 = -1;
  for(let y = 0; y < a.ch; y++) for(let x = 0; x < a.cw; x++)
    if(a.px[(y*a.ancho + c*a.cw + x)*4 + 3] > 110){
      if(x < x0) x0 = x; if(x > x1) x1 = x; if(y > y1) y1 = y;
    }
  if(x1 < 0) return { masc, col };
  const ox = Math.round(LENZO/2 - (x0+x1)/2), oy = LENZO - 3 - y1;
  for(let y = 0; y < a.ch; y++) for(let x = 0; x < a.cw; x++){
    const s = (y*a.ancho + c*a.cw + x)*4;
    if(a.px[s+3] < 110) continue;
    const X = ox+x, Y = oy+y;
    if(X < 0 || Y < 0 || X >= LENZO || Y >= LENZO) continue;
    masc[Y*LENZO + X] = 1;
    col[(Y*LENZO + X)*3] = a.px[s];
    col[(Y*LENZO + X)*3+1] = a.px[s+1];
    col[(Y*LENZO + X)*3+2] = a.px[s+2];
  }
  return { masc, col };
}

function diferenza(a, b){
  let sil = 0, tot = 0, cor = 0;
  for(let i = 0; i < LENZO*LENZO; i++){
    if(a.masc[i] || b.masc[i]) tot++;
    if(a.masc[i] !== b.masc[i]){ sil++; continue; }
    if(!a.masc[i]) continue;
    if(Math.abs(a.col[i*3]-b.col[i*3]) + Math.abs(a.col[i*3+1]-b.col[i*3+1])
     + Math.abs(a.col[i*3+2]-b.col[i*3+2]) > 60) cor++;
  }
  return { sil, cor, tot };
}

/* ---------- medir ---------- */
const ESTADO = 'REPOUSO';
const pares = [];
for(let i = 0; i < CLASES.length; i++) for(let j = i+1; j < CLASES.length; j++){
  for(let d = 0; d < BANCO3D.dirs; d++){
    const a = cadro(CLASES[i], ESTADO, d, 0), b = cadro(CLASES[j], ESTADO, d, 0);
    const r = diferenza(a, b);
    pares.push({ a: CLASES[i], b: CLASES[j], d, ...r });
  }
}

const anchoNome = Math.max(...CLASES.map(c => c.length));
console.log(`\n  SILUETA SÓ — píxeles de sprite que difiren, ${ESTADO}\n`);
console.log('  ' + ''.padEnd(anchoNome*2 + 5) + [...Array(8).keys()].map(d => String(d).padStart(5)).join(''));
console.log('  ' + '-'.repeat(anchoNome*2 + 5 + 40));
const porPar = new Map();
for(const p of pares){
  const k = p.a + '|' + p.b;
  if(!porPar.has(k)) porPar.set(k, []);
  porPar.get(k).push(p);
}
for(const [k, ps] of porPar){
  const [a, b] = k.split('|');
  console.log('  ' + (a + ' / ' + b).padEnd(anchoNome*2 + 5) +
    ps.map(p => String(p.sil).padStart(5)).join(''));
}

/* O umbral: por debaixo de aquí, dúas unidades a 22 píxeles no medio
   dunha batalla non se distinguen sen mirar a cor. Non é un número
   sagrado, é o que se mediu que xa custa distinguir na captura. */
const UMBRAL = 24;
const frouxos = pares.filter(p => p.sil < UMBRAL).sort((x, y) => x.sil - y.sil);
console.log(`\n  pares que se confunden pola silueta (menos de ${UMBRAL} px):`);
if(!frouxos.length) console.log('    ningún');
for(const p of frouxos)
  console.log(`    dir ${p.d}  ${p.a} / ${p.b}   ${p.sil} px de silueta` +
              `   (${p.sil + p.cor} contando a cor)`);

const media = pares.reduce((s, p) => s + p.sil, 0) / pares.length;
const peor = Math.min(...pares.map(p => p.sil));
console.log(`\n  media ${media.toFixed(1)} px   peor ${peor} px   sobre ${pares.length} comparacións\n`);

/* ---------- --imaxe: as siluetas en negro, que é como hai que velas ---------- */
if(process.argv.includes('--imaxe')){
  const Z = 6, MARXE = 120, CAB = 30;
  const W = MARXE + 8*LENZO*Z, H = CAB + CLASES.length*LENZO*Z;
  const px = Buffer.alloc(W*H*4);
  for(let i = 0; i < W*H; i++){ px[i*4]=210; px[i*4+1]=212; px[i*4+2]=205; px[i*4+3]=255; }
  CLASES.forEach((cls, r) => {
    for(let d = 0; d < 8; d++){
      const c = cadro(cls, ESTADO, d, 0);
      for(let y = 0; y < LENZO*Z; y++) for(let x = 0; x < LENZO*Z; x++){
        if(!c.masc[((y/Z)|0)*LENZO + ((x/Z)|0)]) continue;
        const o = ((CAB + r*LENZO*Z + y)*W + MARXE + d*LENZO*Z + x)*4;
        px[o] = 24; px[o+1] = 26; px[o+2] = 22;
      }
    }
  });
  escribir(path.join(RAIZ, 'capturas', '_siluetas.png'), { ancho: W, alto: H, px });
  console.log('  capturas/_siluetas.png  (as cinco clases en negro, oito direccións)\n');
}

fs.rmSync(tmp, { recursive: true, force: true });
