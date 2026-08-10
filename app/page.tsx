import { Suspense } from "react";
import { connection } from "next/server";
import { Estacion } from "@/components/estacion";
import { CONSULTA_POR_DEFECTO, buscar } from "@/lib/usgs";

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
  return <Estacion sismos={sismos} consulta={CONSULTA_POR_DEFECTO} url={url} />;
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="placa px-4 py-2">
          <h1 className="text-xl tracking-[0.2em]">EPICENTRO</h1>
          <p className="mt-1 text-[10px] tracking-[0.15em] opacity-70">
            ESTACIÓN DE RASTREO SÍSMICO
          </p>
        </div>

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
