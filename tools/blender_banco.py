"""
TUERCA — pipeline de SPRITES en Blender.

Isto NON é blender_ollada.py. Aquel é un microscopio para diagnosticar;
este substitúe ao rasterizador propio (vox3d.js) e produce os sprites que
van ao xogo.

O que aporta sobre o rasterizador de caras planas:
  - bisel nas arestas, que collen luz e marcan as xunturas
  - oclusión ambiental nos recunchos
  - sombras propias (un brazo escurece o torso ao pasar por diante)
  - antialiasing de verdade ao reducir

O que NON fai, a propósito:
  - chan e sombra proxectada: iso xa o compón o xogo en js/15-luz.js.
    Se se cocese aquí, veríase dobre e non seguiría á luz da hora.
  - recorte e escalado ao tamaño final: faino Node, que xa ten o código
    e así todos os cadros dunha clase comparten encadre.

Cámara idéntica á de vox3d.js para que os sprites sexan intercambiables:
ortográfica, pitch 0.38, e o mesmo campo visible. O yaw leva media volta
porque a yaw 0 Blender mira desde o -Y, que é o lombo do modelo.

Uso:
  node tools/banco_blender.js --clase ENGINEER
"""
import bpy, json, sys, math, os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ENTRADA = argv[0]
DESTINO = os.path.abspath(argv[1])
RES     = int(argv[2]) if len(argv) > 2 else 256

with open(ENTRADA, 'r', encoding='utf-8') as fh:
    T = json.load(fh)

CARAS = [tuple(c) for c in T['caras']]
PITCH = T.get('pitch', 0.38)
# Mesmo campo visible que vox3d: o lenzo é alt*SS*2 píxeles e a escala
# alt*SS*0.42, así que entran 2/0.42 unidades de mundo. Se isto se
# desincroniza, os sprites de Blender saen de distinto tamaño cós outros.
ORTHO = T.get('ortho', 2.0 / 0.42)

bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene


def a_blender(v):
    """Node é Y-arriba / Z-fondo; Blender é Z-arriba / Y-fondo."""
    x, y, z = v
    return (x, z, y)


materiais = {}
# Cores que EMITEN en vez de reflectir. O visor é o detalle que fai
# lexible cara a onde mira a unidade a 22 píxeles, e como superficie
# iluminada normal apagábase en canto o robot se viraba da luz: xusto
# nas direccións nas que máis falla facía. Un robot ten o visor aceso.
LUMINOSAS = {tuple(c) for c in T.get('luminosas', [])}


def material(cor):
    clave = tuple(cor)
    if clave in materiais:
        return materiais[clave]
    m = bpy.data.materials.new(name='cor_%d_%d_%d' % clave)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']

    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    rgb = (lin(cor[0]), lin(cor[1]), lin(cor[2]), 1.0)
    bsdf.inputs['Base Color'].default_value = rgb
    bsdf.inputs['Roughness'].default_value = 0.52
    bsdf.inputs['Metallic'].default_value = 0.18
    if clave in LUMINOSAS:
        bsdf.inputs['Emission Color'].default_value = rgb
        bsdf.inputs['Emission Strength'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.0
    materiais[clave] = m
    return m


# ---------- luces ----------
# Mesma dirección que LUZ e RECHEO en vox3d.js, para que un sprite de
# Blender e un do rasterizador non se contradigan se conviven.
sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', type='SUN'))
sol.data.energy = 3.6
sol.data.angle = math.radians(9)
sol.rotation_euler = (math.radians(52), 0, math.radians(38))
escena.collection.objects.link(sol)

recheo = bpy.data.objects.new('recheo', bpy.data.lights.new('recheo', type='SUN'))
recheo.data.energy = 1.0
recheo.rotation_euler = (math.radians(72), 0, math.radians(-132))
escena.collection.objects.link(recheo)

mundo = bpy.data.worlds.new('mundo')
mundo.use_nodes = True
mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.16, 0.19, 0.22, 1)
mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
escena.world = mundo

# ---------- cámara ----------
cam_dato = bpy.data.cameras.new('cam')
cam_dato.type = 'ORTHO'
cam_dato.ortho_scale = ORTHO
cam = bpy.data.objects.new('cam', cam_dato)
escena.collection.objects.link(cam)
escena.camera = cam


def situar(yaw_node):
    # Media volta: a yaw 0 de Blender a cámara está no -Y, que mirando
    # desde Node é o -Z, é dicir as costas.
    # E o SIGNO invertido: movendo a cámara arredor do modelo vaise na
    # dirección contraria a xirar o modelo baixo unha cámara fixa, que é
    # o que fai vox3d. Sen isto os dous renderizadores dan o mesmo índice
    # para direccións opostas, e a regra L5 caza a discrepancia.
    yaw = math.pi - yaw_node
    d = 10.0
    p = math.pi / 2 - PITCH
    cam.location = (d * math.sin(p) * math.sin(yaw), -d * math.sin(p) * math.cos(yaw), d * math.cos(p))
    cam.rotation_euler = (p, 0, yaw)


# ---------- motor ----------
_motores = escena.bl_rna.properties['render'].fixed_type.properties['engine'].enum_items.keys()
for _m in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    if _m in _motores:
        escena.render.engine = _m
        break
escena.render.resolution_x = RES
escena.render.resolution_y = RES
escena.render.film_transparent = True      # o xogo pon o terreo detrás
try:
    escena.eevee.taa_render_samples = 64
    escena.eevee.use_gtao = True
    escena.eevee.gtao_distance = 0.35
except Exception:
    pass


def limpar_mallas():
    for ob in list(escena.collection.objects):
        if ob.type == 'MESH':
            bpy.data.objects.remove(ob, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)


def construir(pezas):
    for i, pz in enumerate(pezas):
        malla = bpy.data.meshes.new('p%d' % i)
        malla.from_pydata([a_blender(v) for v in pz['verts']], [], CARAS)
        malla.update()
        ob = bpy.data.objects.new('p%d' % i, malla)
        ob.data.materials.append(material(pz['cor']))
        escena.collection.objects.link(ob)
        mod = ob.modifiers.new(name='bisel', type='BEVEL')
        mod.width = 0.014
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(30)


feitos = []
for cadro in T['cadros']:
    limpar_mallas()
    construir(cadro['pezas'])
    situar(cadro['yaw'])
    ruta = os.path.join(DESTINO, cadro['nome'] + '.png')
    escena.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    feitos.append(cadro['nome'])
    print('CADRO', cadro['nome'])

print('FEITOS', len(feitos))
