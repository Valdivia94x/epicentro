"use client";

import { volverAlInicio } from "@/lib/inicio";

/**
 * La placa del título, que además es el botón de volver al inicio.
 *
 * Va como `<button>` y no como enlace: no navega a ningún sitio, devuelve la
 * pantalla a la vista de partida. Un `<a href="/">` haría lo mismo de cara al
 * usuario pero recargaría la página entera para acabar donde ya estaba.
 */
export function Placa() {
  return (
    <button
      onClick={volverAlInicio}
      // El título del sitio es el botón: sin etiqueta, un lector de pantalla
      // solo diría «Epicentro» y no qué hace pulsarlo.
      aria-label="Epicentro — volver a todos los sismos del mundo"
      className="placa cursor-pointer px-4 py-2 text-left transition-none hover:bg-placa-sombra"
    >
      <span className="block text-xl tracking-[0.2em]">EPICENTRO</span>
      <span className="mt-1 block text-[10px] tracking-[0.15em] opacity-70">
        ESTACIÓN DE RASTREO SÍSMICO
      </span>
    </button>
  );
}
