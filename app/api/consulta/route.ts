import { NextResponse } from "next/server";
import { hayLlave, interpretar } from "@/lib/interprete/interpretar";
import { MAX_ENTRADA, revisarLimites } from "@/lib/interprete/limites";
import { buscar, sanear } from "@/lib/usgs";

/**
 * De una pregunta en español a sismos pintados en el mapa.
 *
 * El modelo NO devuelve datos: devuelve una consulta. Los datos los trae el
 * servidor del USGS después, con esa consulta ya saneada. Es la diferencia
 * entre un modelo que interpreta y un modelo al que se le cree — si el modelo
 * emitiera los sismos, no habría forma de saber si se los inventó.
 */

export async function POST(peticion: Request) {
  if (!hayLlave()) {
    // 501 y no 500: no está roto, es que este despliegue no tiene llave a
    // propósito. La interfaz enseña los ejemplos guardados en su lugar.
    return NextResponse.json(
      {
        error:
          "Este despliegue no lleva llave de OpenAI. Abajo hay ejemplos guardados.",
      },
      { status: 501 },
    );
  }

  let pregunta: string;
  try {
    const cuerpo = await peticion.json();
    pregunta = String(cuerpo?.pregunta ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  if (!pregunta) {
    return NextResponse.json(
      { error: "Escribe una pregunta" },
      { status: 400 },
    );
  }
  if (pregunta.length > MAX_ENTRADA) {
    return NextResponse.json(
      { error: `La pregunta no puede pasar de ${MAX_ENTRADA} caracteres` },
      { status: 400 },
    );
  }

  const ip =
    peticion.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ahora = Date.now();
  const limite = revisarLimites(ip, new Date(ahora).toISOString().slice(0, 10));
  if (!limite.permitido) {
    return NextResponse.json({ error: limite.motivo }, { status: 429 });
  }

  try {
    const cruda = await interpretar(pregunta);
    const { consulta, correcciones } = sanear(cruda);
    const { sismos, url, region } = await buscar(consulta, ahora);

    return NextResponse.json({
      consulta,
      correcciones,
      lectura: cruda.lectura,
      region: region.nombre,
      sismos,
      url,
      ahora,
      fuente: "modelo",
    });
  } catch (falla) {
    console.error("[consulta]", falla);
    return NextResponse.json(
      { error: "No se pudo resolver la consulta. Inténtalo otra vez." },
      { status: 502 },
    );
  }
}
