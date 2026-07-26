"""
TUERCA — ollada 3D ao modelo, para diagnosticar posicións.

NON é o pipeline de sprites: é un microscopio. Constrúe en Blender a
xeometría EXACTA que rasteriza vox3d.js (chegan os vértices xa posados
desde Node) e renderízaa grande, con luz decente e desde varios ángulos.

A 26 píxeles non se ve se unha arma está tres centímetros fóra da man.
A 600, si.

Uso (desde a raíz do repo):
  node tools/exportar3d.js GRUNT ANDAR 0.25 > capturas/modelo.json
  blender --background --python tools/blender_ollada.py -- capturas/modelo.json capturas/ollada.png
"""
import bpy, json, sys, math, os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ENTRADA = argv[0] if argv else 'capturas/modelo.json'
SAIDA   = os.path.abspath(argv[1] if len(argv) > 1 else 'capturas/ollada.png')
RES     = int(argv[2]) if len(argv) > 2 else 420

with open(ENTRADA, 'r', encoding='utf-8') as fh:
    M = json.load(fh)

# ---------- escena limpa ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene

# ---------- xeometría ----------
# Node traballa en Y-arriba e Z-fondo; Blender en Z-arriba e Y-fondo.
# Cámbianse os eixes ao construír para que "arriba" sexa arriba de verdade.
def a_blender(v):
    x, y, z = v
    return (x, z, y)

materiais = {}
def material(cor):
    clave = tuple(cor)
    if clave in materiais:
        return materiais[clave]
    m = bpy.data.materials.new(name='cor_%d_%d_%d' % clave)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    # sRGB -> lineal, que Blender traballa en lineal e se non sae lavado
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    bsdf.inputs['Base Color'].default_value = (lin(cor[0]), lin(cor[1]), lin(cor[2]), 1.0)
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Metallic'].default_value = 0.15
    materiais[clave] = m
    return m

caras = M['caras']
for i, pz in enumerate(M['pezas']):
    malla = bpy.data.meshes.new('peza%d' % i)
    malla.from_pydata([a_blender(v) for v in pz['verts']], [], [tuple(c) for c in caras])
    malla.update()
    ob = bpy.data.objects.new('peza%d' % i, malla)
    ob.data.materials.append(material(pz['cor']))
    escena.collection.objects.link(ob)

# Bisel moi pequeno en todas as pezas: as xunturas deixan de ser
# aristas matemáticas e collen luz. É o que un rasterizador de caras
# planas non pode dar, e o motivo real de traer Blender.
for ob in list(escena.collection.objects):
    if ob.type != 'MESH':
        continue
    mod = ob.modifiers.new(name='bisel', type='BEVEL')
    mod.width = 0.012
    mod.segments = 2
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(30)

# ---------- chan ----------
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -1.08))
chan = bpy.context.active_object
mchan = bpy.data.materials.new(name='chan')
mchan.use_nodes = True
mchan.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.06, 0.09, 0.03, 1)
mchan.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.95
chan.data.materials.append(mchan)

# ---------- luces ----------
# Clave desde arriba-esquerda-adiante, igual que LUZ en vox3d.js.
sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', type='SUN'))
sol.data.energy = 4.0
sol.data.angle = math.radians(12)      # sombras un chisco brandas
sol.rotation_euler = (math.radians(55), 0, math.radians(38))
escena.collection.objects.link(sol)

recheo = bpy.data.objects.new('recheo', bpy.data.lights.new('recheo', type='SUN'))
recheo.data.energy = 1.1
recheo.rotation_euler = (math.radians(70), 0, math.radians(-135))
escena.collection.objects.link(recheo)

mundo = bpy.data.worlds.new('mundo')
mundo.use_nodes = True
mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.10, 0.12, 0.14, 1)
mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
escena.world = mundo

# ---------- cámara ----------
cam_dato = bpy.data.cameras.new('cam')
cam_dato.type = 'ORTHO'
cam_dato.ortho_scale = 3.4
cam = bpy.data.objects.new('cam', cam_dato)
escena.collection.objects.link(cam)
escena.camera = cam

PITCH = 0.38   # o mesmo que usa vox3d.js

def situar(yaw):
    d = 8.0
    p = math.pi/2 - PITCH
    cam.location = (d*math.sin(p)*math.sin(yaw), -d*math.sin(p)*math.cos(yaw), d*math.cos(p))
    cam.rotation_euler = (p, 0, yaw)

# ---------- render ----------
# O nome do motor cambiou entre versións (EEVEE -> EEVEE_NEXT -> EEVEE).
# Colle o primeiro que exista en vez de dar por bo un nome concreto.
_motores = escena.bl_rna.properties['render'].fixed_type.properties['engine'].enum_items.keys()
for _m in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    if _m in _motores:
        escena.render.engine = _m
        break
print('MOTOR', escena.render.engine)
escena.render.resolution_x = RES
escena.render.resolution_y = RES
escena.render.film_transparent = False
try:
    escena.eevee.taa_render_samples = 64
    escena.eevee.use_gtao = True          # oclusión ambiental nas xunturas
except Exception:
    pass

VISTAS = [('fronte', 0.0), ('tres cuartos', -math.pi/4),
          ('perfil', -math.pi/2), ('costas', math.pi)]

tiras = []
for nome, yaw in VISTAS:
    situar(yaw)
    escena.render.filepath = SAIDA.replace('.png', '_%s.png' % nome.replace(' ', ''))
    bpy.ops.render.render(write_still=True)
    tiras.append(escena.render.filepath)
    print('OLLADA', nome, escena.render.filepath)

print('OK', M['clase'], M['estado'], 'fase', M['fase'])
