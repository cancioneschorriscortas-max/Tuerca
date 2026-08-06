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

**Na v2 hai enemigo con base en tres operacións de vinte.** A primeira,
para ensinar o que é. A oitava, porque VOLT ten unha. E a décimo oitava,
porque é a única estrutura da campaña que se derruba de verdade.

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

### O que hai que tocar no motor, e é acoutado

`checkVictory` (10-estructuras.js:546) hoxe é literalmente
`if(g.hq[ET].hp<=0) vitoria; else if(g.hq[PT].hp<=0) derrota;`. **Sen HQ
inimigo, unha operación non remata nunca.** Non é un detalle: é o único
cambio de verdade que pide todo este deseño.

```js
/* en tickEnd, antes do de sempre */
if(g.obxectivo){
  const r = g.obxectivo.avaliar(g);       /* 'victory' | 'defeat' | null */
  if(r){ g.over = true; g.result = r; return; }
  return;                                  /* NON caer no do HQ */
}
```

Con iso, e con `g.hq[ET]` posto fóra do mapa ou con `hp` infinito nas
operacións sen base, todo o demais do motor segue igual. A IA de
produción (`g.prod[ET]`) apágase poñéndoa a `null`, que é o que xa fai o
Crisol.

---

## 2 · Vocabulario

### Obxectivos

Sete, e a columna da dereita é o que importa: cantas veces aparece.

| Obxectivo | Como se gaña | Veces |
|---|---|---|
| `RESCATE` | Reactivar N unidades inertes; pasan ao teu control | 4 |
| `REPARACIÓN` | Poñer en pé material caído; loita contigo o resto da operación | 3 |
| `EXTRACCIÓN` | Levar N unidades ou pezas ao punto de saída | 4 |
| `ESCOLTA` | Que alguén que non combate chegue vivo a un sitio | 2 |
| `SABOTAXE` | Tirar N estruturas concretas (non unha base) | 3 |
| `DEFENSA` | Aguantar N segundos | 3 |
| `BASE` | Tirar o HQ inimigo | **3** |
| `OLEADAS` | Sobrevivir 5 oleadas (Crisol) | 1 |

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
`vidaDe:ID<:%` · `sectorTomado:ID` · `hqInimigo<:%`

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

`†` introduce clase · `‡` acto de hangar, non operación · **B** leva base inimiga

| # | Acto | Título | Planta | Obxectivo | Clase |
|---|---|---|---|---|---|
| 1 | I | Primeiro día | NAVE | **B** BASE (pequena, guiada) | GRUNT † |
| 2 | I | Reciclaxe rutineira | NAVE | SABOTAXE (3 prensas) | |
| 3 | I | Aprender a volver | DOCA | REPARACIÓN (2) | ENGINEER † |
| 4 | I | Unha páxina máis | DOCA | RESCATE (3) | |
| ‡ | I | *O formulario D-77* | *hangar* | — | |
| 5 | I | O que quedou dentro | ARQUIVO | EXTRACCIÓN (3 expedientes) | |
| 6 | I | O taller ten un nome | NAVE | ESCOLTA (o da cantina) | |
| 7 | II | Os que teñen nome | XERADORES | RESCATE (4) | |
| 8 | II | VOLT | GALERIA | **B** BASE | HEAVY † |
| 9 | II | Os Grises | DOCA | DEFENSA (240 s) | |
| 10 | II | A galería alta | GALERIA | SABOTAXE (2 postos altos) | SNIPER † |
| 11 | II | O espectáculo | XERADORES | — *(Mundial, á parte)* | |
| 12 | II | Superioridade industrial | NAVE | REPARACIÓN (3) | |
| 13 | II | Quen escribe o caderno | ARQUIVO | EXTRACCIÓN (o caderno) | |
| 14 | II | O muro | DOCA | RESCATE tras brecha (2) | |
| 15 | II | O que VOLT lembra | GALERIA | DEFENSA (o memorial) | |
| 16 | III | Corte de subministro | XERADORES | SABOTAXE (4 xeradores) | |
| 17 | III | Chegar ao Complexo | COMPLEXO | ESCOLTA + RESCATE (3) | |
| 18 | III | A obra pública | COMPLEXO | **B** BASE + brecha | BOMBARDERO † |
| 19 | III | O Crisol | ARQUIVO | OLEADAS (5) | |
| 20 | III | O último combate | COMPLEXO | EXTRACCIÓN (nomes) | |
| — | — | **Montaxe final** | *montaxe* | — | |

Tres bases en vinte, e cada unha xustifica a súa: a 1 ensina o que é unha
base para que a súa ausencia despois signifique algo, a 8 é a de VOLT
—que é o espello do xogador e por iso ten unha coma el—, e a 18 é a única
estrutura que a campaña derruba de verdade.

**Sen sectores en catorce das vinte.** Círculos de captura nunha misión
de rescate son ruído: o xogador le que hai algo que capturar e non o hai.

---

## 4 · As operacións que cambian de forma

Só se detallan aquí as que non son evidentes desde a táboa. As demais
seguen como na v1 en texto e diálogo; o que cambia é o obxectivo.

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

## 6 · Sen decidir

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
