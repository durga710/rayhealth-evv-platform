import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

signInWithEmailAndPassword(auth, 'durga@rayhealthevv.com', 'blackops22')
  .then((userCredential) => {
    console.log('Firebase Login Success!', userCredential.user.uid);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Firebase Login Failed:', error.code, error.message);
    process.exit(1);
  });