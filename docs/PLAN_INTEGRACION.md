# Plan de integración — do canon ao código

Estado: **plan.** Non implementado.

Documentos de referencia: `LORE_O_ESPERTAR.md` (canon narrativo) e
`ROADMAP_ARRANQUE.md` (números e fases).

---

## O achado que abarata todo

Ao mapear cada momento da historia contra o código, resulta que **case
todo é un interludio**.

O sistema de `21-interludio.js` xa fai exactamente o que pide o canon:
pantalla enteira, imaxe de fondo mandando, panel de texto á dereita, dúas
voces distinguidas por cor, condicións de disparo, tramos ordenados e
control de que non se repitan.

**Non hai que construír o vehículo da historia. Está feito.** O que fai
falla é darlle dous permisos que hoxe non ten e escribirlle o contido.

## Inventario: que existe e que non

| momento do canon | mecanismo | estado |
|---|---|---|
| Montar o primeiro robot | `showMontaxe` | **existe** |
| Presuposto e débeda | `DATA.chatarra` | **existe** (só falta que empece en 80 e poida ir a negativo) |
| Prezo homoxéneo/mesturado | — | **NOVO** |
| Bautizo obrigatorio | `renameUnit` | existe, falta o bloqueo |
| «07K escribe o teu nome» | interludio `primernombre` | **existe** |
| O caderno sobre a mesa | interludio | imaxe **existe** (`entregadediariodetuerca`) |
| Coñecer o arquiveiro | interludio | falta imaxe |
| Voces dos sete TUERCA | `14-diario.js` | existe o diario, falta a atribución |
| Liñas reliquia sen traducir | i18n | **NOVO** (e fará saltar unha proba, a propósito) |
| Cálculo do herdeiro | `ops`, `compa`, `medals`, `recoveries`… | **os datos existen**, falta a fórmula |
| O final | interludio, tramo EPILOGO | imaxe **existe** (`necesitooutrotuerca`) |

**Só tres cousas son de verdade novas:** o eixe de prezo, a fórmula do
herdeiro, e o permiso para que un interludio se dispare fóra do debrief.

---

## ETAPA 1 · Que os interludios poidan falar antes da batalla

Hoxe `interludioQuizais()` só se chama desde `btnBack`, é dicir **ao
volver dunha operación**. O arranque necesita interludios **antes de que
exista ningunha operación**.

**Cambio:** poder chamalo tamén desde o hangar ao arrancar, e engadir un
tramo novo por diante:

    TRAMOS = ['ARRANQUE', 'MAQUINA', 'NOME', 'XENTE', 'EPILOGO']

O tramo `ARRANQUE` contén o guión do primeiro día. Todo o demais queda
igual, e a regra de que o tramo manda sobre a voz segue valendo.

**Risco:** baixo. **Proba que xa o vixía:** a de que o tramo nunca
retrocede.

## ETAPA 2 · O primeiro día

Secuencia, e cada paso ten xa o seu mecanismo:

1. **Interludio de ÓPTIMA** — mapa de probas do firmware v0.9β. Tramo
   `ARRANQUE`, voz `OPTIMA`. Imaxe: `historiafirmware09b`, que hoxe está
   reservada para o final e **encaixa mellor aquí**.
2. **Taller** — `showMontaxe` en modo primeira vez: presuposto 80, seis
   ocos, peza estándar 10 e allea 20.
3. **A mensaxe do firmware** — «a versión 0.9β permite asignar
   identificadores personalizados ás unidades». Voz de ÓPTIMA,
   presentado como función.
4. **Bautizo obrigatorio** — `renameUnit` sen poder cancelar.
5. **Interludio do PRIMEIRO NOME** — xa existe, xa ten a imaxe da man de
   robot escribindo. Só cambia cando se dispara.

**O que hai que escribir:** o texto de 1 e 3, nas tres linguas.
**O que hai que programar:** o modo primeira vez do taller e o bloqueo do
bautizo.

## ETAPA 3 · O prezo

Único eixe novo de mecánica:

    peza da clase do chasis .... 10
    peza doutra clase ......... 20
    presuposto inicial ........ 80

E deixar que `DATA.chatarra` baixe de cero. **Non hai que impoñer nada
máis:** as cinco clases de infantería non custan chatarra (só tempo), e
tanque, torreta e muro xa comproban antes de gastar. En débeda, o HQ
segue e os xoguetes non.

**Onde:** `MONTAXE_COST` e `RECON_RECAMBIO` en `12-debrief-hangar.js`,
máis un valor inicial en `freshData()`.

**Sen resolver:** como se amosa un negativo para que lea como débeda e
non como erro.

## ETAPA 4 · O caderno, e despois a persoa

**Tras a primeira operación:** interludio, tramo `ARRANQUE`, voz
`TUERCA`. Imaxe do caderno sobre a mesa. Texto: as tres liñas de 01A.

Non aparece ninguén.

**Cinco operacións despois** (número a axustar xogando): interludio de
coñecer o arquiveiro. **Falta a imaxe** — un robot escribindo, visto por
primeira vez.

Aquí é onde se decide unha cousa que quedou aberta no canon: **se 07K
asina os interludios de voz TUERCA que xa existen.** Se si, as quince
pezas escritas gañan autor sen tocarlles unha coma.

## ETAPA 5 · As sete voces no diario

O diario xa garda capítulos. Fáltalle **de quen son**.

- Campo `autor` no capítulo (`'07K'`).
- Costume por autor ao pintar: 01A asina coa data completa, 03C non
  asina, 05F engade un engrenaxe, 06H tacha, 07K letra firme.
- **Liñas reliquia**: mesmo texto nas tres linguas, marcadas
  explicitamente para que a proba de traducións non as tome por
  descoido. Ese salto da proba é a funcionalidade, non o problema.

Na campaña só escribe 07K. Os outros seis aparecen como **páxinas
vellas** que se poden ler no Arquivo — e é aí onde o xogador nota que
non as escribiu o mesmo.

## ETAPA 6 · O herdeiro e o final

**Os datos xa están todos**: `ops`, `compa`, `medals`,
`criticalSurvivals`, `recoveries`, `unitsRecovered`, `recoveredFrom`,
`reensamblado`, `renacido`.

O que non existe é **como se pesan**, e é o risco de deseño máis grande
que queda: se sempre gaña o mesmo tipo de unidade —o ENGINEER que repara,
ou o que máis operacións leva— o final deixa de significar nada. **Ten
que poder saír calquera.**

**O final:** interludio, tramo `EPILOGO`, imaxe `necesitooutrotuerca` (xa
convertida). Unha man distinta, máis vella, escribindo `TUERCA 08M`.

**Sen resolver:** que condición o dispara.

---

## Orde, e por que

1. **Etapa 1** — sen isto non hai nada máis. É pequena.
2. **Etapas 2 e 3 xuntas** — son o mesmo momento: non ten sentido montar
   sen presuposto nin cobrar sen taller.
3. **Etapa 4** — o pago emocional do arranque. Xa con imaxe.
4. **Etapa 5** — mellora o que xa hai; non bloquea nada.
5. **Etapa 6** — a última, e a que máis pode saír mal.

## O que este plan non promete

- **Non hai estimacións de tempo.**
- **A calibración non está feita**: nin o presuposto, nin cando aparece o
  arquiveiro, nin a fórmula do herdeiro. Ningunha desas sae do código:
  **hai que xogalas**.
- Falta unha imaxe: coñecer o arquiveiro por primeira vez.
- Nada disto se probou con ninguén xogando.
