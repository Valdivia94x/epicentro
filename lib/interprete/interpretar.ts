import OpenAI from "openai";

/**
 * Sin `server-only` a propósito.
 *
 * Este módulo lo importan dos cosas: la ruta de la app y el harness de evals,
 * que es un proceso Node normal. `server-only` lanza en cualquier entorno que no
 * sea un componente de servidor, así que ponerlo aquí deja los evals sin poder
 * llamar al mismo código que corre en producción — y evaluar una copia del
 * código no es evaluar el código.
 *
 * Lo que de verdad protege la llave es que se lee de `OPENAI_API_KEY` y no de
 * `NEXT_PUBLIC_*`: Next nunca la mete en el paquete del navegador.
 */
import { createHash } from "node:crypto";
import { ESQUEMA, INSTRUCCIONES, type Interpretacion } from "./esquema";
import { MAX_SALIDA } from "./limites";

export const MODELO_POR_DEFECTO = "gpt-5.6-terra";

/** Si el prompt cambia, dos respuestas dejan de ser comparables. */
export const huellaPrompt = () =>
  createHash("sha256").update(INSTRUCCIONES).digest("hex").slice(0, 12);

export function hayLlave() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function interpretar(
  pregunta: string,
  modelo = MODELO_POR_DEFECTO,
): Promise<Interpretacion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Sin OPENAI_API_KEY");

  const cliente = new OpenAI({ apiKey });
  const respuesta = await cliente.responses.create({
    model: modelo,
    instructions: INSTRUCCIONES,
    input: [{ role: "user", content: pregunta }],
    max_output_tokens: MAX_SALIDA,
    text: {
      format: {
        type: "json_schema",
        name: "consulta",
        strict: true,
        schema: ESQUEMA,
      },
    },
  });

  const crudo = respuesta.output_text;
  if (!crudo) throw new Error("El modelo no devolvió nada");
  return JSON.parse(crudo) as Interpretacion;
}
