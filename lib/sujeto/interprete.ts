import { createHash } from "node:crypto";
import { REGIONES } from "@/content/regiones";
import { INSTRUCCIONES } from "@/lib/interprete/esquema";
import { interpretar, MODELO_POR_DEFECTO } from "@/lib/interprete/interpretar";
import type { Sujeto } from "@/lib/evaluacion/tipos";

/**
 * El sujeto a evaluar.
 *
 * El harness no sabe qué hay detrás de `responder`. Eso permite cambiar de
 * modelo sin tocar la evaluación, y verificar el propio harness con un sujeto
 * falso, sin llave y sin gastar.
 */

export const huellaPrompt = () =>
  createHash("sha256").update(INSTRUCCIONES).digest("hex").slice(0, 12);

/** La lista de regiones mueve los resultados tanto como el prompt: añadir
    `islandia` cambió una respuesta sin tocar una sola instrucción. Sin esta
    huella, la comparación entre corridas se lo achacaría al modelo. */
export const huellaRegiones = () =>
  createHash("sha256")
    .update(REGIONES.map((r) => r.id).join(","))
    .digest("hex")
    .slice(0, 12);

export function interpreteReal(modelo = MODELO_POR_DEFECTO): Sujeto {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "Falta OPENAI_API_KEY. Los evals corren en tu máquina, no en un despliegue.",
    );
  }
  return {
    nombre: "interprete",
    modelo,
    huellaPrompt: huellaPrompt(),
    responder: async (pregunta) => {
      const cruda = await interpretar(pregunta, modelo);
      // Cruda a propósito: si `sanear` tuvo que recortar algo, eso es un error
      // del modelo y el harness tiene que verlo, no recibirlo ya arreglado.
      return {
        consulta: cruda,
        lectura: cruda.lectura,
        noPuedo: cruda.noPuedo,
      };
    },
  };
}

/**
 * Sujeto falso y determinista, para verificar el harness sin gastar.
 *
 * Contesta siempre lo mismo, y está hecho para FALLAR varios casos a propósito:
 * un harness que solo se prueba contra un sujeto que aprueba todo no demuestra
 * que sepa detectar fallos.
 */
export function interpreteDePrueba(): Sujeto {
  return {
    nombre: "stub",
    modelo: "determinista",
    huellaPrompt: "stub",
    responder: async () => ({
      consulta: {
        regionId: "mundo",
        magnitudMinima: 4.5,
        dias: 7,
        orden: "reciente" as const,
        limite: 500,
      },
      lectura: "Respuesta fija del sujeto de prueba.",
      noPuedo: "",
    }),
  };
}
