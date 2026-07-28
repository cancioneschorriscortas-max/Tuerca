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


def lin(c):
    """sRGB -> lineal. Blender traballa en lineal e se non sae lavado."""
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(cor):
    clave = tuple(cor)
    if clave in materiais:
        return materiais[clave]
    m = bpy.data.materials.new(name='cor_%d_%d_%d' % clave)
    m.use_nodes = True
    rgb = (lin(cor[0]), lin(cor[1]), lin(cor[2]), 1.0)

    # O visor vai sempre emisivo e sen chanzos: é un piloto aceso, non
    # unha superficie iluminada, e ten que valer en todas as direccións.
    if clave in LUMINOSAS or not TOON:
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = rgb
        bsdf.inputs['Roughness'].default_value = 0.52
        bsdf.inputs['Metallic'].default_value = 0.18
        if clave in LUMINOSAS:
            bsdf.inputs['Emission Color'].default_value = rgb
            # Con cel shading a luz frontal baixa a 0.45, e o visor —que
            # segue sendo material normal— perdía o difuso con ela. Sobe a
            # emisión para que o piloto siga acendido igual.
            bsdf.inputs['Emission Strength'].default_value = 1.05 if TOON else 0.55
            bsdf.inputs['Metallic'].default_value = 0.0
        materiais[clave] = m
        return m

    # --- cel shading ---
    # Difuso -> a cor resultante -> luminancia -> rampla de interpolación
    # CONSTANTE (de aí os chanzos duros) -> emisión, para que a vista non
    # a volva tocar. `Shader to RGB` só existe en EEVEE; é o motivo de
    # que este pipeline non poida usar Cycles.
    nt = m.node_tree
    nt.nodes.clear()
    dif = nt.nodes.new('ShaderNodeBsdfDiffuse')
    dif.inputs['Color'].default_value = (1, 1, 1, 1)   # a cor pona a rampla
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    emi = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')

    cr = ramp.color_ramp
    cr.interpolation = 'CONSTANT'
    chanzos = _CHANZOS.get(TOON, _CHANZOS[3])
    while len(cr.elements) > 1:
        cr.elements.remove(cr.elements[-1])
    for i, (pos, k) in enumerate(chanzos):
        el = cr.elements[0] if i == 0 else cr.elements.new(pos)
        el.position = pos
        el.color = (min(1.0, rgb[0]*k), min(1.0, rgb[1]*k), min(1.0, rgb[2]*k), 1.0)

    nt.links.new(dif.outputs['BSDF'], s2r.inputs['Shader'])
    nt.links.new(s2r.outputs['Color'], bw.inputs['Color'])
    nt.links.new(bw.outputs['Val'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], emi.inputs['Color'])
    nt.links.new(emi.outputs['Emission'], out.inputs['Surface'])
    materiais[clave] = m
    return m


# TOON: cantos chanzos de luz ten cada material. 0 desactívao e volve ao
# sombreado suave.
#
# Por que importa: o sprite final ten 22 píxeles, e chégase a el reducindo
# un render de 256. Cun sombreado suave, ese reducido promedia un
# degradado e inventa tons intermedios que despois hai que cuantizar, e a
# cuantización dun degradado deixa moteado nos bordos das zonas. Con
# chanzos, as zonas xa son planas ANTES de reducir: o promedio dunha zona
# plana é a propia cor, e só os bordos entre zonas mesturan.
#
# É a diferenza entre pintar e fotografar un obxecto pintado.
TOON = int(T.get('toon', 0))

# ---------- pase de PROFUNDIDADE ----------
# Para poder compoñer un robot a partir de pezas renderizadas por
# separado non abonda con apilalas ordenadas: as caixas dos modelos
# interpenétranse a propósito (a cabeza métese no torso) e a xeometría
# que se interpenetra non ten unha orde de pintado correcta. Medido en
# tools/proba_capas.js: ata un 15% de píxeles mal.
#
# A saída é que cada peza leve tamén a súa profundidade, e que ao
# xuntalas gañe o píxel máis próximo. Isto renderiza esa profundidade
# como cor: cada material substitúese por un que emite a distancia á
# cámara, normalizada ao rango [Z0, Z1] que a cámara ortográfica fixa.
#
# Faise cun material e non co compositor porque en modo sen cabeceira o
# nodo de saída de ficheiro engade numeración de fotograma aos nomes, e
# aquí interesa controlar exactamente onde vai cada imaxe.
PROFUNDIDADE = bool(T.get('profundidade', 0))
# SEN SOMBRAS: obrigatorio se as pezas se van renderizar por separado e
# compoñer despois. Unha peza soa non proxecta sombra sobre as veciñas
# nin comparte recunchos con elas, así que a sombra e a oclusión ambiental
# son xusto o que NON se pode reproducir compoñendo. Medido: coas sombras
# postas, compoñer erra ata un 12.7% dos píxeles, e todo o erro é de cor
# dentro da silueta (a silueta cadra ao píxel).
SEN_SOMBRAS = bool(T.get('sensombras', 0))
Z0, Z1 = T.get('zrango', [8.0, 12.0])


def material_profundidade():
    m = bpy.data.materials.get('_prof') or bpy.data.materials.new('_prof')
    if m.node_tree and len(m.node_tree.nodes) > 2:
        return m
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    cam = nt.nodes.new('ShaderNodeCameraData')
    mapa = nt.nodes.new('ShaderNodeMapRange')
    emi = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    mapa.inputs['From Min'].default_value = Z0
    mapa.inputs['From Max'].default_value = Z1
    # Invertido: 1 = preto, 0 = lonxe. Así o "máis próximo gaña" é
    # "o valor máis alto gaña", que é máis difícil de confundir.
    mapa.inputs['To Min'].default_value = 1.0
    mapa.inputs['To Max'].default_value = 0.0
    mapa.clamp = True
    nt.links.new(cam.outputs['View Z Depth'], mapa.inputs['Value'])
    nt.links.new(mapa.outputs['Result'], emi.inputs['Color'])
    nt.links.new(emi.outputs['Emission'], out.inputs['Surface'])
    return m
# Multiplicadores de cada chanzo sobre a cor base. O 1.0 é a cor da
# paleta tal cal, e ten que caer na banda máis ampla: é a que se ve.
_CHANZOS = {
    2: [(0.00, 0.58), (0.52, 1.00)],
    3: [(0.00, 0.52), (0.38, 1.00), (0.80, 1.30)],
    4: [(0.00, 0.46), (0.30, 0.74), (0.55, 1.00), (0.84, 1.32)],
}



# ---------- luces ----------
# Mesma dirección que LUZ e RECHEO en vox3d.js, para que un sprite de
# Blender e un do rasterizador non se contradigan se conviven.
sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', type='SUN'))
sol.data.energy = 3.4
sol.data.angle = math.radians(9)
sol.data.use_shadow = not SEN_SOMBRAS
sol.rotation_euler = (math.radians(52), 0, math.radians(38))
escena.collection.objects.link(sol)

recheo = bpy.data.objects.new('recheo', bpy.data.lights.new('recheo', type='SUN'))
recheo.data.energy = 0.9
recheo.data.use_shadow = not SEN_SOMBRAS
recheo.rotation_euler = (math.radians(72), 0, math.radians(-132))
escena.collection.objects.link(recheo)

# Luz FRONTAL, que viaxa coa cámara (aponse en situar()).
#
# Sen ela o sprite saía apagado, e non por falta de contraste: a cara
# máis iluminada chegaba a luminancia 212, por riba da paleta. O que
# estaba escuro era a cara de FRONTE, xusto a que máis superficie ocupa
# desde a cámara, que quedaba en 78 cando o azul do equipo é 130. A luz
# clave vén de arriba e a cámara mira case de fronte: entre as dúas non
# hai quen ilumine o que se ve.
#
# A arte clásica non ten este problema porque non está iluminada: píntase
# a cara frontal co ton base e ponse un realce arriba. Isto é o
# equivalente físico desa decisión.
#
# CON CEL SHADING case desaparece, e é importante entender por que. A
# frontal existía para CALIBRAR o brillo: subir a cara que mira á cámara
# ata a cor da paleta. Cos chanzos iso xa non fai falla, porque a rampla
# asigna a cor directamente — a banda central É a cor da paleta. E ademais
# estorba: iluminando por igual todo o que mira á cámara, mete case todo
# na mesma banda e o robot queda plano. Medido: 39 dos 51 píxeles do
# corpo nun só ton, e ese a 1.13 veces a paleta.
frontal = bpy.data.objects.new('frontal', bpy.data.lights.new('frontal', type='SUN'))
frontal.data.energy = 0.45 if TOON else 2.2
escena.collection.objects.link(frontal)

# ---------- transformación de vista ----------
# Blender vén con AgX, un mapeador fílmico que desatura e escurece a
# propósito para que un render pareza fotografía. Aquí é veneno: a
# paleta do xogo entra por un lado e sae apagada polo outro, e os
# sprites quedaban 35 puntos de luminancia por debaixo do debuxo
# clásico. Con Standard, o azul do equipo sae sendo o azul do equipo.
try:
    # 'Raw' no pase de profundidade: alí o valor do píxel É un número, non
    # unha cor, e non se lle pode aplicar ningunha curva.
    escena.view_settings.view_transform = 'Raw' if PROFUNDIDADE else 'Standard'
    escena.view_settings.look = 'None'
except Exception as e:
    print('AVISO: non se puido fixar a transformación de vista:', e)

mundo = bpy.data.worlds.new('mundo')
mundo.use_nodes = True
mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.16, 0.19, 0.22, 1)
mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
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
    # A frontal apunta igual que a cámara: un sol emite ao longo do seu
    # -Z, o mesmo eixe polo que mira unha cámara.
    frontal.rotation_euler = (p, 0, yaw)


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
    escena.eevee.use_gtao = not SEN_SOMBRAS
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


def construir(pezas, so_sombra=False):
    """so_sombra: a xeometría constrúese e proxecta sombra, pero non se
    ve. Serve para renderizar unha peza SOA sen perder as sombras que lle
    botan as veciñas — que é a única parte do aspecto que non sobrevive a
    compoñer por separado."""
    for i, pz in enumerate(pezas):
        malla = bpy.data.meshes.new('p%d' % i)
        malla.from_pydata([a_blender(v) for v in pz['verts']], [], CARAS)
        malla.update()
        ob = bpy.data.objects.new('p%d' % i, malla)
        ob.data.materials.append(material_profundidade() if PROFUNDIDADE else material(pz['cor']))
        escena.collection.objects.link(ob)
        if so_sombra:
            ob.visible_camera = False
        mod = ob.modifiers.new(name='bisel', type='BEVEL')
        mod.width = 0.014
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(30)


feitos = []
for cadro in T['cadros']:
    limpar_mallas()
    construir(cadro['pezas'])
    if cadro.get('sombra'):
        construir(cadro['sombra'], so_sombra=True)
    situar(cadro['yaw'])
    ruta = os.path.join(DESTINO, cadro['nome'] + '.png')
    escena.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    feitos.append(cadro['nome'])
    print('CADRO', cadro['nome'])

print('FEITOS', len(feitos))
