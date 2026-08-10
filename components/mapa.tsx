"use client";

import { useEffect, useRef, useState } from "react";
import { MUNDO, aCelda, desempacar, esTierra } from "@/content/mundo";
import { escalon, type Sismo } from "@/lib/usgs";

/**
 * El mapa.
 *
 * Se dibuja en canvas con la celda medida en píxeles enteros del dispositivo, no
 * escalando una imagen pequeña: con una escala fraccionaria, `image-rendering:
 * pixelated` deja unos bloques de 3 px y otros de 4, y la rejilla se ve temblona
 * justo en lo único que el diseño promete que está cuadrado.
 *
 * Por eso el lienzo se remide con el contenedor en vez de fijar un tamaño: el
 * ancho disponible manda cuántos píxeles mide una celda, y de ahí sale todo lo
 * demás.
 */

const COLOR_ESCALON = {
  1: "#f0e9bd",
  2: "#f2c451",
  3: "#e8823a",
  4: "#d4402c",
} as const;

const MAR = "#070b09";
const TIERRA = "#163023";
const REJILLA = "#102019";

/** Radio del marcador en celdas. La magnitud es logarítmica, así que el área
    crece con ella pero despacio: un M7 no puede tapar medio Pacífico. */
function radioDe(magnitud: number) {
  if (magnitud >= 7) return 4;
  if (magnitud >= 6) return 3;
  if (magnitud >= 5) return 2.5;
  if (magnitud >= 4) return 2;
  return 1.5;
}

export function Mapa({
  sismos,
  seleccionado,
  alSeleccionar,
}: {
  sismos: Sismo[];
  seleccionado: string | null;
  alSeleccionar: (id: string | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [celda, setCelda] = useState(4);

  // El tamaño de celda se calcula del ancho real, no de un breakpoint: así el
  // mapa siempre encaja entero y sin restos, en cualquier pantalla.
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    const observador = new ResizeObserver(([entrada]) => {
      const ancho = entrada.contentRect.width;
      const siguiente = Math.max(2, Math.floor(ancho / MUNDO.ancho));
      setCelda((previo) => (previo === siguiente ? previo : siguiente));
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const ancho = MUNDO.ancho * celda;
    const alto = MUNDO.alto * celda;
    cv.width = ancho;
    cv.height = alto;

    ctx.fillStyle = MAR;
    ctx.fillRect(0, 0, ancho, alto);

    // Rejilla cada 30° de longitud y 20° de latitud: orienta sin competir con
    // los datos. Se dibuja antes que la tierra para que quede por debajo.
    ctx.fillStyle = REJILLA;
    for (let c = 0; c < MUNDO.ancho; c += 15) {
      for (let f = 0; f < MUNDO.alto; f += 2)
        ctx.fillRect(c * celda, f * celda, celda, celda);
    }

    const datos = desempacar();
    ctx.fillStyle = TIERRA;
    for (let f = 0; f < MUNDO.alto; f++) {
      for (let c = 0; c < MUNDO.ancho; c++) {
        if (esTierra(datos, c, f))
          ctx.fillRect(c * celda, f * celda, celda, celda);
      }
    }

    // Los sismos, de menor a mayor: el grande queda encima y no lo tapa un
    // enjambre de réplicas pequeñas.
    const ordenados = [...sismos].sort((a, b) => a.magnitud - b.magnitud);
    for (const s of ordenados) {
      const p = aCelda(s.longitud, s.latitud);
      if (!p) continue;

      const r = radioDe(s.magnitud) * celda;
      const x = p.columna * celda + celda / 2;
      const y = p.fila * celda + celda / 2;
      const color = COLOR_ESCALON[escalon(s.magnitud)];

      // Un rombo, no un círculo: en una rejilla de píxeles el círculo pequeño
      // sale como un cuadrado con las esquinas mordidas, y el rombo se lee
      // igual de bien a cualquier tamaño.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();

      if (s.id === seleccionado) {
        ctx.strokeStyle = "#c4f8d9";
        ctx.lineWidth = Math.max(2, celda / 2);
        ctx.strokeRect(
          x - r - celda * 2,
          y - r - celda * 2,
          (r + celda * 2) * 2,
          (r + celda * 2) * 2,
        );
      }
    }
  }, [sismos, celda, seleccionado]);

  /** Del clic a la celda, y de la celda al sismo más cercano dentro de un radio
      de tolerancia — a esta escala pedir puntería exacta es pedir demasiado. */
  function alTocar(evento: React.MouseEvent<HTMLCanvasElement>) {
    const cv = lienzo.current;
    if (!cv) return;
    const caja = cv.getBoundingClientRect();
    const cx = ((evento.clientX - caja.left) / caja.width) * MUNDO.ancho;
    const cy = ((evento.clientY - caja.top) / caja.height) * MUNDO.alto;

    let mejor: { id: string; d: number } | null = null;
    for (const s of sismos) {
      const p = aCelda(s.longitud, s.latitud);
      if (!p) continue;
      const d = Math.hypot(p.columna + 0.5 - cx, p.fila + 0.5 - cy);
      if (d <= 4 && (!mejor || d < mejor.d)) mejor = { id: s.id, d };
    }
    alSeleccionar(mejor ? mejor.id : null);
  }

  // Centrado: la celda es un entero de píxeles, así que el lienzo casi nunca
  // mide justo el ancho disponible. El resto se reparte a los dos lados en vez
  // de acumularse a la derecha como un recorte mal hecho.
  return (
    <div ref={contenedor} className="flex w-full justify-center">
      <canvas
        ref={lienzo}
        onClick={alTocar}
        className="block cursor-crosshair"
        style={{
          width: MUNDO.ancho * celda,
          height: MUNDO.alto * celda,
          imageRendering: "pixelated",
        }}
        aria-label={`Mapa mundial con ${sismos.length} sismos. La lista de abajo tiene los mismos datos.`}
      />
    </div>
  );
}
