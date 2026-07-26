/* ============================================================
   TUERCA — renderizador de caixas 3D a sprite 2D.

   Porte a Node de vox3d.py (Agarfal). Mesma técnica: proxección
   ortográfica, z-buffer, sombreado plano por cara segundo a
   normal, e SUPERMOSTRAXE — renderízase a 4-6× e redúcese por
   promediado de área. Iso último é o núcleo de todo: é o que dá
   os bordos suaves que o `drawRobot` de 16×18 nunca vai ter,
   porque se debuxa 1:1.

   Por que en Node e non en Python: nesta máquina non hai numpy
   nin PIL, así que o orixinal non corre. E de paso queda a porta
   aberta á opción B do documento de traspaso — xerar no arranque
   con paleta por equipo e libreas sen custo de tamaño.

   Sen dependencias: só tools/png.js, que tamén é caseiro.
   ============================================================ */

const PAL = {
  azul:    [74, 138, 216],
  vermello:[216, 74, 60],
  metal:   [150, 156, 166],
  escuro:  [58, 62, 70],
  ambar:   [200, 168, 50],
  laranxa: [226, 128, 52],
  ollo:    [150, 245, 245],
};

/* Dirección da luz, normalizada. Mesmos valores có orixinal. */
const LUZ = (() => { const v = [-0.45, -0.75, 0.48];
  const n = Math.hypot(...v); return v.map(x => x / n); })();
const AMB = 0.52, DIF = 0.62;
const CONTORNO = [14, 18, 10];

/* ---------- Álxebra ---------- */
function rot(eixe, a){
  const c = Math.cos(a), s = Math.sin(a);
  if(eixe === 'x') return [[1,0,0],[0,c,-s],[0,s,c]];
  if(eixe === 'y') return [[c,0,s],[0,1,0],[-s,0,c]];
  return [[c,-s,0],[s,c,0],[0,0,1]];
}
const mul = (A, B) => A.map(f => B[0].map((_, j) => f.reduce((s, v, k) => s + v * B[k][j], 0)));
const aplicar = (M, v) => [
  M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
  M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
  M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
];

/* Caras dun cubo: índices dos vértices e normal. Mesma orde que o
   orixinal, que depende de como se xeran os vértices abaixo. */
const CARAS = [
  [[0,1,3,2], [0,0,-1]], [[4,6,7,5], [0,0,1]], [[0,4,5,1], [0,-1,0]],
  [[2,3,7,6], [0,1,0]],  [[0,2,6,4], [-1,0,0]], [[1,5,7,3], [1,0,0]],
];

function caixaVerts(c, s){
  const [cx, cy, cz] = c, [sx, sy, sz] = s.map(v => v / 2);
  const out = [];
  for(const dz of [-1, 1]) for(const dy of [-1, 1]) for(const dx of [-1, 1]){
    out.push([cx + dx*sx, cy + dy*sy, cz + dz*sz]);
  }
  return out;
}

/* ---------- Modelo ---------- */
class Robot {
  constructor(){ this.pezas = []; }
  /* `xiros` é unha LISTA de rotacións {piv, ang, eixe} que se aplican en
     orde: primeiro a propia da peza, despois as dos seus pais. Iso é o
     que permite que unha arma colgue do brazo — sen encadeado, o brazo
     móvese e o artiluxio queda no aire. */
  caixa(centro, tam, cor, xiros = []){
    let v = caixaVerts(centro, tam);
    for(const x of (Array.isArray(xiros) ? xiros : [xiros])){
      if(!x || !x.piv || !x.ang) continue;
      const R = rot(x.eixe || 'x', x.ang);
      const p0 = x.piv;
      v = v.map(p => {
        const q = aplicar(R, [p[0]-p0[0], p[1]-p0[1], p[2]-p0[2]]);
        return [q[0]+p0[0], q[1]+p0[1], q[2]+p0[2]];
      });
    }
    this.pezas.push([v, PAL[cor] || PAL.azul]);
    return this;
  }
}

/* ---------- Rasterización ---------- */
function render(rb, W, H, escala, yaw = 0, pitch = 0.38){
  const M = mul(rot('x', pitch), rot('y', yaw));
  const zbuf = new Float64Array(W * H).fill(1e9);
  const col = new Float32Array(W * H * 3);
  const masc = new Uint8Array(W * H);

  for(const [verts, cor] of rb.pezas){
    const vv = verts.map(v => aplicar(M, v));
    for(const [idx, n] of CARAS){
      const nn = aplicar(M, n);
      if(nn[2] <= 0) continue;                    /* cara de atrás */
      const dot = nn[0]*LUZ[0] + nn[1]*LUZ[1] + nn[2]*LUZ[2];
      const luz = AMB + DIF * Math.max(0, dot);
      const c3 = [cor[0]*luz, cor[1]*luz, cor[2]*luz];
      const p = idx.map(i => vv[i]);
      const sx = p.map(q => q[0]*escala + W/2);
      const sy = p.map(q => -q[1]*escala + H*0.74);
      const sz = p.map(q => q[2]);

      for(const tri of [[0,1,2],[0,2,3]]){
        const x = tri.map(i => sx[i]), y = tri.map(i => sy[i]), z = tri.map(i => sz[i]);
        const x0 = Math.max(0, Math.floor(Math.min(...x)));
        const x1 = Math.min(W-1, Math.ceil(Math.max(...x)));
        const y0 = Math.max(0, Math.floor(Math.min(...y)));
        const y1 = Math.min(H-1, Math.ceil(Math.max(...y)));
        if(x1 < x0 || y1 < y0) continue;
        const d = (y[1]-y[2])*(x[0]-x[2]) + (x[2]-x[1])*(y[0]-y[2]);
        if(Math.abs(d) < 1e-9) continue;

        for(let py = y0; py <= y1; py++){
          for(let px = x0; px <= x1; px++){
            const fx = px + 0.5, fy = py + 0.5;
            const w0 = ((y[1]-y[2])*(fx-x[2]) + (x[2]-x[1])*(fy-y[2])) / d;
            const w1 = ((y[2]-y[0])*(fx-x[2]) + (x[0]-x[2])*(fy-y[2])) / d;
            const w2 = 1 - w0 - w1;
            if(w0 < 0 || w1 < 0 || w2 < 0) continue;
            const zz = w0*z[0] + w1*z[1] + w2*z[2];
            const i = py*W + px;
            /* Profundidade = -zz: gaña o que teña zz maior, que é o máis
               preto da cámara (mírase cara a +z). */
            if(-zz >= zbuf[i]) continue;
            zbuf[i] = -zz;
            col[i*3] = c3[0]; col[i*3+1] = c3[1]; col[i*3+2] = c3[2];
            masc[i] = 1;
          }
        }
      }
    }
  }
  return { col, masc, W, H };
}

/* Silueta escura por dilatación.
   OLLO: desprazamento CON RECHEO, non circular. Se se envolve polos
   bordos (o equivalente a np.roll) e o modelo toca o lenzo, o contorno
   reaparece no lado oposto. Esa mina xa está pisada no orixinal. */
function contornear({ col, masc, W, H }, g){
  const dil = new Uint8Array(masc);
  for(let dy = -g; dy <= g; dy++){
    for(let dx = -g; dx <= g; dx++){
      if(!dx && !dy) continue;
      for(let y = Math.max(0, dy); y < Math.min(H, H+dy); y++){
        for(let x = Math.max(0, dx); x < Math.min(W, W+dx); x++){
          if(masc[(y-dy)*W + (x-dx)]) dil[y*W + x] = 1;
        }
      }
    }
  }
  const out = new Float32Array(col);
  for(let i = 0; i < W*H; i++){
    if(dil[i] && !masc[i]){ out[i*3] = CONTORNO[0]; out[i*3+1] = CONTORNO[1]; out[i*3+2] = CONTORNO[2]; }
  }
  return { col: out, masc: dil, W, H };
}

/* ---------- Imaxe: recorte e redución ---------- */
function aRGBA({ col, masc, W, H }){
  const px = Buffer.alloc(W*H*4);
  for(let i = 0; i < W*H; i++){
    px[i*4]   = Math.max(0, Math.min(255, col[i*3]))   | 0;
    px[i*4+1] = Math.max(0, Math.min(255, col[i*3+1])) | 0;
    px[i*4+2] = Math.max(0, Math.min(255, col[i*3+2])) | 0;
    px[i*4+3] = masc[i] ? 255 : 0;
  }
  return { ancho: W, alto: H, px };
}

function recortar(im){
  let x0 = im.ancho, y0 = im.alto, x1 = -1, y1 = -1;
  for(let y = 0; y < im.alto; y++) for(let x = 0; x < im.ancho; x++){
    if(im.px[(y*im.ancho + x)*4 + 3]){
      if(x < x0) x0 = x; if(x > x1) x1 = x;
      if(y < y0) y0 = y; if(y > y1) y1 = y;
    }
  }
  if(x1 < 0) return im;
  const w = x1-x0+1, h = y1-y0+1;
  const px = Buffer.alloc(w*h*4);
  for(let y = 0; y < h; y++){
    im.px.copy(px, y*w*4, ((y+y0)*im.ancho + x0)*4, ((y+y0)*im.ancho + x0 + w)*4);
  }
  return { ancho: w, alto: h, px };
}

/* Promediado de área a un tamaño calquera. É a peza que fai a
   supermostraxe: sen isto o sprite sae con dentes. Promédiase en espazo
   PREMULTIPLICADO, ou os píxeles transparentes tinguen o bordo de negro. */
function reducir(im, w2, h2){
  const px = Buffer.alloc(w2*h2*4);
  const ex = im.ancho / w2, ey = im.alto / h2;
  for(let y = 0; y < h2; y++){
    const sy0 = y*ey, sy1 = (y+1)*ey;
    for(let x = 0; x < w2; x++){
      const sx0 = x*ex, sx1 = (x+1)*ex;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for(let sy = Math.floor(sy0); sy < Math.min(im.alto, Math.ceil(sy1)); sy++){
        for(let sx = Math.floor(sx0); sx < Math.min(im.ancho, Math.ceil(sx1)); sx++){
          const i = (sy*im.ancho + sx)*4, al = im.px[i+3]/255;
          r += im.px[i]*al; g += im.px[i+1]*al; b += im.px[i+2]*al;
          a += im.px[i+3]; n++;
        }
      }
      if(!n) continue;
      const o = (y*w2 + x)*4, am = a/n;
      px[o+3] = Math.round(am);
      if(am > 0){
        const k = n * (am/255);
        px[o] = Math.min(255, Math.round(r/k));
        px[o+1] = Math.min(255, Math.round(g/k));
        px[o+2] = Math.min(255, Math.round(b/k));
      }
    }
  }
  return { ancho: w2, alto: h2, px };
}

/* ---------- Sprite ---------- */
function sprite(rb, alt, yaw = 0, SS = 5){
  const W = alt*SS*2, H = alt*SS*2;
  let r = render(rb, W, H, alt*SS*0.42, yaw);
  r = contornear(r, Math.max(1, SS >> 1));
  let im = recortar(aRGBA(r));
  /* Redúcese por metades ata preto do destino e despois de golpe: igual
     có orixinal, e evita artefactos de saltar de 10× a 1× nun paso. */
  while(im.alto > alt*2) im = reducir(im, Math.max(1, im.ancho >> 1), im.alto >> 1);
  return reducir(im, Math.max(1, Math.round(im.ancho * alt / im.alto)), alt);
}

module.exports = { PAL, Robot, render, contornear, sprite, recortar, reducir, aRGBA, rot };
