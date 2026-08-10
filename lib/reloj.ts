"use client";

import { useSyncExternalStore } from "react";

/**
 * El reloj, como fuente externa a la que React se suscribe.
 *
 * La tentación es un `useEffect` que llame a `setAhora(Date.now())` cada minuto,
 * y React lo rechaza con razón: un efecto que empuja estado en cada tic provoca
 * renders en cascada. Un reloj no es estado de React, es un sistema de fuera —
 * y para eso está `useSyncExternalStore`.
 *
 * `leer()` devuelve el valor cacheado y no `Date.now()`: si cambiara en cada
 * lectura, React vería una instantánea distinta cada vez y entraría en bucle.
 */

let valor = 0;
let temporizador: ReturnType<typeof setInterval> | null = null;
const oyentes = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  oyentes.add(alCambiar);

  if (temporizador === null) {
    valor = Date.now();
    temporizador = setInterval(() => {
      valor = Date.now();
      for (const oyente of oyentes) oyente();
    }, 60_000);
  }

  return () => {
    oyentes.delete(alCambiar);
    if (oyentes.size === 0 && temporizador !== null) {
      clearInterval(temporizador);
      temporizador = null;
    }
  };
}

const leer = () => valor;
// En el servidor no hay reloj que valga: la página se cachea, así que cualquier
// «ahora» de ahí llega caducado. 0 significa «todavía no sé qué hora es».
const leerEnServidor = () => 0;

export function useAhora() {
  const ahora = useSyncExternalStore(suscribir, leer, leerEnServidor);
  return ahora === 0 ? null : ahora;
}
