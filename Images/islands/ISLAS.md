# Separar el arte de una isla en dos capas

Guía para pasar de **una imagen con todo junto** a las **dos capas** que el
juego carga: el cielo por un lado y la isla recortada por el otro. Para los
botones de nivel, ver `BOTONES.md` en esta misma carpeta.

## Por qué se separa

Hoy casi todas las islas son una sola imagen 16:9 con el cielo pintado adentro.
Eso obliga a que entre entera en pantalla, así que en una Chromebook 3:2 quedan
bandas arriba y abajo que se rellenan con la misma imagen ampliada y
desenfocada. Un parche.

Separadas, el cielo cubre la pantalla entera y se recorta sin costo (no tiene
nada posicionado encima), y la isla se ajusta sola. Ahí es responsive de verdad.

## El orden importa

1. **Primero arreglar los pedestales**, sobre la imagen combinada.
2. **Después separar** en cielo + isla.
3. **Después importar** con `node scripts/import-island-art.mjs islandN`.
4. **Al final ubicar los niveles** con `?editor=1`.

No al revés. Separar una isla le cambia la caja del escenario (pasa de la
relación de aspecto de la escena entera a la de la isla recortada), así que
cualquier posición de nivel ajustada antes se tira a la basura. Y sumar o
quitar un pedestal mueve todo de nuevo.

## Cuántos pedestales necesita cada isla

Uno por nivel. El conteo sale de `src/data/activities.ts`:

| Pedestales | Islas |
|---|---|
| **7** | 1 a 14 |
| **8** | 15 |

**Siete en todas, salvo la 15.** Esa es la final del juego: repasa siete
destrezas distintas (letras, palabras, frases, signos, correo, atajos y
búsquedas) y encima cierra con el gran final, así que necesita ocho. Es la
única excepción y es a propósito.

Si el arte muestra **más** pedestales que niveles tiene esa isla no pasa nada:
los de sobra quedan como decoración y el juego los ignora. Si muestra **menos**,
sí hay que agregar, porque queda un nivel flotando sobre el pasto.

---

## Prompt 1 - devolver sólo el fondo

Mandá la imagen combinada con este texto.

```
Te paso la ilustración de una isla flotante para un juego infantil.

Quiero SOLO EL FONDO: la misma imagen pero con la isla principal eliminada por
completo, como si nunca hubiera estado ahí.

Donde estaba la isla, continuá el cielo y las nubes de forma natural, con la
misma luz, el mismo degradado y la misma paleta que ya tiene el resto de la
imagen. Que no quede ni un pedazo de tierra, pasto, roca, cascada, camino,
plataforma ni objeto que estuviera apoyado sobre ella. Tampoco su sombra ni el
halo de luz que proyectaba sobre las nubes.

Lo que SÍ se queda, tal cual está:
- El cielo entero, su degradado y su color.
- Todas las nubes que no tapaba la isla.
- Las islas chiquitas del fondo, las lejanas, las estrellitas y cualquier
  elemento decorativo que flote lejos. Eso es fondo, no es la isla.
- El mismo encuadre, el mismo ángulo de cámara y el mismo tamaño de imagen.

No agregues nada nuevo. No cambies el estilo ni la saturación. No recortes ni
reencuadres: la imagen que devuelvas tiene que poder superponerse exactamente
con la original.
```

**Si la isla ocupa casi todo el cuadro** (por ejemplo la 11, que es más un
paisaje que una isla suelta), agregale al final:

```
En esta imagen la isla ocupa casi toda la superficie. Reconstruí el cielo y las
nubes por detrás en toda esa zona, inventando lo que haga falta para que quede
un cielo completo y creíble de borde a borde.
```

Guardalo como `sky-source.jpg` (o `.png`) en `Images/islands/islandN/`.

---

## Prompt 2 - devolver sólo la isla

Misma imagen combinada, este otro texto.

```
Te paso la ilustración de una isla flotante para un juego infantil.

Quiero SOLO LA ISLA, recortada, con FONDO TRANSPARENTE. Devolvela como PNG con
canal alfa de verdad: transparente, no blanco ni de un color liso.

Se queda todo lo que forma parte de la isla o está apoyado en ella: el pasto y
el terreno de arriba, los pedestales o plataformas circulares, los caminos, la
roca y la tierra de abajo, la vegetación, las cascadas, los edificios, los
objetos y toda la decoración que esté sobre la isla.

Se va todo lo demás: el cielo, el degradado, las nubes de atrás, las islas
lejanas del fondo, las estrellitas y cualquier cosa que flote separada de la
isla principal.

Reglas:
- No redibujes la isla. Tiene que quedar idéntica a como está: mismos colores,
  mismas texturas, mismos detalles, mismas sombras propias. Es un recorte, no
  un rediseño.
- No la muevas ni la reescales. Mismo ángulo de cámara, misma posición dentro
  del cuadro, mismo tamaño de imagen que la original.
- El borde tiene que ser limpio. Nada de halo blanco ni de restos de nube
  pegados al contorno.
- Las cascadas que se desvanecen en las nubes: cortalas donde se desvanecen,
  con la transparencia degradando suave, sin dejar un corte recto.
```

Guardalo como `island-source.png` en `Images/islands/islandN/`. **Tiene que ser
PNG**: el JPG no guarda transparencia, y una isla opaca tapa el cielo entero.
El importador avisa si el archivo llegó sin canal alfa, así que si te
equivocaste te enterás antes de verlo en pantalla.

---

## Prompt 3 - agregar un pedestal

Sobre la imagen **combinada**, antes de separar.

```
Te paso la ilustración de una isla flotante de un juego infantil. Sobre la isla
hay varias plataformas circulares planas: son los pedestales donde el juego
apoya los botones de nivel.

Agregá UN pedestal más, para que queden N en total.

El nuevo tiene que ser indistinguible de los que ya están:
- Mismo material, mismo color, mismos bordes y mismo grosor.
- Mismo diámetro, salvo el cambio de tamaño que corresponda por perspectiva si
  queda más adelante o más atrás que los otros.
- Mismo ángulo, apoyado en el suelo de la misma manera. Que no parezca pegado
  encima ni flotando.
- Conectado a los caminos que unen a los demás, con el mismo tipo de camino.

Ubicalo en un espacio libre de la isla, bien separado de los otros, sin tapar
edificios ni elementos importantes. La cara de arriba tiene que quedar plana,
despejada y sin nada encima: ahí va el botón del nivel.

TODO lo demás queda exactamente igual. No muevas, no agrandes y no reacomodes
ningún pedestal existente. No cambies el terreno, la vegetación, el cielo, la
luz ni el encuadre. Mismo tamaño de imagen.
```

Reemplazá la **N** por el total que tiene que quedar, según la tabla de arriba.

---

## Prompt 4 - quitar un pedestal

```
Te paso la ilustración de una isla flotante de un juego infantil. Sobre la isla
hay varias plataformas circulares planas: son los pedestales donde el juego
apoya los botones de nivel.

Quitá UNO, para que queden N en total. Sacá <cuál: el de más arriba a la
izquierda / el que está pegado a la cascada / etc.>.

Donde estaba, dejá el terreno de la isla como si el pedestal nunca hubiera
estado: mismo pasto, misma tierra, misma textura y misma vegetación que hay
alrededor. Si algún camino llegaba hasta ese pedestal, redirigilo con
naturalidad hacia los que quedan, o terminalo de forma que no quede cortado
en seco.

TODO lo demás queda exactamente igual. No muevas ni reacomodes los pedestales
que quedan: tienen que estar en la misma posición y del mismo tamaño que ahora.
No cambies el cielo, la luz, la paleta ni el encuadre. Mismo tamaño de imagen.
```

Decile cuál sacar describiéndolo por su posición: los modelos aciertan mucho
más con "el de abajo a la derecha, al lado de la cascada" que con "uno
cualquiera".

---

## Qué revisar antes de importar

- **La isla tiene transparencia de verdad**, no un fondo blanco.
- **Las dos capas se superponen bien.** Abrilas una encima de la otra: la isla
  tiene que caer donde estaba en la original.
- **El cielo no tiene un fantasma de la isla**: una mancha, una sombra o un
  pedazo de roca que quedó.
- **Los pedestales están despejados arriba.** Ahí va el número del nivel.

El importador se encarga del resto: recorta el margen transparente sobrante,
convierte a WebP y marca la isla como separada en `assets.ts`.

```bash
node scripts/import-island-art.mjs islandN
```
