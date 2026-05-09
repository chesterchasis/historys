# Historys

Version actual: v1.0.5

App movil hecha con Expo para crear collages en formato historia (9:16), combinando fotos y videos en distintos layouts.

## Caracteristicas

- Formato historia de Instagram: 1080 x 1920 (9:16).
- Slots multimedia (foto o video) en varios estilos de collage.
- Selector de estilos:
  - 3 slots horizontales.
  - 2 verticales + 1 horizontal.
  - 1 horizontal + 2 verticales.
- Estilo visual de bordes:
  - Con bordes.
  - Sin bordes.
- Ajuste de foto por slot:
  - Zoom con pinza o botones +/-.
  - Desplazamiento libre (pan) para encuadrar.
- Preview en tiempo real dentro del collage.
- Duracion configurable del collage (5s, 10s, 15s, 30s).
- Exportacion:
  - Video MP4 en build nativo Android.
  - Fallback: imagen JPG si no hay soporte nativo de FFmpeg.
  - Audio original de videos (con opcion de silenciar por video).
- Guardado en galeria en album "Historys".

## Stack tecnico

- Expo SDK 54
- React Native
- TypeScript
- expo-image-picker
- expo-video-thumbnails
- expo-av
- expo-media-library
- react-native-view-shot
- @wokcito/ffmpeg-kit-react-native
- expo-file-system

## Requisitos

- Node.js 18+ recomendado.
- npm.
- Android Studio y/o dispositivo Android.

## Instalacion

1. Instalar dependencias:

```bash
npm install
```

2. Iniciar proyecto:

```bash
npm start
```

3. Abrir en Android:

```bash
npm run android
```

## Uso rapido

1. Elige el estilo del collage.
2. Elige si quieres bordes o sin bordes.
3. Carga fotos y/o videos en los slots.
4. En fotos, pulsa "Ajustar" para encuadrar (zoom y desplazamiento).
5. Define la duracion.
6. Pulsa "Preview" para previsualizar.
7. Pulsa "Exportar" para guardar en galeria.

## Exportacion de video: nota importante

La exportacion a video usa FFmpegKit (modulo nativo). Por eso:

- En Expo Go puede no estar disponible la exportacion MP4.
- En ese caso, la app aplica fallback automatico y exporta imagen.
- En builds nativos la exportacion MP4 esta preparada para conservar audio de videos no silenciados.

Para exportar video de forma consistente, usar Development Build:

```bash
npx expo run:android
```

O usar EAS Dev Client.

## Permisos

La app solicita permisos para:

- Leer libreria multimedia (cargar fotos/videos).
- Escribir en galeria (guardar exportaciones).

## Estructura principal

- App principal: `App.tsx`

## Estado actual

- Flujo funcional para crear collages 9:16 con fotos y videos.
- Preview funcional con reproduccion en tiempo real.
- Exportacion funcional a MP4 en build nativo Android, con fallback a imagen cuando el entorno no soporta FFmpeg.
- Exportacion con audio original y control de silencio por video (por slot).
- UI en espanol, compacta y optimizada para mobile.
- Ajuste visual del encabezado para respetar mejor el borde superior del telefono.

## Release v1.0.5

- Correccion de exportacion de video para evitar dependencias de codec no soportadas por el paquete FFmpeg instalado.
- Mejora del manejo de errores de exportacion para mostrar la causa real cuando falle FFmpeg.
- Mapeo de audio opcional para videos sin pista de audio.
- Ajuste de espacio superior en el encabezado principal.

## Proximos pasos sugeridos

- Selector visual de calidad de exportacion (Baja/Media/Alta) con presets de bitrate.
- Barra de timeline para definir inicio/fin por video y sincronizar mejor el collage.
- Guardar y cargar plantillas (layout + bordes + duracion + transformaciones).
- Exportacion directa para redes (Instagram Stories, TikTok, WhatsApp Status) con atajos.
- Pantalla de onboarding breve con tips de uso para primera ejecucion.

## Diseño del icono (Prompt)

```
Diseña un icono minimalista y moderno para la app "Historys", 
una aplicación Android para crear collages en formato vertical (9:16) 
combinando fotos y videos.

Características del icono:
- Formato cuadrado (512x512px) con esquinas redondeadas
- Paleta de colores cálida y moderna: tonos de beige (#e9e5df), gris oscuro (#41484b) y azul suave (#7a9ccc)
- Centro: 4 marcos superpuestos en disposición de collage (2x2 o 3 capas) 
  representando fotos y videos entrecruzados
- Un símbolo de "play" sutil en una esquina para indicar video
- Movimiento dinámico: líneas o elementos diagonales que sugieran composición en movimiento
- Fondo: gradiente sutil de beige a blanco
- Estilo: geométrico, limpio, sin detalles innecesarios
- Compatible con Light y Dark mode de Android
```

## Licencia

Pendiente de definir.
