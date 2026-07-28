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

/* ============================================================
   ENDURECER — de render 3D a arte de píxel.

   Un render reducido de 256 a 22 píxeles trae 130 tons e 78 valores de
   alfa nun sprite de 17×22. A arte do xogo usa cinco ou seis tons e
   bordo opaco. Por iso os sprites de Blender saían brandos ao lado do
   debuxo procedural: non era o escalado do lenzo, eran os propios
   píxeles, que nacían medio transparentes e medio mesturados.

   Dúas operacións, as dúas necesarias:
     - o alfa pasa a ser todo ou nada, para que a silueta teña bordo
     - as cores redúcense a poucos chanzos, que é o que fai que se lea
       como debuxo e non como fotografía diminuta
   ============================================================ */
/* O contraste sepárase da cuantización a propósito: primeiro ábrese o
   rango, despois cuantízase. Ao revés os tons xa colapsaron e estirar
   non recupera nada — só separa os poucos chanzos que quedasen.

   O pivote non é 128 senón a luminancia MEDIA das pezas do corpo: un
   robot azul vive por debaixo do medio da escala, e pivotar en 128
   escurecíao enteiro en vez de abrir a diferenza entre luz e sombra. */
/* niveis = 0 -> NON se cuantiza a cor, só se endurece o alfa.
   É o que hai que usar co cel shading, e o motivo é que se non se
   cuantiza DÚAS veces: a rampla xa deixa as cores exactas da paleta, e
   volver recortalas a seis chanzos por canle lévaas a outro sitio. O
   azul do equipo (74,138,216) acababa en (153,153,204), un lavanda
   pálido — e iso era o que se vía no mapa. */
function endurecer(s, niveis, gañancia){
  const paso = niveis > 1 ? 255/(niveis - 1) : 0;
  const k = gañancia || 1;
  let suma = 0, n = 0;
  for(let i = 0; i < s.ancho*s.alto; i++){
    const o = i*4;
    if(s.px[o+3] < 110) continue;
    suma += 0.2126*s.px[o] + 0.7152*s.px[o+1] + 0.0722*s.px[o+2];
    n++;
  }
  const piv = n ? suma/n : 128;
  const px = Buffer.from(s.px);
  for(let i = 0; i < s.ancho*s.alto; i++){
    const o = i*4;
    if(px[o+3] < 110){ px[o] = px[o+1] = px[o+2] = px[o+3] = 0; continue; }
    px[o+3] = 255;
    /* A ganancia vai sobre a LUMINANCIA e despois escálanse as tres
       canles polo mesmo factor. Aplicándoa canle a canle, o vermello dun
       azul (que xa é baixo) cae por debaixo de cero e recórtase: o
       resultado non era máis contrastado, era outro ton. Así só cambia
       o brillo e a cor do equipo mantense. */
    const l = 0.2126*px[o] + 0.7152*px[o+1] + 0.0722*px[o+2];
    const f = l > 1 ? Math.max(0, piv + (l - piv)*k) / l : 1;
    for(let c = 0; c < 3; c++){
      const v = px[o+c]*f;
      px[o+c] = Math.max(0, Math.min(255, paso ? Math.round(Math.round(v/paso)*paso) : Math.round(v)));
    }
  }
  return { ancho: s.ancho, alto: s.alto, px };
}

/* ============================================================
   PALETA DO CEL SHADING.

   Cunha rampla de chanzos sábese EXACTAMENTE que cores pode dar o
   render: cada entrada da paleta multiplicada por cada chanzo. Así que
   en vez de cuantizar a unha grella uniforme —que non pasa polas cores
   da paleta e converteu o azul do equipo nun lavanda— axústase cada
   píxel á cor máis próxima desa lista.

   É a diferenza entre redondear e escoller. Redondeando, (74,138,216)
   ía parar a (153,153,204); escollendo, queda en (74,138,216).
   ============================================================ */
const _CHANZOS_CEL = { 2: [0.58, 1.00], 3: [0.52, 1.00, 1.30], 4: [0.46, 0.74, 1.00, 1.32] };

function paletaCel(toon){
  const ks = _CHANZOS_CEL[toon] || _CHANZOS_CEL[3];
  const fóra = [[12, 14, 12]];                 /* o contorno */
  for(const base of Object.values(PAL))
    for(const k of ks)
      fóra.push(base.map(v => Math.max(0, Math.min(255, Math.round(v*k)))));
  return fóra;
}

function axustarAPaleta(s, paleta){
  const px = Buffer.from(s.px);
  const cache = new Map();
  for(let i = 0; i < s.ancho*s.alto; i++){
    const o = i*4;
    if(px[o+3] < 110) continue;
    const clave = (px[o] << 16) | (px[o+1] << 8) | px[o+2];
    let mellor = cache.get(clave);
    if(!mellor){
      let d = Infinity;
      for(const c of paleta){
        const q = (c[0]-px[o])**2 + (c[1]-px[o+1])**2 + (c[2]-px[o+2])**2;
        if(q < d){ d = q; mellor = c; }
      }
      cache.set(clave, mellor);
    }
    px[o] = mellor[0]; px[o+1] = mellor[1]; px[o+2] = mellor[2];
  }
  return { ancho: s.ancho, alto: s.alto, px };
}

/* cadros: [{nome, estado, fase, yaw}]  ->  {nome: {ancho,alto,px}} */
function xerar(clase, cadros, opc = {}){
  const ALT = opc.alt || 22, RES = opc.res || 256;
  const tmp = opc.tmp || path.join(__dirname, '..', 'capturas', '_blender', clase);
  fs.mkdirSync(tmp, { recursive: true });

  /* opc.cor tinxe as pezas de equipo (azul / vermello / metal). Vai aquí e
     non nun paso de recolorado posterior porque montar() xa o sabe facer,
     e así o sombreado de Blender calcúlase sobre a cor final en vez de
     tinxir un gris xa iluminado. */
  const traballo = cadros.map(c => ({
    nome: c.nome, yaw: c.yaw,
    pezas: montar(clase, c.estado, c.fase, opc.cor).pezas.map(([verts, cor]) => ({ verts, cor })),
  }));
  const entrada = path.join(tmp, 'traballo.json');
  fs.writeFileSync(entrada, JSON.stringify({ caras: CARAS, cadros: traballo, luminosas: [PAL.ollo], toon: opc.toon || 0 }), 'utf8');

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
  /* O encadre pódese impoñer desde fóra. Fai falla para o xerador de
     PEZAS: se cada peza se recorta polo seu propio contorno, ao apilalas
     cada unha vén cun encadre distinto e xa non cadran. Cun encadre
     común, apilar é debuxar unha enriba doutra. */
  const caixaPropia = caixa;
  if(opc.caixaFixa) caixa = { ...opc.caixaFixa };
  /* O grosor mídese sobre a escala FINAL, non sobre a do render. E o
     encadre medra ese mesmo grosor, ou o contorno sae cortado polos bordos. */
  /* Un píxel final COMPLETO. A 0.55 o contorno cubría media cela, e o
     limiar de alfa do endurecido borrábao: quedaban os sprites sen liña
     escura, que é o que os facía perder contra o debuxo procedural. */
  const GROSO = opc.groso || Math.max(1, Math.round((caixa.y1 - caixa.y0 + 1)/ALT));
  if(!opc.caixaFixa) caixa = { x0: Math.max(0, caixa.x0-GROSO), y0: Math.max(0, caixa.y0-GROSO),
            x1: Math.min(RES-1, caixa.x1+GROSO), y1: Math.min(RES-1, caixa.y1+GROSO) };

  const fóra = {};
  Object.defineProperty(fóra, 'caixa', { value: caixaPropia, enumerable: false });
  const w = caixa.x1 - caixa.x0 + 1, h = caixa.y1 - caixa.y0 + 1;
  for(const c of cadros){
    const im = contornear(cru[c.nome], GROSO);
    const px = Buffer.alloc(w*h*4);
    for(let y = 0; y < h; y++)
      im.px.copy(px, y*w*4, ((y+caixa.y0)*im.ancho + caixa.x0)*4, ((y+caixa.y0)*im.ancho + caixa.x0 + w)*4);
    let rec = { ancho: w, alto: h, px };
    while(rec.alto > ALT*2) rec = reducir(rec, Math.max(1, rec.ancho >> 1), rec.alto >> 1);
    const fin = reducir(rec, Math.max(1, Math.round(rec.ancho * ALT / rec.alto)), ALT);
    const nv = opc.niveis !== undefined ? opc.niveis : (opc.toon ? 0 : 6);
    const duro = opc.brando ? fin : endurecer(fin, nv, opc.contraste || 1);
    fóra[c.nome] = (opc.toon && !opc.brando) ? axustarAPaleta(duro, paletaCel(opc.toon)) : duro;
  }
  return fóra;
}

module.exports = { xerar, endurecer, axustarAPaleta, paletaCel, contornear, contornoDe, CARAS };
