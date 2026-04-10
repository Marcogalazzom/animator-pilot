import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBVMlD2Jdm-Ql4CyDA_Tw-_XUjvEUYkhok',
  authDomain: 'planning-ehpad.firebaseapp.com',
  projectId: 'planning-ehpad',
};

const app = initializeApp(firebaseConfig);

const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({}),
});

const auth = getAuth(app);
const storage = getStorage(app);

export async function uploadInvoice(file: File, fiscalYear: number, expenseId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const storageRef = ref(storage, `invoices/${fiscalYear}/${expenseId}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export {
  firestore,
  auth,
  storage,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
};
