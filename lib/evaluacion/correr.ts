import { CASOS } from "@/content/casos";
import { buscar, sanear, type Consulta } from "@/lib/usgs";
import { ASERCIONES } from "./aserciones";
import type {
  Caso,
  Corrida,
  Intento,
  ResultadoCaso,
  Sujeto,
  Veredicto,
} from "./tipos";

/**
 * El corredor.
 *
 * Un caso pasa cuando pasan TODAS sus aserciones de interpretación en TODOS sus
 * intentos. No hay puntuación parcial ni mayoría: si una pregunta se interpreta
 * mal 1 de cada 3 veces, uno de cada tres usuarios recibe la respuesta de otra
 * pregunta.
 *
 * Las aserciones de resultado se corren igual pero NO deciden si el caso pasa.
 * Dependen de lo que haya temblado esta semana, y un harness que declara una
 * regresión porque la Tierra estuvo tranquila es un harness que miente.
 */

async function evaluarUnaVez(caso: Caso, sujeto: Sujeto): Promise<Intento> {
  const arranque = Date.now();
  try {
    const { consulta, lectura } = await sujeto.responder(caso.pregunta);

    // Se ejecuta la saneada —es lo que haría la app— pero se juzga la cruda.
    const { consulta: segura } = sanear(consulta as Partial<Consulta>);
    const { sismos } = await buscar(segura);

    const veredictos: Veredicto[] = [];
    for (const asercion of ASERCIONES) {
      const salida = asercion.evaluar({ caso, consulta, sismos });
      // null significa «no aplica»: no cuenta ni a favor ni en contra.
      if (!salida) continue;
      veredictos.push({
        asercion: asercion.id,
        descripcion: asercion.descripcion,
        familia: asercion.familia,
        pasa: salida.pasa,
        detalle: salida.detalle,
      });
    }

    const interpretacion = veredictos.filter(
      (v) => v.familia === "interpretacion",
    );
    const resultado = veredictos.filter((v) => v.familia === "resultado");

    return {
      consulta,
      lectura,
      error: null,
      veredictos,
      pasa: interpretacion.every((v) => v.pasa),
      pasaResultado: resultado.every((v) => v.pasa),
      cuantosSismos: sismos.length,
      ms: Date.now() - arranque,
    };
  } catch (falla) {
    // Un fallo de llamada NO es un fallo de aserción. Mezclarlos haría que una
    // corrida con la red caída se leyera como si el modelo hubiera empeorado.
    return {
      consulta: null,
      lectura: "",
      error: falla instanceof Error ? falla.message : String(falla),
      veredictos: [],
      pasa: false,
      pasaResultado: false,
      cuantosSismos: 0,
      ms: Date.now() - arranque,
    };
  }
}

export async function correr(
  sujeto: Sujeto,
  casos: Caso[] = CASOS,
  opciones: {
    repeticiones?: number;
    huellaRegiones?: string;
    alAvanzar?: (resultado: ResultadoCaso) => void;
  } = {},
): Promise<Corrida> {
  const repeticiones = Math.max(1, opciones.repeticiones ?? 1);
  const resultados: ResultadoCaso[] = [];

  for (const caso of casos) {
    const intentos: Intento[] = [];
    for (let n = 0; n < repeticiones; n++) {
      intentos.push(await evaluarUnaVez(caso, sujeto));
    }

    const pasaron = intentos.filter((i) => i.pasa).length;
    const resultado: ResultadoCaso = {
      casoId: caso.id,
      pregunta: caso.pregunta,
      intentos,
      pasa: pasaron === intentos.length,
      pasaron,
    };

    resultados.push(resultado);
    opciones.alAvanzar?.(resultado);
  }

  return {
    id: `${new Date().toISOString().replace(/[:.]/g, "-")}-${sujeto.nombre}`,
    fecha: new Date().toISOString(),
    modelo: sujeto.modelo,
    huellaPrompt: sujeto.huellaPrompt,
    huellaRegiones: opciones.huellaRegiones ?? "",
    repeticiones,
    resultados,
  };
}

// ── Lectura de una corrida ────────────────────────────────────────────────

export function resumen(corrida: Corrida) {
  const total = corrida.resultados.length;
  const estables = corrida.resultados.filter((r) => r.pasa).length;

  const intentos = corrida.resultados.flatMap((r) => r.intentos);
  const rotos = intentos.filter((i) => i.error).length;

  const veredictos = intentos.flatMap((i) => i.veredictos);
  const inter = veredictos.filter((v) => v.familia === "interpretacion");
  const res = veredictos.filter((v) => v.familia === "resultado");

  return {
    total,
    estables,
    tasaEstables: total ? Math.round((estables / total) * 100) : 0,
    intentos: intentos.length,
    intentosOk: intentos.filter((i) => i.pasa).length,
    rotos,
    // Las dos familias, siempre separadas. La primera juzga al modelo; la
    // segunda dice si las respuestas sirvieron el día que se corrió.
    interpretacion: {
      pasan: inter.filter((v) => v.pasa).length,
      total: inter.length,
    },
    resultado: { pasan: res.filter((v) => v.pasa).length, total: res.length },
  };
}

/** Por aserción, sobre todos los intentos: dónde está la debilidad. */
export function porAsercion(corrida: Corrida) {
  const cuenta = new Map<
    string,
    { descripcion: string; familia: string; pasan: number; total: number }
  >();

  for (const resultado of corrida.resultados) {
    for (const intento of resultado.intentos) {
      for (const v of intento.veredictos) {
        const fila = cuenta.get(v.asercion) ?? {
          descripcion: v.descripcion,
          familia: v.familia,
          pasan: 0,
          total: 0,
        };
        fila.total += 1;
        if (v.pasa) fila.pasan += 1;
        cuenta.set(v.asercion, fila);
      }
    }
  }

  return [...cuenta.entries()]
    .map(([id, fila]) => ({
      id,
      ...fila,
      tasa: Math.round((fila.pasan / fila.total) * 100),
    }))
    .sort((a, b) => a.tasa - b.tasa);
}

/**
 * Qué se movió entre dos corridas.
 *
 * Con repeticiones se distingue lo que un binario esconde: un caso que pasa 3/3
 * y baja a 0/3 es una regresión; uno que va de 3/3 a 2/3 es inestabilidad, y
 * merece otra lectura.
 */
export function comparar(antes: Corrida, despues: Corrida) {
  const previos = new Map(
    antes.resultados.map((r) => [
      r.casoId,
      { pasa: r.pasa, pasaron: r.pasaron, de: r.intentos.length },
    ]),
  );

  const arreglados: string[] = [];
  const rotos: string[] = [];
  const inestables: { casoId: string; antes: string; despues: string }[] = [];

  for (const r of despues.resultados) {
    const anterior = previos.get(r.casoId);
    if (!anterior) continue;

    if (!anterior.pasa && r.pasa) arreglados.push(r.casoId);
    if (anterior.pasa && !r.pasa) rotos.push(r.casoId);

    const parcial = (p: number, de: number) => p > 0 && p < de;
    if (
      parcial(anterior.pasaron, anterior.de) ||
      parcial(r.pasaron, r.intentos.length)
    ) {
      inestables.push({
        casoId: r.casoId,
        antes: `${anterior.pasaron}/${anterior.de}`,
        despues: `${r.pasaron}/${r.intentos.length}`,
      });
    }
  }

  return {
    arreglados,
    rotos,
    inestables,
    // Comparar corridas con prompts o regiones distintas es legítimo —es justo
    // lo que se quiere medir— pero hay que saberlo, no descubrirlo después.
    mismoPrompt: antes.huellaPrompt === despues.huellaPrompt,
    mismasRegiones: antes.huellaRegiones === despues.huellaRegiones,
    mismoModelo: antes.modelo === despues.modelo,
  };
}
