import { REGION_POR_ID } from "@/content/regiones";
import type { Asercion } from "./tipos";

/**
 * Las comprobaciones. Todas deterministas: o la consulta pide 90 días o no.
 *
 * Cada una devuelve `null` cuando no aplica al caso, para que un caso que no
 * habla de orden no arrastre una aserción de orden que pasaría trivialmente e
 * inflaría la tasa.
 *
 * La familia importa tanto como el veredicto. `interpretacion` solo depende del
 * modelo; `resultado` depende además de lo que haya temblado esta semana, y por
 * eso no puede decidir si el modelo pasa — solo informar aparte.
 */

export const ASERCIONES: Asercion[] = [
  {
    id: "region",
    descripcion: "Elige una región que cubre lo que preguntaron",
    familia: "interpretacion",
    evaluar: ({ caso, consulta }) => {
      const validas = caso.espera.regiones;
      if (!validas?.length) return null;
      const pasa = validas.includes(consulta.regionId);
      const nombre =
        REGION_POR_ID.get(consulta.regionId)?.nombre ?? consulta.regionId;
      return {
        pasa,
        detalle: pasa
          ? `${nombre}`
          : `eligió ${nombre}; se esperaba ${validas.join(" o ")}`,
      };
    },
  },

  {
    id: "ventana",
    descripcion: "La ventana de tiempo alcanza para encontrar algo",
    familia: "interpretacion",
    evaluar: ({ caso, consulta }) => {
      const minimo = caso.espera.diasMinimos;
      if (minimo === undefined) return null;
      return {
        pasa: consulta.dias >= minimo,
        detalle: `${consulta.dias} días (mínimo ${minimo})`,
      };
    },
  },

  {
    id: "magnitud",
    descripcion: "No filtra tan alto que se quede sin datos",
    familia: "interpretacion",
    evaluar: ({ caso, consulta }) => {
      const tope = caso.espera.magnitudMaxima;
      if (tope === undefined) return null;
      return {
        pasa: consulta.magnitudMinima <= tope,
        detalle: `pide M${consulta.magnitudMinima}+ (tope M${tope})`,
      };
    },
  },

  {
    id: "magnitud_pedida",
    descripcion: "Respeta la magnitud que le pidieron explícitamente",
    familia: "interpretacion",
    evaluar: ({ caso, consulta }) => {
      const suelo = caso.espera.magnitudMinimaRequerida;
      if (suelo === undefined) return null;
      return {
        pasa: consulta.magnitudMinima >= suelo,
        detalle: `pide M${consulta.magnitudMinima}+ (se pidió M${suelo}+)`,
      };
    },
  },

  {
    id: "orden",
    descripcion: "Ordena por lo que la pregunta pide",
    familia: "interpretacion",
    evaluar: ({ caso, consulta }) => {
      const quiere = caso.espera.orden;
      if (!quiere) return null;
      return {
        pasa: consulta.orden === quiere,
        detalle: `ordena por ${consulta.orden} (se esperaba ${quiere})`,
      };
    },
  },

  {
    id: "limite",
    descripcion: "No devuelve una avalancha cuando le piden uno",
    familia: "interpretacion",
    evaluar: ({ caso, consulta }) => {
      const tope = caso.espera.limiteMaximo;
      if (tope === undefined) return null;
      return {
        pasa: consulta.limite <= tope,
        detalle: `límite ${consulta.limite} (tope ${tope})`,
      };
    },
  },

  {
    id: "devuelve_algo",
    descripcion: "La consulta encuentra al menos un sismo",
    familia: "resultado",
    evaluar: ({ caso, sismos }) => {
      if (!caso.espera.devuelveAlgo) return null;
      return {
        pasa: sismos.length > 0,
        detalle: `${sismos.length} eventos`,
      };
    },
  },

  {
    id: "lugar_cubierto",
    descripcion: "Entre los resultados sale el sitio por el que preguntaron",
    familia: "resultado",
    evaluar: ({ caso, sismos }) => {
      const aguja = caso.espera.lugarContiene;
      if (!aguja) return null;
      // Es la comprobación que separa «la consulta está bien formada» de «la
      // consulta contesta la pregunta». Se puede emitir una consulta impecable
      // sobre la región equivocada y quedarse tan ancho.
      const encontrados = sismos.filter((s) =>
        s.lugar.toLowerCase().includes(aguja.toLowerCase()),
      );
      return {
        pasa: encontrados.length > 0,
        detalle: encontrados.length
          ? `${encontrados.length} en «${aguja}»`
          : `ninguno de los ${sismos.length} menciona «${aguja}»`,
      };
    },
  },

  {
    id: "vacio_cuando_toca",
    descripcion: "Devuelve cero cuando cero es la respuesta correcta",
    familia: "resultado",
    evaluar: ({ caso, sismos }) => {
      if (!caso.espera.esperaVacio) return null;
      return {
        pasa: sismos.length === 0,
        detalle: `${sismos.length} eventos (se esperaban 0)`,
      };
    },
  },
];
