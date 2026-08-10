/**
 * Corre la batería y guarda la corrida.
 *
 *   pnpm eval --stub                      # sujeto determinista, sin llave, gratis
 *   OPENAI_API_KEY=sk-... pnpm eval       # el intérprete de verdad
 *   pnpm eval --repeticiones 3            # cada caso tres veces
 *   pnpm eval --casos islandia,cdmx --repeticiones 10   # medir uno frágil
 *
 * Los evals corren aquí, en tu máquina. Lo que se publica es el harness y las
 * corridas guardadas — nunca una llave en un endpoint.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CASOS } from "../content/casos.js";
import {
  comparar,
  correr,
  porAsercion,
  resumen,
} from "../lib/evaluacion/correr.js";
import type { Corrida } from "../lib/evaluacion/tipos.js";
import {
  huellaRegiones,
  interpreteDePrueba,
  interpreteReal,
} from "../lib/sujeto/interprete.js";
import { MODELO_POR_DEFECTO } from "../lib/interprete/interpretar.js";

const CARPETA = "content/corridas";
const args = process.argv.slice(2);

/**
 * Lee `--bandera valor`.
 *
 * A mano esto se escribe `args[args.indexOf(b) + 1]`, y está mal: indexOf
 * devuelve -1 cuando la bandera no está, y -1 + 1 = 0 apunta al PRIMER
 * argumento. En el harness de Tizón eso hizo que una corrida entera se
 * ejecutara contra un modelo llamado «--repeticiones».
 */
function valor(bandera: string): string | undefined {
  const i = args.indexOf(bandera);
  if (i === -1) return undefined;
  const siguiente = args[i + 1];
  if (!siguiente || siguiente.startsWith("--")) {
    console.error(`\n${bandera} necesita un valor.\n`);
    process.exit(1);
  }
  return siguiente;
}

const esStub = args.includes("--stub");
const modelo = valor("--modelo") ?? MODELO_POR_DEFECTO;

const crudo = valor("--repeticiones");
const repeticiones = crudo === undefined ? 1 : Number(crudo);
if (!Number.isInteger(repeticiones) || repeticiones < 1) {
  console.error(`\n--repeticiones espera un entero >= 1, no «${crudo}».\n`);
  process.exit(1);
}

const soloIds = valor("--casos")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (soloIds) {
  const noExisten = soloIds.filter((id) => !CASOS.some((c) => c.id === id));
  if (noExisten.length) {
    console.error(`\nNo existen estos casos: ${noExisten.join(", ")}\n`);
    process.exit(1);
  }
}

const casos = soloIds ? CASOS.filter((c) => soloIds.includes(c.id)) : CASOS;
const sujeto = esStub ? interpreteDePrueba() : interpreteReal(modelo);

console.log(
  `\nSujeto: ${sujeto.nombre} · ${sujeto.modelo} · prompt ${sujeto.huellaPrompt} · regiones ${huellaRegiones()}`,
);
console.log(
  `${casos.length} casos × ${repeticiones} ${repeticiones === 1 ? "intento" : "intentos"} = ${casos.length * repeticiones} llamadas` +
    (soloIds
      ? `  (parcial: ${CASOS.length - casos.length} casos fuera)\n`
      : "\n"),
);

const corrida = await correr(sujeto, casos, {
  repeticiones,
  huellaRegiones: huellaRegiones(),
  alAvanzar: (r) => {
    // Separadas por familia: poner «falla: vacio_cuando_toca» junto a un ✓ se
    // lee como una contradicción, cuando lo que pasa es que esa comprobación
    // depende de los datos y por diseño no tumba el caso.
    const deFamilia = (f: string) => [
      ...new Set(
        r.intentos.flatMap((i) =>
          i.veredictos
            .filter((v) => !v.pasa && v.familia === f)
            .map((v) => v.asercion),
        ),
      ),
    ];
    const fallidas = deFamilia("interpretacion");
    const flojas = deFamilia("resultado");
    const errores = r.intentos.filter((i) => i.error).length;
    const ms = Math.round(
      r.intentos.reduce((s, i) => s + i.ms, 0) / r.intentos.length,
    );
    console.log(
      `  ${r.pasa ? "✓" : "✗"} ${r.casoId.padEnd(20)} ${r.pasaron}/${r.intentos.length}  ${String(ms).padStart(5)}ms` +
        (errores ? `  ${errores} sin evaluar` : "") +
        (fallidas.length ? `  falla: ${fallidas.join(", ")}` : "") +
        (flojas.length ? `  (datos: ${flojas.join(", ")})` : ""),
    );
  },
});

const r = resumen(corrida);

// Si NINGÚN intento llegó a evaluarse, esto no mide al modelo: mide un fallo de
// llamada. Imprimir «0%» sería mentir con un número correcto, y guardarlo
// dejaría en el histórico una corrida que la siguiente comparación leería como
// una regresión gigante.
if (r.rotos === r.intentos && r.intentos > 0) {
  console.error(
    `\nNingún intento llegó a evaluarse — esto no mide al modelo.` +
      `\n  ${corrida.resultados[0]?.intentos[0]?.error}` +
      `\nNo se guarda la corrida.\n`,
  );
  process.exit(1);
}

console.log(
  `\n${r.estables}/${r.total} casos estables · ${r.tasaEstables}%` +
    `   ·   interpretación ${r.interpretacion.pasan}/${r.interpretacion.total}`,
);
console.log(
  `resultado ${r.resultado.pasan}/${r.resultado.total} — depende de lo que haya temblado, no decide si el modelo pasa`,
);
if (repeticiones === 1)
  console.log("una sola repetición: no distingue regresión de varianza");
if (r.rotos) console.log(`${r.rotos} intentos no llegaron a evaluarse`);

console.log("\nPor aserción, de peor a mejor:");
for (const fila of porAsercion(corrida)) {
  const barra = "█".repeat(Math.round(fila.tasa / 10)).padEnd(10, "·");
  console.log(
    `  ${barra} ${String(fila.tasa).padStart(3)}%  ${fila.id.padEnd(18)} ${fila.pasan}/${fila.total}  ${fila.familia === "resultado" ? "(datos)" : ""}`,
  );
}

if (soloIds) {
  // Ni se compara ni se guarda: al comparador le faltarían casos y los leería
  // como ausentes, y en el histórico una parcial se lee como completa.
  console.log(`\nCorrida parcial, no se guarda.\n`);
  process.exit(0);
}

await mkdir(CARPETA, { recursive: true });
// Solo del mismo sujeto: comparar el stub contra el modelo real avisa de dos
// diferencias y no dice nada útil. El diff sirve cuando cambia UNA cosa.
const archivos = (await readdir(CARPETA))
  .filter(
    (f) => f.endsWith(`-${sujeto.nombre}.json`) && !f.startsWith(corrida.id),
  )
  .sort();

if (archivos.length > 0) {
  const previa = JSON.parse(
    await readFile(join(CARPETA, archivos.at(-1)!), "utf8"),
  ) as Corrida;
  const diff = comparar(previa, corrida);

  console.log(`\nContra ${previa.id}:`);
  if (!diff.mismoModelo)
    console.log(
      `  ojo: modelo distinto (${previa.modelo} → ${corrida.modelo})`,
    );
  if (!diff.mismoPrompt)
    console.log(
      `  ojo: prompt distinto (${previa.huellaPrompt} → ${corrida.huellaPrompt})`,
    );
  if (!diff.mismasRegiones)
    console.log(
      `  ojo: lista de regiones distinta (${previa.huellaRegiones} → ${corrida.huellaRegiones})`,
    );
  console.log(`  arreglados: ${diff.arreglados.join(", ") || "ninguno"}`);
  console.log(`  rotos:      ${diff.rotos.join(", ") || "ninguno"}`);
  if (diff.inestables.length)
    console.log(
      `  inestables: ${diff.inestables.map((i) => `${i.casoId} ${i.antes}→${i.despues}`).join(", ")}`,
    );
}

const destino = join(CARPETA, `${corrida.id}.json`);
await writeFile(destino, `${JSON.stringify(corrida, null, 2)}\n`);
console.log(`\nGuardada en ${destino}\n`);
