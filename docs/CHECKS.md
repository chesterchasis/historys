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
- [ ] Diseño abre un panel con las tres formas y un interruptor Bordes; el lienzo se escala para dejarle sitio y cambia en directo. «Listo» cierra el panel.
- [ ] Duración abre el panel «Duración»; el valor elegido aparece en la barra al cerrar.
- [ ] Al tocar un hueco, la barra pasa a Cargar/Cambiar, Ajustar, Audio/Silencio, Quitar y Listo, siempre en el mismo sitio. Tocar fuera del lienzo o «Listo» la devuelve a la general.
- [ ] La barra no cambia mientras se exporta: el progreso se ve en la hoja de exportación (fase 09).

## Propuesta UX · Fase 02 — Cabecera y menú

- [ ] La cabecera solo tiene el título y un botón de ajustes (fase 1 de la propuesta premium). No hay ninguna «R».
- [ ] El botón de ajustes abre la ventana «Ajustes» (ver la sección de ajustes más abajo).
- [ ] Tocar fuera de la ventana, «Listo» o el gesto atrás la cierran sin hacer nada.
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
- [ ] Al terminar, la hoja se cierra y sale el aviso «Guardada en tu galería» con sus opciones. El vídeo está en el álbum Historys.
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
- [ ] El aviso final tiene «Seguir editando» como botón principal y, debajo, el enlace «Empezar otra historia». No hay «Ver en galería».
- [ ] «Seguir editando» deja el collage intacto; «Empezar otra historia» pide confirmación antes de vaciar.
- [ ] La guía rápida sigue disponible desde Ajustes para releerla.

## Propuesta premium · Fase 1 — Identidad y detalle

Para probar «Auto» hace falta reconstruir la app tras el cambio de `userInterfaceStyle` en `app.json` (`npm run prebuild:android` y volver a instalar). Claro y Oscuro funcionan sin reconstruir.

- [ ] El recuadro del lienzo tiene las esquinas redondeadas. Los huecos, el anillo de selección y el arrastre quedan recortados por esas esquinas.
- [ ] El archivo exportado sigue siendo rectangular y completo, con las cuatro esquinas.
- [ ] La miniatura de la hoja de exportación y la del aviso final también son redondeadas.
- [ ] Arriba solo hay un botón de ajustes con un engranaje. Ya no hay «?» ni «···».
- [ ] La ventana de ajustes tiene un selector Claro, Oscuro y Auto con el modo actual marcado. Al cambiarlo, toda la app cambia al instante con la ventana abierta.
- [ ] En Oscuro se leen bien la barra, los paneles, la hoja de exportación, los avisos, la guía y las burbujas de ayuda. Ningún texto queda claro sobre fondo claro.
- [ ] La barra de estado cambia de iconos claros a oscuros según el modo.
- [ ] Cerrar la app y abrirla de nuevo conserva el modo elegido. Auto sigue el modo del teléfono.
- [ ] Al abrir Diseño o Duración, el lienzo se escala y sube con suavidad, sin saltos, y el panel sube desde abajo mientras la barra se desvanece.
- [ ] Al cerrar el panel (Listo, tocar fuera o tocar un hueco) el lienzo vuelve a su tamaño con la misma suavidad.
- [ ] Con el panel abierto se puede cambiar de diseño y el interruptor de Bordes responde en toda su altura.
- [ ] Con el panel abierto, tocar un hueco lo cierra y lo selecciona; mantener y arrastrar cierra el panel y permite intercambiar huecos.
- [ ] El aviso final dice «Guardada en tu galería» y ya no ofrece «Ver en galería».

## Propuesta premium · Fase 2 — Fondo, formato y recorte

- [ ] El panel Diseño tiene, bajo las tres formas, un selector Formato (9:16, 4:5, 1:1) y otro Fondo (Negro, Blanco), y debajo el interruptor Bordes.
- [ ] Cambiar de formato cambia la forma del lienzo en pantalla y las miniaturas de las tres formas. Los huecos se reparten bien en los tres formatos, con y sin bordes.
- [ ] Con 4:5 y bordes, las tres bandas miden lo mismo (1032 × 418 px en el archivo). Con 1:1 el lienzo es cuadrado.
- [ ] Fondo Blanco: el lienzo, los huecos vacíos, los márgenes y las franjas alrededor de una foto estrecha salen blancos. El «+ Añadir» y el anillo de selección se siguen viendo.
- [ ] El lienzo blanco tiene un contorno fino para no perderse sobre el fondo de la app.
- [ ] La vista previa, la miniatura de la hoja de exportación y la del aviso final respetan formato y fondo.
- [ ] El vídeo exportado mide 1080 × 1920, 1080 × 1350 o 1080 × 1080 según el formato, con el fondo elegido y exactamente lo que se ve en pantalla.
- [ ] La hoja de exportación y la guía dicen el tamaño correcto.
- [ ] «Ajustar» en un vídeo más largo que la historia (p. ej. 25 s con 10 s elegidos) muestra la tira «Tramo del vídeo» con una ventana del largo de la historia y las horas de inicio y fin.
- [ ] Deslizar la ventana, o tocar fuera de ella, la mueve sin salirse de los extremos; al soltar, el vídeo del editor empieza en ese punto y se repite solo dentro del tramo.
- [ ] En un vídeo igual o más corto que la historia no aparece la tira.
- [ ] Tras «Hecho», la miniatura del hueco enseña un fotograma del nuevo tramo.
- [ ] La vista previa del collage y el archivo exportado empiezan en el punto elegido. Una prueba: elige el segundo 12 de un clip de 25 s y comprueba que el vídeo guardado arranca igual que el editor.
- [ ] Si luego se alarga la duración (p. ej. de 10 a 30 s), el tramo se corre hacia atrás para seguir cabiendo; nunca queda un vídeo corto ni un salto.
- [ ] Intercambiar dos huecos arrastrando se lleva consigo el tramo elegido.

## Propuesta premium · Fase 3 — Color fiel y fotos solas

Esta versión de FFmpeg no incluye `zscale`, así que la conversión HDR → SDR usa tablas de color y un cambio de primarios (`lutrgb` y `colorchannelmixer`). Se probó en un ordenador con vídeo sintético HLG, pero hace falta compararla con clips reales del S25.

- [ ] Un vídeo del S25 grabado en HDR (HLG) muestra la insignia «HDR» sobre el hueco.
- [ ] Un vídeo normal (SDR) no muestra «HDR» y se exporta como antes.
- [ ] Exportar un clip HDR: el resultado ya no sale blanquecino. Los negros son negros, los colores tienen cuerpo y el contraste se parece al del vídeo original reproducido en la galería.
- [ ] El aviso final de un collage con HDR dice «El HDR se convirtió a SDR para conservar el color.»
- [ ] Comparar el mismo clip en la galería y en el archivo exportado: no hay un tono verdoso ni rosado general, y la piel se ve natural.
- [ ] Las luces altas (cielo, focos) no quedan quemadas de golpe: conservan degradado.
- [ ] Un collage con un clip HDR y un clip SDR: los dos se ven con un nivel de luz parecido.
- [ ] Las fotos del vídeo exportado conservan su color (un azul de foto no cambia de tono respecto a la pantalla).
- [ ] Si la conversión HDR fallara en algún dispositivo, el export no se rompe: se repite sin convertir.
- [ ] En el MP4 final, las propiedades del vídeo indican BT.709 (se puede ver con la información del archivo en la galería o con un reproductor como VLC).
- [ ] Un collage con solo fotos muestra en la hoja de exportación «Guardar foto» y «Foto · 2160 × 3840 · JPG», sin «Calidad» ni segundos ni «MP4».
- [ ] Exportar solo fotos guarda un JPG en el álbum Historys de 2160 × 3840 (1080 × 1350 → 2160 × 2700; 1:1 → 2160 × 2160), con la misma composición que se ve en pantalla.
- [ ] El aviso final de las fotos dice «Foto guardada en tu galería» con el tamaño.
- [ ] Con solo fotos, «Duración» en la barra aparece atenuada con «Solo vídeo» y no abre el panel. Al añadir un vídeo vuelve a estar activa.
- [ ] Mezclar fotos y vídeos sigue exportando un MP4 como hasta ahora.
- [ ] Cancelar la exportación de una foto no deja ningún `collage_*.jpg` en la caché.

## Ventana de ajustes

- [ ] El botón de arriba es un engranaje. Al tocarlo se abre una ventana centrada, con las mismas esquinas redondeadas que el resto de ventanas (guía, avisos), y un fondo atenuado detrás.
- [ ] La ventana tiene las secciones Apariencia, Diseño, Vídeos, Ayuda y Collage, y abajo «Historys By chesterchasis» con la versión debajo. Si no cabe, se desplaza.
- [ ] Apariencia: Claro, Oscuro y Auto; Auto sigue al teléfono.
- [ ] «Recordar mi último diseño» (activado de serie): cambiar formato, fondo, forma, bordes, duración o calidad, cerrar la app del todo y abrirla de nuevo vuelve con ese diseño. Los huecos empiezan vacíos.
- [ ] Con «Recordar mi último diseño» apagado, la app abre siempre con 3 bandas, 9:16, fondo negro, con bordes, 10 s y calidad Normal.
- [ ] «Silenciar vídeos al cargarlos»: con el interruptor activado, un vídeo nuevo entra con el altavoz tachado; se puede activar en el hueco. Con él apagado, entran con sonido como antes.
- [ ] «Guía rápida» cierra los ajustes y abre la guía.
- [ ] «Repetir la guía de inicio» cierra los ajustes, avisa «Las burbujas de ayuda volverán a salir» y las burbujas vuelven a aparecer en orden.
- [ ] «Nuevo collage…» (en rojo) cierra los ajustes y pide confirmación antes de vaciar.
- [ ] En modo oscuro la ventana se lee bien: texto, grupos, interruptores y el selector.
- [ ] Todos los ajustes se conservan al cerrar y abrir la app.

## Fuera de esta lista

No se prueba porque no entra en este ciclo: recorte de entrada y salida por vídeo, plantillas guardadas, y compartir directo a Instagram, TikTok o WhatsApp.
