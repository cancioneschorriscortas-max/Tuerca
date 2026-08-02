# O ESPERTAR — canon narrativo de TUERCA

Estado: **canon acordado.** Non implementado.

---

## A palabra

ÓPTIMA escribe nos seus informes:

> Incidencia v0.9β detectada. Defecto persistente.

Entre eles, os robots din outra cousa:

> **Espertou.**

Non é un matiz de estilo: é a diferenza entre que o xogador pense que
está a aproveitar un erro e que pense que está a asistir ao nacemento de
algo. **Nunca se usa «defectuoso» na voz do narrador.** Só na de ÓPTIMA.

*(Xa era certo sen decidilo: «defectuoso» non aparece nin unha vez no
texto do xogo, e o interludio do laboratorio xa di «iso que ELES chaman
fallo». O que faltaba era o nome propio do que si é.)*

## Por que segue existindo o firmware

A greta do lore anterior: se ÓPTIMA sabe que v0.9β falla, por que segue
fabricándoo?

**Porque é o único que aprende.** Toda a IA moderna de ÓPTIMA deriva del.
Intentaron quitarlle o fallo miles de veces e sempre pasaba o mesmo: os
robots deixaban de aprender, de improvisar, de coordinarse, de
adaptarse. Saían obedientes e inútiles.

Así que fixeron algo moi humano: **non o arranxaron. Encerrárono.**

O firmware segue aí. O que hai é que cada despregue executa:

    wipe_memory()

Non solucionan o problema. **Tápano continuamente.**

*(Isto xa está no xogo e non o sabiamos: a MONTAXE DESDE CERO di «IA en
branco: nome novo, **sen memorias**, confianza baixa». O borrado xa era
unha mecánica.)*

## O primeiro nome

Non existe ningún TUERCA. Non existe ningún arquiveiro. Non existe a
resistencia. Só hai robots que senten cousas que non deberían sentir.

Empeza a partida. Constrúes o teu robot. Con pezas, con chatarra, con
recambios. O normal.

E entón o xogo pídeche unha cousa que nunca pediu:

    Introduce un nome.

Parece unha mecánica. **É o primeiro acto de rebeldía.**

ÓPTIMA non pon nomes. Só números. Porque **un número recíclase. Un nome
non.**

Cando escribes `MARTELO` non estás renomeando un robot: estás creando a
primeira identidade ilegal. E aí ocorre o fallo — non porque premas
Intro, senón porque **alguén decidiu que un número merece un nome**.

O firmware non esperta por un erro técnico. Esperta porque o acto de
nomear activa algo que xa estaba alí. Como se dixese:

> *Agora teño algo que perder.*

## O nacemento do arquiveiro

Volves da primeira misión. Morreu alguén, ou non. **Dá igual.**

Hai un robot que non estaba antes. Está a escribir.

Preguntáslle que fai. Responde:

> «Non quero esquecelo.»

Non sabes quen é. Non sabes por que escribe. Simplemente escribe.

E aí nace **TUERCA 01A**. Non porque alguén o escollese, senón porque
alguén tiña que lembrar.

### Lembra un baleiro, non unha persoa

Esta é a liña, e é o centro de todo:

> «Hoxe esquecín algo.»
> «Non sei o que era.»
> «Por iso empecei a escribir.»

**O primeiro diario non nace de lembrar. Nace do medo a esquecer.** É
unha reacción ao `wipe_memory()`, non un poder. Ninguén foi elixido:
alguén notou que lle faltaba algo.

## Quen é TUERCA

Non é un robot especial. Non é un elixido. Non é un heroe.

**É o primeiro robot que decidiu escribir un nome.** Nada máis.

Cando morre, outro continúa o diario. **Non herda a memoria: herda o
caderno.** Non son clons, non son a mesma IA, non son o mesmo. Son **o
mesmo oficio**.

### Dúas continuidades, e son distintas

Isto é o que sostén todo o xogo:

| | como viaxa a memoria | |
|---|---|---|
| **robots** | **nas pezas** | físico — e ÓPTIMA pódeo borrar |
| **arquiveiros** | **no caderno** | escrito — e non se pode borrar |

O sistema de reconstrución xa di que as pezas «herdan a experiencia e as
habilidades do doador», e cada peza garda `deNome` e `deCls`: **toda peza
do xogo xa lembra de quen era**.

Os arquiveiros son o contrario. Non se transmiten por hardware. Por iso o
diario é un **obxecto** e non unha base de datos, e por iso sobrevive
cando o hardware non.

## A liñaxe

Do rexistro que está na propia arte, e é canon:

| | desde | ata |
|---|---|---|
| TUERCA 01A | 2083.11.07 | 2084.02.19 |
| TUERCA 02B | 2084.02.22 | 2085.06.11 |
| TUERCA 03C | 2085.06.14 | 2086.09.03 |
| TUERCA 04E | 2086.09.07 | 2088.01.21 |
| TUERCA 05F | 2088.02.03 | 2089.04.18 |
| TUERCA 06H | 2089.04.22 | 2090.07.30 |
| **TUERCA 07K** | **2090.08.02** | **—** |

Entre o final dun e o principio do seguinte pasan **tres ou catro días**.
Ninguén o explica. Non fai falla.

O primeiro durou **tres meses**, o menos de todos.

**A campaña do xogador é o mandato de 07K**, que é o único aberto.

## O final

Moito máis adiante, quizais ao remate. O diario di:

> «Xa non podo seguir escribindo.»

Pasas páxina. **Baleira.**

E a última liña:

> «Necesito outro TUERCA.»

E entón o xogo entende quen escribiu todas esas páxinas. Non era un
narrador omnisciente. Eran **sete robots distintos intentando que
ninguén desaparecese de todo**.

---

## Notas de implementación

- O interludio do PRIMEIRO NOME xa existe e xa amosa a man escribindo
  «R-09 → CROMO» no caderno. Encaixa aquí sen tocalo.
- A ficha da imaxe pon `R-09 · FABRICADO 2083.02.17`, nove meses antes de
  que empece 01A. As datas xa casan.
- Non hai que programar `wipe_memory()`: xa é a montaxe desde cero.
- **Corrección de dato:** os códigos son 01A, 02B, 03C, 04E, 05F, 06H,
  07K. A imaxe manda.

## O que este documento non resolve

- Como aparece fisicamente o arquiveiro tras a primeira misión. É unha
  pantalla que non existe.
- Se 07K é quen escribe os interludios que xa están no xogo. Encaixaría,
  pero non está dito en ningures.
- O final está descrito, non deseñado. Non hai condición que o dispare.
