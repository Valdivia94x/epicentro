"use client";

import { useEffect, useState } from "react";
import guardadas from "@/content/consultas-guardadas.json";
import type { Consulta, Sismo } from "@/lib/usgs";
import { alVolver } from "@/lib/inicio";

/**
 * La consola: de una pregunta en español a una consulta ejecutada.
 *
 * Enseña siempre la interpretación antes que los resultados. Si el modelo
 * entendió «Chiapas» como «todo México», eso se ve en una frase en vez de
 * descubrirse contando puntos en el mapa — y si se equivoca, se equivoca a la
 * vista, que es la única forma de que alguien pueda corregirlo.
 */

export type Resultado = {
  sismos: Sismo[];
  consulta: Consulta;
  url: string;
  ahora: number;
  lectura: string;
  /** Qué parte de la petición no cabe en una consulta. Vacío casi siempre. */
  noPuedo: string;
  correcciones: string[];
  /** Tres estados, no dos. Un ejemplo grabado del modelo no es lo mismo que una
      llamada de ahora, y decir «ahora mismo» sobre algo enlatado es mentir en
      pequeño — que en una demo es exactamente donde se miente. */
  fuente: "vivo" | "grabado" | "manual";
};

type Guardada = {
  pregunta: string;
  fuente: string;
  consulta: Consulta & { lectura: string; noPuedo?: string };
};

export function Consola({
  alResolver,
}: {
  alResolver: (r: Resultado) => void;
}) {
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinLlave, setSinLlave] = useState(false);

  // Volver al inicio también vacía la caja: dejar ahí la pregunta anterior
  // mientras el mapa enseña otra cosa es enseñar dos estados a la vez.
  useEffect(
    () =>
      alVolver(() => {
        setPregunta("");
        setError(null);
      }),
    [],
  );

  async function preguntar(e: React.FormEvent) {
    e.preventDefault();
    if (!pregunta.trim() || cargando) return;

    setCargando(true);
    setError(null);

    try {
      const r = await fetch("/api/consulta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pregunta }),
      });
      const datos = await r.json();

      if (r.status === 501) {
        setSinLlave(true);
        setError(datos.error);
        return;
      }
      if (!r.ok) {
        setError(datos.error ?? "No se pudo consultar");
        return;
      }

      alResolver({ ...datos, fuente: "vivo" });
    } catch {
      setError("Se cayó la conexión");
    } finally {
      setCargando(false);
    }
  }

  /** Un ejemplo guardado trae la interpretación grabada, pero los sismos se
      piden ahora: lo que está enlatado es cómo se leyó la pregunta, no el mapa. */
  async function correrGuardada(g: Guardada) {
    setCargando(true);
    setError(null);
    setPregunta(g.pregunta);
    try {
      const r = await fetch("/api/buscar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consulta: g.consulta }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos.error ?? "No se pudo consultar");
        return;
      }
      alResolver({
        ...datos,
        lectura: g.consulta.lectura,
        noPuedo: g.consulta.noPuedo ?? "",
        fuente: g.fuente === "modelo" ? "grabado" : "manual",
      });
    } catch {
      setError("Se cayó la conexión");
    } finally {
      setCargando(false);
    }
  }

  const ejemplos = guardadas.ejemplos as Guardada[];

  return (
    <div className="placa flex flex-col gap-3 p-4">
      <form onSubmit={preguntar} className="flex flex-wrap gap-2">
        <label htmlFor="pregunta" className="sr-only">
          Pregunta sobre sismos
        </label>
        <input
          id="pregunta"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          maxLength={200}
          placeholder="¿ha temblado cerca de la Ciudad de México?"
          className="min-w-0 flex-1 border-2 border-tinta/25 bg-placa-sombra/35 px-3 py-2 text-[12px] text-tinta placeholder:text-tinta/45"
        />
        <button
          type="submit"
          disabled={cargando || !pregunta.trim()}
          className="border-2 border-tinta bg-tinta px-4 py-2 text-[11px] tracking-[0.15em] text-placa disabled:opacity-40"
        >
          {cargando ? "…" : "INTERPRETAR"}
        </button>
      </form>

      {error && <p className="text-[11px] text-m4">{error}</p>}

      {(sinLlave || !error) && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-[0.12em] text-tinta/60">
            {sinLlave ? "EJEMPLOS GUARDADOS" : "O PRUEBA CON"}
          </p>
          <div className="flex flex-wrap gap-2">
            {ejemplos.map((g) => (
              <button
                key={g.pregunta}
                onClick={() => correrGuardada(g)}
                disabled={cargando}
                className="border-2 border-tinta/30 px-2 py-1 text-left text-[11px] text-tinta hover:bg-tinta hover:text-placa disabled:opacity-40"
              >
                {g.pregunta}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
