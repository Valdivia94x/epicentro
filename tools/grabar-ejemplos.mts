/**
 * Graba las interpretaciones de ejemplo llamando al modelo de verdad.
 *
 *   OPENAI_API_KEY=sk-... pnpm dev        # en una terminal
 *   pnpm grabar                           # en otra
 *
 * Lo que se publica son estas interpretaciones, no los sismos: el despliegue sin
 * llave las reproduce y pide los eventos al USGS en el momento. Así la demo
 * pública enseña datos de hoy con una interpretación de ayer, en vez de una
 * captura de pantalla de las dos cosas.
 *
 * Hay que volver a correrlo cada vez que cambie el prompt. Unos ejemplos
 * grabados con un prompt viejo enseñan un comportamiento que el sistema ya no
 * tiene, que es peor que no enseñar ninguno.
 */
import { writeFile } from "node:fs/promises";

const BASE = process.env.EPICENTRO_URL ?? "http://localhost:3000";

const PREGUNTAS = [
  "¿Qué tan fuerte fue lo de Chiapas?",
  "sismos de más de 5 en el pacífico este mes",
  "¿ha temblado cerca de la Ciudad de México?",
  "los cinco más grandes del año en todo el mundo",
  "¿algo en Islandia?",
  "terremotos de más de 9 grados esta semana",
];

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ejemplos = [];

for (const [i, pregunta] of PREGUNTAS.entries()) {
  process.stdout.write(`  ${String(i + 1).padStart(2)}. ${pregunta} `);

  let intentos = 0;
  for (;;) {
    const r = await fetch(`${BASE}/api/consulta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pregunta }),
    });

    // El límite por IP es del servidor y aplica también a esta herramienta. Se
    // espera en vez de subirlo: un límite que se salta el que lo escribió no es
    // un límite.
    if (r.status === 429 && intentos < 5) {
      intentos += 1;
      process.stdout.write("(al límite, espero) ");
      await espera(62_000);
      continue;
    }

    const datos = await r.json();
    if (!r.ok) {
      console.log(`\n\n  Falló con ${r.status}: ${datos.error}\n`);
      process.exit(1);
    }

    ejemplos.push({
      pregunta,
      fuente: "modelo",
      consulta: { ...datos.consulta, lectura: datos.lectura },
    });
    console.log(`→ ${datos.consulta.regionId} · ${datos.sismos.length} eventos`);
    break;
  }
}

const salida = {
  nota: "Generado por tools/grabar-ejemplos.mts llamando al modelo. Se publican las INTERPRETACIONES, no los sismos: la app vuelve a pedir los eventos al USGS al abrir un ejemplo. Volver a generar cuando cambie el prompt.",
  ejemplos,
};

await writeFile(
  "content/consultas-guardadas.json",
  `${JSON.stringify(salida, null, 2)}\n`,
);
console.log(`\n  ${ejemplos.length} ejemplos en content/consultas-guardadas.json\n`);
