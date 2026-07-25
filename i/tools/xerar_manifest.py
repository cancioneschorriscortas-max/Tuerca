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
json.dump(manifest, open(out, 'w'), indent=1, ensure_ascii=False)
print(f"manifest: {len(manifest)} claves → {out}")
for k in sorted(manifest): print(' ', k, '·', '/'.join(manifest[k].keys()))
