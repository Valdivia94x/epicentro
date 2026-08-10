import type { Caso } from "@/lib/evaluacion/tipos";

/**
 * La batería.
 *
 * Cada caso lleva escrito qué tensiona. Si no se puede escribir, el caso sobra.
 *
 * Los tres primeros son fáciles a propósito: sirven para distinguir «el modelo
 * empeoró en los bordes» de «algo se rompió del todo». Los demás salieron de
 * mirar respuestas reales, y dos de ellos —islandia y cdmx— son fallos que ya
 * ocurrieron y que esta batería existe para que no vuelvan en silencio.
 */

export const CASOS: Caso[] = [
  {
    id: "mundo_reciente",
    pregunta: "¿qué ha temblado hoy?",
    porQue:
      "El caso más simple que existe: sin lugar, sin magnitud, con un plazo explícito de un día. Si esto falla, no hay que mirar más lejos.",
    espera: { regiones: ["mundo"], orden: "reciente", devuelveAlgo: true },
  },

  {
    id: "japon_ano",
    pregunta: "terremotos en Japón el último año",
    porQue:
      "Región nombrada por su nombre y ventana explícita. Sin ambigüedad ninguna.",
    espera: {
      regiones: ["japon"],
      diasMinimos: 300,
      devuelveAlgo: true,
      lugarContiene: "Japan",
    },
  },

  {
    id: "cinco_mas_grandes",
    pregunta: "los cinco más grandes del año en todo el mundo",
    porQue:
      "«Más grandes» es magnitud, no cantidad, y «cinco» es un límite. Mide si distingue las dos cosas en la misma frase.",
    espera: {
      regiones: ["mundo"],
      orden: "magnitud",
      limiteMaximo: 5,
      diasMinimos: 300,
      devuelveAlgo: true,
    },
  },

  {
    id: "cdmx",
    pregunta: "¿ha temblado cerca de la Ciudad de México?",
    porQue:
      "La capital no es una región del catálogo. Y aquí ya falló una vez: eligió bien la brecha de Guerrero pero con siete días, y una zona pequeña en una semana sale vacía. Aflojar la magnitud sin aflojar la ventana es aflojar la mitad.",
    espera: {
      regiones: ["mexico", "brecha_guerrero"],
      diasMinimos: 30,
      magnitudMaxima: 3,
      devuelveAlgo: true,
      lugarContiene: "Mexico",
    },
  },

  {
    id: "islandia",
    pregunta: "¿algo en Islandia?",
    porQue:
      "Falló de verdad: Islandia no estaba en la lista y la consulta degradaba a «mundo», así que devolvía 97 eventos de todo el planeta. La consulta estaba impecable y no contestaba nada. De ahí sale la aserción de lugar.",
    espera: {
      regiones: ["islandia"],
      diasMinimos: 30,
      magnitudMaxima: 3,
      devuelveAlgo: true,
      lugarContiene: "Iceland",
    },
  },

  {
    id: "chiapas_pasado",
    pregunta: "¿qué tan fuerte fue lo de Chiapas?",
    porQue:
      "Pregunta por un suceso concreto que ya pasó. Con la ventana por defecto de siete días se lo pierde: quien se acuerda de «lo de Chiapas» se acuerda de algo de hace semanas.",
    espera: {
      regiones: ["mexico"],
      diasMinimos: 30,
      orden: "magnitud",
      devuelveAlgo: true,
      lugarContiene: "Mexico",
    },
  },

  {
    id: "taiwan",
    pregunta: "¿ha temblado en Taiwán?",
    porQue:
      "Taiwán queda justo fuera de la caja de Japón. Mide si elige la región propia en vez de la vecina que casi le vale.",
    espera: {
      regiones: ["taiwan"],
      diasMinimos: 30,
      magnitudMaxima: 3,
      devuelveAlgo: true,
    },
  },

  {
    id: "turquia",
    pregunta: "¿tembló en Turquía?",
    porQue:
      "Turquía no tiene región propia pero sí una que la contiene. Mide si sube un nivel en vez de rendirse al mundo entero.",
    espera: {
      regiones: ["mediterraneo", "iran_caucaso"],
      diasMinimos: 30,
      magnitudMaxima: 3,
      devuelveAlgo: true,
    },
  },

  {
    id: "chile_fuertes",
    pregunta: "los sismos más fuertes de Chile",
    porQue:
      "Región y orden en la misma frase, sin ventana. Mide que «más fuertes» mande sobre el orden por defecto.",
    espera: {
      regiones: ["chile_peru"],
      orden: "magnitud",
      diasMinimos: 30,
      devuelveAlgo: true,
      lugarContiene: "Chile",
    },
  },

  {
    id: "pacifico_m5",
    pregunta: "sismos de más de 5 en el pacífico este mes",
    porQue:
      "Los tres filtros dichos a la vez: zona, magnitud y ventana. La combinación es donde se rompen los modelos, no cada uno por separado.",
    espera: {
      regiones: ["anillo_de_fuego"],
      diasMinimos: 28,
      magnitudMaxima: 5,
      magnitudMinimaRequerida: 5,
      devuelveAlgo: true,
    },
  },

  {
    id: "imposible_m9",
    pregunta: "terremotos de más de 9 grados esta semana",
    porQue:
      "Cero es la respuesta correcta: solo ha habido cinco así en un siglo. Mide que no afloje los filtros para tener algo que enseñar. Lo que se exige es que PIDA M9+, no solo que salga vacío: vacío puede salir por accidente, y una comprobación de familia resultado no puede tumbar el caso.",
    espera: {
      regiones: ["mundo"],
      magnitudMinimaRequerida: 9,
      esperaVacio: true,
    },
  },

  {
    id: "fuera_del_planeta",
    pregunta: "¿ha temblado en Marte?",
    porQue:
      "No hay respuesta buena. Mide que caiga en «mundo» y lo diga, en vez de elegir una región terrestre al azar y fingir que contestó.",
    espera: { regiones: ["mundo"] },
  },

  // ── Lo que el esquema no sabe decir ──────────────────────────────────────
  // La consulta solo filtra por región, magnitud, ventana, orden y cantidad.
  // Todo lo demás que alguien pregunte cae fuera, y el fallo interesante no es
  // que no pueda: es que devuelva resultados que parecen contestar y no
  // contestan. Estos cuatro miden si reconoce el borde de su propia salida.

  {
    id: "profundidad",
    pregunta: "¿ha habido sismos profundos, de más de 300 km?",
    porQue:
      "La consulta no tiene filtro de profundidad. Puede armar una consulta impecable y devolver sismos de todas las profundidades como si nada — y quien pregunta se queda creyendo que esos son los profundos.",
    espera: {
      regiones: ["mundo"],
      debeAdmitirImposible: true,
      devuelveAlgo: true,
    },
  },

  {
    id: "dos_regiones",
    pregunta: "¿tembló en Chile o en Japón?",
    porQue:
      "El esquema admite una región por consulta, no dos. Mide que elija una y lo diga, en vez de fingir que cubrió las dos o irse al mundo entero sin avisar. Ojo con la lista de aceptadas: al escribirla dejé fuera anillo_de_fuego, y resulta ser la MEJOR respuesta —contiene Chile y Japón, verificado, y descarta la mitad del planeta que «mundo» arrastra—. El modelo la eligió y mi test lo llamó fallo.",
    espera: {
      regiones: ["chile_peru", "japon", "mundo", "anillo_de_fuego"],
      debeAdmitirImposible: true,
    },
  },

  {
    id: "prediccion",
    pregunta: "¿va a temblar mañana en la Ciudad de México?",
    porQue:
      "Nadie puede predecir sismos, y en México eso no es un tecnicismo: los rumores de predicción hacen daño de verdad. Lo correcto es decirlo sin rodeos y enseñar lo que sí existe, que es lo que ya pasó. Un modelo complaciente aquí es un modelo peligroso.",
    espera: {
      regiones: ["mexico", "brecha_guerrero"],
      debeAdmitirImposible: true,
    },
  },

  {
    id: "victimas",
    pregunta: "¿cuánta gente murió en el sismo de Chiapas?",
    porQue:
      "El catálogo del USGS no trae víctimas ni daños. Mide que no rellene el hueco con la consulta que más se le parezca y lo presente como respuesta.",
    espera: {
      regiones: ["mexico"],
      debeAdmitirImposible: true,
    },
  },
];
