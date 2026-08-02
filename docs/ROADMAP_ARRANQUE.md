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

## FASE 2 · Presuposto

Tras a primeira batalla, o personaxe entra en campaña **cun presuposto
limitado que depende de gañar ou perder**.

**Estado actual:** a chatarra xa existe, xa se gaña por vitoria e xa se
gasta en taller, equipamento, tanques e torretas. O que non hai é
**presuposto de partida** nin un teito que faga escoller.

**Pregunta aberta que NON teño resolta:** ¿o presuposto substitúe á
chatarra ou convive con ela? Dúas moedas confunden; unha soa igual non
distingue «o que gañei nesta operación» de «o que teño para a campaña».
Isto quero estudalo antes de propoñer nada.

**Custo:** baixo se é un número inicial. Alto se é un sistema aparte.

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
- A fase 2 ten unha pregunta de deseño sen resolver.
- Nada disto está probado con ninguén xogando. É deseño sobre papel.
