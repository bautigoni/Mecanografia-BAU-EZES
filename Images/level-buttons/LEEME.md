# Botones de nivel — cómo agregar el de una isla nueva

Cada isla tiene su propio botón de nivel, dibujado con el tema de su terreno:
pasto en las verdes, hielo en la del reloj, glaseado en la de caramelos. Las
quince ya están hechas. Este archivo es para cuando se sume la dieciséis.

El proceso completo son cuatro pasos y dura unos minutos. Lo único que no está
automatizado es una medición a ojo, y más abajo se explica por qué no puede
estarlo.

---

## 0. Antes de empezar: qué es un botón de nivel

Son **dos imágenes por isla**: el botón en reposo y el botón apretado (el
estado con el mouse encima). El juego las cruza al pasar el mouse, así que
tienen que estar dibujadas con la **misma cámara, el mismo tamaño y en la misma
posición del cuadro**. Si difieren, el botón pega un salto al pasar el mouse.

Encima del botón el juego dibuja **un número blanco grande**. De ahí sale la
condición que más se incumple al generar: el disco central tiene que ser de
**color parejo y de valor medio a oscuro**. Un centro claro deja el número
ilegible — le pasó a la isla 1, que quedó en 2.80:1 de contraste cuando el
mínimo aceptable para texto grande es 3:1.

---

## 1. Generar la lámina

Mandale a nanobanana el prompt de abajo **junto con la imagen de referencia**
`REFERENCIA-boton-clasico.png`, que está en esta misma carpeta. Esa referencia
trae los dos estados lado a lado, que es justo el formato que se pide de
vuelta: el modelo tiene un molde literal que copiar en vez de una descripción.

No mandes `btn-default.png` suelto: es sólo el estado libre, y sin ver el
apretado el modelo se inventa cómo se hunde el disco.

En el prompt, reemplazá el bloque `TEMA` por el de la isla nueva.

```
Te paso una imagen de referencia con un botón de nivel en dos estados: libre a
la izquierda, apretado a la derecha. Es para un juego infantil de islas
flotantes, estilo 3D suave y colores brillantes.

Rediseñá el botón COMPLETO con la temática de abajo: cambiá el material, el
color y los detalles de la base y del disco central, y sumá la decoración que
corresponda. No es decorar el botón de la referencia, es rehacerlo con otro
material.

Lo que NO puede cambiar, porque es lo que lo hace intercambiable con los otros:
- La silueta y la huella: misma base ovalada, mismas proporciones, mismo ancho.
- El disco elevado del centro, del mismo tamaño y a la misma altura.
- El ángulo de cámara, idéntico al de la referencia.
- El tamaño y la posición del botón dentro del cuadro.
- Los dos estados lado a lado, libre izquierda y apretado derecha, alineados
  entre sí: lo único que cambia entre uno y otro es que el disco central baja.
- Fondo liso de un solo color, sin texto ni etiquetas.
- Resolución alta: cada botón de al menos 900 px de ancho.

Condición funcional: encima del disco central el juego dibuja un número blanco
grande. El disco tiene que ser de color parejo y de valor medio a oscuro para
que ese número se lea. Nada muy claro ni muy detallado en el centro.

TEMA: <material de la base> / <color del disco central> / <decoración que le
pega al terreno de la isla>
```

Guardá el resultado acá, en `Images/level-buttons/`, como `btn-islandN.png`.

**Pedí PNG.** Con JPG anda igual, pero deja halo de compresión alrededor del
fondo y el recorte queda más sucio. La isla 2 vino en JPG y se nota.

**Sobre el fondo:** cualquier color liso sirve, el importador lo mide en vez de
asumirlo. Pero si el botón lleva partes **blancas o muy claras** — nieve,
merengue, hielo, pétalos — pedí explícitamente un fondo de un color que no
exista en el botón, un verde o un magenta fuerte. Contra un fondo blanco esas
partes son indistinguibles del fondo y el recorte se las come. Le pasó a la
isla 8: perdió la parte más pálida de su manto de nieve.

---

## 2. Medir la lámina

```bash
node scripts/measure-button-sheet.mjs Images/level-buttons/btn-island16.png
```

Devuelve algo así:

```
Images/level-buttons/btn-island16.png  1638x640   fondo rgb(255,255,255)
estados detectados: 2  [[100,737],[906,1543]]
gap sugerido: 806
  [0] x 100..737  y 120..515  alto 396  ancho 638  centroX 418.5
  [1] x 906..1543  y 120..515  alto 396  ancho 638  centroX 1224.5
```

**Qué mirar:**

- **"estados detectados: 2"**. Si dice 1, la lámina no tiene los dos estados
  separados o vinieron pegados. Volvé a generar.
- **Que los dos coincidan** en `y`, en `alto` y en `ancho`. Diferencias de uno
  o dos píxeles son normales (la sombra cambia al hundirse el disco).
  Diferencias de veinte o más significan que el modelo dibujó los dos botones
  a distinto tamaño, y eso hace que el botón salte al pasar el mouse. Volvé a
  generar.

De acá salen el **recorte** `[x, y, ancho, alto]` del estado libre y el **gap**.

---

## 3. Medir la base — el paso a ojo

```bash
node scripts/grid-button.mjs Images/level-buttons/btn-island16.png 100 120 638 396 .tmp/grid.png
```

(los cuatro números son el recorte del paso anterior)

Eso deja una imagen con una grilla de porcentajes encima. Mirala y anotá tres
cosas de la **base**, o sea del cuerpo del botón, **sin contar la decoración
que se sale de la huella**:

- `cx` — el centro horizontal, en px del recorte
- `cy` — la altura de su ecuador, la fila más ancha
- `w`  — su ancho

### Por qué esto no se puede automatizar

Se intentó de varias formas y ninguna aguanta las quince islas:

- **Por silueta** no sirve: cada isla saca la decoración fuera de la huella
  —pasto, cristales, flores, merengues, hojas, arena— y a veces de un solo
  lado. La isla 12 tiene la roca corrida a la izquierda y la arena derramada a
  la derecha.
- **Por color** tampoco: la decoración suele estar pintada del mismo material
  y color que la base.
- **Por inundación desde el centro** se escapa: los discos tienen degradé y
  brillo, y el relleno se fuga por el antialias.

### El truco cuando la silueta engaña

Si el botón es asimétrico, **el `cx` sacalo del disco central, no de la
silueta**: el disco es concéntrico con la base, así que su centro *es* el
centro del botón. Y medilo en la **franja alta del disco**, cerca de su borde
superior, donde lo que lo rodea es el aro del botón; más abajo cualquier
detección por color se escapa hacia el agua, el vidrio o el reflejo.

Este truco corrigió la 3 (el libro apoyado al costado corría el centro 8 px),
la 12 (12 px) y la 1 (21 px).

---

## 4. Importar

Agregá la línea a la tabla `SHEETS` de `scripts/import-level-button.mjs`:

```js
island16: { file: "btn-island16.png", crop: [100, 120, 638, 396], gap: 806,
            base: { cx: 340, cy: 246, w: 549 } },
```

Y corré:

```bash
node scripts/import-level-button.mjs island16
```

Sale algo así:

```
island16  escala 0.827  base 454 px (referencia 454)  dibujo 528x327 en 18,11
```

Deja los dos WebP en `public/assets/level-buttons/`.

### Verificar el centrado

Después de importar, comprobá que el disco quedó centrado en el lienzo (x=300
de 600). Si no lo está, corregí el `cx` de la tabla: **subir `cx` mueve el
botón a la izquierda**, bajarlo lo mueve a la derecha, y la conversión es
`px de correción ÷ escala`.

### Opción `huecos`

Si la decoración forma **lazos cerrados** —lianas que cuelgan, un asa— el fondo
que queda atrapado adentro no se puede alcanzar desde el borde y queda como una
mancha en medio del dibujo. Para eso está `huecos: true`.

Va **apagado por defecto y encendido sólo donde hace falta** (hoy, sólo la
isla 10). No se puede dejar prendido siempre: en un arte con grandes zonas del
color del fondo se las come — con la nieve de la isla 8 le arrancaba pedazos.

---

## 5. Darla de alta

En `src/utils/assets.ts`, agregá la línea a `LEVEL_BUTTON_BY_WORLD`:

```ts
island16: `${LEVEL_BUTTONS_DIR}/btn-island16`,   // <tema en una línea>
```

Una isla que no figure ahí cae al botón de piedra sin decorar (`btn-default`).
Eso ya no es el estado normal de nadie: queda como red de seguridad.

Después, `npm run build`.

---

## 6. Chequear el contraste del número

El número es blanco. Si el disco quedó claro, no se lee. Medilo:

```bash
node -e "
const sharp=require('sharp');
const lin=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
sharp('public/assets/level-buttons/btn-island16.webp').ensureAlpha().raw()
 .toBuffer({resolveWithObject:true}).then(({data,info})=>{
  const W=info.width,C=4;let r=0,g=0,b=0,n=0;
  for(let y=165;y<=265;y++)for(let x=255;x<=345;x++){const i=(y*W+x)*C;
   if(data[i+3]<200)continue;r+=data[i];g+=data[i+1];b+=data[i+2];n++}
  const L=0.2126*lin(r/n)+0.7152*lin(g/n)+0.0722*lin(b/n);
  console.log('contraste',(1.05/(L+0.05)).toFixed(2)+':1');
 });"
```

**Mínimo 3:1**, y de 4.5:1 para arriba se ve cómodo. Las quince actuales van de
2.80:1 (isla 1, la única floja) a 8.0:1.

Si queda flojo, lo mejor es **regenerar** pidiendo un disco más oscuro. Como
parche también se le puede bajar la luminosidad al disco sin tocar el resto:

```bash
node scripts/lighten-disc.mjs -0.30 entrada.webp salida.webp <cx> <cy> <rx> <ry>
```

Los cuatro últimos números son la elipse del disco dentro del lienzo de
600×445. Valores positivos aclaran, negativos oscurecen. Se usó en positivo con
la isla 11, a la que se le subió el disco un 18 % porque estaba muy apagado.

**Ojo:** ese pase se aplica *después* de importar. Si reimportás la isla, hay
que volver a correrlo o el disco vuelve al original.

### El color del número completado

El número va **blanco** mientras el nivel no está completado y **de un color
propio de la isla** cuando sí lo está. Ese color se calcula, no se elige a
dedo: se mide lo que el número tiene detrás en ese botón y se busca su
complementario partido, y de una paleta de tonos que se mantienen vivos se toma
el más cercano que pase 3.5:1.

Después de importar una isla nueva, regeneralo:

```bash
node scripts/level-number-colors.mjs
```

Imprime la tabla completa y, al final, las líneas listas para pegar en
`LEVEL_NUMBER_DONE` (en `src/utils/assets.ts`). Pegá sólo la línea de la isla
nueva: las otras catorce ya están y no cambian.

Esto es además la red para un disco demasiado claro. La isla 1 tiene el número
blanco en 2.80:1, por debajo del mínimo — su color de completado es un vino
oscuro y ahí sí se lee.

---

## 7. Ubicar los niveles

El botón nuevo aparece en su isla al instante, pero cae en las posiciones que
ya tenía esa isla. Para acomodarlos está el editor visual — ver **CLAUDE.md
§6.1**, "Placing levels".

Contá con **retocar el `scale` de los nodos de esa isla**. Las bases no salen
todas del mismo tamaño: van de 333 px (isla 9) a 454 px (islas 1, 11, 14, 15),
contra los 454 px del botón de referencia. Cuanto más se derrame la decoración
fuera de la huella, más chico tiene que quedar el botón para entrar en el
lienzo, y más `scale` va a necesitar esa isla.

---

## Archivos que intervienen

| Archivo | Qué hace |
|---|---|
| `REFERENCIA-boton-clasico.png` | La referencia que va con el prompt |
| `btn-islandN.png` | La lámina cruda tal como vino. **No se toca** |
| `scripts/measure-button-sheet.mjs` | Recorte y gap; verifica que los dos estados coincidan |
| `scripts/grid-button.mjs` | Grilla de % para medir la base a ojo |
| `scripts/import-level-button.mjs` | Tabla de medidas + recorte de fondo + encuadre → WebP |
| `scripts/lighten-disc.mjs` | Aclara u oscurece sólo el disco central |
| `src/utils/assets.ts` | `LEVEL_BUTTON_BY_WORLD`: qué isla usa qué botón |
| `public/assets/level-buttons/` | Los WebP que consume el juego |
| `public/assets/level-buttons/_backups/` | Originales antes de aclarar/oscurecer |
