import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { useAuth } from './composables/useAuth';
import './assets/main.css';
import { MotionPlugin } from '@vueuse/motion';

// Get the waiter function from our composable
const { waitForAuthInit } = useAuth();

// NEW: Use an async function to control the app's startup
const startApp = async () => {
  // Wait for Firebase to confirm the initial authentication state
  await waitForAuthInit();

  // ONLY after the wait is over, create and mount the app
  const app = createApp(App);
  app.use(MotionPlugin, {
    directives: {
      // Create a custom directive called 'fade-visible-once'
      'fade-visible-once': {
        initial: {
          opacity: 0,
          y: 40, // Start 40px down
        },
        visibleOnce: {
          opacity: 1,
          y: 0,
          transition: {
            type: 'spring', // Use a spring physics animation
            stiffness: 120,
            damping: 20,
            mass: 0.5,
          },
        },
      },
      'popup': {
        initial: {
          scale: 0.95,
          opacity: 0,
          y: 20,
        },
        enter: {
          scale: 1,
          opacity: 1,
          y: 0,
          transition: {
            type: 'spring',
            stiffness: 150,
            damping: 20,
          }
        },
        leave: {
          opacity: 0,
          scale: 0.95,
          transition: { duration: 0.1 }
        }
      }
    },
  });
  app.use(router);
  app.mount('#app');
};

// Start the application
startApp();