# Roadmap — o arranque de TUERCA

Estado: **borrador para estudar.** Non se implementou nada.

---

## O problema, medido

Non é que falten mecánicas de apego. É **cando as coñece o xogador**.

Comprobado no código:

- `freshData()` devolve `units: []` e sen chatarra.
- O despregue sae das caixiñas marcadas no roster, e na primeira partida
  non hai ningunha.
- Polo tanto **a primeira batalla xógase enteira con unidades saídas da
  fábrica**: `mkUnit` sen ficha persistente dálles nome ao chou e cero
  operacións.
- O taller non aparece ata que morre alguén.

Resultado: a primeira partida de TUERCA é **un RTS anónimo**. Nomes,
confianza, vínculos, taller e arquivo están todos apagados xusto no
momento en que alguén decide se segue xogando.

## Por que a proposta funciona

**Efecto IKEA.** Está medido: valoramos moito máis o que axudamos a
construír, e quen personaliza un personaxe aguanta máis tempo no xogo cá
quen recibe un pregenerado. Non é o diálogo o que crea o apego: é teres
posto ti as mans.

**Titorial diexético.** Cando as mecánicas existen dentro da ficción, o
xogador non ten que separar «xogo» de «historia»: acepta as regras como
leis dese mundo. E a recomendación repetida é ensinar **só o que fai
falla para o minuto seguinte**, xogando, sen fiestras que ler.

**E aquí o lore xa estaba escrito.** As imaxes traen o laboratorio
v0.9β, o rexistro «SERIE D-07 a D-12 → ERROR · CAUSA: DESCONOCIDA», as
observacións «comportamento inestable, fallos aleatorios no núcleo», e
un post-it que di «verificar cód. moral v0.9β». O xogo leva desde sempre
chamándolle a ÓPTIMA «Unidade Central de Optimización e Entusiasmo
**v0.9β**».

Un mapa de probas dese firmware non é un titorial disfrazado: **é a
escena que explica o xogo enteiro.**

---

## FASE 1 · O arranque

**Ficción:** unha fábrica de ÓPTIMA nun mapa de probas da nova versión de
firmware.

1. **Banco de pezas base.** Ao empezar, o xogador ten un xogo completo de
   pezas e monta o seu primeiro robot. Non é unha pantalla nova: é
   `showMontaxe`, que xa existe, xa ten vista previa e xa monta por
   slots.
2. **Nome automático.** O robot sae con designación de fábrica —`R-01`—
   como sae todo o que fai ÓPTIMA.
3. **A mensaxe do firmware.** «A versión 0.9β permite asignar
   identificadores personalizados ás unidades.» ÓPTIMA preséntao como
   unha **función**. Iso é o truco: para ela é unha etiqueta editable;
   para o xogo é o principio de que os robots sexan alguén.
4. **Bautizo obrigatorio.** O sistema non deixa continuar sen renomear.
5. **O interludio do PRIMEIRO NOME**, que xa está feito, dispárase aquí
   en vez de por casualidade. Pasa de agocho a segunda pantalla do xogo.

**Custo estimado:** medio. `showMontaxe` e o interludio existen; o novo é
o guión de arranque e o bloqueo do bautizo.

**Riscos:**
- Un arranque obrigatorio molesta a quen rexoga. Fai falla que se salte
  en partidas posteriores, e non só que se poida saltar: que **non
  apareza**.
- O bloqueo do renomear ten que aceptar teclados e idiomas raros sen
  deixar a ninguén atrapado nun diálogo.

---

### 1.b · A PRIMEIRA DECISIÓN, e é económica

O banco de pezas non é un regalo: é un **presuposto de chatarra**. Con
el móntase o primeiro robot, e hai dous camiños:

- **Estándar** — un GRUNT con todas as pezas de GRUNT. Sae **barato**, e
  o que sobra queda para a operación seguinte.
- **Mesturado** — un GRUNT con brazo de SNIPER, ou o que se lle ocorra.
  Sae **caro**, e gástase case todo.

**Ningún dos dous está castigado.** Un dáche marxe; o outro dáche algo
que non ten ninguén máis.

E aquí está o motivo polo que isto é mellor ca un titorial: **quen aforra
montando estándar está facendo exactamente o que ÓPTIMA quere.** Quen se
gasta o presuposto por ter algo único xa está, no primeiro minuto,
resistíndose. O xogo pregunta «quen es ti?» **sen unha soa liña de
texto**, e a resposta vai na factura.

A xustificación en ficción é directa e non hai que escribila: *a liña de
ÓPTIMA está optimizada para montaxes estándar; unha mestura precisa
recalibración, e cóbrase.* **A empresa fai que saia caro ser distinto.**

#### O prezo actual vai no eixe contrario

Comprobado no código:

    total = MONTAXE_COST (60) + RECON_RECAMBIO (14) por oco SEN cubrir

    todo con pezas reais ......  60
    todo con recambio xenérico . 158

Hoxe o caro é o **recambio de fábrica**, e usar pezas reais é o barato —
lóxico, porque as recuperaches ti nun campo de batalla. Pero ese eixe é
**real fronte a xenérico**, non **homoxéneo fronte a mesturado**.

Fan falla os dous, e non se pisan:

| eixe | pregunta | cando pesa |
|---|---|---|
| real / xenérico | ¿rapiñaches ou mercas? | campaña, tras as baixas |
| homoxéneo / mesturado | ¿estándar ou teu? | sempre, e sobre todo ao empezar |

No arranque só actúa o segundo, porque todas as pezas do banco son
«reais». Despois conviven.

**Calibración:** o presuposto ten que dar **para un robot mesturado
xusto**, para que aforrar signifique algo e gastar tamén. Se dá de sobra,
non hai decisión; se non chega, non hai escolla.

### 1.c · A DÉBEDA, e non fai falla programar a regra

Seis pezas a dez de chatarra: **presuposto 60**. Unha peza doutra clase
custa máis. Se non escolles peza, entra a que corresponde por defecto.

E se te pasas, **quedas en chatarra negativa**.

Non hai tope que impoñer nin diálogo que bloquee. Simplemente **déixase
baixar de cero**, e o resto xa está no código:

| en débeda | que pasa | por que |
|---|---|---|
| infantería | **segue producíndose** | GRUNT, HEAVY, ENGINEER, SNIPER e BOMBARDERO non teñen `cost`: só `prod`, que é tempo |
| tanque (40) · torreta (45) · muro (10) | **bloqueados** | comparan `DATA.chatarra < cost` antes de gastar |
| chatarra recollida | **paga a débeda** | `DATA.chatarra += ganada` |

Comprobáronse **todas** as lecturas de `DATA.chatarra` no código: ou
amosan (un negativo pinta ben), ou comparan antes de gastar (bloquea,
que é o que queremos), ou suman (paga soa). **Ningunha rompe.**

Segues sendo parte de ÓPTIMA: o HQ non deixa de funcionar. O que non
podes é mercar xoguetes ata saldar.

#### Por que isto é bo, e non só cómodo

**Empezas o xogo endebedado con ÓPTIMA por querer que o teu robot fose
distinto.** Esa é a tese do xogo enteiro nun número na esquina da
pantalla, sen unha liña de diálogo.

**O precedente:** *Hardspace: Shipbreaker*. Es un traballador endebedado
cunha corporación, todo o que rapiñas paga a débeda, e cóbranche o
aluguer do equipo, o da vivenda, os intereses e ata o osíxeno. A empresa
gaña igual.

**E a crítica que lle fan importa máis có eloxio:** esa débeda non chega
a ser presión real, porque non ten fin nin se pode perder por ela. Queda
en decorado.

A versión de TUERCA evítao por unha razón sinxela: **só te podes
endebedar na primeira misión.** É unha decisión, non unha lousa. Ten
dentes mentres dura esa operación —sen tanque, sen torreta, sen muro— e
despois acábase. Non se converte nunha economía paralela que haxa que
manter para sempre.

#### O que hai que decidir aínda

- **Canto máis custa unha peza allea.** Se 15 fronte a 10, un mesturado
  completo son 90 e a débeda máxima 30. Se 20, son 120 e debes 60 —tanto
  coma o presuposto enteiro—. O número decide se a decisión é un
  pinchazo ou un compromiso, e **non sae do código: hai que xogalo**.
- **Como se amosa un negativo.** Hoxe o HUD pon `⚙ CHATARRA: -30` sen
  máis. Iso funciona pero non comunica: convén que se lea como débeda e
  non como erro.
- **Se a débeda se menciona.** ÓPTIMA cobrándoa en ficción —«axuste de
  conta por montaxe non estándar»— vale máis ca un número vermello.

## FASE 2 · O presuposto continúa

Tras a primeira batalla o personaxe entra en campaña co que sobrou, e
gaña ou perde segundo o resultado.

**Pregunta resolta:** non hai segunda moeda. O presuposto **é** chatarra
— a que xa existe, xa se gaña por vitoria e xa se gasta en taller,
equipamento, tanques e torretas. O que cambia é que **empeza cun número
en vez de con cero**, e que o que non gastas no arranque vai contigo.

**Custo:** baixo. É un valor inicial en `freshData()` e o eixe de prezo
novo na montaxe.

---

## FASE 3 · A fábrica tira do hangar

Hoxe `mkUnit` sen ficha crea un descoñecido. Se tes un veterano de doce
operacións sentado no hangar, a fábrica cóspeche igual un estraño.

**Cambio:** producir unha unidade en batalla trae a alguén do hangar se
hai quen. Só se non queda ninguén se fabrica novo.

**E do lado inimigo é mellor aínda**, porque `voltRoster` xa garda os
veteranos de VOLT. Que a fábrica vermella tire deles convérteo en
información de combate: «volveu o que che matou a MARTELO».

**Custo:** medio-baixo. **Risco:** toca a batalla, que é o que máis
probas ten e o que peor perdoa. Vai despois da fase 1 a propósito.

---

## FASE 4 · Que o arquiveiro teña ritmo

**O achado:** o diario de TUERCA non ten ritmo, ten **primeiras veces**.
Os capítulos dispáranse coa primeira baixa, o primeiro reensamblado e o
fin de acto. Cando xa che pasaron esas cousas, **cala**.

RimWorld chámalle **AI Storyteller** e a idea é a contraria: non simula
todo, **dosifica** os acontecementos para manter tensión e ritmo. As
boas historias non guionizadas saen de darlle liberdade ao xogador e
despois quitarlle algo de control cun suceso que non esperaba.

**O que faría falla:** algo que vixíe cantas operacións levas sen que
pase nada memorable, e que **provoque** en vez de esperar.

**Custo:** alto, e é o menos definido dos catro. Non o tocaría ata ter
o arranque asentado.

---

## Orde e por que

1. **Fase 1**, porque arranxa o problema medido e case todo existe.
2. **Fase 2**, porque dálle consecuencia á primeira batalla.
3. **Fase 3**, porque converte o hangar en reserva real.
4. **Fase 4**, cando as tres anteriores estean asentadas.

## O que este documento NON di

- Non hai estimacións de tempo. Nesta sesión demostrouse que as miñas
  son optimistas.
- A calibración do presuposto non está feita: hai que xogar para
  saber canto é «xusto para un mesturado».
- Nada disto está probado con ninguén xogando. É deseño sobre papel.
