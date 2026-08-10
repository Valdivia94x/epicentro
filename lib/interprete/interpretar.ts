import "server-only";
import OpenAI from "openai";
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
