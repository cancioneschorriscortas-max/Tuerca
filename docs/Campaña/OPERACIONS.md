# TUERCA — as vinte operacións
## Deseño xogable do modo campaña · v2

Este documento non repite a narrativa. `TUERCA_documento_narrativo_v1.md`
di **de que trata** cada momento; isto di **que fai o xogador**, **con que
se dispara** e **que se oe**. Onde os dous discrepen, manda o narrativo.

---

## 0 · O que cambiou desde a v1, e por que

A v1 tiña vinte operacións e **trece delas gañábanse polo mesmo**: máis
sectores ca o rival, ou tirarlle a base. Iso non é unha campaña. É a
escaramuza do modo libre repetida trece veces con outro texto por riba, e
o texto non salva unha estrutura que non cambia.

O aviso foi do dono e é o correcto: nunha campaña de RTS non tes que
derrotar sempre unha segunda base. Liberas tropas atrapadas que despois
te axudan a avanzar. Reparas material abandonado e pasa a loitar contigo.
Sacas a alguén de alí. **A segunda base é un accesorio do modo
escaramuza, non da campaña.**

Isto encaixa co que TUERCA xa é: o filtro do proxecto di que unha
mecánica só entra se axuda a lembrar unha unidade despois de varias
partidas. Un HQ derrubado non se lembra. Unha unidade que liberaches na
operación 7 e che segue viva na 19, si.

**Na campaña non hai ningunha base inimiga. Cero de vinte.**

A v2 aínda deixaba tres, con tres xustificacións narrativas —«a primeira
ensina o que é unha base», «VOLT ten unha porque é o espello»—. Iso non é
deseño: é conservar a escaramuza e buscarlle desculpa despois. Ningunha
das tres resistía a pregunta de que aportaba que non aportase outro
obxectivo, así que fóra as tres.

O HQ inimigo é a condición de vitoria **do modo libre**. A campaña son
entradas en instalacións de ÓPTIMA, e nunha instalación non hai nada que
«derrubar para gañar»: hai algo que sacar, alguén que erguer, ou algo que
parar.

---

## 1 · Que é unha operación sen segunda base

Isto é o que hai que ter claro antes de tocar código, porque cambia o
ritmo enteiro.

**O inimigo deixa de ser un rival e pasa a ser unha GARNICIÓN.** Non
produce, non se reforza soa, non ten cola. Está a que está: repartida
polas salas, e cada unha que cae xa non volve. Iso ten tres
consecuencias que hai que querer:

- **A operación baixa de intensidade segundo avanza**, ao revés que unha
  escaramuza. É correcto: as operacións da campaña son entradas, non
  batallas campais.
- **Non se pode gañar por atrición**, porque non hai produción que
  afogar. Gáñase facendo a cousa que pide a operación.
- **O fracaso xa non é "perdeu a base"**. É quedar sen ninguén, ou perder
  o que viñeches buscar. E iso *pode ser peor*, que é o que se quere.

**O reforzo pasa a estar SCRIPTADO.** En vez dunha IA que produce, hai
gatillos: ao abrir a porta do fondo saen tres; aos catro minutos chega
unha patrulla pola doca. Iso é o que fai que unha planta escrita se poida
deseñar. Cunha IA que fabrica, a mesma planta xógase igual sempre; con
reforzos postos, a planta ten guión.

### O que hai que tocar no motor

**A condición de vitoria É o obxectivo da misión.** Non hai unha por
defecto coa que comparar; cada operación declara a súa e o motor
pregúntalla.

Hoxe `checkVictory` (10-estructuras.js:546) é literalmente
`if(g.hq[ET].hp<=0) vitoria; else if(g.hq[PT].hp<=0) derrota;`. Iso non é
«a regra do xogo»: é **a regra do modo libre**, escrita no sitio onde
tiña que haber unha pregunta.

O arranxo non é engadirlle un desvío por diante. É darlle a volta:

```js
/* Cada modo trae a súa condición. A do HQ deixa de ser o caso xeral e
   pasa a ser unha máis, coa mesma forma que todas as outras. */
const CONDICIONS = {
  BASE:        (g) => g.hq[ET].hp <= 0 ? 'victory' : null,
  RESCATE:     (g) => g.rescatados >= g.obxectivo.n ? 'victory' : null,
  REPARACION:  (g) => g.reparados  >= g.obxectivo.n ? 'victory' : null,
  EXTRACCION:  (g) => g.extraidos  >= g.obxectivo.n ? 'victory' : null,
  SABOTAXE:    (g) => g.sabotados  >= g.obxectivo.n ? 'victory' : null,
  DEFENSA:     (g) => g.t >= g.obxectivo.ata ? 'victory' : null,
  ESCOLTA:     (g) => g.escolta && g.escolta.chegou ? 'victory' : null,
  OLEADAS:     (g) => g._wave > g.obxectivo.n ? 'victory' : null,
};

function tickEnd(g){
  if(g.over) return;
  const cond = CONDICIONS[g.obxectivo.tipo];
  const r = cond(g) || derrotaComun(g);
  if(r){ g.over = true; g.result = r; }
  ...
}

/* A derrota é o único que si é común a todo, e nin sequera sempre: */
function derrotaComun(g){
  if(!g.units.some(u => u.team === PT && !u.dead)) return 'defeat';
  if(g.obxectivo.perdeSe && g.obxectivo.perdeSe(g)) return 'defeat';
  return null;
}
```

O modo libre pasa a declarar `{tipo:'BASE'}` e non se entera de nada. E
`g.hq[ET]` deixa de existir nas vinte operacións, o que apaga de camiño a
produción inimiga (`g.prod[ET] = null`, coma no Crisol) e os reforzos
automáticos: o que chega, chega porque o pon un gatillo.

---

## 2 · Vocabulario

### Obxectivos

Sete, e a columna da dereita é o que importa: cantas veces aparece.

| Obxectivo | Como se gaña | Veces na campaña |
|---|---|---|
| `RESCATE` | Reactivar N unidades inertes; pasan ao teu control | 5 |
| `REPARACIÓN` | Poñer en pé material caído; loita contigo o resto | 3 |
| `EXTRACCIÓN` | Levar N unidades ou pezas ao punto de saída | 5 |
| `ESCOLTA` | Que alguén que non combate chegue vivo a un sitio | 2 |
| `SABOTAXE` | Parar ou tirar N estruturas concretas | 3 |
| `DEFENSA` | Aguantar N segundos | 2 |
| `OLEADAS` | Sobrevivir 5 oleadas (Crisol) | 1 |
| `BASE` | Tirar o HQ inimigo | **0** — é a do modo libre |

**RESCATE e REPARACIÓN son a mesma peza con dúas caras**, e é a peza que
pediches:

- **RESCATE**: unha unidade `team: 2`, `inerte: true`, non se move e non
  dispara. Un ENGINEER a menos de 20 px durante 3 segundos actívaa e
  pasa a `team: PT`. Desde ese momento é unha unidade túa de verdade:
  ten nome, entra no roster ao rematar, e pode morrer.
- **REPARACIÓN**: o mesmo, pero sae con 30% de vida e habilidades
  reducidas. Curala é o que a fai útil.

Ningunha das dúas é un sistema novo: `mkUnit`, o cambio de `team` e o
radio de reparación do ENGINEER (`engHealStats`) xa existen. O que hai
que engadir é a bandeira `inerte` e o pulso de activación.

**Por que isto é TUERCA e non un adorno**: unha unidade rescatada na
operación 7 pode chegar viva á 20. Non é unha recompensa, é un nome
máis. E cando morre, morre nun sitio con nome (`placeAt`) e entra no
Diario. Un HQ derrubado non fai nada diso.

### Gatillos

Predicados avaliados unha vez por paso; cada un dispara unha soa vez agás
que diga `sempre`.

`aoEmpezar` · `tras:N` · `unidadeEn:LUGAR` · `salaAberta:ID` ·
`tabiqueAberto:N` · `rescatados:N` · `reparados:N` · `extraidos:N` ·
`baixaPropia:N` · `baixaInimiga:N` · `sabotado:N` · `escoltaEn:LUGAR` ·
`vidaDe:ID<:%` · `queimado:N` *(o reloxo de VOLT)*

Non hai `sectorTomado` nin `hqInimigo<`: os sectores e o HQ inimigo son
do modo libre e non aparecen en ningunha das vinte.

Accións:

`dicir:VOZ:clave` (HQ · TUERCA · VOLT · SUPERVISOR · CANTINA) ·
`aparecer:BANDO:N:LUGAR` · `marcar:TIPO` · `rematar:vitoria|derrota` ·
`interludio:ID` · `camara:LUGAR` · `abrir:TABIQUE`

### Ficheiro

```js
const OPERACIONS = [{
  n: 3, acto: 'I', id: 'aprender-a-volver',
  planta: 'DOCA', sectores: false, baseInimiga: false,
  obxectivo: {tipo: 'REPARACION', n: 2},
  presenta: 'ENGINEER',
  garnicion: [{cls:'GRUNT', n:4, onde:'ALMACENS'}, {cls:'HEAVY', n:1, onde:'DOCA'}],
  gatillos: [
    { cando:'aoEmpezar',   facer:['dicir:HQ:op3.entrada'] },
    { cando:'reparados:1', facer:['dicir:TUERCA:op3.primeiro'] },
    { cando:'tras:210',    facer:['aparecer:GRIS:3:PEIRAO', 'dicir:HQ:op3.grises'] },
  ],
  derrota: 'ningunha unidade viva',
}];
```

---

## 3 · A táboa

`†` introduce clase · `‡` acto de hangar, non operación

| # | Acto | Título | Planta | Obxectivo | Clase |
|---|---|---|---|---|---|
| 1 | I | Primeiro día | NAVE | EXTRACCIÓN (o teu escuadrón) | GRUNT † |
| 2 | I | Reciclaxe rutineira | NAVE | SABOTAXE (3 prensas) | |
| 3 | I | Aprender a volver | DOCA | REPARACIÓN (2) | ENGINEER † |
| 4 | I | Unha páxina máis | DOCA | RESCATE (3) | |
| ‡ | I | *O formulario D-77* | *hangar* | — | |
| 5 | I | O que quedou dentro | ARQUIVO | EXTRACCIÓN (3 expedientes) | |
| 6 | I | O taller ten un nome | NAVE | ESCOLTA (o da cantina) | |
| 7 | II | Os que teñen nome | XERADORES | RESCATE (4) | |
| 8 | II | VOLT | GALERIA | RESCATE contra reloxo | HEAVY † |
| 9 | II | Os Grises | DOCA | DEFENSA (240 s) | |
| 10 | II | A galería alta | GALERIA | SABOTAXE (2 postos altos) | SNIPER † |
| 11 | II | O espectáculo | XERADORES | — *(Mundial, á parte)* | |
| 12 | II | Superioridade industrial | NAVE | REPARACIÓN (3 inimigas) | |
| 13 | II | Quen escribe o caderno | ARQUIVO | EXTRACCIÓN (o caderno) | |
| 14 | II | O muro | DOCA | RESCATE tras brecha (2) | |
| 15 | II | O que VOLT lembra | GALERIA | DEFENSA (o memorial) | |
| 16 | III | Corte de subministro | XERADORES | SABOTAXE (4 xeradores) | |
| 17 | III | Chegar ao Complexo | COMPLEXO | ESCOLTA + RESCATE (3) | |
| 18 | III | A obra pública | COMPLEXO | RESCATE tras brecha (2) | BOMBARDERO † |
| 19 | III | O Crisol | ARQUIVO | OLEADAS (5) | |
| 20 | III | O último combate | COMPLEXO | EXTRACCIÓN (nomes) | |
| — | — | **Montaxe final** | *montaxe* | — | |

**Ningún HQ inimigo en toda a campaña**, e ningunha operación se gaña
matando a todo o mundo. Nas vinte hai algo que sacar, alguén que erguer,
ou algo que parar.

**Sen sectores nas vinte.** Círculos de captura nunha misión de rescate
son ruído: o xogador le que hai algo que capturar e non o hai.

---

## 4 · As operacións que cambian de forma

Só se detallan aquí as que non son evidentes desde a táboa. As demais
seguen como na v1 en texto e diálogo; o que cambia é o obxectivo.

### 1 · Primeiro día — `EXTRACCIÓN` (o teu propio escuadrón)

Tres unidades entran pola doca da nave e teñen que chegar ao punto de
reunión do outro lado. Iso é todo. Non hai que tomar nada, non hai que
tirar nada, e o único que se atopa polo camiño son dous Grises que non
esperaban a ninguén.

**Por que así.** O peso da escena está no nome, non na arma — dío o
narrativo. Unha primeira misión que sexa un asalto a unha base pon o peso
exactamente no sitio equivocado, e ademais ensina unha gramática que
despois non se volve usar en dezanove operacións.

O que si ensina: mover, atravesar unha porta, e que as unidades disparan
soas. Nada máis.

**Entrada** — no taller, non na batalla:

> **SUPERVISOR** · `op1.norma`
> «Non lles poñas nomes. Fai que o traballo sexa máis difícil, para eles
> e para ti.»
>
> «Non che vou dicir por que. Se cho digo agora, non o entendes. Se
> esperas, xa non fai falla que cho diga.»

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `op1.inicio`: «Traslado de rutina. Punto de reunión no extremo norte. Grazas por utilizar ÓPTIMA INDUSTRIES.» |
| `unidadeEn:ESPINA` | `aparecer:GRIS:2:NAVE` — sen aviso ningún |
| `baixaPropia:1` | *silencio.* Ninguén di nada, e é a primeira vez |
| `extraidos:3` | `rematar:vitoria` |

**Saída.** O caderno enriba da banca. Unha páxina en branco.
`bautizoObrigatorio()` **sen explicar para que serve**: só o cursor.

### 2 · Reciclaxe rutineira — `SABOTAXE`

Tres prensas de reciclaxe na nave. Hai que paralas. Non hai rival: hai
seis operarios armados e unha instalación funcionando con normalidade.

**Por que funciona.** A operación 1 rematou tirando unha base e sentiu
como un xogo. Esta remata parando unha máquina, e a máquina segue quente.

| Cando | Que pasa |
|---|---|
| `sabotado:1` | **HQ** `op2.rendemento`: «Liña un detida. Rexístrase perda de rendemento.» |
| `sabotado:3` | **HQ** `op2.reciclaxe`: *«Grazas por utilizar ÓPTIMA INDUSTRIES. A súa unidade será reciclada ao finalizar a avaliación.»* — a mensaxe automática de sempre, agora dentro do sitio onde se fai |

### 3 · Aprender a volver — `REPARACIÓN`

Dous chasis propios de operacións anteriores, tirados na doca ao 15% de
vida. O ENGINEER ponos en pé e loitan contigo o resto da operación.

**Isto é a clase feita misión**, e é onde se ensina a regra que despois
sostén media campaña: **reconstruír non é fabricar; é impedir que
desapareza.**

Regra que non se explica en ningures e se descobre no taller: se o
reparado compartira operación cunha unidade viva, herda unha habilidade
dela.

### 4 · Unha páxina máis — `RESCATE`

Tres unidades inertes nun almacén pechado. A porta está tapiada: hai un
tabique, e abrilo é a operación. Non hai combate ata que se abre.

**Por que é entretida.** É a primeira vez que o mapa é o problema e non a
xente. E ao abrir, o que hai dentro non ataca: está agardando.

| Cando | Que pasa |
|---|---|
| `tabiqueAberto:1` | **TUERCA** `op4.dentro`: «Levan aquí desde antes de que eu chegase.» |
| `rescatados:1` | *silencio*, e o nome aparece na radio como se sempre fose teu |
| `rescatados:3` | `rematar:vitoria` |

**Saída.** No caderno, coa letra doutra man: *«Hoxe esquecín algo. Non sei
o que era.»*

### 6 · O taller ten un nome — `ESCOLTA`

O da cantina ten que chegar á nave. Non combate, non se defende, e móvese
máis lento ca todos. Se cae, a operación **non se perde**: gáñase igual e
non volve aparecer nunca máis, e ninguén o menciona.

**Isto é a brúxula do proxecto feita regra.** O xogo non che castiga por
perdelo. Simplemente deixa de estar.

### 7 · Os que teñen nome — `RESCATE`

Catro unidades inertes repartidas polos cadros dos xeradores, en catro
salas distintas. Non se poden facer as catro polo mesmo camiño: hai que
partir o escuadrón, e partir o escuadrón é a primeira decisión difícil da
campaña.

### 8 · VOLT — `RESCATE` contra reloxo

VOLT non ten base. VOLT está **dentro**, e está a queimar o arquivo.

Seis unidades inertes nos palcos da galería. Cada 40 segundos, VOLT
destrúe unha —a que estea máis lonxe de ti—. Rescatas as que poidas. Non
hai un número que gañe: gáñase cando xa non queda ningunha, e o resultado
é cantas saíron.

**Por que isto e non unha base.** O narrativo di que VOLT lembra e segue
queimando arquivos, e que é a proba de que lembrar non fai a ninguén bo,
só o fai responsable. Unha base derrubada non demostra iso. Un reloxo que
lle come as unidades unha a unha mentres el cita os seus nomes, si.

O HEAVY entra aquí porque a escaleira da galería é o único camiño aos
palcos e VOLT tena batida: aguantala é a diferenza entre chegar a catro
ou a unha.

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **VOLT** `op8.saudo`: «Lévoos contados. Os teus e os meus. É máis eficiente.» |
| cada 40 s | **VOLT** `op8.queima`: «{nome}. Rexistro pechado.» *(nome real da que acaba de destruír)* |
| `rescatados:1` | **VOLT** `op8.espello`: «Ti tamén escolles cal. A diferenza é que eu levo o rexistro ao día.» |

VOLT non morre aquí. Retírase cando xa non queda nada que queimar.

### 10 · A galería alta — `SABOTAXE`

Dous postos elevados nos palcos que baten a escaleira enteira. Sen SNIPER
hai que subir por ela; con SNIPER, non. O obxectivo son eles, non a xente
que os leva.

### 12 · Superioridade industrial — `REPARACIÓN`

Tres unidades **inimigas** caídas. Repáraas e loitan contigo.

**A operación que máis incomoda de toda a campaña.** ÓPTIMA felicítate
por rendemento mentres o fas, e ten razón: é máis eficiente. O xogador
está a facer exactamente o que critica.

| Cando | Que pasa |
|---|---|
| `reparados:1` | **HQ** `op12.material`: «Material reasignado. Excelente aproveitamento.» |
| `reparados:3` | **TUERCA** `op12.tuerca`: «Non lles preguntaches se querían.» |

### 14 · O muro — `RESCATE` tras brecha

O tabique con restos aliados incrustados. Ao abrilo non hai pezas: hai
dúas unidades inertes que levan aí dentro desde que se fixo o muro.

> **TUERCA** `op14.obra`: «Non foi unha atrocidade. Foi obra pública.
> Alguén precisaba material.»

### 15 · O que VOLT lembra — `DEFENSA`

VOLT non ataca o teu HQ: ataca o **memorial**. Un punto que non dá
recursos, non dá territorio e non dá puntuación. Só ten nomes dentro.

Se cae, a operación **non se perde**. O que se perde son os nomes, e vese
no Diario da partida seguinte.

### 17 · Chegar ao Complexo — `ESCOLTA` + `RESCATE`

Hai que meter un ENGINEER ata o fondo das oficinas e sacar tres. O
ENGINEER é o que activa, así que se cae, a operación segue pero xa non se
pode rescatar a ninguén máis. **Perder unha unidade deixa de ser unha
baixa e pasa a ser unha porta que se pecha.**

### 18 · A obra pública — `RESCATE` tras brecha · BOMBARDERO

Un muro de carga do Complexo con dous aliados dentro do formigón. Non é
un tabique: é estrutura, e a estrutura non se abre a tiros de fusil. Só
cede con potencia de fogo alta, e o BOMBARDERO ignora a cobertura — o que
significa que abrir custa baixas propias probables.

**A decisión é toda a operación**: sacar a dous que levan aí anos, a
cambio de arriscar aos que che quedan vivos. Non hai unha resposta
correcta e o xogo non che vai dicir cal era.

A clase máis destrutiva chega ao final a propósito, cando a historia xa
fala do prezo de todo isto.

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **TUERCA** `op18.prezo`: «Isto ábrese. A pregunta non é se se pode.» |
| `tabiqueAberto:1` | **HQ** `op18.optima`: «Demolición non autorizada rexistrada. Cargarase ao seu presuposto.» |
| `rescatados:2` | `rematar:vitoria` |

### 20 · O último combate — `EXTRACCIÓN`

Sen base, sen sectores, sen vitoria total. Cada unidade que sae polo
punto de extracción conta; as que quedan dentro non volven. O marcador
non di «vitoria»: di cantos saíron.

---

## 5 · O que aínda non está probado, e hai que probalo antes de escribir vinte guións

Isto é honesto, non cauteloso. As plantas están medidas e a navegación
tamén (chégase a destino no 97–100% dos casos, medido; antes era o
3–39%). O que **non** está probado é isto:

1. **Canto dura unha operación sen produción inimiga.** Se a garnición é
   fixa, o ritmo dependeo de canta hai e de onde. Hai que xogar unha e
   cronometrala antes de escribir as vinte.
2. **Se catro unidades inertes en catro salas obriga a partir o
   escuadrón ou só a dar catro voltas.** Se é o segundo, aburre.
3. **Se un escuadrón de tres chega a facer unha travesía de 80×45** sen
   que se faga longo. O COMPLEXO pode ser grande de máis.
4. **Se `ESCOLTA` funciona sen ordes de formación.** Unha unidade lenta
   que segue ao grupo pode quedar atrás por deseño ou por accidente, e
   desde fóra vense igual.

**Recomendación**: prototipar a operación 4 (RESCATE tras brecha) antes
que ningunha outra. É a máis curta que usa a peza nova, e se esa non
funciona, non funciona ningunha das once que dependen dela.

O botón **INTERIORES (probar planta)** do hangar está aí para iso: entra
nunha planta concreta, con ou sen sectores, sen agardar á campaña.

---

## 6 · O alfabeto que falta

Da lámina de pezas de interior (muros, portas, escaleiras, compuertas,
ventilacións, elevadores, pisos, barandas, tuberías, detalles).

**Primeiro a conta que decide todo o demais.** As dúas láminas están en
`art/tiles_interior.png` e `art/tiles_interior0.png`, 1536×1024 as dúas.
Medidas coas propias ferramentas do proxecto —`tools/recortar.js`, que xa
detecta pezas sobre croma verde— saen 58 pezas con estes tamaños:

| Peza | Na lámina | A 16 px | Redución |
|---|---|---|---|
| Tramo de muro | 45×60 | 16×16 | 3× |
| Baldosa de piso | 85×70 | 16×16 | **5×** |
| Caixa · bidón | 43×49 · 33×60 | 16×16 | 3× |

A 3× un prop conserva a silueta. **A 5× unha textura de piso convértese
en ruído**, e ese número é o que decide o reparto de abaixo.

**O valor das láminas non son os píxeles: é o vocabulario.** O alfabeto
actual ten cinco símbolos e queda curto.

### Xa implementado a partir delas

- **Columnas** — as masas macizas pequenas van con chapitel e base.
- **Chan por zona** — tres materiais (formigón, chapa ranurada, reixa)
  asignados polo lugar con nome máis próximo. Non fixo falla declarar
  nada: `lugares` xa tiña as coordenadas.
- **Carteis no chan** — o nome da zona en estarcido, grande e apagado.
  É a peza máis rendible das dúas láminas e non precisou cortar un só
  píxel: os seus carteis (`DOCA 1`, `TALLER`, `GENERADORES`) son
  literalmente as etiquetas que `placeAt()` xa usa. O Diario levaba
  escribindo «caeu na Doca de Carga» sobre un mapa no que a doca non se
  vía por ningures.

Medido con `tools/contraste.js` sobre a mesma planta: 13,4 antes, **14,6**
despois. A primeira versión do chan por zona baixara a 13,2 —pintaba
sobre a base e a reixa case enteira en escuro— e a corrección foi
inverter a receita: **superficie clara con liña interna escura**, que é o
que a propia ferramenta di que funciona.

| Da lámina | Serve? | Como entra |
|---|---|---|
| Columnas / pilares | **Si** | Xa feito: as masas macizas pequenas píntanse con chapitel e base, non como parede |
| Compuertas / persianas | **Si** | Símbolo novo `▯`: porta **pechada**. Non se pasa ata que alguén a abre. É a porta da misión de rescate, e xa hai gatillo (`salaAberta:ID`) |
| Barandas / valados | **Si** | Símbolo novo `-`: para o movemento, **non** para o tiro, e dá cobertura. É o único engadido de xogabilidade real que hai na lámina |
| Detalles (caixas, bidóns, consolas, xeradores) | **Si** | Símbolo novo `o`: obxecto dunha cela. Cobertura, e sobre todo **corpo** para os obxectivos de SABOTAXE — hoxe «3 prensas» e «4 xeradores» son abstraccións sen nada no mapa |
| Ventilacións / reixas | Cosmético | Detalle sobre a cara do muro. Barato e non cambia nada |
| Tuberías / condutos | Cosmético | Idem, no chan e ao longo dos muros |
| Pisos industriais (7) | **A medias** | A 16 px son sete grises. O que si funciona é **un material por zona** —nave, corredor, doca— porque fai lexibles as zonas que `placeAt()` xa nomea |
| Remates de muro | Non fai falla | O autotiling xa resolve os remates mirando os veciños |
| **Escaleiras / elevadores** | **Non** | TUERCA é un só plano: non hai altura nin andares. Un elevador pode ser un **sitio** (o punto de extracción da operación 20), nunca unha mecánica. É a trampa máis grande da lámina |

### Alfabeto proposto

```
#  macizo        estrutura. Non se pasa, non se derruba
.  chan
,  chan de chapa material distinto, para distinguir zonas
:  escombro      chan sucio (xa non se pinta con relevo)
+  porta         aberta, transitable
▯  compuerta     PECHADA. Ábrese por gatillo ou por un ENGINEER
=  tabique       muro destruíble
-  baranda       para o movemento, non o tiro, dá cobertura
o  obxecto       caixa, bidón, consola. Cobertura e branco de SABOTAXE
```

De cinco a nove. Cada un ten que pasar polas mesmas comprobacións do
xerador (chan conectado, nada de pasos dunha cela) e polo mesmo sitio na
navegación: `macizoEn()` para `#`, `-`, `o` e `▯`, e `rutaInterior`
rodéaos igual que rodea o formigón.

### Sobre cortar a lámina de verdade

`tools/recortar.js` existe exactamente para isto: colle unha lámina sobre
croma verde, detecta as pezas conexas e escríbeas con transparencia. É o
mesmo camiño que xa seguiron `lamina_GRUNT.png` e compañía.

Se a lámina entra en `art/`, o que ten sentido cortar son **os obxectos**
—caixas, bidóns, consolas, xeradores, ventilacións— a 16 ou 24 px, que
son os que teñen silueta e sobreviven á redución.

Os **muros e os pisos quedan procedurais**. A 16 px unha textura
fotográfica reducida perde contra a xeometría que xa hai, e ademais os
muros teñen que seguir a luz da escena e responder ao autotiling: un
sprite fixo non fai nin unha cousa nin a outra.

---

## 7 · Sen decidir

1. ~~Contraste macizo/chan.~~ **Decidido**: masa escura, chan lexible
   (`MACIZO_CLARO = false`).
2. **Se a campaña e o libre son unha partida ou dous gardados.**
3. **Como se empalma o banco do primeiro día cos caídos da campaña.**
   `bancoPrimeiroDia()` xera hoxe 35 pezas anónimas. Segue sendo a peza
   máis rendible de todas.
4. **Se as unidades rescatadas contan como veteranas para o cálculo do
   rival.** Se contan, rescatar penalízate; se non contan, rescatar é
   gratis. Probablemente teñan que contar a metade.
5. **O da cantina leva designación ou non.**
6. **O ton do Mundial na operación 11.**
