#!/usr/bin/env node
/* ============================================================
   OS FONDOS DAS PANTALLAS, listos para o xogo.

   En art/ están as imaxes grandes tal e como saíron: 1536 px e 2.5 MB
   cada unha. No xogo van de fondo detrás dun modal, así que non fai
   falla nin ese tamaño nin ese peso — pero SI fai falla que non se
   estraguen, e aí é onde isto se diferencia de tools/xerar_laminas.js.

   POR QUE JPEG E NON PNG, que é o que usa todo o demais:

   As láminas técnicas son liña sobre fondo plano e comprimen de marabilla
   como PNG indexado. Estas son fotográficas. Probouse o mesmo camiño e o
   resultado foi inmediato:

       cuantizada a 8 chanzos   145 KB  pero bandea nas zonas escuras
       desenfocada e escurecida 270 KB  e perde o que a fai boa
       JPEG 1100 px calidade 80 157 KB  sen bandeado e sen perder nada

   E ao revés tamén: unha lámina en JPEG sae MÁIS GRANDE (150 KB fronte
   a 135) e ademais mancha os bordos do texto. Cada tipo de imaxe co seu
   contedor; non hai un que gañe sempre.

   POR QUE POWERSHELL: non hai ffmpeg nin ImageMagick nin Pillow neste
   equipo, e o proxecto non ten dependencias. Pero Windows trae .NET e
   .NET trae un codificador JPEG. É a mesma idea que xa se fai con
   Blender en sprites_blender.js: usar o que hai instalado en vez de
   engadir unha dependencia.

   Uso: node tools/xerar_fondos.js [--ancho 1100] [--calidade 80]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const op = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i+1] : d; };
const ANCHO = parseInt(op('ancho', '1100'), 10);
const CALIDADE = parseInt(op('calidade', '80'), 10);

const ORIXE = path.join(RAIZ, 'art');
const DESTINO = path.join(RAIZ, 'i', 'ui');

if(!fs.existsSync(ORIXE)){
  console.log('\n  non hai art/ — nada que facer\n');
  process.exit(0);
}

/* De nome de ficheiro a nome de pantalla. Vaise polo nome e non por unha
   táboa para que engadir un fondo sexa deixar o PNG no cartafol:
   "FondoMemorialDosCaidos.png" -> "fondo_memorialdoscaidos.jpg". */
const traballos = [];
for(const f of fs.readdirSync(ORIXE)){
  const m = /^fondo(.+)\.png$/i.exec(f);
  if(!m) continue;
  /* Os mockups de interface quedan fóra: teñen nome de fondo pero non o
     son. fondoMundial_Ui_ref.png é un deseño de pantalla enteiro, non
     unha imaxe para poñer detrás dun modal. */
  if(/_?ui_?ref/i.test(f)) continue;
  traballos.push({ de: f, a: 'fondo_' + m[1].toLowerCase().replace(/[^a-z0-9]/g, '') + '.jpg' });
}

if(!traballos.length){
  console.log('\n  non se atopou ningún art/fondo*.png\n');
  process.exit(0);
}

/* O guión de PowerShell faise UNHA vez para todos: arrancar o intérprete
   custa máis que a conversión en si. */
const liñas = traballos.map(t =>
  `  ,@{de='${path.join(ORIXE, t.de).replace(/\\/g, '\\\\')}'; a='${path.join(DESTINO, t.a).replace(/\\/g, '\\\\')}'}`
).join('\n');

const guion = `
Add-Type -AssemblyName System.Drawing
$cod = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
if (-not $cod) { Write-Error 'sen codificador JPEG'; exit 1 }
$lista = @(
  $null
${liñas}
) | Where-Object { $_ -ne $null }
foreach ($t in $lista) {
  $img = [System.Drawing.Image]::FromFile($t.de)
  $anc = [Math]::Min(${ANCHO}, $img.Width)
  $alt = [int]($img.Height * $anc / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap $anc, $alt
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $anc, $alt)
  $g.Dispose()
  $ps = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]${CALIDADE})
  $bmp.Save($t.a, $cod, $ps)
  $kb = [int]((Get-Item $t.a).Length / 1KB)
  Write-Output ("    " + (Split-Path $t.a -Leaf).PadRight(30) + $anc + "x" + $alt + "   " + $kb + " KB")
  $ps.Dispose(); $bmp.Dispose(); $img.Dispose()
}
`;

fs.mkdirSync(DESTINO, { recursive: true });
console.log(`\n  ${traballos.length} fondos → ${ANCHO} px, JPEG calidade ${CALIDADE}\n`);
const saida = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', guion],
                           { encoding: 'utf8' });
process.stdout.write(saida);
const total = traballos.reduce((s, t) => {
  const f = path.join(DESTINO, t.a);
  return s + (fs.existsSync(f) ? fs.statSync(f).size : 0);
}, 0);
console.log(`\n  ${(total/1024/1024).toFixed(2)} MB en i/ui/  (cárganse só ao abrir esa pantalla)\n`);
