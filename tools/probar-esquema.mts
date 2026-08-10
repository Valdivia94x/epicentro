/**
 * Comprueba el esquema sin gastar una llamada.
 *
 *   pnpm test
 *
 * Existe por un fallo concreto: `noPuedo` acabó en `properties` pero no en
 * `required`, el modo estricto lo rechazó, OpenAI devolvió 400 y la app lo
 * convirtió en un 502 genérico. Tres capas entre la causa y el síntoma, y la
 * causa era una línea. Esto lo caza antes de la primera llamada.
 */
import { ESQUEMA, INSTRUCCIONES } from "../lib/interprete/esquema.js";
import { REGIONES } from "../content/regiones.js";

let fallos = 0;
const revisar = (ok: boolean, texto: string) => {
  console.log(`  ${ok ? "✓" : "✗"} ${texto}`);
  if (!ok) fallos++;
};

const props = Object.keys(ESQUEMA.properties);
const req = [...ESQUEMA.required] as string[];

console.log("\nEsquema estricto:");
revisar(
  props.every((p) => req.includes(p)),
  `todas las propiedades son required (faltan: ${props.filter((p) => !req.includes(p)).join(", ") || "ninguna"})`,
);
revisar(
  req.every((p) => props.includes(p)),
  `ningún required inexistente (sobran: ${req.filter((p) => !props.includes(p)).join(", ") || "ninguno"})`,
);
revisar(ESQUEMA.additionalProperties === false, "additionalProperties: false");

console.log("\nRegiones:");
const ids = REGIONES.map((r) => r.id);
revisar(new Set(ids).size === ids.length, "sin identificadores repetidos");
revisar(
  JSON.stringify(ESQUEMA.properties.regionId.enum) === JSON.stringify(ids),
  "el enum del esquema coincide con la lista de regiones",
);
revisar(
  REGIONES.every((r) =>
    r.cajas.every((c) => c.o < c.e && c.s < c.n && c.s >= -90 && c.n <= 90),
  ),
  "todas las cajas son válidas y no están invertidas",
);
revisar(
  ids.every((id) => INSTRUCCIONES.includes(id)),
  "todas las regiones aparecen en el prompt",
);

console.log(
  fallos ? `\n${fallos} FALLOS\n` : `\nEsquema y regiones correctos\n`,
);
process.exit(fallos ? 1 : 0);
