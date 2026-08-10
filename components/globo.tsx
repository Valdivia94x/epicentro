"use client";

import { useEffect, useRef } from "react";
import { MUNDO, desempacar, esTierra } from "@/content/mundo";

/**
 * El globo del encabezado.
 *
 * Sale del mismo ráster que el mapa: proyección ortográfica sobre la misma
 * rejilla de 180×90. No hay ni un asset nuevo, y por eso el ráster se guarda de
 * polo a polo aunque el mapa plano recorte — en una esfera, la Antártida que
 * allí sobra aquí es un agujero en el polo sur.
 *
 * Va sin sismos encima a propósito. El mapa de abajo ya los enseña, y repetirlos
 * aquí sería decir dos veces lo mismo en menos espacio y peor. Esto es el emblema
 * del instrumento, no una segunda vista de los datos.
 */

const CELDAS = 46; // ancho y alto de la rejilla del globo
const CELDA = 3; // píxeles por celda
const LADO = CELDAS * CELDA;
const INCLINACION = (18 * Math.PI) / 180; // se ve más hemisferio norte, que es donde está la tierra
const VUELTA_MS = 48_000; // una vuelta completa, despacio: es un instrumento, no un banner
const FOTOGRAMAS_POR_SEGUNDO = 10; // a saltos, que es lo que pide el píxel

const MAR = "#0d1a14";
const TIERRA = "#2f6a4a";
/** El limbo se pinta en la propia rejilla y no con un border-radius: un círculo
    suave sobre una esfera de píxeles se ve como dos cosas distintas pegadas. Y
    de paso, la hoja global tiene `border-radius: 0 !important`, que se lo habría
    comido de todas formas. */
const BORDE = "#1d3b2c";

/**
 * Para cada celda, su latitud y su longitud RELATIVA al centro.
 *
 * La clave para que esto no cueste nada: con la inclinación fija, la latitud de
 * cada celda no cambia nunca y la longitud solo se desplaza. Girar el globo es
 * sumar un número, no rehacer la trigonometría sesenta veces por segundo.
 */
function tabla() {
  const celdas: ({ lat: number; lonRel: number; borde: boolean } | null)[] = [];
  const sinLat0 = Math.sin(INCLINACION);
  const cosLat0 = Math.cos(INCLINACION);

  for (let f = 0; f < CELDAS; f++) {
    for (let c = 0; c < CELDAS; c++) {
      const x = ((c + 0.5) / CELDAS) * 2 - 1;
      const y = -(((f + 0.5) / CELDAS) * 2 - 1); // en pantalla la y crece hacia abajo
      const rho = Math.hypot(x, y);

      if (rho > 1) {
        celdas.push(null); // fuera de la esfera
        continue;
      }

      // Inversa de la ortográfica.
      const cc = Math.asin(Math.min(1, rho));
      const sinC = Math.sin(cc);
      const cosC = Math.cos(cc);
      const lat =
        rho === 0
          ? INCLINACION
          : Math.asin(cosC * sinLat0 + (y * sinC * cosLat0) / rho);
      const lonRel = Math.atan2(
        x * sinC,
        rho * cosC * cosLat0 - y * sinC * sinLat0,
      );
      celdas.push({ lat, lonRel, borde: rho > 0.93 });
    }
  }
  return celdas;
}

export function Globo() {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const celdas = tabla();
    const datos = desempacar();
    const quieto = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const pintar = (giro: number) => {
      ctx.clearRect(0, 0, LADO, LADO);

      for (let i = 0; i < celdas.length; i++) {
        const celda = celdas[i];
        if (!celda) continue;

        const lon = celda.lonRel + giro;
        const grados = ((((lon * 180) / Math.PI + 180) % 360) + 360) % 360;
        const columna = Math.min(
          MUNDO.ancho - 1,
          Math.floor((grados / 360) * MUNDO.ancho),
        );
        const fila = Math.min(
          MUNDO.alto - 1,
          Math.max(
            0,
            Math.floor(((90 - (celda.lat * 180) / Math.PI) / 180) * MUNDO.alto),
          ),
        );

        ctx.fillStyle = celda.borde
          ? BORDE
          : esTierra(datos, columna, fila)
            ? TIERRA
            : MAR;
        ctx.fillRect(
          (i % CELDAS) * CELDA,
          Math.floor(i / CELDAS) * CELDA,
          CELDA,
          CELDA,
        );
      }
    };

    // Sin animación, un fotograma y fuera: quien pide menos movimiento no debería
    // pagar un bucle de por vida para ver lo mismo.
    if (quieto) {
      pintar(0);
      return;
    }

    let animacion = 0;
    let ultimo = 0;
    const arranque = performance.now();
    const intervalo = 1000 / FOTOGRAMAS_POR_SEGUNDO;

    const paso = (ahora: number) => {
      animacion = requestAnimationFrame(paso);
      if (ahora - ultimo < intervalo) return;
      ultimo = ahora;
      pintar((((ahora - arranque) % VUELTA_MS) / VUELTA_MS) * Math.PI * 2);
    };
    animacion = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(animacion);
  }, []);

  return (
    <div
      style={{ width: LADO, height: LADO }}
      // El globo no dice nada que no esté escrito debajo; anunciarlo a un lector
      // de pantalla sería ruido.
      aria-hidden="true"
    >
      <canvas
        ref={lienzo}
        width={LADO}
        height={LADO}
        style={{ width: LADO, height: LADO, imageRendering: "pixelated" }}
      />
    </div>
  );
}
