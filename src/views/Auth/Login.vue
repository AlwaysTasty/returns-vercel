<template>
  <div class="login-container">
      <div class="card login-modal" v-motion-popup>
        <!-- Tab Navigation -->
        <div class="auth-tabs">
          <button @click="activeTab = 'login'" :class="{ active: activeTab === 'login' }">
            Login
          </button>
          <button @click="activeTab = 'register'" :class="{ active: activeTab === 'register' }">
            Register
          </button>
        </div>

        <!-- Login Form -->
          <div v-if="activeTab === 'login'">
            <h2>Secure Login</h2>
            <p>Charlie Returns Dashboard</p>
            <form @submit.prevent="handleLogin">
              <div class="input-group">
                <label for="email">Email</label>
                <input id="email" type="email" v-model="loginForm.email" placeholder="you@example.com" required />
              </div>
              <div class="input-group">
                <label for="password">Password</label>
                <input id="password" type="password" v-model="loginForm.password" placeholder="••••••••" required />
              </div>
              <button type="submit" class="btn btn-primary" :disabled="isLoading">
                {{ isLoading ? 'Logging In...' : 'Log In' }}
              </button>
              <p v-if="loginForm.error" class="error-message">{{ loginForm.error }}</p>
            </form>
          </div>

          <!-- Register Form -->
          <div v-else-if="activeTab === 'register'">
            <h2>Request Access</h2>
            <p>Your account will be created upon approval</p>
            <form @submit.prevent="handleRegister">
              <div class="input-group">
                <label for="reg-email">Email</label>
                <input id="reg-email" type="email" v-model="registerForm.email" placeholder="you@example.com" required />
              </div>
              <div class="input-group">
                <label for="reg-password">Password</label>
                <input id="reg-password" type="password" v-model="registerForm.password" placeholder="Choose a strong password" required />
              </div>
              <button type="submit" class="btn btn-primary" :disabled="isLoading">
                {{ isLoading ? 'Requesting...' : 'Request Account' }}
              </button>
              <p v-if="registerForm.error" class="error-message">{{ registerForm.error }}</p>
              <p v-if="registerForm.success" class="success-message">{{ registerForm.success }}</p>
            </form>
          </div>

      </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { db } from '../../services/firebase'; // <-- Import db
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore'; // <-- Import Firestore functions
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const activeTab = ref('login');
const isLoading = ref(false);
const router = useRouter();
const { login } = useAuth();

// Forms
const loginForm = reactive({ email: '', password: '', error: null });
const registerForm = reactive({ email: '', password: '', error: null, success: null });

// In /src/views/Auth/Login.vue inside handleLogin() success block
const handleLogin = async () => {
  // ... try block
  try {
    await login(loginForm.email, loginForm.password);
    
    // NEW: Check for a redirect query
    const redirectPath = router.currentRoute.value.query.redirect;
    if (redirectPath) {
      router.push(redirectPath);
    } else {
      router.push({ name: 'Returns' });
    }

  } catch (err) {
    // --- CATCH the error if the login failed ---
    console.error("Login failed:", err.code, err.message);
    loginForm.error = 'Invalid email or password. Please check your credentials and try again.'
  } finally {
    isLoading.value = false;
  }
};

const handleRegister = async () => {
  isLoading.value = true;
  registerForm.error = null;
  registerForm.success = null;
  

  try {
    await addDoc(collection(db, "pending_users"), {
      email: registerForm.email,

      requestedAt: serverTimestamp()
    });
    registerForm.success = "Your request has been submitted! You will be notified once your account is approved by an administrator.";
    registerForm.email = '';
    registerForm.password = '';
  } catch (err) {
    console.error("Registration request error: ", err);
    registerForm.error = 'Something went wrong. Please try again later.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
/* Main Container */
.login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 2rem; }
.login-modal { max-width: 400px; width: 100%; text-align: center; }
.login-modal p { margin: 0.5rem 0 1.5rem; color: var(--text-secondary); }

/* Tabs */
.auth-tabs { display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem; }
.auth-tabs button {
  flex-grow: 1; padding: 1rem;
  background: none; border: none; color: var(--text-secondary);
  font-size: 1rem; font-weight: 600; cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}
.auth-tabs button:hover { color: var(--text-primary); }
.auth-tabs button.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}

/* Form Groups and Messages */
.input-group { margin-bottom: 1.5rem; text-align: left; }
.input-group label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-secondary); }
.error-message { margin-top: 1rem; color: var(--error-color); font-size: 0.9rem; }
.success-message { margin-top: 1rem; color: #4ade80; background-color: rgba(74, 222, 128, 0.1); padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; text-align: left; }

/* Transitions */
.modal-fade-enter-active { transition: all 0.5s ease-out; }
.modal-fade-enter-from { opacity: 0; transform: translateY(-50px); }
.form-fade-enter-active, .form-fade-leave-active { transition: opacity 0.2s ease; }
.form-fade-enter-from, .form-fade-leave-to { opacity: 0; }
</style>