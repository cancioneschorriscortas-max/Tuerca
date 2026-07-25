# TUERCA · Guión de gravación de voces

> **Xerado**, non escrito a man: `node tools/voces.js` cruza as claves que o
> código pide de verdade coas frases do dicionario. Se cambia o xogo, este
> documento queda vello — rexenérao ou comproba co informe de cobertura.

**37 frases × 3 linguas = 111 ficheiros.**

## Como se nomean

O ficheiro chámase **exactamente como a clave**, en `.ogg`, na carpeta da lingua:

```
voces/gl/op.inicio.ogg
voces/es/hq.peche30.ogg
voces/en/mun.gol.ogg
```

Nada máis. Ao acabar: `python tools/xerar_manifest.py`. Non hai que tocar código.

## As tres voces

| Voz | Quen é | Ton |
|---|---|---|
| **MANDO / HQ** | Máquina operativa. Datos, prioridades, silencio. | Plano e seco, ritmo constante. **Nunca berra**, nin no aviso de base baixo ataque: sobe a urxencia, non o volume. Se dubidas, aburre máis. |
| **COMENTARISTA** | Radio deportiva do Mundial. | Enerxía, saturación, retranca de tarde de domingo. Aquí **si** se berra. |
| **ÓPTIMA** | A corporación. | Amable, pulido, lixeiramente inhumano. O ton de quen le unha nota de prensa sobre despedimentos. |

Idealmente **tres persoas distintas**. Que o HQ e ÓPTIMA soen igual regala a mellor broma do xogo.

---

## Operación

*Voz: **MANDO***

> Sóanse en TODAS as partidas, incluído o duelo online. Se só gravas un bloque, que sexa este.

| Clave | Galego | Castelán | Inglés |
|---|---|---|---|
| `op.derrota` | Operación fracasada. Retirada inmediata. | Operación fracasada. Retirada inmediata. | Operation failed. Withdraw immediately. |
| `op.inicio` | Operación iniciada. Boa sorte, comandante. | Operación iniciada. Buena suerte, comandante. | Operation underway. Good luck, commander. |
| `op.vitoria` | Obxectivo cumprido. Volvede á base. | Objetivo cumplido. Volved a la base. | Objective complete. Return to base. |

---

## Avisos de campo

*Voz: **MANDO***

| Clave | Galego | Castelán | Inglés |
|---|---|---|---|
| `r.baseAtaque` **\*** | Base baixo ataque. Todas as unidades dispoñibles, ao HQ. | Base bajo ataque. Todas las unidades disponibles, al HQ. | Base under attack. All available units, fall back to HQ. |
| `r.radarDeles` | Perdemos o radar central. | Hemos perdido el radar central. | We have lost the central radar. |
| `r.radarNoso` | Radar central baixo control noso. | Radar central bajo nuestro control. | Central radar under our control. |

**\*** `r.baseAtaque` — o texto do dicionario leva "(clic para ir)", que é interface.

---

## Partes do cuartel xeral

*Voz: **MANDO***

| Clave | Galego | Castelán | Inglés |
|---|---|---|---|
| `hq.clima` **\*** | Parte meteorolóxico. Visibilidade reducida. | Parte meteorológico. Visibilidad reducida. | Weather report. Visibility reduced. |
| `hq.colapso` | Produción inimiga colapsada. Peche de operación en 90 segundos: recollan o campo. | Producción enemiga colapsada. Cierre de operación en 90 segundos: recojan el campo. | Enemy production collapsed. Operation closes in 90 seconds: police the field. |
| `hq.crisolInicio` | Simulacro con lume real. Cinco oleadas. Sobrevivide. | Simulacro con fuego real. Cinco oleadas. Sobrevivid. | Live-fire drill. Five waves. Survive. |
| `hq.crisolVitoria` | Cinco oleadas. Todos os datos son nosos. Volvemos á casa. | Cinco oleadas. Todos los datos son nuestros. Volvemos a casa. | Five waves. All the data is ours. We are going home. |
| `hq.escudo` | HQ inimigo baixo ESCUDO DE SUBMINISTRO. Só cae se controlas MÁIS sectores ca el. | HQ enemigo bajo ESCUDO DE SUMINISTRO. Solo cae si controlas MÁS sectores que él. | Enemy HQ under SUPPLY SHIELD. It only falls if you control MORE sectors than they do. |
| `hq.grises` | Sinais non identificadas. Múltiples. Orixe: administración central. | Señales no identificadas. Múltiples. Origen: administración central. | Unidentified signals. Multiple. Origin: central administration. |
| `hq.hq50` | Integridade estrutural ao cincuenta por cento. Requírese presenza. | Integridad estructural al cincuenta por ciento. Se requiere presencia. | Structural integrity at fifty percent. Presence required. |
| `hq.muroRestos` | Ecos estruturais anómalos: restos aliados incrustados nun muro. Demolición requirida. | Ecos estructurales anómalos: restos aliados incrustados en un muro. Demolición requerida. | Anomalous structural echoes: allied remains embedded in a wall. Demolition required. |
| `hq.oleada` **\*** | Oleada neutralizada. Recarguen. | Oleada neutralizada. Recarguen. | Wave neutralized. Reload. |
| `hq.oxidados` | Restos oxidados. Recuperación fallida. | Restos oxidados. Recuperación fallida. | Remains oxidized. Recovery failed. |
| `hq.peche10` | Dez segundos. | Diez segundos. | Ten seconds. |
| `hq.peche30` | Peche en 30 segundos. | Cierre en 30 segundos. | Closing in 30 seconds. |
| `hq.peche60` | Peche en 60 segundos. | Cierre en 60 segundos. | Closing in 60 seconds. |
| `hq.portador` **\*** | Sinal de material propio nunha unidade hostil. Recuperádeo. | Señal de material propio en una unidad hostil. Recuperadlo. | Friendly materiel detected on a hostile unit. Recover it. |
| `hq.prodBaixa` | Produción por debaixo do 40%. Prioridade: supervivencia. | Producción por debajo del 40%. Prioridad: supervivencia. | Production below 40%. Priority: survival. |
| `hq.radarHint` | Radar central sen enlazar. Sen el non se detectan MISIÓNS SECUNDARIAS nin material propio en campo inimigo. | Radar central sin enlazar. Sin él no se detectan MISIONES SECUNDARIAS ni material propio en campo enemigo. | Central radar not linked. Without it, SIDE MISSIONS and friendly materiel in enemy territory go undetected. |
| `hq.radarOff` | Enlace de radar perdido. | Enlace de radar perdido. | Radar link lost. |
| `hq.radarOn` | Enlace de radar establecido. Cobertura ampliada. | Enlace de radar establecido. Cobertura ampliada. | Radar link established. Coverage extended. |
| `hq.sectoresPerdidos` | Rede de sectores comprometida. Reavaliando. | Red de sectores comprometida. Reevaluando. | Sector network compromised. Reassessing. |
| `hq.senResposta` **\*** | Operador... sen resposta. | Operador... sin respuesta. | Operator... no response. |
| `hq.sinalPerdida` | Sinal de material propio perdida. | Señal de material propio perdida. | Friendly materiel signal lost. |
| `hq.sqDone` | Obxectivo secundario completado. | Objetivo secundario completado. | Secondary objective complete. |
| `hq.superioridade` | Superioridade industrial confirmada. | Superioridad industrial confirmada. | Industrial superiority confirmed. |
| `hq.tecnoloxia` | Tecnoloxía non identificada detectada no sector central. Requírese ENXEÑEIRO. | Tecnología no identificada detectada en el sector central. Se requiere INGENIERO. | Unidentified technology detected in central sector. ENGINEER required. |

**\*** `hq.clima` — leva {label} e {vis}.  
**\*** `hq.oleada` — leva o número de oleada.  
**\*** `hq.portador` — leva a peza e o nome.  
**\*** `hq.senResposta` — leva o nome do operador.

---

## Mundial

*Voz: **COMENTARISTA***

| Clave | Galego | Castelán | Inglés |
|---|---|---|---|
| `mun.final` **\*** | Pitido final! Ata aquí o partido. | ¡Pitido final! Hasta aquí el partido. | Full time! That is all. |
| `mun.gol` **\*** | GOL! Sector dominado! Que berre o hangar! | ¡GOL! ¡Sector dominado! ¡Que grite el hangar! | GOAL! Sector dominated! Let the hangar roar! |
| `mun.golRival` **\*** | Gol do rival... silencio no hangar. Hai que apertar. | Gol del rival... silencio en el hangar. Hay que apretar. | They score... the hangar goes quiet. Time to push. |
| `mun.minuto85` | Minuto 85! Quen queira algo deste partido, que o busque AGORA! | ¡Minuto 85! ¡Quien quiera algo de este partido, que lo busque AHORA! | Minute 85! If you want something from this match, go get it NOW! |
| `mun.primeiro` **\*** | Primeira baixa do partido! Xa hai aceite no céspede! | ¡Primera baja del partido! ¡Ya hay aceite en el césped! | First casualty of the match! There is oil on the pitch! |
| `mun.remontada` | REMONTADA EN MARCHA! Isto está VIVO! | ¡REMONTADA EN MARCHA! ¡Esto está VIVO! | COMEBACK ON! This one is ALIVE! |
| `mun.saqueHQ` **\*** | Comeza o encontro! Que rode o balón! | ¡Comienza el encuentro! ¡Que ruede el balón! | And we are under way! Let it roll! |

**\*** `mun.final` — leva o marcador.  
**\*** `mun.gol` — leva o marcador.  
**\*** `mun.golRival` — leva o marcador.  
**\*** `mun.primeiro` — non hai texto no dicionario; ademais úsase para as dúas baixas, a nosa e a deles, así que ten que valer para ambas.  
**\*** `mun.saqueHQ` — non hai texto no dicionario.

---

## Ao ler en alto

**As cifras están en díxitos** ("30 segundos", "40%", "minuto 85"). Dise o
número, obviamente — pero dío **igual nas tres linguas**, porque o mesmo clip
non se vai regravar por iso.

**As palabras en MAIÚSCULAS** son énfase para a pantalla. Ao gravar,
tradúcense en acento: *ESCUDO DE SUBMINISTRO*, *MÁIS sectores*, *ENXEÑEIRO*.
Non se berran, márcanse.

---

## ÓPTIMA: aínda non hai nada que gravar

A terceira voz está deseñada e non ten unha soa liña conectada. `br.comunicadoDe`
existe no dicionario pero **ningunha chamada a pide**, así que gravala hoxe sería
gravar para nada.

Se queres a ÓPTIMA falando, é unha liña de código: unha cabeceira falada
("Comunicado de ÓPTIMA") ao pintar o comunicado no panel de estado, co corpo
quedando escrito. **Unha soa gravación serve para infinitos comunicados.**
Dimo e cablease antes de que graves.

Hai outras dúas na mesma situación —`r.canal` e `r.hqVermello`— que tiñan
ficheiro e ninguén as pedía. Están fóra deste guión a propósito.

---

## O que NON se grava

- `hq.sqPrima` — É un anaco que se pega ao final de hq.sqDone (" Prima: {n} de chatarra"), non unha frase. O importe varía. Queda en texto.

Tampouco se grava nada dos robots entre eles: **iso son chíos procedurais e
seguirano sendo**. A voz humana é só do mando ao comandante, do comentarista e
de ÓPTIMA.

## Orde suxerida

1. **Operación + avisos de campo** (6 frases × 3 = 18 ficheiros). Con isto o xogo xa fala en todas as partidas.
2. **Mundial** — o modo con máis personalidade, e o que máis se nota.
3. **Partes do cuartel xeral** — o bloque longo, pero mecánico: mesmo ton, frases curtas, gravables dun tirón por lingua.

## Gravación

- Micro a un palmo, **fóra do eixo** (evita as explosivas).
- **Sala seca**: manta detrás e debaixo. O paso banda do post non quita a reverb, multiplícaa.
- WAV, **sen compresión nin EQ**. O carácter engádese despois; se vai na gravación, non hai volta atrás.
- Un ficheiro longo por bloque e córtase despois. Parar e retomar cambia o ton entre liñas.
- **Tres tomas seguidas de cada frase** e escolles despois.
- Medio segundo de silencio antes e despois.
- **Di a clave en voz alta antes de cada frase** ("op punto inicio, toma un"). Córtase despois e aforra unha hora de identificar ficheiros.
- Picos arredor de **−12 dBFS**. O `loudnorm` iguala despois; o clipping non se arranxa.

## Post

```bash
ffmpeg -y -i entrada.wav \
  -af "loudnorm=I=-18:TP=-2,highpass=f=250,lowpass=f=3400" \
  -c:a libvorbis -q:a 3 voces/gl/op.inicio.ogg
```

**MANDO e COMENTARISTA** co paso banda completo: é o son de radio.

**ÓPTIMA sen `highpass`/`lowpass`.** Non fala por radio de campaña, fala por
megafonía corporativa: limpa e próxima mentres todos os demais soan a lata. Ese
contraste é de balde e di máis do personaxe ca calquera diálogo.

## Comprobar

```bash
python tools/xerar_manifest.py     # rexenera o manifesto
node tools/voces.js                # cobertura: que falta, que sobra, que está roto
node tools/voces.js --guion en     # o que queda por gravar nesa lingua
```

O informe avisa de tres fallos silenciosos: **orfas** (hai ficheiro e o xogo non
o pide), **manifesto roto** (promete un ficheiro que non está) e **sen texto**
(sen gravación nin texto, o chío sintetizaría o nome da clave).
