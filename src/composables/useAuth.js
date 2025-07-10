// src/composables/useAuth.js
import { ref } from 'vue';
import { auth } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";

// This ref holds the user state and is updated in real-time by the listener below.
const user = ref(null);

// This persistent listener ensures the `user` ref is always up-to-date
// after the app has initialized.
onAuthStateChanged(auth, (firebaseUser) => {
  user.value = firebaseUser;
});

// --- THE NEW, ROBUST FUNCTIONS ---

// Function for initial app load.
const waitForAuthInit = () => {
  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      resolve(firebaseUser);
      unsubscribe();
    });
  });
};

// NEW: This function gives us the user state on-demand for every navigation.
// It resolves immediately with the currently known user from the SDK.
const getCurrentUser = () => {
  return new Promise(resolve => {
    // onAuthStateChanged resolves immediately if the state is already known,
    // making it a perfect tool for an on-demand check.
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      resolve(user);
    });
  });
};

// The main composable function.
export function useAuth() {
  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    return signOut(auth);
  };

  return {
    user,
    login,
    logout,
    waitForAuthInit,
    getCurrentUser, // <-- Export the new on-demand function
  };
}