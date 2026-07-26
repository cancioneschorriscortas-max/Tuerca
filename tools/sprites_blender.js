/* ============================================================
   XERADOR DE SPRITES EN BLENDER — a parte reutilizable.

   Estaba dentro de banco_blender.js, pero en canto houbo un segundo
   consumidor (o probador) tocaba sacala. Aquí non hai folla de contacto
   nin métricas: só "dáme estes cadros renderizados e listos".

   O ENCADRE é común a todos os cadros dun lote. É a diferenza importante
   co pipeline vello: recortando cada cadro polo seu propio contorno o
   boneco baila entre fotogramas, porque a caixa medra ao abrir as pernas.
   Como efecto secundario todos os sprites do lote saen do mesmo tamaño,
   que é o que fai falla para empaquetalos nun atlas.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { reducir, PAL } = require('./vox3d.js');
const { montar } = require('./modelos.js');
const { ler } = require('./png.js');

const CARAS = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];

function atoparBlender(){
  const base = 'C:/Program Files/Blender Foundation';
  if(!fs.existsSync(base)) throw new Error('non atopo Blender en ' + base);
  for(const d of fs.readdirSync(base).sort().reverse()){
    const p = path.join(base, d, 'blender.exe');
    if(fs.existsSync(p)) return p;
  }
  throw new Error('non atopo blender.exe');
}

function contornoDe(im){
  let x0 = im.ancho, y0 = im.alto, x1 = -1, y1 = -1;
  for(let y = 0; y < im.alto; y++) for(let x = 0; x < im.ancho; x++){
    if(im.px[(y*im.ancho + x)*4 + 3] > 8){
      if(x < x0) x0 = x; if(x > x1) x1 = x;
      if(y < y0) y0 = y; if(y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

/* Liña escura arredor da silueta. A 22 píxeles, sen ela o boneco desfaise
   contra a herba. Ponse ANTES de reducir para que quede suavizada. */
function contornear(im, gr){
  const fóra = Buffer.from(im.px);
  for(let y = 0; y < im.alto; y++) for(let x = 0; x < im.ancho; x++){
    const i = (y*im.ancho + x)*4;
    if(im.px[i+3] > 24) continue;
    let veciño = false;
    for(let dy = -gr; dy <= gr && !veciño; dy++) for(let dx = -gr; dx <= gr; dx++){
      const X = x+dx, Y = y+dy;
      if(X < 0 || Y < 0 || X >= im.ancho || Y >= im.alto) continue;
      if(im.px[(Y*im.ancho + X)*4 + 3] > 128){ veciño = true; break; }
    }
    if(veciño){ fóra[i] = 12; fóra[i+1] = 14; fóra[i+2] = 12; fóra[i+3] = 255; }
  }
  return { ancho: im.ancho, alto: im.alto, px: fóra };
}

/* cadros: [{nome, estado, fase, yaw}]  ->  {nome: {ancho,alto,px}} */
function xerar(clase, cadros, opc = {}){
  const ALT = opc.alt || 22, RES = opc.res || 256;
  const tmp = opc.tmp || path.join(__dirname, '..', 'capturas', '_blender', clase);
  fs.mkdirSync(tmp, { recursive: true });

  const traballo = cadros.map(c => ({
    nome: c.nome, yaw: c.yaw,
    pezas: montar(clase, c.estado, c.fase).pezas.map(([verts, cor]) => ({ verts, cor })),
  }));
  const entrada = path.join(tmp, 'traballo.json');
  fs.writeFileSync(entrada, JSON.stringify({ caras: CARAS, cadros: traballo, luminosas: [PAL.ollo] }), 'utf8');

  if(!opc.reusar){
    execFileSync(atoparBlender(), ['--background', '--python', path.join(__dirname, 'blender_banco.py'),
                                   '--', entrada, tmp, String(RES)], { stdio: 'pipe' });
  }

  const cru = {};
  let caixa = null;
  for(const c of cadros){
    const im = ler(path.join(tmp, c.nome + '.png'));
    cru[c.nome] = im;
    const b = contornoDe(im);
    caixa = caixa ? { x0: Math.min(caixa.x0,b.x0), y0: Math.min(caixa.y0,b.y0),
                      x1: Math.max(caixa.x1,b.x1), y1: Math.max(caixa.y1,b.y1) } : b;
  }
  /* O grosor mídese sobre a escala FINAL, non sobre a do render. E o
     encadre medra ese mesmo grosor, ou o contorno sae cortado polos bordos. */
  const GROSO = Math.max(1, Math.round((caixa.y1 - caixa.y0 + 1)/ALT * 0.55));
  caixa = { x0: Math.max(0, caixa.x0-GROSO), y0: Math.max(0, caixa.y0-GROSO),
            x1: Math.min(RES-1, caixa.x1+GROSO), y1: Math.min(RES-1, caixa.y1+GROSO) };

  const fóra = {};
  const w = caixa.x1 - caixa.x0 + 1, h = caixa.y1 - caixa.y0 + 1;
  for(const c of cadros){
    const im = contornear(cru[c.nome], GROSO);
    const px = Buffer.alloc(w*h*4);
    for(let y = 0; y < h; y++)
      im.px.copy(px, y*w*4, ((y+caixa.y0)*im.ancho + caixa.x0)*4, ((y+caixa.y0)*im.ancho + caixa.x0 + w)*4);
    let rec = { ancho: w, alto: h, px };
    while(rec.alto > ALT*2) rec = reducir(rec, Math.max(1, rec.ancho >> 1), rec.alto >> 1);
    fóra[c.nome] = reducir(rec, Math.max(1, Math.round(rec.ancho * ALT / rec.alto)), ALT);
  }
  return fóra;
}

module.exports = { xerar, contornear, contornoDe, CARAS };
