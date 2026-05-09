# Collage Motion (Expo)

App movil hecha con Expo para crear collages en formato historia (9:16), combinando fotos y videos en distintos layouts.

## Caracteristicas

- Formato historia de Instagram: 1080 x 1920 (9:16).
- Slots multimedia (foto o video) en varios estilos de collage.
- Selector de estilos:
  - 3 slots horizontales.
  - 2 verticales + 1 horizontal.
  - 1 horizontal + 2 verticales.
- Estilo visual de bordes:
  - Con bordes negros.
  - Sin bordes.
- Ajuste de foto por slot:
  - Zoom con pinza o botones +/-.
  - Desplazamiento libre (pan) para encuadrar.
- Preview en tiempo real dentro del collage.
- Duracion configurable del collage (5s, 10s, 15s, 30s).
- Exportacion:
  - Prioridad: video MP4 (si entorno nativo soporta FFmpegKit).
  - Fallback: imagen JPG si no hay soporte nativo de FFmpeg.
- Guardado en galeria en album "Collage Motion".

## Stack tecnico

- Expo SDK 54
- React Native
- TypeScript
- expo-image-picker
- expo-video-thumbnails
- expo-av
- expo-media-library
- react-native-view-shot
- ffmpeg-kit-react-native
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
2. Elige si quieres bordes negros o sin bordes.
3. Carga fotos y/o videos en los slots.
4. En fotos, pulsa "Ajustar" para encuadrar (zoom y desplazamiento).
5. Define la duracion.
6. Pulsa "Preview" para previsualizar.
7. Pulsa "Exportar" para guardar en galeria.

## Exportacion de video: nota importante

La exportacion a video usa FFmpegKit (modulo nativo). Por eso:

- En Expo Go puede no estar disponible la exportacion MP4.
- En ese caso, la app aplica fallback automatico y exporta imagen.

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

- Boceto funcional avanzado.
- Preview funcional con fotos y videos.
- Exportacion funcional (video con fallback a imagen).
- UI en espanol y orientada a flujo rapido.

## Proximos pasos sugeridos

- Barra de progreso real durante render de video.
- Exportar audio original de videos (actualmente exporta sin audio).
- Ajustes finos de calidad/bitrate.
- Compartir directo a Instagram Stories.

## Licencia

Pendiente de definir.
