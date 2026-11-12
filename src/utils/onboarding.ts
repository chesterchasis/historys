import * as FileSystem from 'expo-file-system';

export type HintStep = 'add' | 'adjust' | 'export';
export type OnboardingSeen = Record<HintStep, boolean>;

const FILE_NAME = 'historys-onboarding.json';

const fileHandle = () => new FileSystem.File(FileSystem.Paths.document, FILE_NAME);

const EMPTY: OnboardingSeen = { add: false, adjust: false, export: false };

export async function loadOnboarding(): Promise<OnboardingSeen> {
  try {
    const file = fileHandle();
    if (!file.exists) return { ...EMPTY };
    const parsed = JSON.parse(await file.text());
    return {
      add: Boolean(parsed?.add),
      adjust: Boolean(parsed?.adjust),
      export: Boolean(parsed?.export),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveOnboarding(seen: OnboardingSeen) {
  try {
    const file = fileHandle();
    if (!file.exists) file.create({ overwrite: true });
    file.write(JSON.stringify(seen));
  } catch {
    // Si no se puede guardar, la guía volverá a salir la próxima vez. No es grave.
  }
}
