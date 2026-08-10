import { Suspense } from "react";
import { connection } from "next/server";
import { Estacion } from "@/components/estacion";
import { Placa } from "@/components/placa";
import { Globo } from "@/components/globo";
import { CONSULTA_POR_DEFECTO, buscar } from "@/lib/usgs";
import { hayLlave } from "@/lib/interprete/interpretar";

/**
 * El chasis es estático y se prerenderiza; los datos entran por detrás.
 *
 * Importa el orden: la caja, las placas y la escala están en el HTML inicial, y
 * lo único que espera al USGS es el interior de la pantalla. Una estación que
 * tarda en encender la pantalla se entiende; una página en blanco mientras
 * carga, no.
 */

async function Pantalla() {
  // La ventana de días se mide desde ahora, y «ahora» solo existe cuando alguien
  // pide la página. Sin esto, la fecha se hornea en el prerenderizado y la
  // consulta se queda anclada al momento del despliegue.
  await connection();
  const { sismos, url } = await buscar(CONSULTA_POR_DEFECTO);
  // `conLlave` se resuelve en el servidor y baja como dato. Descubrir que no
  // hay llave escribiendo una pregunta y esperando un error es la peor forma de
  // enterarse: el usuario ya invirtió el esfuerzo cuando se lo dices.
  return (
    <Estacion
      sismos={sismos}
      consulta={CONSULTA_POR_DEFECTO}
      url={url}
      conLlave={hayLlave()}
    />
  );
}

function PantallaApagada() {
  return (
    <div className="pantalla flex h-96 items-center justify-center">
      <p className="text-fosforo-tenue">ENLAZANDO CON LA RED DEL USGS…</p>
    </div>
  );
}

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-5 p-4 sm:p-8">
      {/* El globo baja hasta la altura de la fila del título y asoma por arriba.
          Va con transformación y no con margen: así nada de lo que viene
          después se mueve un píxel.

          85 y no 101, que sería el centrado exacto: a 101 el globo terminaría en
          299 y la placa de la consola empieza en 297, así que asomarían dos
          píxeles de verde por encima de ella. Dos píxeles fuera de sitio no se
          leen como una decisión, se leen como un fallo. */}
      <div className="flex translate-y-[85px] justify-center pt-2">
        <Globo />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="contents">
          <Placa />
        </h1>

        <div className="placa flex items-center gap-2 px-3 py-2 text-[10px] tracking-[0.15em]">
          <span className="inline-block h-2.5 w-2.5 bg-m4" />
          DATOS EN VIVO · USGS
        </div>
      </header>

      <Suspense fallback={<PantallaApagada />}>
        <Pantalla />
      </Suspense>

      <footer className="mt-auto flex flex-wrap gap-x-6 gap-y-1 pt-4 text-[10px] text-placa/55">
        <span>
          Datos del U.S. Geological Survey, dominio público. Epicentro no es un
          sistema de alerta.
        </span>
      </footer>
    </main>
  );
}
