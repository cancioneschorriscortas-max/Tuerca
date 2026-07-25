#!/usr/bin/env python3
"""Reensambla o HTML único de distribución desde index.html (fonte única de markup).
Uso: python3 build.py"""
import pathlib, re
ROOT = pathlib.Path(__file__).parent
FILES = ['config.js', '00-preambulo.js', '00b-i18n.js', '01-nucleo-datos.js', '01b-assets.js', '02-pvp-lobby.js', '03-pvp-sync.js', '04-progresion.js', '05-mapa-camara-neboa.js', '06-audio-voces.js', '06b-voz.js', '07-terreo-batalla.js', '08-social-narrativa.js', '09-economia-combate.js', '10-estructuras.js', '11-retratos-ui.js', '12-debrief-hangar.js', '13-mundial.js', '14-diario.js', '99-boot.js']
# encoding='utf-8' EXPLÍCITO en todo: en Windows o defecto de Python é a
# codepage ANSI (cp1252) e peta cos emojis dos botóns e cos acentos.
html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
js = '\n'.join((ROOT / 'js' / f).read_text(encoding='utf-8') for f in FILES)
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '</style>')
html = re.sub(r'(<script src="js/[^"]+"></script>\s*)+',
              lambda m: '<script>\n' + js + '\n</script>\n', html, count=1)
assert '<script src=' not in html, 'quedaron scripts externos sen absorber'
out = ROOT / 'dist/tuerca.html'
out.parent.mkdir(parents=True, exist_ok=True)   # dist/ está en .gitignore: pode non existir
out.write_text(html, encoding='utf-8', newline='\n')
import os
import shutil as _sh
_vsrc = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voces')
_vdst = os.path.join(os.path.dirname(os.path.abspath(out)), 'voces')
if os.path.isdir(_vsrc):
    if os.path.isdir(_vdst): _sh.rmtree(_vdst)
    _sh.copytree(_vsrc, _vdst)
    print(f'voces/ -> dist ({len(os.listdir(_vsrc))} entradas)')
print(f'OK -> {out} ({len(html)//1024} KB)')
