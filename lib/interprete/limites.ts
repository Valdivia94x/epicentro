/**
 * Límites de la ruta que llama al modelo.
 *
 * En memoria y por instancia: en un despliegue con varias, cada una lleva su
 * cuenta. Es a propósito — un contador compartido de verdad pide una base de
 * datos, y esto protege de un bucle accidental, no de un ataque decidido.
 */

export const MAX_ENTRADA = 200;
export const MAX_SALIDA = 400;
const POR_IP_POR_MINUTO = 5;
const POR_DIA = 300;

const porIp = new Map<string, number[]>();
let delDia = { fecha: "", cuenta: 0 };

export function revisarLimites(ip: string, hoy: string) {
  if (delDia.fecha !== hoy) delDia = { fecha: hoy, cuenta: 0 };
  if (delDia.cuenta >= POR_DIA) {
    return {
      permitido: false as const,
      motivo: "La cuota del día se agotó. Los ejemplos guardados siguen ahí.",
    };
  }

  const ahora = Date.now();
  const sellos = (porIp.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  if (sellos.length >= POR_IP_POR_MINUTO) {
    return {
      permitido: false as const,
      motivo: "Demasiadas consultas seguidas. Espera un minuto.",
    };
  }

  sellos.push(ahora);
  porIp.set(ip, sellos);
  delDia.cuenta += 1;

  // El mapa crece con cada IP distinta; sin esto es una fuga lenta.
  if (porIp.size > 5000) {
    for (const [k, v] of porIp)
      if (v.every((t) => ahora - t > 60_000)) porIp.delete(k);
  }

  return { permitido: true as const };
}
