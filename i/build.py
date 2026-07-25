#!/usr/bin/env python3
"""Reensambla o HTML único de distribución desde index.html (fonte única de markup).
Uso: python3 build.py"""
import pathlib, re
ROOT = pathlib.Path(__file__).parent
FILES = ['config.js', '00-preambulo.js', '00b-i18n.js', '01-nucleo-datos.js', '01b-assets.js', '02-pvp-lobby.js', '03-pvp-sync.js', '04-progresion.js', '05-mapa-camara-neboa.js', '06-audio-voces.js', '06b-voz.js', '07-terreo-batalla.js', '08-social-narrativa.js', '09-economia-combate.js', '10-estructuras.js', '11-retratos-ui.js', '12-debrief-hangar.js', '13-mundial.js', '14-diario.js', '15-luz.js', '16-estado.js', '17-ambiente.js', '18-efectos.js', '99-boot.js']
# encoding='utf-8' EXPLÍCITO en todo: en Windows o defecto de Python é a
# codepage ANSI (cp1252) e peta cos emojis dos botóns e cos acentos.
html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
js = '\n'.join((ROOT / 'js' / f).read_text(encoding='utf-8') for f in FILES)
# As imaxes de interface NON se inlinan en base64: son texturas pesadas e
# medrarían un terzo ao codificar. Van soltas a dist/ui/, coma as voces.
# Ao meter o CSS dentro do HTML, as rutas pasan a ser relativas a dist/,
# así que '../ui/' deixa de valer e hai que deixalo en 'ui/'.
css = css.replace('../ui/', 'ui/')
# O manifesto de voces vai INLINE: é pequeno (JSON de rutas) e así o dist
# segue sendo autónomo e non fai nin unha petición para sabelo.
_man = ROOT / 'voces' / 'manifest.js'
_man_txt = _man.read_text(encoding='utf-8') if _man.exists() else 'window._VOCES_MANIFEST = {};'
html = re.sub(r'<script src="voces/manifest\.js"></script>',
              '<script>\n' + _man_txt + '</script>', html, count=1)
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
# Interface: só o que usa o CSS. As láminas de orixe e as pezas recortadas
# quedan fóra do que se publica — son material de traballo, non do xogo.
_UI_PUBLICAS = ['marco-panel.png', 'fondo_menu.png']
_usrc = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui')
_udst = os.path.join(os.path.dirname(os.path.abspath(out)), 'ui')
if os.path.isdir(_usrc):
    os.makedirs(_udst, exist_ok=True)
    _n = 0
    for _f in _UI_PUBLICAS:
        _o = os.path.join(_usrc, _f)
        if os.path.isfile(_o): _sh.copy2(_o, os.path.join(_udst, _f)); _n += 1
    _kb = sum(os.path.getsize(os.path.join(_udst, f)) for f in os.listdir(_udst)) // 1024
    print(f'ui/ -> dist ({_n} imaxes, {_kb} KB)')
print(f'OK -> {out} ({len(html)//1024} KB)')
