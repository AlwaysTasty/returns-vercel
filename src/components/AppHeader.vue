<template>
  <header class="header">
    <div class="header-left">
      <h1>Returns Calculator v3.4</h1>
      
      <transition name="fade" mode="out-in">
        <div class="shift-indicator" :class="currentShift.class" :key="currentShift.text">
          <span class="shift-icon">{{ currentShift.icon }}</span>
          <span class="shift-text">{{ currentShift.text }}</span>
        </div>
      </transition>
    </div>
    <div class="header-right">
      <button class="btn btn-danger" @click="handleLogout">
        Logout
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { logout } = useAuth();

// --- Shift Logic ---
const currentTime = ref(new Date());
let timeInterval = null;

const currentShift = computed(() => {
  const hour = currentTime.value.getHours();
  // Shift 1: 10:00 AM (10) to 9:59 PM (21)
  if (hour >= 10 && hour < 22) {
    return { text: 'Shift 1', icon: '☀️', class: 'light-shift' };
  }
  // Shift 2: 10:00 PM (22) to 9:59 AM (9)
  else {
    return { text: 'Shift 2', icon: '🌙', class: 'dark-shift' };
  }
});

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 60 * 1000);
});

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval);
  }
});

const handleLogout = async () => {
  if (confirm('Are you sure you want to log out?')) {
    try {
      await logout(); // Call the logout function from useAuth
      // Redirect the user to the login page after a successful logout
      router.push({ name: 'Login' }); 
    } catch (error) {
      console.error("Error logging out:", error);
      // Optionally, show an error message to the user
      alert('Failed to log out. Please try again.');
    }
  }
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
  gap: 1.5rem;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.header-right {
  display: flex;
  align-items: center;
}

h1 { margin: 0; font-size: 1.8rem; white-space: nowrap; }

/* Shift Indicator Styles (unchanged) */
.shift-indicator {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0.8rem; border-radius: 20px;
  font-weight: 600; font-size: 0.9rem; user-select: none;
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
.shift-icon { font-size: 1rem; }
.shift-indicator.light-shift { background-color: #d0d0d0; color: #121212; border: 1px solid #a0a0a0; }
.shift-indicator.dark-shift { background-color: #3a3a44; color: #f0f0f0; border: 1px solid #5a5a64; }

/* Transition for Shift Indicator (unchanged) */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>