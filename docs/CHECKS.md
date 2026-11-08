# Pruebas al final del ciclo

No se prueba fase por fase. Cuando las 10 fases estén en el código, se recorre esta lista en un teléfono con navegación por gestos.

La build tiene que ser nativa (`npm run android`). Expo Go no sirve para el vídeo: FFmpeg no está ahí.

Marca cada casilla en el teléfono. Si una falla, anota el modelo y qué se veía.

## Antes de empezar

- [ ] El teléfono usa gestos, no los tres botones de Android.
- [ ] Hay al menos dos fotos y dos vídeos verticales de la cámara en la galería.
- [ ] Hay un vídeo grabado en horizontal.
- [ ] Hay un vídeo sin pista de audio (o se acepta silenciar uno).
- [ ] La app instalada es la de este ciclo, no un APK viejo.

## Fase 01 — Un solo export

- [ ] Con el collage vacío, Exportar avisa y no arranca nada.
- [ ] Con al menos un medio, dos toques rápidos en Exportar no lanzan dos renders. El botón pasa a "Exportando..." y no se puede pulsar.
- [ ] Preview tampoco se puede abrir mientras exporta.
- [ ] Si se cancela el permiso de galería, se puede volver a exportar después.
- [ ] Tras un export correcto, en la caché de la app no queda un `collage_*.mp4` suelto.
- [ ] Si el export falla, tampoco queda ese temporal.
- [ ] Un collage solo de fotos guarda un JPG y no intenta el MP4.
- [ ] `package.json`, `app.json` (`version` y `versionCode` 109) y el README dicen 1.0.9.

## Fase 02 — Barras del sistema

- [ ] En la pantalla principal, "Historys" y el botón de info no quedan bajo el reloj ni el notch.
- [ ] Al bajar del todo, Preview y Exportar se pueden pulsar. No quedan bajo la barra de gestos.
- [ ] En el preview, el título, el contador y "Cerrar preview" quedan fuera de las barras. El reloj del sistema se lee en claro sobre el fondo oscuro.
- [ ] En el editor, el título, el zoom y Reset / Cancelar / Guardar quedan fuera de las barras. Ninguno se sale de la pantalla.
- [ ] El marco del preview y el del editor siguen siendo el recorte del slot (9:16 el preview; banda o columna en el editor) y no se estiran para tapar los botones.
- [ ] En un teléfono sin notch el hueco de arriba no es enorme: solo la barra de estado más un poco de aire.

## Fase 03 — El marco solo muestra la historia

- [ ] Dentro del marco 9:16 no hay botones. Solo la foto, el vídeo o un hueco negro.
- [ ] Un hueco vacío dice "Toca para cargar".
- [ ] Al tocar un slot aparece una barra fuera del marco: Cargar, Ajustar, Audio y Quitar.
- [ ] Audio solo aparece si el slot es un vídeo.
- [ ] Quitar vacía ese slot y la barra se cierra.

## Fase 04 — El mismo encuadre en todos lados

- [ ] Lo que encuadras en el editor se ve igual en la miniatura del slot, en el preview y en un fotograma del MP4.
- [ ] Un slot horizontal (banda) se edita en horizontal, no en un cuadro vertical.
- [ ] El título del editor distingue foto y vídeo.
- [ ] La miniatura de un vídeo muestra el recorte, no el vídeo entero ignorando el zoom.

## Fase 05 — Vídeos girados

Hace falta la build nativa. Expo Go no endereza el vídeo.

- [ ] Un vídeo de cámara vertical sale de pie en el MP4, no tumbado.
- [ ] Una foto no se gira sola.
- [ ] Si el vídeo se corrigió, se ve la pastilla "Corregido". Si no hizo falta, no aparece.

## Fase 06 — Un solo audio

- [ ] Dos vídeos con sonido se oyen mezclados en una sola pista del MP4.
- [ ] La pantalla lo dice: "Se mezclarán en una pista".
- [ ] Un vídeo silenciado no entra en la mezcla.
- [ ] Un clip sin audio no tumba el export.

## Fase 07 — Calidad

- [ ] Hay tres pastillas: Baja, Media, Alta.
- [ ] Media, sin tocarla, se ve como el export de hoy (unos 15 Mbps).
- [ ] Si el archivo no quedó en H.264, la app lo dice. No lo presenta como si lo fuera.

## Fase 08 — Preview igual al MP4

- [ ] El preview es a pantalla, en 9:16, con cuenta atrás y cierre.
- [ ] Un slot silenciado no suena en el preview.
- [ ] Una captura del preview y un fotograma del MP4 coinciden en cortes, bordes y huecos negros.

## Fase 09 — Tres formas, mismos medios

- [ ] Se elige la forma con tres miniaturas: 3 bandas, 2+1 y 1+2. Ya no hay un menú de texto.
- [ ] Al cambiar de forma, la foto o el vídeo sigue en el slot 1, 2 o 3.
- [ ] Bordes sigue siendo una pastilla aparte. No cambia la forma, solo el margen.

## Fase 10 — Al terminar

- [ ] Un export correcto no vacía el collage solo.
- [ ] "Nuevo collage" pregunta antes de borrar.
- [ ] iOS tiene `bundleIdentifier` en `app.json`.

## Fuera de esta lista

No se prueba porque no entra en este ciclo: recorte de entrada y salida por vídeo, plantillas guardadas, y compartir directo a Instagram, TikTok o WhatsApp.
