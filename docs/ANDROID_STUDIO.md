# Abrir Historys en Android Studio

La carpeta `android/` **no** está en el repositorio (está en `.gitignore`). Hay que generarla con Expo **prebuild** antes de abrir el proyecto en Android Studio.

## Requisitos

- **Node.js** 18+ y npm.
- **Android Studio** (última estable) con:
  - Android SDK **35** (compile/target alineados con `app.json` / `expo-build-properties`).
  - **JDK 17** (File → Settings → Build → Gradle → Gradle JDK).
- Dispositivo o emulador con **API 24+** (FFmpeg Kit en esta variante exige minSdk 24).

## Pasos (una vez por máquina o tras borrar `android/`)

En la raíz del repo:

```bash
npm install
npm run prebuild:android
```

- Si ya tenías una carpeta `android/` corrupta o antigua:

```bash
npm run prebuild:android:clean
```

(`--clean` borra `android/` y la vuelve a generar.)

## Abrir en Android Studio

1. **File → Open** y elige la carpeta `android/` dentro del proyecto (no la raíz del monorepo si AS se confunde; la raíz correcta es `…/historys/android`).
2. Espera a que termine **Gradle Sync** (la primera vez suele crear `android/local.properties` con la ruta del SDK).
3. Selecciona un **device** o emulador.
4. **Run** (triángulo verde) o **Build → Build Bundle(s) / APK(s)** según lo que necesites.

### Si solo usas la terminal (`gradlew`) sin abrir Android Studio antes

Gradle necesita saber dónde está el SDK. Elige **una** de estas opciones:

**A) Archivo `android/local.properties` (recomendado en CLI)**

1. Mira la ruta del SDK en Android Studio (**Settings → Android SDK → Android SDK location**).
2. Crea el archivo `android/local.properties` con **una** línea (ajusta tu usuario y ruta):

```properties
sdk.dir=C:/Users/yberbeci/AppData/Local/Android/Sdk
```

En el repo hay una plantilla: [local.properties.example](local.properties.example).

**B) Variable de entorno `ANDROID_HOME` (o `ANDROID_SDK_ROOT`)**

En PowerShell (sesión actual):

```powershell
$env:ANDROID_HOME = "C:\Users\yberbeci\AppData\Local\Android\Sdk"
.\gradlew.bat assembleRelease
```

Para dejarlo fijo en Windows: *Configuración del sistema → Variables de entorno* y añade `ANDROID_HOME` apuntando a esa carpeta.

### Error: «Autolinking is not set up in settings.gradle»

Suele ir ligado a un `android/` viejo o generado fuera de Expo, o a que el configure falló antes por el SDK.

1. Asegúrate de tener `local.properties` o `ANDROID_HOME` como arriba.
2. Regenera el nativo desde la **raíz** del repo:

```bash
npm run prebuild:android:clean
```

3. Vuelve a ejecutar `.\gradlew.bat assembleRelease` **desde** `android/`, o abre `android/` en Android Studio y deja que sincronice.

## Comando alternativo (sin abrir AS)

```bash
npm run android
```

Compila, instala y arranca la app usando la carpeta `android/` generada.

## Notas sobre esta app

- **FFmpeg** (`@wokcito/ffmpeg-kit-react-native`): la exportación a MP4 solo funciona en **build nativo**, no en Expo Go.
- **Nueva arquitectura (Fabric)**: desactivada en `app.json` (`newArchEnabled: false`) para compatibilidad estable con FFmpeg y otros módulos nativos.
- **Application ID**: `com.chesterchasis.historys` (definido en `app.json`).

Si Gradle falla por versión de SDK, instala los componentes que pida el propio Android Studio en el asistente de errores.
