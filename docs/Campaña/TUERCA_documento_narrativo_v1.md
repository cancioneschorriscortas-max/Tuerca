# TUERCA
## Documento narrativo · v1 (consolidado)
**Documento de traballo do proxecto. Substitúe os borradores e addenda previos.**

---

## Brúxula

> A morte pon fin a unha vida. O esquecemento pon fin a unha historia. TUERCA
> loita para que ningunha historia remate onde remata un corpo.

Esta frase non decide que mecánicas entran no xogo — para iso segue vixente o
filtro orixinal do proxecto: *se unha mecánica non axuda a lembrar unha unidade
despois de varias partidas, non entra.* Son dous niveis distintos e complementarios:

- **O filtro** decide se unha mecánica pertence a TUERCA.
- **A brúxula** decide se unha escena, xa admitida, demostra de que trata
  TUERCA de verdade.

Ante calquera escena nova, a pregunta non é "queda ben?". É: *isto demostra a
brúxula, ou só a ilustra?*

---

## Ficha

| | |
|---|---|
| **Xénero** | Ciencia ficción industrial. Drama bélico de retagarda. |
| **Formato** | Campaña de RTS territorial, operacións encadeadas con retagarda persistente. |
| **Logline** | Un administrador de campo que non debía facer amigos escribe un nome nun caderno — e pasa vinte operacións intentando que ese nome non se borre. |
| **Desexo do protagonista** | Concreto e mecánico: manter viva a súa primeira unidade e o rexistro de todas as que veñan despois. |
| **Ton** | Burocrático e cálido á vez. O horror non vén de máquinas monstruosas: vén de formularios ben cubertos. |

---

## Mundo

Hai catro xeracións que non morre unha persoa nunha guerra.

ÓPTIMA INDUSTRIES fabrica os exércitos de ambos os bandos, arbitra as disputas,
recolle os restos, e borra as memorias entre despregamentos. O sistema funciona.
Ninguén discute que funciona.

O que ninguén dixo en voz alta é que, para que funcione, ninguén pode contar
como alguén.

## O xogador

Un administrador de campo. Contrato de ÓPTIMA, categoría técnica, sen rango
militar. Nunca se ve o seu rostro nin se oe a súa voz. As unidades diríxense a
el como *comandante*, un tratamento de cortesía que ÓPTIMA nunca corrixiu
porque mantén ás máquinas atentas.

---

# ACTO I · O TALLER
*Operacións 1–6*

## 1. Primeiro día

Non hai firmware nin protocolo na primeira páxina. Hai un taller e un supervisor.

*"Non lles poñas nomes. Fai que o traballo sexa máis difícil, para eles e para ti."*

É a única norma que se explica en voz alta en toda a campaña. O motivo detrás
dela **nunca se di ao xogador**; descóbrese xogando, non lendo.

Cinco minutos despois, o xogador xa a incumpriu. Hai un caderno enriba dunha
banca de traballo, non é seu, ten unha páxina en branco. Escribe un nome.

O firmware v0.9β non esperta por erro. Esperta porque, por primeira vez, existe
algo que merece ser lembrado.

> **Clase introducida: GRUNT.** A máis simple, para que o peso da escena estea
> no nome, non na arma.
>
> **Ancoraxe mecánica.** Nace aquí a unidade que o xogador terá — ou perderá —
> durante toda a campaña.

## 2. Reciclaxe rutineira

Remata a operación 1. Mensaxe automática, cortés, idéntica á que recibe
calquera unidade despois de calquera misión:

> *Grazas por utilizar ÓPTIMA INDUSTRIES.
> A súa unidade será reciclada ao finalizar a avaliación.*

Non é unha ameaza dirixida. É o texto estándar de sempre. O xogador entende que
a norma do supervisor non era caprichosa.

## 3. Aprender a volver

Operacións pequenas. Non buscan territorio: buscan regresar. O xogador
descobre que reconstruír non é fabricar de novo — é impedir que desapareza. As
pezas conservan rastros: non memorias completas, hábitos. Unha maneira de
cubrirse. Unha preferencia por certa ruta.

A memoria non desaparece do todo. Só cambia de lugar.

> **Clase introducida: ENGINEER**, cando hai unha unidade caída e pezas
> recuperables e sen reconstrución non se pode seguir. O acto I xa fala de
> reconstruír en vez de fabricar; o ENGINEER é esa idea feita clase.
>
> **Ancoraxe mecánica.** RECONSTRUCTOR R1, herdanza de habilidades por peza.

## 4. Unha páxina máis

Non se explica quen escribe. Aparece outra páxina no caderno, letra distinta
á do día anterior, no mesmo lugar — como se alguén máis o usase entre
operacións.

> *Hoxe esquecín algo. Non sei o que era.*

O xogador non sabe se é para el. Segue lendo igual.

## 5. O formulario D-77

Primeiro punto de non retorno. Unha unidade viva pódese desmontar. Con
confianza alta é **DOAZÓN**: hai despedida. Sen ela é **REQUISA**: hai formulario.

> *Formulario D-77 (desmantelamento non consentido) selado sen incidencias. É
> un pracer traballar con profesionais.*

O xogador cúbreo. É a primeira vez que fai, coa súa propia man, o que a
mensaxe de reciclaxe ameazaba facerlle a el.

> **Ancoraxe mecánica.** `desmantelarVivo()`, distingue consentimento por confianza.

## 6. O taller ten un nome

Peche do acto I. Chega á base unha unidade sen valor militar: non combate, non
dá ordes. Repara radios que xa funcionan.

*Escena concreta:* o HEAVY rompe unha cunca sen querer. El suspira, colle
outra do estante, e segue coa radio. Non di nada. O xogador xa o coñece.

Cando chega un veterano novo, xa sabe o seu nome antes de que se presente.
Ninguén sabe como.

> **Nota de implementación.** Este personaxe é unha unidade máis do roster coa
> cantina como escenario, sen liña de combate útil. Se funciona é porque o
> xogador o nota, non porque haxa parágrafo que llo explique.

---

# ACTO II · O FOGAR
*Operacións 7–15*

## 7. Os que teñen nome

A cantina, o memorial, o taller. Un bebe sempre da mesma taza. Outro non se
senta nunca.

Empezan as perdas. Unha cadeira queda baleira. Unha taza deixa de usarse.
Ninguén comenta nada. O da radio garda a taza el mesmo, sen que llo pidan.

## 8. VOLT

Comandante de ÓPTIMA que tamén conserva o seu roster. Coñece os seus
veteranos. Lémbraos entre operacións. Non por compaixón — porque é máis
eficiente.

VOLT lembra e segue queimando arquivos. É a proba de que lembrar non fai a
ninguén bo — só o fai responsable. Vólvese contra o xogador de inmediato: el
tamén lembra e tamén desmonta.

> **Clase introducida: HEAVY**, nun enfrentamento sostido contra VOLT que
> ningunha unidade lixeira aguanta. Primeira vez que o xogador se enfronta a
> alguén que razoa coma el.

## 9. Os Grises

Equipos de recuperación que atacan a ambos os bandos por igual: os dous teñen
material que reclamar. Sen nomes, sen roster, sen baixas rexistradas. Cando cae
un Gris, non hai obituario — hai un albarán.

## 10. A torre

Unha posición elevada que ningunha outra clase pode neutralizar sen baixas
graves.

> **Clase introducida: SNIPER.** Encaixa co xiro do acto II cara ás perdas
> individuais, non ás operacións en bloque.

## 11. O espectáculo

O Mundial: torneos retransmitidos, comentarista, marcador. A xustificación
pública do Protocolo. O xogador inscribe o seu escuadrón sabendo que alimenta o
mecanismo que fai posible o borrado. Faino igual: precisa as pezas.

## 12. ÓPTIMA sen rostro

Por primeira vez, o argumento completo. Non hai vilán. Hai unha lóxica difícil
de rebater: se ninguén lembra, ninguén busca vinganza.

ÓPTIMA non odia aos robots. Cre que esquecer é máis seguro que lembrar. E ten
razón nunha parte — o que se discute non é a eficacia, é o prezo.

## 13. Quen escribe o caderno

Recoñécese o padrón: certas letras máis presionadas cando a páxina fala de
perdas. Erros riscados e corrixidos. Non se revela quen é. Vese que é alguén,
cansado, que dubida antes de escribir certas liñas e as escribe igual.

> *Non quero que desaparezan dúas veces.*

---

# ACTO III · O BORRADO
*Operacións 16–20*

## 14. A guerra contra o esquecemento

Recuperar corpos antes da reciclaxe. Salvar expedientes. Evacuar veteranos.
Rescatar diarios.

Unha operación destaca: un muro con restos aliados incrustados no formigón.
Non foi atrocidade — foi obra pública. Alguén precisaba material.

> **Clase introducida: BOMBARDERO**, ante unha estrutura que só cede con
> potencia de fogo alta, a costa de baixas propias probables. Chega ao final a
> propósito: a clase máis destrutiva, cando a historia xa fala do prezo de todo isto.
>
> **Ancoraxe mecánica.** SQ2.

## 15. O Crisol

Simulacro con lume real, cinco oleadas. O que se proba non son as unidades: é
se un roster con memoria acumulada rende mellor ou peor có limpo. O xogador
xera os datos que xustificarán a súa propia eliminación.

## 16. O último combate

ÓPTIMA atopa o Arquivo. Operación final, real: gáñase ou pérdese de verdade.
Mídese en nomes evacuados, non en territorio.

## 17. Un nome, publicado

Non a sociedade enteira espertando — sería demasiado limpo. Un só expediente
sae do Protocolo e chega a publicarse: un accidente burocrático, non unha
vitoria moral. ÓPTIMA segue existindo. O Protocolo segue vixente. Pero xa non
é certo dicir que ninguén o sabía.

---

# O PECHE · Montaxe final

A campaña non ten epílogo escrito despois do combate. Ten unha última decisión
xogable, e esa decisión **é** o final.

```
Campaña  →  Montaxe final  →  Créditos
```

Nada de texto despois de colocar a última peza.

## A pantalla

É a mesma interface de **MONTAXE DESDE CERO** que o xogador xa usou de cedo na
campaña para crear reforzos, cando aínda non tiña historia detrás. Naquel
momento cada oco dicía algo neutro: *"Perna compatible."* Agora, vinte horas
despois, a mesma casilla di: *"Perna · FERRALLA · 2090.08.14."* A pantalla non
cambiou. O que o xogador ve nela, si.

## Quen está presente

Dous supervivintes, non o escuadrón enteiro. Un deixa unha ferramenta. O outro
márchase. Silencio. (Vinte unidades arredor parecerían unha cerimonia; dúas
parecen algo íntimo.)

Mentres se monta, sóase unha vez a mesma mensaxe automática de ÓPTIMA do
principio da campaña — recuperación rematada, compoñentes clasificados,
proceda á reciclaxe. Ninguén responde. O xogador segue montando.

## As pezas candidatas

Para cada ranura hai varias pezas candidatas concretas, procedentes de caídos
distintos. **Non se presentan como saída dun algoritmo**: xustifícanse dentro
do mundo — son as que quedaron preparadas, ou as únicas recuperables, ou as
compatibles. O xogador nunca debe pensar "o sistema puxo isto aquí"; ten que
pensar "isto era o que había".

Por detrás, si hai un criterio: as candidatas están sesgadas cara ao maior
contraste narrativo dispoñible nesa partida concreta (vínculos rotos, causas
de morte opostas, cronoloxía significativa). Cando ese material existe na
partida, ten que atoparse e poñerse diante. Cando non existe, cáese en
candidatas neutras sen problema — a montaxe ten que funcionar igual.

**As pezas non elixidas non se destrúen nin desaparecen para sempre.** Quedan
no mundo: requisadas, roubadas, tratadas como chatarra por outra facción.
Nunca volverán loitar co xogador, pero poden reaparecer — nun robot inimigo,
nunha operación futura doutra partida. É coherente coa brúxula: ninguén remata
onde remata o seu corpo, nin sequera as pezas que quedan atrás.

## Como escribe o Arquivo

O Arquivo **recompila, non escribe**. Nunca interpreta, nunca inventa. Rexistra
feitos, non conclusións:

| Non | Si |
|---|---|
| "Nunca se terían levado ben." | "Nunca coincidiron nunha operación." |
| "Volveron a atoparse." | "Compartiron 14 despregamentos. O último, o mesmo día." |

**Non escribe sobre os vivos.** Mentres o xogador escolle pezas, o Arquivo non
mostra texto — só vai preparando a páxina en silencio, cunha ou dúas palabras
por peza como moito:

> *Perna: sete muescas.*
> *Torso: pintura azul, baixo o blindaxe.*
> *Brazo: non volveu só.*

Ao colocar a última peza, e só entón, o rexistro péchase e a páxina completa
aparece de golpe:

> *REXISTRO PECHADO.*

Antes dese instante, ese robot non formaba parte da historia. Montalo é o acto
que o fai entrar nela.

## O último acto

Rexistro pechado. O robot abre os ollos. Non mira á cámara nin ao xogador —
mira ao Diario. Non sabe aínda quen é. Xa ten unha historia agardando.

Silencio. Aparece un cursor:

```
Nome:
```

Nada máis. Sen titorial, sen explicación. É a última entrada do xogo.

Corte a negro. Créditos.

## Robustez en dúas capas *(requisito de deseño, non opcional)*

- **Capa 1, sempre funciona.** Montar un robot con candidatas neutras, aínda
  sen ningunha historia detrás. Precedente xa existente: no prototipo do
  xerador, sen doadores, o veredicto di "Unidade de fábrica. Sen historia."
- **Capa 2, aparece se existe.** Trazas, contraste emocional, texto cruzado por
  vínculos.

O final ten que sentirse completo aínda que o xogador chegase sen vínculos
fortes nin caídos memorables.

---

## Personaxes

| | |
|---|---|
| **O comandante** (xogador) | Administrador de campo. Sen rostro, sen voz. Desexo concreto: manter viva unha unidade que non debía importarlle. |
| **A primeira unidade** | Nomeada na operación 1. Sen protección de guión: pode morrer como calquera outra. |
| **Quen escribe o caderno** | Presenza sen identidade confirmada. Cansazo, dúbida, erros riscados. Nunca se resolve quen é. |
| **O da cantina** | Sen valor militar. O primeiro en saber os nomes. Non protagoniza nada e sostén todo. |
| **VOLT** | Lembra e segue borrando. O espello incómodo. |
| **ÓPTIMA** | Nunca é unha persoa. É unha mensaxe automática, un formulario, un pé de páxina cortés. |
| **Os Grises** | Sen nomes, sen roster. |

---

## Tema

TUERCA non fala de robots. Fala de persoas. A pregunta: que nos converte en
alguén? Os recordos, o corpo, o nome, ou o feito de que alguén decida
lembrarnos?

O xogador queda atrapado entre TUERCA e ÓPTIMA porque toma exactamente as
mesmas decisións que critica: desmonta, recicla, sacrifica, decide quen merece
outra oportunidade. Nunca se lle coloca por riba do dilema — oblígaselle a
vivir dentro del.

---

## Pendente de decidir

1. **A identidade do que escribe o caderno** — manter ambigua ou pechar.
2. **A función de puntuación de contraste** para as pezas candidatas — que
   combinacións de datos pesan máis (vínculo, causa de morte, cronoloxía).
3. **Cantas pezas candidatas por ranura** — probablemente entre dúas e tres.
4. **Se as pezas non elixidas deixan rastro visible** no Diario xeral da
   partida, ou só se menciona que existiron.
5. **Se o gatillo de cada clase é restrición mecánica dura ou suxestión forte**
   con alternativa máis custosa.
6. **O ton do Mundial dentro da campaña** — probar antes de comprometer.
7. **Pezas incompatibles que requiren adaptación** — aparcado. Comprobar
   primeiro se un texto e unha penalización estatística abondan sen minixogo novo.
8. **Non elixir nome e que quede en branco para a seguinte partida** — aparcado.
   É un final alternativo, non un pulido; require decisión de deseño propia.
