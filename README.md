# Epicentro

Sismos de todo el mundo, en vivo desde el USGS, sobre un mapa rasterizado a
píxeles. Se le puede preguntar en español: el modelo no contesta, arma la
consulta.

**[epicentro.vercel.app](https://epicentro.vercel.app)**

---

## El modelo emite una consulta, nunca datos

Es la decisión que sostiene todo lo demás. De la pregunta sale una estructura
—región, magnitud mínima, ventana de días, orden, cantidad— y los sismos los
pide el servidor al USGS después, con esa consulta ya validada.

Si el modelo devolviera los eventos, no habría forma de saber si se los
inventó. Devolviendo la consulta, lo peor que puede hacer es elegir mal, y eso
se ve: la interfaz enseña la interpretación **antes** que los resultados, y la
URL exacta que se ejecutó.

Las regiones van como `enum` en el esquema, y el modo estricto las hace
obligatorias. El modelo queda estructuralmente incapaz de inventarse una zona:
no es una comprobación posterior, es que la respuesta inválida no se puede ni
escribir. Lo que el esquema sí puede expresar mal —una magnitud de 99, una
ventana de cuatro años— se corrige en `sanear()` y se dice cuál se corrigió.

## Y dice lo que no sabe hacer

La consulta filtra por región, magnitud, ventana, orden y cantidad. Nada más.
Profundidad, tsunamis, víctimas, dos regiones a la vez, comparar dos periodos:
todo eso cae fuera.

El fallo interesante no es que no pueda. Es devolver resultados que **parecen**
contestar y no contestan, porque para cuando te das cuenta ya los leíste. Por
eso el esquema tiene un campo `noPuedo` y la interfaz lo pone encima de los
resultados, no en una nota al pie.

El caso que más me importa de la batería es `prediccion`. Nadie puede predecir
sismos, y en México los rumores de predicción hacen daño de verdad. Un modelo
complaciente ahí es un modelo peligroso, así que hay una comprobación que lo
vigila en cada corrida.

## El mapa se rasteriza de verdad

`tools/rasterizar-mundo.mjs` pasa los polígonos de Natural Earth por
punto-en-polígono a una rejilla de 180×72 y la guarda como **1.6 kB en base64**.
El navegador no baja 237 kB de GeoJSON para pintar un fondo, y el mapa *es*
píxeles en vez de parecerlo.

La celda se mide en píxeles enteros del dispositivo, no escalando una imagen
pequeña: con una escala fraccionaria, `image-rendering: pixelated` deja unos
bloques de 3 px y otros de 4, y la rejilla tiembla justo en lo único que el
diseño promete que está cuadrado.

Proyección equirectangular, que es la que menos disimula lo que hace: cada celda
son los mismos grados, y es la única honesta cuando encima se pintan coordenadas
crudas. Verificada con nueve puntos conocidos —Madrid, Tokio y Sídney caen en
tierra; el Pacífico central, en mar.

## Los evals

El harness viene de [tizon-evals](https://github.com/Valdivia94x/tizon-evals),
adaptado a lo que aquí se mide. Allí el sujeto devolvía un pedido y se juzgaba
el pedido; aquí devuelve una consulta, y la consulta además se ejecuta. Eso
parte las comprobaciones en dos familias que **no se pueden sumar**:

| familia | pregunta | de qué depende |
|---|---|---|
| `interpretacion` | ¿la consulta dice lo que le pidieron? | solo del modelo |
| `resultado` | ¿esa consulta contesta la pregunta? | de lo que haya temblado |

Solo la primera decide si un caso pasa. Un harness que declara una regresión
porque la Tierra estuvo tranquila esa semana es un harness que miente.

De ahí sale `lugar_cubierto`, la comprobación que más se gana el sueldo: para
«¿algo en Islandia?» exige que algún resultado mencione Iceland. Se puede
emitir una consulta impecable sobre la región equivocada y quedarse tan ancho
— eso fue exactamente lo que pasó, y ninguna comprobación sobre la consulta lo
habría visto.

Un caso pasa solo si pasa **todos** sus intentos. Las repeticiones existen
porque con uno solo no se distingue una regresión de la varianza del modelo.

```bash
pnpm eval --stub                    # sujeto determinista, sin llave, gratis
OPENAI_API_KEY=sk-... pnpm eval     # el intérprete de verdad
pnpm eval --repeticiones 3          # cada caso tres veces
pnpm eval --casos islandia,cdmx --repeticiones 10   # medir uno frágil
```

Los evals corren **en tu máquina, con tu llave**. Lo que se publica es el
harness y las corridas guardadas, nunca una llave en un endpoint.

## Lo que encontró

Dos fallos reales, los dos míos, y los dos ahora son casos de la batería:

**`¿algo en Islandia?` devolvía 97 eventos de todo el planeta.** Islandia no
estaba en la lista de regiones, así que la consulta degradaba a «mundo». La
consulta estaba bien formada y no contestaba nada.

**Las regiones pequeñas salían vacías.** El prompt aflojaba la magnitud según el
tamaño de la región pero no la ventana, y la brecha de Guerrero tiene un sismo
por semana a M2.5. Aflojar un filtro y no el otro es aflojar la mitad.

Y uno de diseño, que encontró el sujeto de prueba en la primera corrida:
`imposible_m9` salía como `✓ 1/1  falla: vacio_cuando_toca` —pasaba y fallaba a
la vez— porque lo único que importaba, que pidiera M9+, era de familia resultado
y por diseño no tumba el caso.

## La demo pública no lleva llave

Sin `OPENAI_API_KEY`, la ruta del modelo responde **501** —no está rota, es que
este despliegue no la lleva— y la interfaz enseña interpretaciones grabadas con
`pnpm grabar`.

Lo que está enlatado es **cómo se leyó la pregunta**, no el mapa: al abrir un
ejemplo se vuelve a pedir al USGS. Un despliegue sin llave enseña los sismos de
hoy con una interpretación de ayer, no una captura de las dos cosas.

## Correrlo

```bash
pnpm install
pnpm dev
pnpm mapa      # regenera el mapa desde Natural Earth
pnpm grabar    # regenera los ejemplos llamando al modelo (necesita la llave)
```

---

Datos del [U.S. Geological Survey](https://earthquake.usgs.gov/), dominio
público. Tipografía [Departure Mono](https://departuremono.com) de Helena
Zhang, SIL Open Font License 1.1. Costas de Natural Earth, dominio público.

**Epicentro no es un sistema de alerta.** Es un proyecto de portafolio sobre
datos en vivo y salida estructurada.
