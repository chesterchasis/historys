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
- [ ] Con al menos un medio, dos toques rápidos en «Guardar en galería» (hoja de exportación) no lanzan dos renders. La hoja pasa a mostrar el progreso y no se puede volver a lanzar.
- [ ] Mientras exporta, la hoja no se puede cerrar tocando fuera y el botón Exportar de la pantalla principal queda desactivado.
- [ ] Si se cancela el permiso de galería, se puede volver a exportar después.
- [ ] Tras un export correcto, en la caché de la app no queda un `collage_*.mp4` suelto.
- [ ] Si el export falla, tampoco queda ese temporal.
- [ ] Un collage solo de fotos guarda un JPG y no intenta el MP4.
- [ ] `package.json`, `app.json` (`version` y `versionCode` 109) y el README dicen 1.0.9.

## Fase 02 — Barras del sistema

- [ ] En la pantalla principal, "Historys" y el botón de info no quedan bajo el reloj ni el notch.
- [ ] Al bajar del todo, Preview y Exportar se pueden pulsar. No quedan bajo la barra de gestos.
- [ ] En el preview, el título, el contador y "Cerrar preview" quedan fuera de las barras. El reloj del sistema se lee en claro sobre el fondo oscuro.
- [ ] En el editor, Cancelar, el título, Hecho, el deslizador de zoom y Restablecer quedan fuera de las barras. Ninguno se sale de la pantalla.
- [ ] El marco del preview y el del editor siguen siendo el recorte del slot (9:16 el preview; banda o columna en el editor) y no se estiran para tapar los botones.
- [ ] En un teléfono sin notch el hueco de arriba no es enorme: solo la barra de estado más un poco de aire.

## Fase 03 — El marco solo muestra la historia

- [ ] Dentro del marco 9:16 no hay botones. Solo la foto, el vídeo o un hueco negro.
- [ ] Un hueco vacío muestra un «+» con la palabra «Añadir».
- [ ] Al tocar un slot con contenido, la barra de abajo pasa a: Cambiar, Ajustar, Sonido, Quitar y Listo.
- [ ] Sonido solo aparece si el slot es un vídeo.
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
- [ ] Si el vídeo se corrigió, al cargarlo sale el aviso «Vídeo vertical enderezado automáticamente» unos segundos bajo el lienzo. Si no hizo falta, no aparece.

## Fase 06 — Un solo audio

- [ ] Dos vídeos con sonido se oyen mezclados en una sola pista del MP4.
- [ ] La hoja de exportación lo dice: «Sonido: 2 vídeos mezclados».
- [ ] Un vídeo silenciado no entra en la mezcla.
- [ ] Un clip sin audio no tumba el export.

## Fase 07 — Calidad

- [ ] En la hoja de exportación hay tres opciones: Ligera, Normal, Máxima.
- [ ] Normal, sin tocarla, se ve como el export de antes (unos 15 Mbps).
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
- [ ] «Empezar otra historia» (enlace del aviso final) pregunta antes de borrar.
- [ ] iOS tiene `bundleIdentifier` en `app.json`.

## Propuesta UX · Fase 01 — Pantalla sin scroll

- [ ] La pantalla principal no se desplaza. Se ven a la vez el título, el lienzo 9:16 entero, la barra de herramientas y Exportar.
- [ ] Probado también en un móvil pequeño (unos 360 × 640 dp): el lienzo se reduce pero sigue entero.
- [ ] La barra muestra Diseño, Duración, Añadir y Vista previa, cada una con su valor actual (p. ej. «10 s»). La calidad ya no está en la barra: se elige al exportar (fase 09).
- [ ] Diseño abre un panel con las tres formas y un interruptor Bordes; el lienzo se encoge y cambia en directo. «Listo» cierra el panel.
- [ ] Duración abre el panel «Duración»; el valor elegido aparece en la barra al cerrar.
- [ ] Al tocar un hueco, la barra pasa a Cargar/Cambiar, Ajustar, Audio/Silencio, Quitar y Listo, siempre en el mismo sitio. Tocar fuera del lienzo o «Listo» la devuelve a la general.
- [ ] La barra no cambia mientras se exporta: el progreso se ve en la hoja de exportación (fase 09).

## Propuesta UX · Fase 02 — Cabecera y menú

- [ ] La cabecera solo tiene el título, «?» y «···». No hay ninguna «R».
- [ ] «?» abre la guía rápida y su texto ya no menciona la «R».
- [ ] «···» abre un menú justo debajo del botón, alineado a la derecha, y no queda bajo la cámara ni la barra de estado.
- [ ] El menú tiene Nuevo collage… (en rojo), Guía rápida y Acerca de con la versión.
- [ ] Tocar fuera del menú, o el gesto atrás, lo cierra sin hacer nada.
- [ ] Nuevo collage… con huecos cargados pide confirmación antes de vaciar; con el collage vacío avisa de que ya lo está.
- [ ] Acerca de muestra la versión de `app.json`.

## Propuesta UX · Fase 03 — Hueco vacío abre la galería

- [ ] Con la app recién instalada, tocar un hueco vacío lanza directamente el permiso de Android (sin diálogo propio) y luego el selector.
- [ ] Tras elegir una foto, queda en ese hueco: dos toques en total (hueco y foto).
- [ ] Cancelar el selector deja el hueco vacío y se puede volver a tocar.
- [ ] Dos toques rápidos en un hueco vacío no abren dos selectores.
- [ ] Un hueco con contenido no abre la galería al tocarlo: se selecciona y Cambiar sí la abre.
- [ ] Con el permiso denegado (y «no volver a preguntar»), aparece «Permiso necesario» con «Ahora no» y «Abrir ajustes», y este último abre los ajustes de la app.
- [ ] Tras dar el permiso en ajustes y volver, tocar el hueco abre el selector.

## Propuesta UX · Fase 04 — Selección múltiple

- [ ] Con el lienzo vacío, Añadir dice «3 libres» y abre un selector donde se pueden marcar hasta 3.
- [ ] Marcar 3 elementos (fotos y vídeos mezclados) los coloca en los huecos 1, 2 y 3 en el orden en que se marcaron.
- [ ] Con un hueco ya lleno, Añadir dice «2 libres», deja marcar hasta 2 y no toca el hueco lleno.
- [ ] Si se marcan menos elementos que huecos libres, solo se rellenan los primeros libres; el resto sigue vacío.
- [ ] Con los tres huecos llenos, Añadir aparece desactivado con «Completo».
- [ ] Cancelar el selector no cambia nada.
- [ ] Cada vídeo cargado así enseña su miniatura y, si es de cámara vertical, sale el aviso de enderezado.
- [ ] Un vídeo silenciado antes y sustituido con «Cambiar» conserva el silencio.
- [ ] Tocar Añadir dos veces seguidas no abre dos selectores.

## Propuesta UX · Fase 05 — Barra contextual con iconos

Hace falta volver a instalar dependencias (`npm install`) y la build nativa; si no, los iconos no salen.

- [ ] Todos los botones de la barra llevan icono y texto: Diseño, Duración, Añadir y Vista previa; y en un hueco: Cambiar, Ajustar, Sonido, Quitar y Listo.
- [ ] Los iconos se ven desde el primer segundo, sin cuadros vacíos.
- [ ] Al tocar un hueco, la línea bajo el lienzo dice «Hueco 2 · Vídeo · Con sonido» o «· Silenciado» (o «· Sin sonido» si el clip no trae audio).
- [ ] Sonido cambia el icono del altavoz a tachado, el botón se marca en azul y la línea dice «Silenciado».
- [ ] Un vídeo en el lienzo lleva una pastilla con ▶ y su duración (p. ej. 0:12), sin la palabra VIDEO.
- [ ] Un vídeo silenciado o sin audio lleva además un altavoz tachado en la pastilla.
- [ ] Ya no hay pastilla «Corregido» fija en el lienzo.
- [ ] Listo y tocar fuera del lienzo deseleccionan el hueco y devuelven la barra general.

## Propuesta UX · Fase 06 — Paneles de Diseño y Duración

- [ ] El panel Diseño tiene las tres miniaturas y, debajo, la fila «Bordes» con su explicación y un interruptor.
- [ ] El interruptor quita y pone el margen negro: las miniaturas y el lienzo cambian a la vez.
- [ ] El interruptor no cambia la forma elegida ni los medios cargados.
- [ ] Cambiar de forma conserva la foto o el vídeo de cada hueco.
- [ ] Con el panel Diseño abierto, el lienzo sigue entero (más pequeño) y Exportar sigue visible, también en un móvil pequeño.
- [ ] El panel Duración marca la duración actual; el botón de la barra muestra «10 s» al cerrar.
- [ ] Abrir un panel y tocar un hueco, o el fondo del lienzo, cierra el panel.
- [ ] Mientras hay un panel abierto no se puede abrir otro sin cerrarlo antes con «Listo» o tocando fuera.

## Propuesta UX · Fase 07 — Arrastrar y doble toque

No añade librerías nativas: usa `PanResponder` y `Animated`.

- [ ] Mantener pulsado un hueco con contenido (casi medio segundo) lo «levanta»: el hueco original se oscurece y una copia pequeña sigue al dedo.
- [ ] Mientras se arrastra, bajo el lienzo dice «Suelta sobre otro hueco para intercambiarlos».
- [ ] Al pasar sobre otro hueco, este se marca en azul.
- [ ] Soltar sobre otro hueco los intercambia, con su zoom, posición y sonido.
- [ ] Soltar sobre un hueco vacío mueve el contenido allí y deja el original vacío.
- [ ] Soltar fuera de cualquier hueco, o sobre el mismo, no cambia nada.
- [ ] Mantener pulsado un hueco vacío no levanta nada.
- [ ] Un toque corto sigue seleccionando el hueco (y de nuevo lo deselecciona).
- [ ] Un doble toque sobre un hueco con contenido abre el editor de encuadre.
- [ ] Con bordes, tocar la franja negra entre huecos deselecciona y cierra paneles.
- [ ] Probado en las tres formas (3 bandas, 2+1, 1+2), incluido intercambiar un hueco vertical con uno horizontal.
- [ ] Mientras exporta no se puede arrastrar.
- [ ] Un arrastre con vídeos no se corta ni congela el lienzo.

## Propuesta UX · Fase 08 — Editor de encuadre

No añade librerías nativas: el deslizador es propio.

- [ ] Arriba hay «Cancelar» a la izquierda, el título en el centro («Ajustar foto» o «Ajustar vídeo») y «Hecho» a la derecha.
- [ ] «Cancelar» descarta los cambios; «Hecho» los guarda y la miniatura del hueco muestra el nuevo encuadre.
- [ ] La parte de la foto o del vídeo que queda fuera del hueco se ve en tenue alrededor del marco, y no tapa el título ni los controles.
- [ ] Se puede arrastrar desde cualquier punto de la zona central, no solo desde dentro del marco.
- [ ] Mientras se arrastra o se pellizca aparece una cuadrícula de tercios dentro del marco, y desaparece al soltar.
- [ ] El deslizador va de 1× a 4× y el texto «Zoom NNN %» sigue al dedo. El pellizco y el deslizador dan el mismo resultado.
- [ ] «Restablecer» (enlace de texto) vuelve a 1× y centra la imagen.
- [ ] Doble toque dentro del editor alterna entre 1× y 2×; un toque suelto no hace nada.
- [ ] Con un hueco vertical (2+1 o 1+2) el marco del editor es vertical, y con una banda es horizontal.
- [ ] Un vídeo vertical de cámara se ve derecho tanto en el marco como en el recorte tenue.
- [ ] El encuadre guardado coincide con el del preview y con un fotograma del MP4.
- [ ] Con TalkBack, el deslizador se puede subir y bajar con las acciones de incrementar y decrementar.

## Propuesta UX · Fase 09 — Hoja de exportación

La vista previa en bucle con su propio botón Exportar no entra en esta fase.

- [ ] Exportar con el collage vacío avisa y no abre la hoja.
- [ ] Exportar con contenido abre la hoja «Guardar historia» desde abajo, con miniatura y resumen.
- [ ] El resumen dice los huecos usados, los segundos, el sonido («Sonido: 2 vídeos mezclados», «Sonido: 1 vídeo» o «Sin sonido»), «1080 × 1920 · MP4» y el álbum.
- [ ] La calidad tiene tres opciones: Ligera, Normal (marcada por defecto) y Máxima, cada una con su peso aproximado; con 10 s: ≈ 8, ≈ 19 y ≈ 35 MB.
- [ ] El peso estimado cambia al cambiar la duración (p. ej. con 30 s, Normal ≈ 56 MB).
- [ ] «Ahora no», tocar fuera de la hoja o el gesto atrás la cierran sin hacer nada.
- [ ] «Guardar en galería» lanza el render: la hoja pasa a mostrar el progreso y «Cancelar»; no se puede cerrar tocando fuera.
- [ ] Al terminar, la hoja se cierra y sale el aviso «Listo» con sus opciones. El vídeo está en el álbum Historys.
- [ ] «Cancelar» a mitad de render para el proceso, no sale ningún error y la hoja vuelve a mostrar las opciones con el collage intacto.
- [ ] Tras cancelar, no queda ningún `collage_*.mp4` en la caché y se puede volver a guardar con normalidad.
- [ ] Cancelar no cambia a otro codificador: no se lanza un segundo render.
- [ ] Cancelar justo al terminar el render no deja el vídeo guardado a medias.
- [ ] Un fallo del vídeo muestra el aviso de error y deja la hoja abierta para reintentar con otra calidad.
- [ ] Con permiso de galería denegado, el aviso sale y la hoja sigue abierta.

## Propuesta UX · Fase 10 — Primera vez y final

Pendiente: el botón «Compartir» del aviso final (necesita `expo-sharing`, que aún no está instalado).

Para repetir la guía, borra los datos de la app (Ajustes del teléfono → Apps → Historys → Almacenamiento).

- [ ] Con la app recién instalada y el lienzo vacío sale la burbuja «Empieza aquí» (1 de 3) sobre la barra, con la flecha hacia Añadir.
- [ ] Tocar la burbuja, o cargar una foto, la cierra y no vuelve a salir.
- [ ] Con contenido cargado y nada seleccionado sale «Toca un hueco» (2 de 3). Al tocar un hueco desaparece y no vuelve.
- [ ] Después sale «Cuando termines» (3 de 3). Al pulsar Exportar desaparece y no vuelve.
- [ ] Las burbujas no salen con un panel abierto, un hueco seleccionado, la hoja de exportación abierta ni mientras se arrastra.
- [ ] Cerrar y abrir la app de nuevo: las burbujas ya vistas no reaparecen. «Nuevo collage…» tampoco las repite.
- [ ] Las burbujas no tapan los botones que necesitas: se cierran con un toque.
- [ ] El aviso final tiene «Ver en galería» como botón principal, «Seguir editando» y, debajo, el enlace «Empezar otra historia».
- [ ] «Seguir editando» deja el collage intacto; «Empezar otra historia» pide confirmación antes de vaciar.
- [ ] La guía «?» sigue disponible para releerla.

## Fuera de esta lista

No se prueba porque no entra en este ciclo: recorte de entrada y salida por vídeo, plantillas guardadas, y compartir directo a Instagram, TikTok o WhatsApp.
