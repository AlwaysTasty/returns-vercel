<template>
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
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { updatePassword, deleteUser } from 'firebase/auth';
import { useRouter } from 'vue-router';

const { user } = useAuth();
const router = useRouter();

const newPassword = ref('');
const isLoading = ref(false);
const statusMessage = ref('');
const statusType = ref(''); // 'success' or 'error'


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