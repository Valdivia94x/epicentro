"use client";

/**
 * Un aviso de «vuelve al inicio», del que cualquiera puede colgarse.
 *
 * Existe por una restricción de la página: la cabecera se pinta FUERA del
 * `<Suspense>`, para que el chasis esté en el HTML inicial mientras los datos
 * llegan por detrás. Eso la deja en un componente de servidor, sin forma de
 * pasarle una función al de cliente que guarda el estado.
 *
 * Podría meterse la cabecera dentro de la estación y arreglado, pero entonces
 * el título desaparecería mientras carga, que es peor. Quince líneas de tienda
 * externa cuestan menos que eso.
 */

const oyentes = new Set<() => void>();

export function alVolver(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function volverAlInicio() {
  for (const oyente of oyentes) oyente();
}
