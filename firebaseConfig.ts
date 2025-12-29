
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
    apiKey: "AIzaSyBPvquIY3OgXt-KcfhHhiKKpNem-Rs_pck",
    authDomain: "happy-joby.firebaseapp.com",
    projectId: "happy-joby",
    storageBucket: "happy-joby.appspot.com",
    messagingSenderId: "934196054776",
    appId: "1:934196054776:web:a853e42dfba92e96ddc90d",
    measurementId: "G-VNEKB7839K"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Define the root path for the prompt's requested structure
export const APP_ARTIFACT_ID = "tracker_v1";
