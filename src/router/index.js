import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth';

// Import Views
import Login from '../views/Auth/Login.vue'
import AppLayout from '../views/AppLayout.vue'
import Returns from '../views/Returns.vue'
import Upload from '../views/Upload.vue'
import Download from '../views/Download.vue'
import Files from '../views/Files.vue'
import Settings from '../views/Settings.vue'
import Archive from '../views/Archive.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/',
    component: AppLayout, // A wrapper for all authenticated pages
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/returns' }, // Redirect root to returns
      { path: 'returns', name: 'Returns', component: Returns },
      { path: 'upload', name: 'Upload', component: Upload },
      { path: 'download', name: 'Download', component: Download },
      { path: 'files', name: 'Files', component: Files },
      { path: 'archive', name: 'Archive', component: Archive },
      { path: 'settings', name: 'Settings', component: Settings },
    ]
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})


// (Your routes array and createRouter call are above this)

// --- NEW, ROBUST NAVIGATION GUARD ---
router.beforeEach(async (to, from, next) => {
  const { getCurrentUser } = useAuth();
  const currentUser = await getCurrentUser(); // Await the on-demand check

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  
  if (requiresAuth && !currentUser) {
    // If the route requires auth and the awaited check returns no user,
    // send them to login.
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (to.name === 'Login' && currentUser) {
    // If the user is already logged in and tries to go to the Login page,
    // send them to the default home page.
    next({ name: 'Returns' });
  } else {
    // In all other cases (e.g., going to a public page, or going
    // to a protected page when logged in), allow navigation.
    next();
  }
});

export default router;