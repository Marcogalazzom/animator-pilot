import Database from '@tauri-apps/plugin-sql';

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:pilot-animateur.db').catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}
