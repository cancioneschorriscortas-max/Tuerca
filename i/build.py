#!/usr/bin/env python3
"""Reensambla o HTML único de distribución desde index.html (fonte única de markup).
Uso: python3 build.py"""
import pathlib, re
ROOT = pathlib.Path(__file__).parent
# encoding='utf-8' EXPLÍCITO en todo: en Windows o defecto de Python é a
# codepage ANSI (cp1252) e peta cos emojis dos botóns e cos acentos.
html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css/style.css').read_text(encoding='utf-8')

# A lista de scripts LESE do index.html, non se escribe aquí.
#
# Antes estaba duplicada nunha constante, e pasou o que tiña que pasar:
# engadíronse dous ficheiros ao index e non á constante. Como o paso de
# absorción borra TODAS as etiquetas <script src="js/..."> e as substitúe
# polo paquete desta lista, os dous novos desapareceron sen erro ningún —
# a aserción de abaixo seguía contenta porque non quedaba ningún script
# externo. O dist saía sen eles e servido funcionaba, que é o peor xeito
# de fallar. Cunha soa fonte iso xa non pode pasar.
FILES = re.findall(r'<script src="js/([^"]+)"></script>', html)
assert FILES, 'o index.html non declara ningún script en js/'
_falta = [f for f in FILES if not (ROOT / 'js' / f).exists()]
assert not _falta, 'o index.html referencia ficheiros que non existen: %s' % _falta
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
# Interface: só o que usa o xogo. O resto de ui/ —as láminas de orixe, as
# pezas recortadas— queda fóra: é material de traballo.
#
# lamina_<CLASE>.png e fondo_<PANTALLA>.jpg SI entran: as láminas que
# amosa a ficha dunha unidade e os fondos das pantallas, xerados por
# tools/xerar_laminas.js e tools/xerar_fondos.js. Van por PATRÓN e non
# por nome para que engadir unha clase ou unha pantalla non pida tocar
# isto — que xa foi fonte de dous fallos, un aquí e outro no ignore de
# firebase.json, os dous invisibles desde local.
# fondo_menu vai en JPEG: son 2093 KB como PNG e 213 como JPEG, e é o
# activo máis pesado do xogo (cárgase en cada visita á portada). O marco
# queda en PNG: son 19 KB e é un bordo de interface, onde os artefactos
# de JPEG si se notarían.
_UI_PUBLICAS = ['marco-panel.png', 'fondo_menu.jpg']
_UI_PATRONS = ['lamina_', 'fondo_', 'retrato_']
_usrc = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui')
_udst = os.path.join(os.path.dirname(os.path.abspath(out)), 'ui')
if os.path.isdir(_usrc):
    # Límpase antes de copiar, coma voces/. Sen isto dist/ui/ acumula
    # ficheiros mortos: ao pasar fondo_menu de PNG a JPEG quedaban os
    # dous, e o vello seguía pesando 2 MB no que se publica.
    if os.path.isdir(_udst): _sh.rmtree(_udst)
    os.makedirs(_udst, exist_ok=True)
    _n = 0
    # dict.fromkeys: fondo_menu.jpg está na lista E casa co patrón, e
    # sen isto copiaríase dúas veces e o reconto mentiría
    _lista = list(dict.fromkeys(list(_UI_PUBLICAS) + sorted(
        f for f in os.listdir(_usrc)
        if any(f.startswith(pre) for pre in _UI_PATRONS)
        and (f.endswith('.png') or f.endswith('.jpg')))))
    for _f in _lista:
        _o = os.path.join(_usrc, _f)
        if os.path.isfile(_o): _sh.copy2(_o, os.path.join(_udst, _f)); _n += 1
    _kb = sum(os.path.getsize(os.path.join(_udst, f)) for f in os.listdir(_udst)) // 1024
    print(f'ui/ -> dist ({_n} imaxes, {_kb} KB)')
print(f'OK -> {out} ({len(html)//1024} KB)')
