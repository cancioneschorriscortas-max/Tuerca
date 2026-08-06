# TUERCA — as vinte operacións
## Deseño xogable do modo campaña · v1

Este documento non repite a narrativa. `TUERCA_documento_narrativo_v1.md`
di **de que trata** cada momento; isto di **que fai o xogador**, **con que
se dispara** e **que se oe**. Onde os dous discrepen, manda o narrativo:
aquí só se decide a forma xogable.

Escríbese despois de arranxar os interiores, e iso non é un detalle: ata
esta versión unha planta escrita ocupaba un cuarto do mapa, o HQ inimigo
caía dentro do formigón e o escuadrón atravesaba o edificio a tiros en vez
de percorrelo. Deseñar operacións sobre aquilo tería sido deseñar sobre
area.

---

## 1 · O que o motor sabe facer hoxe

Todo o que segue úsase abaixo. Nada do que segue está por inventar.

| Peza | Onde vive | Que dá |
|---|---|---|
| Planta de interior | `PLANTAS`, `mapaDaPlanta()` | Escenario recoñecible, co seu tamaño e os seus fondeadeiros |
| Sectores | `SECTORS`, `window._senSectores` | Captura, ou ningunha captura |
| HQ | `g.hq`, escudo de subministro | Destrución condicionada a controlar máis sectores |
| Tabique | `=` na planta, `damageWall`, `abrirTabique` | Muro que **si** se abre, e ábrese de verdade |
| Formigón | `macizoEn()` | Estrutura. Non se derruba. Obriga a usar as portas |
| Lugares con nome | `PLACES`, `placeAt()` | «caeu na Doca de Carga», non «en campo aberto» |
| Misións secundarias | `addSubquest`, `tickSubquests` | Panel lateral, obxectivo con progreso, cámara ao premer |
| Voz do HQ | `hqSay(texto, atraso, clave)` | Liña de radio de ÓPTIMA, con voz |
| Radio | `radio(texto, cor, pos)` | Liña de calquera, cor libre, e sinala no mapa |
| Interludios | `INTERLUDIOS`, `interludioQuizais()` | Pantalla completa entre operacións, dúas voces |
| Briefing | `showBriefing()` | Antes da batalla, cos veteranos que van |
| Confianza / folga | `04-progresion.js` | Consecuencias persistentes entre operacións |
| Desmantelar vivo | `desmantelarVivo()` | O D-77, coa distinción doazón/requisa |
| Crisol | `modo: 'crisol'` | Oleadas |

### O que hai que engadir, e é pouco

Un só ficheiro novo, `22-operacions.js`, con esta forma. É a única peza de
maquinaria que pide este deseño:

```js
const OPERACIONS = [{
  n: 3, acto: 'I', id: 'aprender-a-volver',
  planta: 'DOCA',            /* window._plantaPedida */
  sectores: false,           /* window._senSectores */
  obxectivo: 'EXTRACCION',   /* ver a táboa de abaixo */
  presenta: 'ENGINEER',      /* clase que entra aquí por primeira vez */
  entrada: [ {voz:'OPTIMA', txt:'op3.entrada.1'} ],
  gatillos: [
    { cando: 'aoEmpezar',            facer: ['dicir:HQ:op3.aviso'] },
    { cando: 'baixaPropia:1',        facer: ['marcar:RECUPERACION', 'dicir:TUERCA:op3.caeu'] },
    { cando: 'extraidos:1',          facer: ['dicir:HQ:op3.primeiro'] },
    { cando: 'tras:240',             facer: ['aparecer:GRIS:2:DOCA'] },
  ],
  vitoria: 'extraidos >= 2',
  derrota: 'ningunha unidade viva',
}];
```

**Gatillos** — predicados que se avalían unha vez por paso, e cada un
dispara **unha soa vez** agás que diga `sempre`:

`aoEmpezar` · `tras:N` (segundos) · `sectorTomado:ID` · `sectoresTomados:N`
· `baixaPropia:N` · `baixaInimiga:N` · `unidadeEn:LUGAR` ·
`tabiqueAberto:N` · `hqInimigo<:%` · `hqPropio<:%` · `extraidos:N` ·
`vidaDe:ID<:%` · `radarPropio` · `sqCumprida:TIPO`

**Accións**:

`dicir:VOZ:clave` (VOZ = HQ | TUERCA | VOLT | SUPERVISOR | CANTINA) ·
`aparecer:BANDO:N:LUGAR` · `marcar:TIPO` (crea subquest) · `abrir:TABIQUE`
· `rematar:vitoria|derrota` · `interludio:ID` · `camara:LUGAR`

**Obxectivos** — cinco, e só un é novo:

| Obxectivo | Como se gaña | Novo? |
|---|---|---|
| `CAPTURA` | Máis sectores ca o rival ao pechar | non |
| `HQ` | Tirar o HQ inimigo (co escudo de subministro) | non |
| `DEFENSA` | Aguantar N segundos co HQ propio en pé | non |
| `OLEADAS` | Sobrevivir N oleadas | non (Crisol) |
| `EXTRACCION` | Levar N unidades/pezas ao punto de saída | **si** |

`EXTRACCION` é o único sistema novo, e é o que o dono xa dixo que era o
único que pagaba a pena. Implementación mínima: un `PLACE` marcado como
saída, e unha unidade propia que entre nel con material a bordo cóntase e
retírase do mapa. Reaproveita `placeAt()` enteiro.

**O que NON entra**: sixilo. É un sistema completo para unha soa escena, e
xa se avisou. A operación 15 do narrativo resólvese aquí doutra maneira.

---

## 2 · O escenario

Seis plantas xeradas (`node tools/planta.js --listar`). Ningunha se
escribe a man e todas pasan as mesmas comprobacións: chan conectado, nada
de pasos dunha cela, fondeadeiros reais.

| Planta | Medida | Le como | Operacións |
|---|---|---|---|
| `NAVE` | 60×34 | Nave principal, talleres, anexo pechado | 1, 2, 6, 12 |
| `DOCA` | 60×34 | Doca de carga, peirao, almacéns | 3, 4, 9, 14 |
| `XERADORES` | 60×34 | Sala de xeradores, galería de cables | 7, 11, 16 |
| `ARQUIVO` | 60×34 | Depósito, corredor frío, salas de consulta | 5, 13, 19 |
| `GALERIA` | 40×50 | **Alta e estreita.** Escaleira e palcos | 8, 10, 15 |
| `COMPLEXO` | 80×45 | A localización nova. Patio cuberto e oficinas | 17, 18, 20 |

`GALERIA` é vertical a propósito: nunha planta alta e estreita non hai
flanqueo longo, hai **alturas**. É a «torre» da operación do SNIPER sen
inventar unha mecánica de torre.

Repetir planta non é repetir operación. A mesma nave con `_senSectores`,
outra entrada e outro obxectivo é outro sitio. Iso é o que permite oito
zonas e unha soa localización nova, que é o que estaba decidido.

---

## 3 · A táboa

`†` = introduce clase. `‡` = acto de hangar, non operación.

| # | Acto | Título | Planta | Obxectivo | Sec. | Clase |
|---|---|---|---|---|---|---|
| 1 | I | Primeiro día | NAVE | CAPTURA (2 sec.) | si | GRUNT † |
| 2 | I | Reciclaxe rutineira | NAVE | HQ | si | |
| 3 | I | Aprender a volver | DOCA | EXTRACCIÓN | non | ENGINEER † |
| 4 | I | Unha páxina máis | DOCA | CAPTURA | si | |
| ‡ | I | *O formulario D-77* | *hangar* | — | — | |
| 5 | I | O que quedou dentro | ARQUIVO | EXTRACCIÓN | non | |
| 6 | I | O taller ten un nome | NAVE | DEFENSA | non | |
| 7 | II | Os que teñen nome | XERADORES | CAPTURA | si | |
| 8 | II | VOLT | GALERIA | HQ | si | HEAVY † |
| 9 | II | Os Grises | DOCA | DEFENSA | non | |
| 10 | II | A galería alta | GALERIA | CAPTURA | si | SNIPER † |
| 11 | II | O espectáculo | XERADORES | HQ | si | |
| 12 | II | Superioridade industrial | NAVE | CAPTURA | si | |
| 13 | II | Quen escribe o caderno | ARQUIVO | EXTRACCIÓN | non | |
| 14 | II | O muro | DOCA | HQ + brecha | si | |
| 15 | II | O que VOLT lembra | GALERIA | DEFENSA | non | |
| 16 | III | Corte de subministro | XERADORES | HQ | si | |
| 17 | III | Chegar ao Complexo | COMPLEXO | CAPTURA | si | |
| 18 | III | A obra pública | COMPLEXO | HQ + brecha | si | BOMBARDERO † |
| 19 | III | O Crisol | ARQUIVO | OLEADAS (5) | non | |
| 20 | III | O último combate | COMPLEXO | EXTRACCIÓN | non | |
| — | — | **Montaxe final** | *montaxe* | — | — | |

Contas: catro operacións no acto I, once no II, cinco no III, máis o acto
de hangar e o peche. **Aviso**: o narrativo di «operacións 16–20» na
cabeceira do acto III pero numera as súas seccións 14–17. Aquí resólvese
como acto III = 16–20, que é o que di a cabeceira e o que casa cos vinte.

---

## 4 · Operación a operación

O texto vai en galego e listo para meter en `00b-i18n.js` coas claves que
se indican. As liñas de ÓPTIMA son **corteses sempre**; iso non é un ton,
é a regra.

---

### 1 · Primeiro día `NAVE` · CAPTURA · GRUNT

**Lóxica.** Dous sectores, un escuadrón de tres, sen tabiques marcados no
panel. É a operación máis curta da campaña e non se pode perder por
tempo: só se perde quedando sen ninguén. O que se ensina é mover e
capturar, nada máis.

**Por que é entretida.** Porque non trata do combate. Antes de saír, o
supervisor di a única norma que se explica en voz alta en todo o xogo, e
o xogador vai poder incumprila cinco minutos despois.

**Entrada** — no taller, non na batalla:

> **SUPERVISOR** · `op1.norma`
> «Non lles poñas nomes. Fai que o traballo sexa máis difícil, para eles
> e para ti.»
>
> «Non che vou dicir por que. Se cho digo agora, non o entendes. Se
> esperas, xa non fai falla que cho diga.»

**Gatillos.**

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `op1.inicio`: «Operación de rutina. Dous puntos de control. Grazas por utilizar ÓPTIMA INDUSTRIES.» |
| `sectorTomado:A` | **HQ** `op1.sectorA`: «Punto asegurado. Rendemento dentro do previsto.» |
| `baixaPropia:1` | *silencio.* Ninguén di nada. É a primeira vez e é o que máis pesa |
| `sectoresTomados:2` | `rematar:vitoria` |

**Saída.** Ao volver, o caderno enriba da banca. Unha páxina en branco.
`bautizoObrigatorio()` pero **sen explicar para que serve**: só o cursor.
Escribir aí é o que marca `marcas.primeiroNome` e o que dispara o
interludio `primernombre`.

---

### 2 · Reciclaxe rutineira `NAVE` · HQ

**Lóxica.** A mesma nave, agora enteira: hai que tirar o HQ inimigo, e o
escudo de subministro obriga a controlar máis sectores ca el. É a
primeira vez que a captura serve para algo e non é o obxectivo.

**Por que é entretida.** Gáñase, e a recompensa é a mensaxe automática.

**Gatillos.**

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `op2.escudo`: «HQ inimigo baixo escudo de subministro. Só cae se controla máis sectores ca el.» |
| `hqInimigo<:50` | **HQ** `op2.medio`: «Integridade estrutural inimiga ao cincuenta por cento.» |
| `baixaInimiga:3` | **VOLT** *(primeira vez que se oe, sen presentarse)* `op2.volt`: «Anotado.» |

**Saída — o momento da operación.** Ao rematar, antes do informe:

> **ÓPTIMA** · `op2.reciclaxe`
> «Grazas por utilizar ÓPTIMA INDUSTRIES.
> A súa unidade será reciclada ao finalizar a avaliación.»

Vai **idéntica** para todas as unidades, incluída a que o xogador acaba
de bautizar. Non se subliña. Non hai réplica. O informe ábrese despois,
coma sempre.

---

### 3 · Aprender a volver `DOCA` · EXTRACCIÓN · ENGINEER

**Lóxica.** Sen sectores (`_senSectores`). Hai dúas unidades propias
caídas de antes tiradas na doca e hai que sacalas polo peirao. O ENGINEER
entra aquí porque sen reconstrución non se pode seguir, e iso é unha
regra, non un consello: as caídas non se levantan soas.

**Por que é entretida.** Cambia o verbo. Todo o que se aprendeu era
tomar; agora hai que **traer**, e traer é máis lento, e o mapa non
colabora.

**Gatillos.**

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `op3.entrada`: «Recuperación de material. Dous chasis. Punto de saída no peirao.» |
| `aoEmpezar` | **TUERCA** `op3.tuerca`: «Non son dous chasis.» |
| `extraidos:1` | **HQ** `op3.un`: «Unidade recuperada. As pezas conservan rastros; iso non afecta ao rendemento.» |
| `tras:180` | `aparecer:GRIS:2:DOCA` — chegan os primeiros Grises, sen presentación |
| `extraidos:2` | `rematar:vitoria` |

**Regra que se descobre xogando.** Se se extrae unha unidade que
compartira operación cunha viva, a reconstruída herda unha habilidade
dela. Non se di en ningures. Vese no taller.

---

### 4 · Unha páxina máis `DOCA` · CAPTURA

**Lóxica.** Operación normal, de transición. Curta.

**Por que existe.** Porque o acto I precisa un respiro entre a
extracción e o D-77, e porque a páxina do caderno ten que aparecer nun
sitio onde non pase nada máis.

**Saída.** No hangar, no caderno, coa letra doutra man:

> `op4.pagina`
> «Hoxe esquecín algo. Non sei o que era.»

Nada máis. Sen botón de resposta, sen menú.

---

### ‡ · O formulario D-77 — acto de hangar

**Non é unha operación**, e xa se avisou de que non o era. É unha
pantalla de hangar entre a 4 e a 5.

Chega unha orde: falta unha peza para completar un chasis e a única
compatible está nunha unidade **viva** do roster. `desmantelarVivo()`.

- Con confianza alta → **DOAZÓN**. Hai despedida, e a unidade di algo.
- Con confianza baixa → **REQUISA**. Non hai despedida. Hai formulario.

> **ÓPTIMA** · `d77.selado`
> «Formulario D-77 (desmantelamento non consentido) selado sen
> incidencias. É un pracer traballar con profesionais.»

O xogador cúbreo coa súa man. É a primeira vez que fai o que a mensaxe
da operación 2 lle prometía a el.

---

### 5 · O que quedou dentro `ARQUIVO` · EXTRACCIÓN

**Lóxica.** Primeira visita ao Arquivo, sen saber aínda o que é. Hai que
sacar expedientes, non unidades: tres puntos de recollida repartidos, un
punto de saída. Sen sectores.

**Por que é entretida.** Porque o corredor frío do Arquivo é longo e
estreito e o xogador xa aprendeu que o formigón non se derruba: hai que
usar as portas, e as portas están onde están.

| Cando | Que pasa |
|---|---|
| `unidadeEn:DEPOSITO` | **TUERCA** `op5.deposito`: «Isto non é un almacén. Está ordenado por nomes.» |
| `extraidos:3` | `rematar:vitoria` |

---

### 6 · O taller ten un nome `NAVE` · DEFENSA · peche do acto I

**Lóxica.** Aguantar 240 segundos na nave co HQ en pé. Sen sectores: non
hai nada que tomar, só que non caia.

**Por que é entretida.** Porque é a primeira vez que o xogador non
decide onde vai a operación, e porque no medio da defensa chega alguén
que non serve para nada.

**O da cantina.** Unha unidade máis do roster, sen liña de combate útil.
Repara radios que xa funcionan. *(Designación proposta: `T-07`. O
narrativo non lle pon nome e quizais deba seguir sen el.)*

| Cando | Que pasa |
|---|---|
| `tras:120` | `aparecer:ALIADO:1:NAVE` — chega el. Non dispara |
| `tras:150` | **CANTINA** `op6.cunca`: *(sen texto. Rompe unha cunca. Colle outra do estante. Segue coa radio.)* Só o son |
| `tras:240` | `rematar:vitoria` |

**Saída.** Cando chega o seguinte veterano ao hangar, o da cantina xa
sabe o seu nome antes de que se presente. Non se explica. Ninguén o
comenta.

---

### 7 · Os que teñen nome `XERADORES` · CAPTURA · abre o acto II

**Lóxica.** Operación normal, e o cambio está fóra dela: a partir de
aquí o hangar amosa cantina, memorial e taller, e as unidades teñen
manías visibles (un bebe sempre da mesma taza, outro non se senta).

| Cando | Que pasa |
|---|---|
| `baixaPropia:1` | **TUERCA** `op7.cadeira`: «Unha cadeira queda baleira. Ninguén comenta nada.» |

O da cantina garda a taza el mesmo, sen que llo pidan. No hangar, non na
batalla.

---

### 8 · VOLT `GALERIA` · HQ · HEAVY

**Lóxica.** VOLT en persoa, nunha planta alta e estreita onde non se
pode rodear. Combate sostido que ningunha unidade lixeira aguanta: o
HEAVY entra aquí porque é a única maneira de non perder metade do
escuadrón na escaleira.

**Por que é entretida.** É a primeira vez que o inimigo razoa coma o
xogador. VOLT **lembra**: as súas liñas citan nomes de unidades propias
mortas en operacións anteriores (`killedNames`, que xa existe no sistema
de recorrentes).

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **VOLT** `op8.saudo`: «Lévoos contados. Os teus e os meus. É máis eficiente.» |
| `baixaPropia:1` | **VOLT** `op8.anota`: «{nome}. Anotado.» *(nome real da unidade caída)* |
| `hqInimigo<:30` | **VOLT** `op8.espello`: «Ti tamén desmontas. A diferenza é que eu levo o rexistro ao día.» |

VOLT non morre nesta operación. Retírase.

---

### 9 · Os Grises `DOCA` · DEFENSA

**Lóxica.** Sen bando vermello. Os Grises atacan e retíranse cargando
material — teu e do inimigo, indistintamente. Non se gaña matándoos:
gáñase aguantando ata que se van.

**Por que é entretida.** Porque cambia a pregunta. Non é «quen gaña», é
«canto che levaron».

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `hq.grises` *(clave xa existente)*: «Sinais non identificadas. Múltiples. Orixe: administración central.» |
| `baixaInimiga:1` | **TUERCA** `op9.albaran`: «Cando cae un Gris non hai obituario. Hai un albarán.» |

---

### 10 · A galería alta `GALERIA` · CAPTURA · SNIPER

**Lóxica.** Un sector nos palcos, en alto, que domina a escaleira. Sen
SNIPER hai que subir por ela e cústache dous. Con SNIPER, non.

**Por que é entretida.** É a primeira operación que se resolve escollendo
**antes** de saír, no hangar, e non durante.

---

### 11 · O espectáculo `XERADORES` · HQ

**Lóxica.** O Mundial dentro da campaña. Retransmisión, comentarista,
marcador. Mecanicamente é unha operación normal; o que cambia é a capa
de son e o feito de que as pezas gañadas veñen do torneo.

**Aviso mantido do traspaso**: o ton do Mundial dentro da campaña hai que
**probalo antes de comprometelo**. Se rompe o rexistro, o Mundial queda
fóra do mapa territorial, opcional, como xa estaba decidido.

---

### 12 · Superioridade industrial `NAVE` · CAPTURA

**Lóxica.** Operación grande e sen truco. Existe para que ÓPTIMA poida
expoñer o seu argumento completo cando o xogador vai gañando.

**Saída** — interludio, non batalla:

> **ÓPTIMA** · `op12.argumento`
> «Non hai vinganza en catro xeracións. Non hai viúvas. Non hai
> represalias. Non discutimos que funcione.
>
> Discútese o prezo. Nós tamén o discutimos, e resolvémolo. É a nosa
> función.»

Sen vilán. O argumento ten que ser difícil de rebater ou non funciona.

---

### 13 · Quen escribe o caderno `ARQUIVO` · EXTRACCIÓN

**Lóxica.** Sacar diarios do Arquivo antes de que os reciclen. Un dos
que se recolle é o caderno.

**Saída.** Recoñécese o padrón: certas letras máis presionadas cando a
páxina fala de perdas, erros riscados e corrixidos. **Non se revela quen
é.**

> `op13.liña`
> «Non quero que desaparezan dúas veces.»

---

### 14 · O muro `DOCA` · HQ + brecha

**Lóxica.** O tabique deixa de ser un atallo e pasa a ser o obxectivo. Un
muro da doca ten restos aliados incrustados no formigón. Reaproveita a
subquest `MURO_RESTOS`, que xa existe, pero aquí está **posta**, non é
aleatoria.

**Por que é entretida.** Porque a resposta á pregunta obvia é peor ca
calquera atrocidade:

| Cando | Que pasa |
|---|---|
| `tabiqueAberto:1` | **TUERCA** `op14.obra`: «Non foi unha atrocidade. Foi obra pública. Alguén precisaba material.» |

---

### 15 · O que VOLT lembra `GALERIA` · DEFENSA

**Esta é a operación 15 reescrita.** O narrativo pedía aquí sixilo, que é
un sistema enteiro para unha soa escena. Substitúese sen perder o que a
escena tiña que demostrar.

**Lóxica.** VOLT non ataca o teu HQ: ataca o **memorial**. Hai que
defender un punto que non dá recursos, non dá territorio e non dá
puntuación. Só ten nomes dentro.

**Por que é entretida.** Porque o xogo levaba quince operacións
ensinando a avaliar obxectivos por rendemento, e este non ten ningún. A
decisión de defendelo é o argumento enteiro do xogo, tomado coas mans.

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `op15.optima`: «Obxectivo sen valor táctico asignado. Recoméndase repregar.» |
| `aoEmpezar` | **VOLT** `op15.volt`: «Eu tamén lembro. Por iso sei onde doe.» |
| `tras:300` | `rematar:vitoria` |

Se cae o memorial, a operación **non se perde**: séguese e gáñase igual.
O que se perde son os nomes, e vese no Diario da partida seguinte.

---

### 16 · Corte de subministro `XERADORES` · HQ · abre o acto III

**Lóxica.** Tirar a alimentación do Complexo. Operación técnica, dura,
sen ninguén falando por riba. É o único momento do acto III que se
parece a un RTS normal, e está aí para que os catro seguintes non o
parezan.

---

### 17 · Chegar ao Complexo `COMPLEXO` · CAPTURA

**Lóxica.** Primeira entrada na única localización nova. Grande, seis
sectores, cinco tabiques. Non se gaña rápido.

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `op17.benvida`: «Benvidos ao Complexo Central. Rógase circular polos corredores sinalizados.» |

---

### 18 · A obra pública `COMPLEXO` · HQ + brecha · BOMBARDERO

**Lóxica.** Unha estrutura que só cede con potencia de fogo alta, e o
BOMBARDERO ignora a cobertura: usalo custa baixas propias probables. A
clase máis destrutiva chega ao final a propósito, cando a historia xa
fala do prezo de todo isto.

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **TUERCA** `op18.prezo`: «Isto ábrese. A pregunta non é se se pode.» |

---

### 19 · O Crisol `ARQUIVO` · OLEADAS (5)

**Lóxica.** Cinco oleadas, non infinitas: ese é o **contrato da
campaña**. O Crisol do modo libre segue sendo infinito e non se toca.

**Por que é entretida — e por que é cruel.** O que se proba non son as
unidades. Próbase se un roster con memoria acumulada rende mellor ou peor
có limpo. O xogador xera os datos que xustificarán a súa propia
eliminación, e o informe final dállos con cortesía.

| Cando | Que pasa |
|---|---|
| `aoEmpezar` | **HQ** `op19.ensaio`: «Ensaio comparativo. Grupo de control: unidades sen historial. Grupo experimental: o seu.» |
| oleada 5 limpa | **HQ** `op19.grazas`: «Datos suficientes. Grazas pola súa colaboración.» |

---

### 20 · O último combate `COMPLEXO` · EXTRACCIÓN

**Lóxica.** ÓPTIMA atopou o Arquivo. Sen sectores, sen HQ que tirar. Hai
que **evacuar nomes**: cada unidade que sae polo punto de extracción
conta, e as que quedan dentro non volven.

**Gáñase ou pérdese de verdade.** Non hai vitoria total: hai unha conta.
O marcador non di «vitoria», di cantos saíron.

| Cando | Que pasa |
|---|---|
| `tras:60` | **HQ** `op20.peche`: «Peche de instalación en curso. Rógase abandonar o edificio con orde.» |
| `extraidos:1` | *silencio* |
| `hqPropio<:25` | **TUERCA** `op20.non`: «Non contes territorio. Conta nomes.» |
| tempo esgotado | `rematar` — co número que sexa |

**Saída.** Un só expediente sae do Protocolo e chega a publicarse. Un
accidente burocrático, non unha vitoria moral. ÓPTIMA segue existindo. O
Protocolo segue vixente.

Pero xa non é certo dicir que ninguén o sabía.

---

## 5 · A montaxe final

Non é unha operación e non leva gatillos. É `showMontaxe()`, que xa
existe, coa mesma interface de MONTAXE DESDE CERO que o xogador leva
vinte operacións usando.

O que cambia é o que di cada oco. Antes: *«Perna compatible.»* Agora:
*«Perna · FERRALLA · 2090.08.14.»* A pantalla non cambiou; o que o
xogador ve nela, si.

Mentres monta, o Arquivo prepara a páxina en silencio, unha ou dúas
palabras por peza. Ao colocar a última, e só entón, `REXISTRO PECHADO` e
a páxina completa de golpe. O robot abre os ollos, mira ao Diario, e
aparece o cursor:

```
Nome:
```

Que é `bautizoObrigatorio()`, que xa está feito. Corte a negro.

**A clave estrutural**: aquí é onde a campaña desemboca no modo libre. A
primeira misión do modo libre é a última da campaña. Isto resolve as tres
contradicións aparentes que xa estaban identificadas e non se repiten
aquí.

---

## 6 · Cadencia dos interludios

Os interludios xa existen e xa se disparan por estado, non por contador.
Este é o encaixe coas vinte operacións, para comprobar que non quedan
ocos longos nin dous seguidos:

| Tramo | Operacións | Interludios que caen aí |
|---|---|---|
| ARRANQUE | antes da 1 | `firmware` |
| MAQUINA | 1–6 | `optima`, `veteranos`, `restos`, `chatarra`, `radar` |
| NOME | tras bautizar | `primernombre` |
| MAQUINA | 7–12 | `taller`, `regreso`, `principios`, `estratexia`, `arquiveiros` |
| XENTE | 13–19 | `entrega`, `descanso` |
| EPILOGO | tras a 20 | `pradera` |

`ultimatransmision` dispárase na primeira derrota, caia onde caia. Se o
xogador non perde nunca, non o ve, e está ben.

**Punto a vixiar**: `entrega` esixe `opCount >= 15` **e** tres caídos
propios. Nunha partida limpa non sae, e é o interludio que explica o
caderno. Ou se baixa o limiar de caídos a dous, ou se acepta que hai
partidas nas que o caderno non se explica nunca — que tampouco é un
problema, se se acepta a conciencia.

---

## 7 · O que queda sen decidir

1. ~~Contraste macizo/chan.~~ **Decidido**: masa escura, chan lexible
   (`MACIZO_CLARO = false`). O interruptor queda por se hai que
   comparar outra vez.
2. **Se a campaña e o libre son unha partida ou dous gardados.** Afecta
   á operación 20 e á montaxe final, non a ningunha outra.
3. **Como se empalma o banco do primeiro día cos caídos da campaña.**
   Segue sendo a peza máis rendible de todas: `bancoPrimeiroDia()` xera
   hoxe 35 pezas anónimas.
4. **O da cantina leva designación ou non.** Aquí propúxose `T-07`. Que
   non a leve é máis fiel ao narrativo; que a leve permite que apareza no
   Diario, e o Diario é o protagonista.
5. **O ton do Mundial na operación 11.** Probar antes de comprometer.
6. **Se as pezas dos caídos poden reaparecer nun robot inimigo.** O
   narrativo dío; o sistema de recorrentes xa podería facelo.
