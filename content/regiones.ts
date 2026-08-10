/**
 * Las regiones que se pueden consultar.
 *
 * Van como lista cerrada y no como coordenadas libres: si el modelo pudiera
 * emitir una caja geográfica cualquiera, podría emitir una caja vacía, invertida
 * o en mitad del Atlántico, y el fallo aparecería como «no hay sismos» en vez de
 * como un error. Eligiendo de una lista, lo peor que puede hacer es elegir mal
 * —visible y comprobable— en vez de inventar.
 *
 * Algunas regiones no son un rectángulo. Se modelan como varias cajas: a la API
 * se le pide la envolvente de todas y el recorte fino se hace aquí.
 */

export type Caja = {
  /** [oeste, sur, este, norte] en grados. */
  o: number;
  s: number;
  e: number;
  n: number;
};

export type Region = {
  id: string;
  nombre: string;
  /** Qué tensiona o por qué está en la lista. */
  nota: string;
  cajas: Caja[];
};

export const REGIONES: Region[] = [
  {
    id: "mundo",
    nombre: "Todo el mundo",
    nota: "Sin recorte.",
    cajas: [{ o: -180, s: -90, e: 180, n: 90 }],
  },
  {
    id: "mexico",
    nombre: "México",
    nota: "Todo el territorio y sus dos costas.",
    cajas: [{ o: -118, s: 14, e: -86, n: 33 }],
  },
  {
    id: "brecha_guerrero",
    nombre: "Costa de Guerrero y Oaxaca",
    nota: "La zona de subducción que más sismos sensibles manda a la capital.",
    cajas: [{ o: -102, s: 15, e: -94, n: 18.5 }],
  },
  {
    id: "california",
    nombre: "California y Baja",
    nota: "San Andrés y el golfo.",
    cajas: [{ o: -125, s: 28, e: -113, n: 42 }],
  },
  {
    id: "alaska",
    nombre: "Alaska y Aleutianas",
    nota: "El arco más activo de Norteamérica.",
    cajas: [
      { o: -180, s: 50, e: -128, n: 72 },
      { o: 165, s: 50, e: 180, n: 60 },
    ],
  },
  {
    id: "japon",
    nombre: "Japón",
    nota: "Cuatro placas en el mismo sitio.",
    cajas: [{ o: 128, s: 24, e: 148, n: 46 }],
  },
  {
    id: "indonesia",
    nombre: "Indonesia y Filipinas",
    nota: "Sunda y Filipinas.",
    cajas: [{ o: 94, s: -11, e: 128, n: 21 }],
  },
  {
    id: "chile_peru",
    nombre: "Chile y Perú",
    nota: "Nazca bajo Sudamérica. Los sismos más grandes registrados.",
    cajas: [{ o: -82, s: -57, e: -66, n: 0 }],
  },
  {
    id: "mediterraneo",
    nombre: "Mediterráneo y Turquía",
    nota: "Anatolia, Grecia, Italia.",
    cajas: [{ o: -6, s: 32, e: 45, n: 46 }],
  },
  {
    id: "himalaya",
    nombre: "Himalaya y Asia central",
    nota: "India empujando contra Eurasia.",
    cajas: [{ o: 60, s: 24, e: 100, n: 42 }],
  },
  {
    id: "caribe",
    nombre: "Caribe y Centroamérica",
    nota: "Del istmo a las Antillas.",
    cajas: [{ o: -92, s: 8, e: -58, n: 22 }],
  },
  {
    id: "anillo_de_fuego",
    nombre: "Cinturón de Fuego",
    nota: "No es un rectángulo: son cuatro cajas alrededor del Pacífico.",
    cajas: [
      { o: -180, s: -60, e: -60, n: 72 },
      { o: 100, s: -50, e: 180, n: 62 },
      { o: 90, s: -12, e: 130, n: 25 },
      { o: 160, s: -50, e: 180, n: 0 },
    ],
  },
];

export const REGION_POR_ID = new Map(REGIONES.map((r) => [r.id, r]));

/** Caja envolvente de una región: lo que se le pide a la API. */
export function envolvente(region: Region): Caja {
  return region.cajas.reduce(
    (acc, c) => ({
      o: Math.min(acc.o, c.o),
      s: Math.min(acc.s, c.s),
      e: Math.max(acc.e, c.e),
      n: Math.max(acc.n, c.n),
    }),
    { o: 180, s: 90, e: -180, n: -90 },
  );
}

/** ¿Cae el punto dentro de alguna caja de la región? */
export function dentroDeRegion(
  region: Region,
  longitud: number,
  latitud: number,
) {
  return region.cajas.some(
    (c) =>
      longitud >= c.o && longitud <= c.e && latitud >= c.s && latitud <= c.n,
  );
}
