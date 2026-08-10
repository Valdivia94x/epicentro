import {
  REGION_POR_ID,
  REGIONES,
  dentroDeRegion,
  envolvente,
  type Region,
} from "@/content/regiones";

/**
 * La capa de datos: del USGS a algo que se pueda pintar.
 *
 * Una `Consulta` es lo único que entra aquí, venga de un botón o del modelo. Que
 * ambos caminos terminen en la misma estructura es lo que hace que la parte de
 * lenguaje natural sea comprobable: no hay una ruta «de IA» distinta de la
 * normal, solo dos formas de rellenar el mismo formulario.
 */

export type Orden = "magnitud" | "reciente";

export type Consulta = {
  regionId: string;
  magnitudMinima: number;
  dias: number;
  orden: Orden;
  limite: number;
};

export type Sismo = {
  id: string;
  magnitud: number;
  lugar: string;
  /** Milisegundos desde epoch, tal como los da el USGS. */
  cuando: number;
  longitud: number;
  latitud: number;
  /** Kilómetros. La profundidad cambia por completo lo que se siente arriba. */
  profundidad: number;
  tsunami: boolean;
  url: string;
};

export const CONSULTA_POR_DEFECTO: Consulta = {
  regionId: "mundo",
  magnitudMinima: 4.5,
  dias: 7,
  orden: "reciente",
  limite: 200,
};

const LIMITE_MAXIMO = 500;

/**
 * Ajusta una consulta a lo que el sistema admite en vez de rechazarla.
 *
 * Devuelve también qué tuvo que tocar: una consulta corregida en silencio se
 * lee como una consulta obedecida, y entonces nadie se entera de que el modelo
 * pidió cuatro años de datos. Es la misma decisión que en el mesero — corregir
 * y decirlo, no rechazar.
 */
export function sanear(cruda: Partial<Consulta>): {
  consulta: Consulta;
  correcciones: string[];
} {
  const correcciones: string[] = [];
  const c = { ...CONSULTA_POR_DEFECTO, ...cruda };

  if (!REGION_POR_ID.has(c.regionId)) {
    correcciones.push(
      `región «${c.regionId}» desconocida, se usa todo el mundo`,
    );
    c.regionId = "mundo";
  }

  const mag = Number(c.magnitudMinima);
  if (!Number.isFinite(mag) || mag < 0 || mag > 10) {
    correcciones.push(
      `magnitud ${c.magnitudMinima} fuera de escala, se usa 4.5`,
    );
    c.magnitudMinima = 4.5;
  } else {
    c.magnitudMinima = Math.round(mag * 10) / 10;
  }

  const dias = Math.round(Number(c.dias));
  if (!Number.isFinite(dias) || dias < 1) {
    correcciones.push("ventana inválida, se usan 7 días");
    c.dias = 7;
  } else if (dias > 365) {
    correcciones.push(`${dias} días es demasiado, se recortan a 365`);
    c.dias = 365;
  } else {
    c.dias = dias;
  }

  if (c.orden !== "magnitud" && c.orden !== "reciente") {
    correcciones.push(`orden «${c.orden}» desconocido, se ordena por fecha`);
    c.orden = "reciente";
  }

  const limite = Math.round(Number(c.limite));
  if (!Number.isFinite(limite) || limite < 1) {
    c.limite = CONSULTA_POR_DEFECTO.limite;
  } else {
    c.limite = Math.min(LIMITE_MAXIMO, limite);
  }

  return { consulta: c, correcciones };
}

type RespuestaUsgs = {
  features: {
    id: string;
    properties: {
      mag: number | null;
      place: string | null;
      time: number;
      tsunami: number;
      url: string;
    };
    geometry: { coordinates: [number, number, number] };
  }[];
};

/** La URL que se le pide al USGS. Se expone porque la interfaz la enseña: si
    el usuario no puede ver la consulta que se ejecutó, tiene que creerse el
    resultado. */
export function urlDeConsulta(consulta: Consulta, ahora = Date.now()) {
  const region = REGION_POR_ID.get(consulta.regionId) ?? REGIONES[0];
  const caja = envolvente(region);
  const desde = new Date(ahora - consulta.dias * 86_400_000);

  const p = new URLSearchParams({
    format: "geojson",
    starttime: desde.toISOString().slice(0, 10),
    minmagnitude: String(consulta.magnitudMinima),
    orderby: consulta.orden === "magnitud" ? "magnitude" : "time",
    // Se pide de más porque el recorte fino de las regiones con varias cajas
    // ocurre aquí, después de la respuesta: pedir justo el límite dejaría menos
    // de los pedidos en cuanto la envolvente incluya mar de otra región.
    limit: String(Math.min(LIMITE_MAXIMO * 2, consulta.limite * 3)),
  });

  // El mundo entero no lleva caja: mandarla cuesta parámetros y no filtra nada.
  if (consulta.regionId !== "mundo") {
    p.set("minlongitude", String(caja.o));
    p.set("maxlongitude", String(caja.e));
    p.set("minlatitude", String(caja.s));
    p.set("maxlatitude", String(caja.n));
  }

  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${p}`;
}

export async function buscar(
  consulta: Consulta,
  // Por defecto, ahora. El reloj es de esta capa y no de quien la llama: pedirlo
  // como parámetro obligaba a leerlo dentro de un componente, que es justo donde
  // no se puede leer.
  ahora = Date.now(),
): Promise<{ sismos: Sismo[]; url: string; region: Region }> {
  const region = REGION_POR_ID.get(consulta.regionId) ?? REGIONES[0];
  const url = urlDeConsulta(consulta, ahora);

  // Cinco minutos: el USGS revisa y corrige eventos durante horas, así que pedir
  // más seguido no trae datos más ciertos, solo más peticiones a un servicio
  // público y gratuito.
  const respuesta = await fetch(url, { next: { revalidate: 300 } });
  if (!respuesta.ok) {
    throw new Error(`USGS respondió ${respuesta.status}`);
  }

  const datos = (await respuesta.json()) as RespuestaUsgs;

  const sismos = datos.features
    .map((f) => {
      const [longitud, latitud, profundidad] = f.geometry.coordinates;
      return {
        id: f.id,
        magnitud: f.properties.mag ?? 0,
        lugar: f.properties.place ?? "sin localizar",
        cuando: f.properties.time,
        longitud,
        latitud,
        profundidad,
        tsunami: f.properties.tsunami === 1,
        url: f.properties.url,
      } satisfies Sismo;
    })
    .filter((s) => dentroDeRegion(region, s.longitud, s.latitud))
    .slice(0, consulta.limite);

  return { sismos, url, region };
}

/** El escalón de la rampa de magnitud. Una sola función para que el mapa, la
    lista y la leyenda no puedan discrepar sobre qué color le toca a un sismo. */
export function escalon(magnitud: number): 1 | 2 | 3 | 4 {
  if (magnitud >= 6) return 4;
  if (magnitud >= 5) return 3;
  if (magnitud >= 3) return 2;
  return 1;
}

/**
 * Cuánto hace que ocurrió.
 *
 * `ahora` puede ser null, y entonces devuelve la fecha absoluta. Es lo que se
 * pinta en el servidor: la página se cachea cinco minutos, así que un «hace 2h»
 * calculado ahí llegaría caducado a quien la abra cuatro minutos después. El
 * cliente lo cambia por el relativo en cuanto monta, contra su propio reloj.
 */
export function hace(ms: number, ahora: number | null) {
  if (ahora === null) {
    return new Date(ms).toISOString().slice(5, 16).replace("T", " ") + "Z";
  }
  const s = Math.max(0, Math.round((ahora - ms) / 1000));
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}
