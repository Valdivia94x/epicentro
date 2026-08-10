import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buscar, escalon } from "@/lib/usgs";

export const alt = "Epicentro — estación de rastreo sísmico";

/** 2400×1260: el doble de 1.91:1, para que LinkedIn siempre reduzca en vez de
    estirar. Reducir es nítido; estirar es lo que se ve borroso. */
export const size = { width: 2400, height: 1260 };
export const contentType = "image/png";

const departure = await readFile(
  join(process.cwd(), "assets/DepartureMono-Regular.otf"),
);

const COLOR_ESCALON = ["#f0e9bd", "#f0e9bd", "#f2c451", "#e8823a", "#d4402c"];

/**
 * La tarjeta enseña el sismo más grande de la última semana, pedido al USGS
 * cuando se construye. Escribir una cifra a mano en la tarjeta de un proyecto
 * que va de datos en vivo sería raro.
 *
 * Sin mapa a propósito: satori no dibuja en canvas, y las 12.960 celdas del
 * mundo tendrían que ser 12.960 divs. Un número grande y legible a un tercio de
 * tamaño dice más que un mapa que no se distingue.
 */
export default async function Image() {
  let mayor: { magnitud: number; lugar: string } | null = null;
  let cuantos = 0;

  try {
    const { sismos } = await buscar({
      regionId: "mundo",
      magnitudMinima: 4.5,
      dias: 7,
      orden: "magnitud",
      limite: 500,
    });
    cuantos = sismos.length;
    mayor = sismos[0] ?? null;
  } catch {
    // Si el USGS no contesta, la tarjeta sale sin cifras en vez de no salir.
    // Una tarjeta rota es un enlace sin imagen en todas partes donde se pegue.
  }

  const color = COLOR_ESCALON[mayor ? escalon(mayor.magnitud) : 0];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 130,
        padding: "0 172px",
        // Fondo de PANTALLA, no de caja: el fósforo verde vive sobre lo
        // oscuro. Encima va el bisel, así que la tarjeta enseña lo mismo que
        // el sitio — el interior del instrumento, no su carcasa.
        backgroundColor: "#070b09",
      }}
    >
      {/* El bisel, con divs y bordes de verdad: satori no pinta box-shadow
          interior, y además ignora la propiedad abreviada `inset` — un div con
          `inset: 0` no se estira, se queda del tamaño de su borde y aparece
          como un cuadradito suelto en una esquina. Las dos cosas fallan en
          silencio: compila igual y sale una tarjeta plana. Por eso van medidas
          explícitas, que a tamaño fijo no tienen ninguna ambigüedad. */}
      {[
        { d: 0, grosor: 24, color: "#3d453c" },
        { d: 24, grosor: 10, color: "#4e574b" },
        { d: 34, grosor: 6, color: "#171b17" },
      ].map(({ d, grosor, color: c }) => (
        <div
          key={d}
          style={{
            position: "absolute",
            top: d,
            left: d,
            width: size.width - d * 2,
            height: size.height - d * 2,
            display: "flex",
            border: `${grosor}px solid ${c}`,
          }}
        />
      ))}

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            fontFamily: "Departure",
            fontSize: 34,
            letterSpacing: 9,
            color: "#7ce8a6",
          }}
        >
          ESTACIÓN DE RASTREO SÍSMICO
        </div>

        <div
          style={{
            fontFamily: "Departure",
            fontSize: 190,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: "#d7d0bb",
            marginTop: 34,
          }}
        >
          Epicentro
        </div>

        {/* Dos divs en columna en vez de un <br/>: satori exige display
              explícito en cualquier div con más de un hijo, y texto + br +
              texto son tres. El build falla, no lo avisa en silencio. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Departure",
            fontSize: 60,
            lineHeight: 1.3,
            color: "#7ce8a6",
            marginTop: 30,
          }}
        >
          <div>Sismos del mundo en vivo,</div>
          <div>y una consulta que entiende español.</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          paddingLeft: 92,
          borderLeft: "4px solid #3d7a5b",
        }}
      >
        <div
          style={{
            fontFamily: "Departure",
            fontSize: 30,
            letterSpacing: 6,
            color: "#3d7a5b",
          }}
        >
          MAYOR DE LA SEMANA
        </div>

        {/* String() y plantillas, nunca un número suelto: satori revienta con
              un hijo numérico y culpa a otra cosa —«el div tiene más de un
              hijo»—, así que el mensaje no lleva a la línea que falla. */}
        <div
          style={{
            fontFamily: "Departure",
            fontSize: 220,
            letterSpacing: -4,
            color,
            marginTop: 10,
          }}
        >
          {mayor ? `M${mayor.magnitud.toFixed(1)}` : "—"}
        </div>

        <div
          style={{
            fontFamily: "Departure",
            fontSize: 40,
            lineHeight: 1.3,
            color: "#d7d0bb",
            marginTop: 6,
            maxWidth: 620,
          }}
        >
          {mayor ? mayor.lugar : "sin datos del USGS"}
        </div>

        <div
          style={{
            fontFamily: "Departure",
            fontSize: 34,
            letterSpacing: 4,
            color: "#3d7a5b",
            marginTop: 46,
          }}
        >
          {`${String(cuantos)} EVENTOS M4.5+ EN 7 DÍAS`}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Departure", data: departure, style: "normal", weight: 400 },
      ],
    },
  );
}
