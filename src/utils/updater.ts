import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

export type UpdateInfo = {
  available: true;
  version: string;
  notes: string;
  date: string | null;
  update: Update;
} | {
  available: false;
};

/**
 * Check if a new version is available. Returns null on error (e.g.
 * misconfigured pubkey, no network, CI not yet deployed). The app
 * must never crash because of a failed update check.
 */
export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
  try {
    const update = await check();
    if (!update) return { available: false };
    return {
      available: true,
      version: update.version,
      notes: update.body ?? '',
      date: update.date ?? null,
      update,
    };
  } catch (err) {
    console.warn('[updater] check failed:', err);
    return null;
  }
}

/**
 * Download and install the update, then restart the app.
 * onProgress is called with { downloaded, contentLength } where
 * contentLength may be 0 if unknown.
 */
export async function downloadAndInstall(
  update: Update,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((ev) => {
    switch (ev.event) {
      case 'Started':
        total = ev.data.contentLength ?? 0;
        onProgress?.(0, total);
        break;
      case 'Progress':
        downloaded += ev.data.chunkLength;
        onProgress?.(downloaded, total);
        break;
      case 'Finished':
        onProgress?.(total || downloaded, total || downloaded);
        break;
    }
  });

  await relaunch();
}

export async function currentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return '?';
  }
}
