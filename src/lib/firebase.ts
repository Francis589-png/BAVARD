// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "bavard-rk2yf",
  "appId": "1:568170080990:web:1a6f7288174ee7a72e704f",
  "storageBucket": "bavard-rk2yf.firebasestorage.app",
  "apiKey": "AIzaSyCnkv3AtU79kCRarXsBK0-T-9gJw27YOvw",
  "authDomain": "bavard-rk2yf.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "568170080990"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export { app };
