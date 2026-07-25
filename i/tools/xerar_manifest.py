#!/usr/bin/env python3
"""Escanea voces/<lingua>/*.ogg e xera voces/manifest.json.
O manifesto é O REGULADOR: clave con ficheiro → voz humana; sen el → chío/silencio.
Uso: python3 tools/xerar_manifest.py   (desde a raíz do proxecto)"""
import json, os, sys

RAIZ = os.path.join(os.path.dirname(__file__), '..', 'voces')
manifest = {}
for lingua in ('gl', 'es', 'en'):
    d = os.path.join(RAIZ, lingua)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if not f.endswith('.ogg'): continue
        clave = f[:-4]                      # r.baseAtaque.ogg → r.baseAtaque
        manifest.setdefault(clave, {})[lingua] = f"voces/{lingua}/{f}"
out = os.path.join(RAIZ, 'manifest.json')
# encoding='utf-8' EXPLÍCITO, e ficheiro pechado como é debido: en Windows o
# defecto de Python é a codepage ANSI (cp1252) e as rutas con acentos
# corromperíanse. Mesmo fallo que tiña build.py.
with open(out, 'w', encoding='utf-8', newline='\n') as fh:
    json.dump(manifest, fh, indent=1, ensure_ascii=False)
# Sen frechas nin puntos medios no que se imprime: a consola de Windows vai
# en cp1252 e petaba aquí mesmo, DESPOIS de escribir o manifesto (así que
# parecía que fallara todo cando en realidade xa estaba feito).
print(f"manifest: {len(manifest)} claves -> {out}")
for k in sorted(manifest):
    print('  ', k, '-', '/'.join(manifest[k].keys()))
if not manifest:
    print('  (baleiro: non hai .ogg en voces/gl, voces/es nin voces/en)')
