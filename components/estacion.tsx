"use client";

import { useState } from "react";
import { Mapa } from "./mapa";
import { Consola, type Resultado } from "./consola";
import { escalon, hace, type Consulta, type Sismo } from "@/lib/usgs";
import { REGION_POR_ID } from "@/content/regiones";
import { useAhora } from "@/lib/reloj";

const COLOR_ESCALON = {
  1: "text-m1",
  2: "text-m2",
  3: "text-m3",
  4: "text-m4",
} as const;

const ESCALA = [
  { escalon: 1, etiqueta: "M < 3", clase: "bg-m1" },
  { escalon: 2, etiqueta: "M 3–4.9", clase: "bg-m2" },
  { escalon: 3, etiqueta: "M 5–5.9", clase: "bg-m3" },
  { escalon: 4, etiqueta: "M 6+", clase: "bg-m4" },
] as const;

export function Estacion({
  sismos: iniciales,
  consulta: consultaInicial,
  url: urlInicial,
}: {
  sismos: Sismo[];
  consulta: Consulta;
  url: string;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // null hasta que el navegador monte: en el servidor no hay un «ahora» que
  // valga para quien abra la página cuatro minutos después.
  const ahora = useAhora();

  const sismos = resultado?.sismos ?? iniciales;
  const consulta = resultado?.consulta ?? consultaInicial;
  const url = resultado?.url ?? urlInicial;
  const activo = sismos.find((s) => s.id === seleccionado) ?? null;
  const region = REGION_POR_ID.get(consulta.regionId);

  return (
    <div className="flex flex-col gap-4">
      <Consola
        alResolver={(r) => {
          setResultado(r);
          setSeleccionado(null);
        }}
      />

      {/* La interpretación, antes que los resultados. Y con su procedencia:
          un ejemplo escrito a mano presentado como salida del modelo es una
          demo falsa, aunque los datos de debajo sean de verdad. */}
      {resultado && (
        <div className="border-l-4 border-m2 bg-pantalla-alta p-3 text-[11px]">
          <p className="text-fosforo-alto">{resultado.lectura}</p>
          <p className="mt-2 text-[10px] text-fosforo-tenue">
            {resultado.fuente === "modelo"
              ? "Interpretado por el modelo ahora mismo."
              : "Interpretación grabada a mano. Los sismos sí se acaban de pedir al USGS."}
          </p>
          {resultado.correcciones.length > 0 && (
            <ul className="mt-2 text-[10px] text-m3">
              {resultado.correcciones.map((c) => (
                <li key={c}>se ajustó: {c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* La pantalla: el mapa vive hundido en la caja. */}
      <div className="pantalla overflow-hidden p-3">
        {/* El barrido va solo sobre el mapa. Encima del texto lo vuelve más
            difícil de leer sin aportar nada: la textura es del cristal, y el
            cristal está delante de la imagen, no de la ficha. */}
        <div className="relative">
          <div className="barrido pointer-events-none absolute inset-0 z-10" />
          <Mapa
            sismos={sismos}
            seleccionado={seleccionado}
            alSeleccionar={setSeleccionado}
          />
        </div>

        <div className="mt-3 border-t-2 border-fosforo-honda pt-3 text-[11px] leading-relaxed">
          {activo ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span
                className={`${COLOR_ESCALON[escalon(activo.magnitud)]} brillo text-lg`}
              >
                M{activo.magnitud.toFixed(1)}
              </span>
              <span className="text-fosforo-alto">{activo.lugar}</span>
              <span className="text-fosforo-tenue">
                {activo.profundidad.toFixed(0)} km de profundidad
              </span>
              <span className="text-fosforo-tenue">
                {hace(activo.cuando, ahora)}
              </span>
              {activo.tsunami && (
                <span className="text-m4">AVISO DE TSUNAMI</span>
              )}
              <a
                href={activo.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-fosforo underline underline-offset-4"
              >
                ficha del USGS
              </a>
            </div>
          ) : (
            <span className="text-fosforo-tenue">
              Toca un epicentro en el mapa para ver su ficha.
            </span>
          )}
        </div>
      </div>

      {/* Escala. El color es el único dato codificado por color en todo el
          sitio, así que la leyenda no es opcional. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-fosforo-tenue">
        <span>MAGNITUD</span>
        {ESCALA.map((e) => (
          <span key={e.escalon} className="flex items-center gap-2">
            <span className={`${e.clase} inline-block h-3 w-3`} />
            {e.etiqueta}
          </span>
        ))}
        <span className="ml-auto text-right">
          {sismos.length} EVENTOS · {region?.nombre ?? "—"} · ÚLTIMOS{" "}
          {consulta.dias} DÍAS · M{consulta.magnitudMinima}+
        </span>
      </div>

      {/* La lista es la misma información que el mapa, en texto. No es un
          añadido de accesibilidad: es la vista que se puede leer, ordenar y
          copiar, y la que funciona sin distinguir los colores. */}
      <div className="pantalla max-h-[22rem] overflow-y-auto">
        <table className="w-full border-collapse text-[11px]">
          <caption className="sr-only">
            Sismos encontrados, con magnitud, lugar, profundidad y hora.
          </caption>
          <thead className="sticky top-0 bg-pantalla text-fosforo-tenue">
            <tr className="text-left">
              <th className="px-3 py-2 font-normal">MAG</th>
              <th className="px-3 py-2 font-normal">LUGAR</th>
              <th className="px-3 py-2 font-normal">PROF.</th>
              <th className="px-3 py-2 font-normal">CUÁNDO</th>
            </tr>
          </thead>
          <tbody>
            {sismos.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSeleccionado(s.id)}
                className={`cursor-pointer border-t border-fosforo-honda hover:bg-pantalla-alta ${
                  s.id === seleccionado ? "bg-pantalla-alta" : ""
                }`}
              >
                <td
                  className={`${COLOR_ESCALON[escalon(s.magnitud)]} px-3 py-1.5`}
                >
                  {s.magnitud.toFixed(1)}
                </td>
                <td className="px-3 py-1.5 text-fosforo-alto">{s.lugar}</td>
                <td className="px-3 py-1.5 text-fosforo-tenue">
                  {s.profundidad.toFixed(0)} km
                </td>
                <td className="px-3 py-1.5 text-fosforo-tenue">
                  {hace(s.cuando, ahora)}
                </td>
              </tr>
            ))}
            {sismos.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-fosforo-tenue"
                >
                  Ningún sismo con estos criterios. No es un fallo: significa
                  que no tembló ahí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* La consulta que se ejecutó, a la vista. Si no se puede comprobar de
          dónde salen los datos, hay que creérselos. */}
      <details className="text-[10px] text-fosforo-tenue">
        <summary className="cursor-pointer">LA CONSULTA QUE SE EJECUTÓ</summary>
        <p className="mt-2 break-all">{url}</p>
      </details>
    </div>
  );
}
