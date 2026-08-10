import type { Consulta, Orden, Sismo } from "@/lib/usgs";

/**
 * Tipos del harness, portados del de Tizón y adaptados a lo que aquí se mide.
 *
 * La diferencia con el original: allí el sujeto devolvía un pedido y se juzgaba
 * el pedido. Aquí el sujeto devuelve una CONSULTA, y la consulta además se
 * ejecuta. Eso parte las comprobaciones en dos familias que no se pueden sumar:
 *
 *   - INTERPRETACIÓN: ¿la consulta dice lo que le pidieron? Se verifica sobre
 *     la consulta misma, sin red, y solo depende del modelo.
 *   - RESULTADO: ¿esa consulta contesta la pregunta? Necesita los datos del
 *     USGS, y puede fallar porque la Tierra estuvo tranquila esa semana.
 *
 * Sumarlas daría una cifra que baja sin que nadie haya tocado nada. Se informan
 * por separado, y una regresión solo se declara sobre la primera.
 */

export type Espera = {
  /** Regiones aceptables. Es una lista porque más de una puede ser defendible:
      «cerca de la CDMX» admite tanto `mexico` como `brecha_guerrero`. */
  regiones?: string[];
  /** La ventana no puede ser menor que esto. */
  diasMinimos?: number;
  /** El mínimo de magnitud no puede pasar de esto: pedir M4.5 en una zona
      pequeña es la forma más fácil de devolver cero sin equivocarse en nada. */
  magnitudMaxima?: number;
  /** Suelo del filtro de magnitud. Lo contrario de `magnitudMaxima`: cuando la
      pregunta dice «de más de 9», pedir M4.5 es haberla entendido mal, aunque
      el resultado salga vacío por otros motivos. */
  magnitudMinimaRequerida?: number;
  orden?: Orden;
  /** Tope de resultados. «¿Qué tan fuerte fue X?» pregunta por uno, no por 500. */
  limiteMaximo?: number;

  // — Lo de abajo depende de los datos del día, no solo del modelo —

  /** Tiene que devolver al menos un evento. */
  devuelveAlgo?: boolean;
  /** Al menos un evento cuyo lugar contenga este texto. Es la comprobación que
      de verdad pregunta «¿esto contesta lo que te preguntaron?». */
  lugarContiene?: string;
  /** Tiene que devolver cero. Para lo que es imposible de verdad. */
  esperaVacio?: boolean;
};

export type Caso = {
  id: string;
  pregunta: string;
  /** Qué tensiona este caso. Si no se puede escribir, el caso no vale la pena. */
  porQue: string;
  espera: Espera;
};

export type Familia = "interpretacion" | "resultado";

export type Veredicto = {
  asercion: string;
  descripcion: string;
  familia: Familia;
  pasa: boolean;
  detalle: string;
};

export type Contexto = {
  caso: Caso;
  consulta: Consulta;
  sismos: Sismo[];
};

export type Asercion = {
  id: string;
  descripcion: string;
  familia: Familia;
  /** Devuelve null si la aserción no aplica a este caso. */
  evaluar: (ctx: Contexto) => { pasa: boolean; detalle: string } | null;
};

export type Intento = {
  /** Null si la llamada al modelo falló; se distingue de «falló una aserción». */
  consulta: Consulta | null;
  lectura: string;
  error: string | null;
  veredictos: Veredicto[];
  /** Solo cuenta la familia de interpretación: lo que depende de los datos del
      día no puede decidir si el modelo pasa. */
  pasa: boolean;
  /** Aparte, para poder mirarlo sin que contamine lo anterior. */
  pasaResultado: boolean;
  cuantosSismos: number;
  ms: number;
};

export type ResultadoCaso = {
  casoId: string;
  pregunta: string;
  intentos: Intento[];
  /** Estricto: el caso pasa solo si pasa TODOS sus intentos. */
  pasa: boolean;
  pasaron: number;
};

export type Corrida = {
  id: string;
  fecha: string;
  modelo: string;
  /** Huella del prompt: si cambia, la comparación entre corridas no es limpia. */
  huellaPrompt: string;
  /** Huella de la lista de regiones: cambiarla mueve los resultados tanto como
      cambiar el prompt, y sin esto la comparación lo achacaría al modelo. */
  huellaRegiones: string;
  repeticiones: number;
  resultados: ResultadoCaso[];
};

export type Sujeto = {
  nombre: string;
  modelo: string;
  huellaPrompt: string;
  responder: (
    pregunta: string,
  ) => Promise<{ consulta: Consulta; lectura: string }>;
};
