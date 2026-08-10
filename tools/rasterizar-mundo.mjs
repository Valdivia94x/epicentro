#!/usr/bin/env node
/**
 * Convierte los polígonos de tierra de Natural Earth en una rejilla de píxeles.
 *
 *   node tools/rasterizar-mundo.mjs
 *
 * El mapa se rasteriza de verdad, una sola vez y en tiempo de construcción, en
 * lugar de dibujar vectores y pixelarlos con un filtro. Sale a `content/mundo.ts`
 * como una cadena en base64, así que el navegador no descarga 237 kB de GeoJSON
 * ni ejecuta punto-en-polígono para pintar un fondo.
 *
 * Proyección equirectangular: longitud y latitud van directas a x e y. Es la
 * proyección que menos disimula lo que hace —cada celda son los mismos grados—
 * y la única honesta cuando lo que se pinta encima son coordenadas crudas.
 */
import { writeFile } from "node:fs/promises";

const FUENTE =
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_land.json";

const ANCHO = 180; // 2° por celda
const ALTO = 90;
// El mundo entero, de polo a polo. El mapa plano recorta al pintar porque la
// Antártida le ocupa un quinto del alto sin aportar sismos, pero el ráster no
// puede recortarla: el globo la necesita o le sale un agujero en el polo sur.
const LAT_MAX = 90;
const LAT_MIN = -90;

/** Lo que el mapa plano enseña de todo esto. */
const RECORTE = { latMax: 80, latMin: -64 };

/** Rayo horizontal: cuenta cruces de aristas a la derecha del punto. */
function dentro(x, y, anillo) {
  let d = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      d = !d;
    }
  }
  return d;
}

const respuesta = await fetch(FUENTE);
if (!respuesta.ok) {
  console.error(`\nNo se pudo bajar Natural Earth: HTTP ${respuesta.status}\n`);
  process.exit(1);
}
const geo = await respuesta.json();

// Un anillo por polígono con su caja envolvente: descartar por caja evita correr
// punto-en-polígono 128 veces por celda cuando casi siempre falla a la primera.
const formas = [];
for (const rasgo of geo.features) {
  for (const anillo of rasgo.geometry.coordinates) {
    let x0 = 180,
      x1 = -180,
      y0 = 90,
      y1 = -90;
    for (const [x, y] of anillo) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    formas.push({ anillo, x0, x1, y0, y1 });
  }
}

const bits = new Uint8Array(Math.ceil((ANCHO * ALTO) / 8));
let tierra = 0;

for (let fila = 0; fila < ALTO; fila++) {
  // Centro de la celda, no su esquina: una isla estrecha que cruce el borde
  // se pierde igual, pero el error queda repartido en vez de sesgado al norte.
  const lat = LAT_MAX - ((fila + 0.5) / ALTO) * (LAT_MAX - LAT_MIN);
  for (let col = 0; col < ANCHO; col++) {
    const lon = -180 + ((col + 0.5) / ANCHO) * 360;

    let esTierra = false;
    for (const f of formas) {
      if (lon < f.x0 || lon > f.x1 || lat < f.y0 || lat > f.y1) continue;
      if (dentro(lon, lat, f.anillo)) {
        esTierra = true;
        break;
      }
    }

    if (esTierra) {
      const i = fila * ANCHO + col;
      bits[i >> 3] |= 1 << (i & 7);
      tierra++;
    }
  }
}

const contenido = `// Generado por tools/rasterizar-mundo.mjs — no editar a mano.
// Natural Earth 110m (dominio público) rasterizado a ${ANCHO}×${ALTO} celdas.

export const MUNDO = {
  ancho: ${ANCHO},
  alto: ${ALTO},
  latMax: ${LAT_MAX},
  latMin: ${LAT_MIN},
  /** Filas que enseña el mapa plano. El globo las usa todas. */
  recorte: { desde: ${(LAT_MAX - RECORTE.latMax) / 2}, hasta: ${(LAT_MAX - RECORTE.latMin) / 2} },
  /** Un bit por celda, en orden de lectura, empaquetado a base64. */
  bits: "${Buffer.from(bits).toString("base64")}",
} as const;

/** ¿Es tierra la celda (columna, fila)? */
export function esTierra(datos: Uint8Array, columna: number, fila: number) {
  const i = fila * MUNDO.ancho + columna;
  return (datos[i >> 3] & (1 << (i & 7))) !== 0;
}

/** Descomprime los bits una sola vez. */
export function desempacar() {
  const crudo = atob(MUNDO.bits);
  const datos = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) datos[i] = crudo.charCodeAt(i);
  return datos;
}

/** Coordenadas del mundo a celda, en la rejilla completa de polo a polo. */
export function aCelda(longitud: number, latitud: number) {
  const columna = Math.floor(((longitud + 180) / 360) * MUNDO.ancho);
  const fila = Math.floor(((MUNDO.latMax - latitud) / 180) * MUNDO.alto);
  return {
    columna: ((columna % MUNDO.ancho) + MUNDO.ancho) % MUNDO.ancho,
    fila: Math.min(MUNDO.alto - 1, Math.max(0, fila)),
  };
}

/** La misma celda pero en coordenadas del mapa plano, que empieza más abajo.
    Devuelve null cuando el punto cae fuera de lo que ese mapa enseña. */
export function aCeldaPlana(longitud: number, latitud: number) {
  const p = aCelda(longitud, latitud);
  if (p.fila < MUNDO.recorte.desde || p.fila >= MUNDO.recorte.hasta) return null;
  return { columna: p.columna, fila: p.fila - MUNDO.recorte.desde };
}
`;

await writeFile("content/mundo.ts", contenido);

const porcentaje = Math.round((tierra / (ANCHO * ALTO)) * 100);
console.log(
  `\n${ANCHO}×${ALTO} celdas · ${tierra} de tierra (${porcentaje}%) · ${Math.ceil((ANCHO * ALTO) / 8)} bytes\n`,
);

// Vista rápida en la terminal: si el mapa sale mal, se ve aquí y no en el navegador.
for (let fila = 0; fila < ALTO; fila += 2) {
  let linea = "";
  for (let col = 0; col < ANCHO; col += 1) {
    const i = fila * ANCHO + col;
    linea += bits[i >> 3] & (1 << (i & 7)) ? "█" : "·";
  }
  console.log(linea);
}
