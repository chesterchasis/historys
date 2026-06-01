# Historys

Version actual: v1.0.6

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
  - Video MP4 en Full HD vertical (1080 x 1920), H.264 por hardware cuando el dispositivo lo permite (MediaCodec / VideoToolbox), bitrate alto y `faststart` para mejor calidad y reproduccion fluida.
  - Reintento automatico con MPEG-4 de alta calidad si el encoder H.264 por hardware falla (p. ej. algun emulador).
  - Entradas: FFmpeg intenta decodificar los formatos que incluya el binario; se amplia la sonda de lectura (`-analyzeduration` / `-probesize`) para MP4/MOV raros de galería.
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
- Android Studio y/o dispositivo Android (para build nativo con FFmpeg, ver [docs/ANDROID_STUDIO.md](docs/ANDROID_STUDIO.md)).

## Instalacion

1. Instalar dependencias:

```bash
npm install
```

2. Iniciar proyecto:

```bash
npm start
```

3. Abrir en Android (desarrollo rápido, genera `android/` si falta):

```bash
npm run android
```

4. Solo generar el proyecto nativo **Android** para abrirlo en Android Studio (sin compilar):

```bash
npm run prebuild:android
```

Luego abre la carpeta `android/` en Android Studio. Guía detallada: [docs/ANDROID_STUDIO.md](docs/ANDROID_STUDIO.md).

## Android SDK y `local.properties`

Gradle (y por tanto `gradlew assembleRelease`) necesita saber **dónde está instalado el Android SDK**. Eso se indica de dos formas habituales; con **una** basta.

### Por qué falla a veces

Si ejecutas `./gradlew` o `.\gradlew.bat` **solo desde la terminal** sin haber abierto antes el proyecto en Android Studio, puede **no existir** el archivo `android/local.properties`. Entonces aparece un error del tipo:

`SDK location not found. Define ANDROID_HOME or sdk.dir in local.properties`

Android Studio, al hacer **Gradle Sync**, suele **crear solo** ese archivo. Por eso mucha gente no lo ve hasta que compila solo por consola.

### Opción A: archivo `android/local.properties` (recomendado)

1. Genera la carpeta nativa si hace falta: `npm run prebuild:android`.
2. Averigua la ruta real del SDK en tu PC:
   - Abre **Android Studio** → **File** (o **Android Studio** en macOS) → **Settings** → **Languages & Frameworks** → **Android SDK**.
   - Copia el valor de **Android SDK location** (ejemplo en Windows: `C:\Users\tu_usuario\AppData\Local\Android\Sdk`).
3. Crea el archivo **`android/local.properties`** en la raíz de la carpeta `android/` (al mismo nivel que `build.gradle`, `settings.gradle`, etc.), con **exactamente una línea activa**:

```properties
sdk.dir=C:/Users/tu_usuario/AppData/Local/Android/Sdk
```

**Detalles importantes:**

- Sustituye `tu_usuario` (y la ruta completa) por la que te muestre Android Studio.
- En Windows puedes usar **barras normales** `/` como en el ejemplo; Gradle las acepta y evitas escapar `\`.
- En macOS la ruta suele ser del estilo `/Users/tu_usuario/Library/Android/sdk`.
- No pongas comillas alrededor de la ruta.
- Si en el futuro ejecutas `npm run prebuild:android:clean`, se **borra** la carpeta `android/` entera: tendrás que **volver a crear** `local.properties` (o abrir el proyecto en Android Studio para que lo regenere).

En el repo hay una plantilla vacía de referencia: [docs/local.properties.example](docs/local.properties.example).

### Opción B: variable de entorno `ANDROID_HOME`

Apunta a la **misma** carpeta del SDK (sin `local.properties` o además de ella, según tu entorno).

**PowerShell (solo la ventana actual):**

```powershell
$env:ANDROID_HOME = "C:\Users\tu_usuario\AppData\Local\Android\Sdk"
cd android
.\gradlew.bat assembleRelease
```

**Windows (fijo para todas las apps):** *Configuración → Sistema → Información → Configuración avanzada del sistema → Variables de entorno* → variable de usuario o del sistema `ANDROID_HOME` = ruta del SDK. Cierra y abre la terminal después.

En algunos equipos también se usa `ANDROID_SDK_ROOT`; para Gradle suele bastar con `ANDROID_HOME`.

### Si aparece «Autolinking is not set up in settings.gradle»

A menudo va ligado a que **antes** falló el SDK o a un `android/` desactualizado. Primero arregla `local.properties` o `ANDROID_HOME`. Si sigue el error, desde la **raíz** del repo:

```bash
npm run prebuild:android:clean
```

Vuelve a crear `local.properties` y prueba de nuevo.

## Generar APK

Antes necesitas la carpeta nativa: `npm run prebuild:android` (si aún no existe `android/`). Si compilas con **Gradle por terminal**, revisa la sección **Android SDK y `local.properties`** más arriba.

### Desde Android Studio (menú)

1. Abre el proyecto en la carpeta **`android/`**.
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Al terminar, usa el enlace **locate** para abrir la carpeta del APK.

El APK de release sin firma de Play suele quedar en:

`android/app/build/outputs/apk/release/app-release.apk`

Para **subir a Google Play** conviene el **AAB**: **Build → Generate Signed Bundle / APK…** y elige **Android App Bundle** (requiere configurar el keystore en el asistente).

### Desde terminal (Gradle)

Desde la carpeta **`android/`** del proyecto:

**Windows (PowerShell o CMD):**

```bash
.\gradlew.bat assembleRelease
```

**macOS / Linux:**

```bash
./gradlew assembleRelease
```

Salida típica del APK: `android/app/build/outputs/apk/release/app-release.apk`.

Para una build de prueba rápida (debug):

```bash
.\gradlew.bat assembleDebug
```

(En macOS/Linux: `./gradlew assembleDebug`.)

Más contexto y capturas de menú: [docs/ANDROID_STUDIO.md](docs/ANDROID_STUDIO.md).

## Uso rapido

1. Elige el estilo del collage.
2. Elige si quieres bordes o sin bordes.
3. Carga fotos y/o videos en los slots.
4. En fotos, pulsa "Ajustar" para encuadrar (zoom y desplazamiento).
5. Define la duracion.
6. Pulsa "Preview" para previsualizar.
7. Pulsa "Exportar" para guardar en galeria.

## Exportacion de video: nota importante

La exportacion a MP4 usa **FFmpegKit** (`filter_complex` con la misma rejilla de slots que el preview: fotos, videos, zoom y desplazamiento).

- En Expo Go no hay exportacion MP4 (FFmpeg no va en el cliente de tienda).
- En ese caso, la app aplica fallback automatico y exporta imagen.
- En builds nativos se conserva audio de videos no silenciados.

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
- Exportacion funcional a MP4 en build nativo Android (FFmpeg), con fallback a imagen cuando el entorno no soporta el modulo nativo.
- Exportacion con audio original y control de silencio por video (por slot).
- UI en espanol, compacta y optimizada para mobile.
- Ajuste visual del encabezado para respetar mejor el borde superior del telefono.

## Release v1.0.5

- Correccion de exportacion de video para evitar dependencias de codec no soportadas por el paquete FFmpeg instalado.
- Mejora del manejo de errores de exportacion para mostrar la causa real cuando falle FFmpeg.
- Mapeo de audio opcional para videos sin pista de audio.
- Ajuste de espacio superior en el encabezado principal.

## Release v1.0.6

- **CRITICAL FIX**: Reemplazo de generacion de fondo negro mediante `lavfi` (libavfilter) por imagen PNG embedded.
  - El FFmpeg en el APK no tiene libavfilter compilado, lo que causaba error "Unknown input format: 'lavfi'".
  - Solucion: La app ahora crea una imagen negra temporal en base64 y la usa como input en lugar de generar color dinamico.
- Limpieza automatica de archivos temporales (imagen negra) tras exportacion exitosa o error.
- Mejora de estabilidad de exportacion en diferentes dispositivos Android.

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
