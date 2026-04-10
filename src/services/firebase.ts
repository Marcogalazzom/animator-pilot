import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth';

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

export {
  firestore,
  auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
};
