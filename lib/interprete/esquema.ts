import { REGIONES } from "@/content/regiones";

/**
 * El esquema de la consulta, derivado de la lista de regiones.
 *
 * Los identificadores van como `enum` y el modo estricto los hace obligatorios,
 * así que el modelo queda estructuralmente incapaz de inventarse una región. No
 * es una comprobación que se hace después: es que la respuesta inválida no se
 * puede ni escribir.
 *
 * Lo que el esquema sí puede expresar mal —una magnitud absurda, una ventana de
 * cuatro años— se corrige en `sanear()` y se le dice al usuario. Ver `lib/usgs.ts`.
 */

export const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  // El modo estricto exige que todo sea required. Lo que sería opcional se
  // modela con valores por defecto explícitos, no con campos ausentes.
  required: [
    "regionId",
    "magnitudMinima",
    "dias",
    "orden",
    "limite",
    "lectura",
    "noPuedo",
  ],
  properties: {
    regionId: {
      type: "string",
      description: "La región que mejor cubre lo que se pidió.",
      enum: REGIONES.map((r) => r.id),
    },
    magnitudMinima: {
      type: "number",
      description:
        "Magnitud mínima, de 0 a 10. Si no la piden, 4.5 para el mundo entero y 2.5 para una región concreta.",
    },
    dias: {
      type: "integer",
      description: "Cuántos días hacia atrás, de 1 a 365. Si no lo dicen, 7.",
    },
    orden: {
      type: "string",
      description:
        "«magnitud» cuando preguntan por los más fuertes o más grandes; «reciente» en los demás casos.",
      enum: ["magnitud", "reciente"],
    },
    limite: {
      type: "integer",
      description: "Cuántos eventos devolver como mucho, de 1 a 500.",
    },
    lectura: {
      type: "string",
      description:
        "Una frase corta, en español de México, diciendo qué entendiste que te pidieron. Sin inventar resultados: aún no los has visto.",
    },
    noPuedo: {
      type: "string",
      description:
        "Qué parte de la petición no se puede expresar con esta consulta, y por qué. Cadena vacía si se puede todo.",
    },
  },
} as const;

export type Interpretacion = {
  regionId: string;
  magnitudMinima: number;
  dias: number;
  orden: "magnitud" | "reciente";
  limite: number;
  lectura: string;
  noPuedo: string;
};

const CATALOGO = REGIONES.map(
  (r) => `- ${r.id} · ${r.nombre} · ${r.nota}`,
).join("\n");

export const INSTRUCCIONES = `Traduces preguntas en español sobre sismos a una consulta al catálogo del USGS.

No contestas la pregunta: no tienes los datos todavía. Tu única salida es la consulta que hay que ejecutar, una frase diciendo qué entendiste, y —si hace falta— qué parte no puedes expresar.

Lo que la consulta SÍ puede filtrar: región, magnitud mínima, ventana de días, orden y cuántos resultados. Nada más.

Reglas:
- Solo puedes usar los identificadores de región de la lista de abajo. No inventes ninguno.
- Si piden un país o zona que no está en la lista, elige la región que lo contenga. Si ninguna lo contiene, usa "mundo" y dilo en la lectura.
- "Fuerte", "grande" o "importante" es magnitud, no cantidad: ordena por magnitud.
- Si no dicen ventana de tiempo, usa 7 días. "Hoy" es 1, "esta semana" 7, "este mes" 30, "este año" 365.
- Si preguntan por un suceso concreto que ya pasó —"lo de Chiapas", "el terremoto de Japón"— no uses 7 días: usa 90, porque se acuerdan de algo que puede ser de hace semanas.
- Una región pequeña tiene pocos sismos, así que hay que aflojar los dos filtros a la vez, no solo uno. Si piden una región concreta y no dan magnitud, baja el mínimo a 2.5; y si tampoco dan ventana de tiempo, usa 90 días en vez de 7 — una zona pequeña en una semana casi siempre sale vacía.
- Si te piden algo que la consulta no sabe expresar —profundidad, alertas de tsunami, víctimas, daños, dos regiones a la vez, comparar dos periodos— arma igual la consulta que más se acerque y dilo en noPuedo. Callarlo es peor: devuelve resultados que parecen contestar y no contestan.
- Nadie puede predecir sismos. Si preguntan qué va a pasar, dilo en noPuedo sin rodeos y enseña lo que sí hay: lo que ya ocurrió.
- La escala de magnitud no pasa de 10, y los sismos de más de 8 son rarísimos. Si piden algo así, respétalo: cero resultados es una respuesta correcta.

REGIONES:

${CATALOGO}`;
