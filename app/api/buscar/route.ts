import { NextResponse } from "next/server";
import { buscar, sanear } from "@/lib/usgs";

/**
 * Ejecuta una consulta ya formada, sin pasar por el modelo.
 *
 * Es lo que hace que los ejemplos guardados no sean una captura de pantalla:
 * la interpretación viene grabada, pero los sismos se piden al USGS en el
 * momento. Un despliegue sin llave enseña datos de hoy, no de cuando se grabó.
 */
export async function POST(peticion: Request) {
  let cruda: unknown;
  try {
    cruda = (await peticion.json())?.consulta;
  } catch {
    return NextResponse.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  if (!cruda || typeof cruda !== "object") {
    return NextResponse.json({ error: "Falta la consulta" }, { status: 400 });
  }

  const ahora = Date.now();
  const { consulta, correcciones } = sanear(cruda as never);

  try {
    const { sismos, url, region } = await buscar(consulta, ahora);
    return NextResponse.json({
      consulta,
      correcciones,
      region: region.nombre,
      sismos,
      url,
      ahora,
    });
  } catch {
    return NextResponse.json(
      { error: "El USGS no respondió" },
      { status: 502 },
    );
  }
}
