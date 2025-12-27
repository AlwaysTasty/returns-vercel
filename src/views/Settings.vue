<template>
  <!-- Telegram login page -->
  <div class="card" v-if="telegramParams.id">
      <h2>🔗 Connect Telegram</h2>
      <p>Do you want to link the Telegram account <strong>{{ telegramParams.username || telegramParams.id }}</strong> to your current account ({{ user?.email }})?</p>
      
      <div class="actions">
        <button class="btn btn-primary" @click="linkTelegram" :disabled="isLinking">
          {{ isLinking ? 'Linking...' : 'Yes, Link Account' }}
        </button>
      </div>
      <p v-if="linkMessage" class="status-message" :class="linkStatus">{{ linkMessage }}</p>
    </div>

  <div>
    <!-- Card 1: Account Settings -->
    <div class="card" v-motion-fade-visible-once>
      <h2>👤 Account Settings</h2>
      <div class="setting-item">
        <label>Logged In As</label>
        <p class="user-email">{{ user?.email || 'Loading...' }}</p>
      </div>

      <div class="setting-item">
        <label for="newPassword">Change Password</label>
        <div class="input-with-button">
          <input id="newPassword" type="password" v-model="newPassword" placeholder="New Password" />
          <button class="btn btn-secondary" @click="handleChangePassword" :disabled="!newPassword || isLoading">
            {{ isLoading ? 'Updating...' : 'Update' }}
          </button>
        </div>
      </div>
      <p v-if="statusMessage" class="status-message" :class="statusType">{{ statusMessage }}</p>
    </div>
    
    <!-- Card 3: Danger Zone -->
    <div class="card danger-zone" v-motion-fade-visible-once>
      <h2>⚠️ Danger Zone</h2>
      <div class="setting-item">
        <div class="danger-text">
          <label>Delete Account</label>
          <p>Permanently delete your account and all associated data, including notes and uploaded files. This action cannot be undone.</p>
        </div>
        <button class="btn btn-danger" @click="handleDeleteAccount">Delete My Account</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRoute, useRouter } from 'vue-router'; // Import route tools
import { updatePassword, deleteUser } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions'; // Import functions
import { functions } from '../services/firebase'; // Import your functions instance

const { user } = useAuth();
const route = useRoute();
const router = useRouter();

// Password/Account State
const newPassword = ref('');
const isLoading = ref(false);
const statusMessage = ref('');
const statusType = ref('');

// Telegram Linking State
const telegramParams = ref({ id: null, username: null });
const isLinking = ref(false);
const linkMessage = ref('');
const linkStatus = ref('');

watch(
  () => route.query,
  (newQuery) => {
    console.log("Current URL Query Params:", newQuery); // Debug log

    if (newQuery.tgId) {
      console.log("Found Telegram ID:", newQuery.tgId); // Debug log
      telegramParams.value = {
        id: newQuery.tgId,
        username: newQuery.tgName
      };
    }
  },
  { immediate: true } // This ensures it runs immediately when the page loads
);

const linkTelegram = async () => {
  isLinking.value = true;
  try {
    const linkFunction = httpsCallable(functions, 'linkTelegramAccount');
    await linkFunction({ 
      telegramId: telegramParams.value.id,
      username: telegramParams.value.username
    });
    
    linkMessage.value = "✅ Telegram linked successfully! You can now upload images.";
    linkStatus.value = "success";
    
    // Clear URL params to clean up
    setTimeout(() => {
      // Use 'replace' to remove query params without refreshing
      router.replace({ path: '/settings', query: {} }); 
      telegramParams.value = { id: null, username: null };
    }, 3000);
    
  } catch (error) {
    console.error("Linking failed", error);
    linkMessage.value = "❌ Linking failed: " + error.message;
    linkStatus.value = "error";
  } finally {
    isLinking.value = false;
  }
};


// --- Methods ---

const setStatus = (message, type, duration = 4000) => {
  statusMessage.value = message;
  statusType.value = type;
  setTimeout(() => {
    statusMessage.value = '';
    statusType.value = '';
  }, duration);
};

const handleChangePassword = async () => {
  if (newPassword.value.length < 6) {
    setStatus('Password must be at least 6 characters long.', 'error');
    return;
  }
  isLoading.value = true;
  try {
    await updatePassword(user.value, newPassword.value);
    setStatus('Password updated successfully!', 'success');
    newPassword.value = '';
  } catch (error) {
    console.error("Password update error:", error);
    setStatus('Update failed. You may need to log out and log back in.', 'error');
  } finally {
    isLoading.value = false;
  }
};

const handleDeleteAccount = async () => {
  const confirmation = prompt('This is irreversible. To confirm, please type your email address below:');
  if (confirmation !== user.value.email) {
    alert('Confirmation failed. Account not deleted.');
    return;
  }
  
  if (confirm('FINAL WARNING: Are you absolutely sure you want to delete your account? All data will be lost forever.')) {
    isLoading.value = true;
    try {
      await deleteUser(user.value);
      alert('Account deleted successfully.');
      // The auth listener will automatically handle logout.
      // We push to login page as a fallback.
      router.push('/login');
    } catch (error) {
      console.error("Account deletion error:", error);
      setStatus('Deletion failed. You may need to log out and log back in.', 'error');
    } finally {
      isLoading.value = false;
    }
  }
};

</script>

<style scoped>
.card { margin-bottom: 2rem; }
h2 { border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem; }

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  flex-wrap: wrap;
  gap: 1rem;
}
.setting-item:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}
.setting-item label {
  font-weight: 600;
  color: var(--text-primary);
}
.setting-item p {
  color: var(--text-secondary);
  margin: 0;
}
.user-email {
  background-color: var(--background-secondary);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-family: 'Courier New', Courier, monospace;
}
.input-with-button {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.status-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
}
.status-message.success { background-color: rgba(74, 222, 128, 0.2); color: #4ade80; }
.status-message.error { background-color: rgba(255, 107, 107, 0.2); color: var(--error-color); }

/* Danger Zone */
.danger-zone {
  border-color: var(--error-color);
  background-image: linear-gradient(rgba(244, 63, 94, 0.05), rgba(244, 63, 94, 0.05));
}
.danger-zone h2 {
  color: var(--error-color);
}
.danger-text {
  flex-basis: 60%;
}
.btn-danger {
  background-color: var(--error-color);
}
.btn-danger:hover {
  background-color: #be123c;
}
</style>