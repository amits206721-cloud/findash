import { isValidFinanceData } from './data-validation.js';

const DATABASE_NAME = 'findash-local-data';
const DATABASE_VERSION = 1;
const OBJECT_STORE = 'finance';
const DATA_KEY = 'current';
const LEGACY_KEY = 'findash.frontend.v1';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
        request.result.createObjectStore(OBJECT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local financial storage could not be opened.'));
    request.onblocked = () => reject(new Error('Local financial storage is blocked by another open window.'));
  });
}

function readData(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).get(DATA_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Saved financial data could not be read.'));
  });
}

function writeData(database, data) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE, 'readwrite');
    transaction.objectStore(OBJECT_STORE).put(data, DATA_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Your changes could not be saved to local storage.'));
    transaction.onabort = () => reject(new Error('Saving local financial data was interrupted.'));
  });
}

export async function loadFromStorage(fallback) {
  const database = await openDatabase();
  try {
    const saved = await readData(database);
    if (saved !== undefined) {
      if (!isValidFinanceData(saved)) throw new Error('Saved financial data has an invalid shape.');
      return saved;
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return fallback;
    let parsed;
    try {
      parsed = JSON.parse(legacy);
      if (!isValidFinanceData(parsed)) throw new Error('Saved financial data has an invalid shape.');
    } catch (error) {
      localStorage.setItem(`${LEGACY_KEY}.corrupt-backup`, legacy);
      console.error('Unable to migrate saved finance data. Sample data is being used.', error);
      return fallback;
    }
    await writeData(database, parsed);
    localStorage.removeItem(LEGACY_KEY);
    return parsed;
  } finally {
    database.close();
  }
}

export async function saveToStorage(data) {
  if (!isValidFinanceData(data)) throw new Error('The financial data is invalid and was not saved.');
  const database = await openDatabase();
  try {
    await writeData(database, data);
  } finally {
    database.close();
  }
}

export function removeCorruptBackup() {
  try {
    localStorage.removeItem(`${LEGACY_KEY}.corrupt-backup`);
  } catch (error) {
    console.error('Unable to remove the corrupted-data backup.', error);
    throw new Error('The previous corrupted-data backup could not be removed.');
  }
}
