<template>
  <transition name="modal-fade">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Recycle Bin</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>
        
        <div class="modal-body">
          <p class="info-text">
            Notes in the recycle bin are automatically deleted forever after 14 days.
          </p>
          <div v-if="isLoading" class="loading-state">Loading deleted notes...</div>
          <ul v-else-if="deletedNotes.length > 0" class="deleted-notes-list">
            <li v-for="note in deletedNotes" :key="note.id" class="deleted-note-item">
              <div class="note-info">
                <div class="note-content-preview" v-html="note.content.substring(0, 150) || 'Empty Note'"></div>
                <small>Deleted on: {{ formatTimestamp(note.deletedAt) }}</small>
              </div>
              <button class="btn btn-secondary btn-small" @click="$emit('restore', note.id)">Restore</button>
            </li>
          </ul>
          <div v-else class="empty-state">The recycle bin is empty.</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { formatTimestamp } from '../utils/formatters.js';

const emit = defineEmits(['close', 'restore']);

const deletedNotes = ref([]);
const isLoading = ref(true);
let unsubscribe = null;

onMounted(() => {
  const q = query(collection(db, "notes"), where("isDeleted", "==", true), orderBy("deletedAt", "desc"));
  unsubscribe = onSnapshot(q, (snapshot) => {
    deletedNotes.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    isLoading.value = false;
  }, (error) => {
    console.error("Error fetching deleted notes:", error);
    isLoading.value = false;
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
/* Modal Styles */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background-color: var(--background-card); border-radius: 12px; width: 90%; max-width: 600px; display: flex; flex-direction: column; overflow: hidden; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); }
.modal-header h3 { margin: 0; }
.close-btn { background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; }

/* Modal Body Styles */
.modal-body { padding: 1.5rem; max-height: 70vh; overflow-y: auto; }
.info-text { font-size: 0.9rem; color: var(--text-secondary); margin-top: 0; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); }
.loading-state, .empty-state { padding: 3rem 0; text-align: center; color: var(--text-secondary); }
.deleted-notes-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1rem; }
.deleted-note-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--background-secondary);
  border-radius: 8px;
}
.note-info { display: flex; flex-direction: column; gap: 0.5rem; overflow: hidden; }
.note-content-preview { color: var(--text-secondary); }
.note-info small { font-size: 0.8rem; color: #888; }
.btn-small { padding: 0.5rem 1rem; }

/* Modal Transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.95); }
</style>