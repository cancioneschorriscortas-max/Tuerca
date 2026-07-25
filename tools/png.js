/* ============================================================
   PNG mínimo en Node puro (só zlib, que xa vén de serie).

   Nesta máquina non hai Pillow, ImageMagick nin ffmpeg, e as
   láminas de interface hai que recortalas e quitarlles o fondo
   verde. Un PNG non é máis que scanlines desinfladas cun filtro
   por liña, así que sae máis a conta escribir isto que arrastrar
   unha dependencia — e é coherente co "cero dependencias" do
   resto do proxecto.

   Soporta o que fai falla aquí: ler cor tipo 2 (RGB) e 6 (RGBA)
   de 8 bits, e escribir RGBA de 8 bits.
   ============================================================ */
const fs = require('fs');
const zlib = require('zlib');

/* ---------- Lectura ---------- */
function ler(ruta) {
  const b = fs.readFileSync(ruta);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(ruta + ': non é un PNG');

  let ancho = 0, alto = 0, bits = 0, tipo = 0, entrelazado = 0;
  const trozos = [];
  let p = 8;
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const nome = b.toString('ascii', p + 4, p + 8);
    const datos = b.subarray(p + 8, p + 8 + len);
    if (nome === 'IHDR') {
      ancho = datos.readUInt32BE(0); alto = datos.readUInt32BE(4);
      bits = datos[8]; tipo = datos[9]; entrelazado = datos[12];
    } else if (nome === 'IDAT') trozos.push(datos);
    else if (nome === 'IEND') break;
    p += 12 + len;
  }
  if (bits !== 8) throw new Error('só se admiten 8 bits por canle (este ten ' + bits + ')');
  if (tipo !== 2 && tipo !== 6) throw new Error('só se admite RGB(2) ou RGBA(6); este é tipo ' + tipo);
  if (entrelazado) throw new Error('PNG entrelazado non admitido');

  const canles = tipo === 2 ? 3 : 4;
  const cru = zlib.inflateSync(Buffer.concat(trozos));
  const paso = ancho * canles;
  /* Saída sempre RGBA, para traballar cun só formato. */
  const px = Buffer.alloc(ancho * alto * 4);
  const liña = Buffer.alloc(paso);
  const anterior = Buffer.alloc(paso);

  let o = 0;
  for (let y = 0; y < alto; y++) {
    const filtro = cru[o++];
    cru.copy(liña, 0, o, o + paso);
    o += paso;
    /* Desfiltrado por liña (RFC 2083, apartado 6) */
    for (let i = 0; i < paso; i++) {
      const a = i >= canles ? liña[i - canles] : 0;   /* esquerda */
      const b2 = anterior[i];                          /* arriba */
      const c = i >= canles ? anterior[i - canles] : 0;/* diagonal */
      let v = liña[i];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b2;
      else if (filtro === 3) v += (a + b2) >> 1;
      else if (filtro === 4) {
        const pp = a + b2 - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b2), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b2 : c);
      }
      liña[i] = v & 0xff;
    }
    liña.copy(anterior);
    for (let x = 0; x < ancho; x++) {
      const s = x * canles, d = (y * ancho + x) * 4;
      px[d] = liña[s]; px[d + 1] = liña[s + 1]; px[d + 2] = liña[s + 2];
      px[d + 3] = canles === 4 ? liña[s + 3] : 255;
    }
  }
  return { ancho, alto, px };
}

/* ---------- Escritura (RGBA) ---------- */
function escribir(ruta, { ancho, alto, px }) {
  const cru = Buffer.alloc(alto * (ancho * 4 + 1));
  for (let y = 0; y < alto; y++) {
    cru[y * (ancho * 4 + 1)] = 0;   /* filtro 0: sen filtrar */
    px.copy(cru, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  const trozo = (nome, datos) => {
    const b = Buffer.alloc(8 + datos.length + 4);
    b.writeUInt32BE(datos.length, 0);
    b.write(nome, 4, 'ascii');
    datos.copy(b, 8);
    b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(nome, 'ascii'), datos])), 8 + datos.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(ruta, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(cru, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]));
}

let _tabla = null;
function crc32(buf) {
  if (!_tabla) {
    _tabla = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      _tabla[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = _tabla[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

module.exports = { ler, escribir };
