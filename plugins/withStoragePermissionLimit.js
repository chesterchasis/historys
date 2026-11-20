const { withAndroidManifest } = require('expo/config-plugins');

const WRITE_STORAGE = 'android.permission.WRITE_EXTERNAL_STORAGE';

/**
 * Guardar en la galería en Android 12 o anterior sigue necesitando permiso de escritura.
 * Desde Android 13 no hace falta, así que se limita a esas versiones y la ficha de Google Play
 * no lo muestra para el resto.
 */
module.exports = function withStoragePermissionLimit(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };

    const permissions = (manifest['uses-permission'] ?? []).filter((item) => item.$['android:name'] !== WRITE_STORAGE);
    permissions.push({
      $: {
        'android:name': WRITE_STORAGE,
        'android:maxSdkVersion': '32',
        'tools:node': 'replace',
      },
    });
    manifest['uses-permission'] = permissions;

    return modConfig;
  });
};
