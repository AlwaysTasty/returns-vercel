<template>
  <div>
    <!-- Section 1: Sticky Notes -->
    <div class="card" v-motion-fade-visible-once>
      <div class="card-header">
        <h2>📝 Sticky Notes</h2>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="isRecycleBinOpen = true">
            🗑️ Recycle Bin <span v-if="deletedNotesCount > 0" class="badge">{{ deletedNotesCount }}</span>
          </button>
          <button class="btn btn-primary" @click="createNewNote" :disabled="isCreatingNote">
            {{ isCreatingNote ? 'Creating...' : '+ New Note' }}
          </button>
        </div>
      </div>

      <!-- NEW: Simplified and more robust v-if/v-else structure -->
      <div v-if="isLoadingNotes" class="loading-state">Loading notes...</div>
      <div v-else>
        <transition-group v-if="activeNotes.length > 0" name="grid" tag="div" class="notes-grid">
          <div v-for="note in activeNotes" :key="note.id" class="note-card">
            <div class="note-content">
              <TiptapEditor
                :model-value="note.content"
                @update:modelValue="(newContent) => onNoteUpdate(note, newContent)"
              />
            </div>
            <div class="note-footer">
              <div class="note-meta">
                <transition name="fade-status">
                  <span v-if="note.status" class="save-status" :class="note.status">
                    {{ note.status === 'saving' ? 'Saving...' : '✓ Saved' }}
                  </span>
                </transition>
              </div>
              <button @click.stop="moveToRecycleBin(note.id)" class="delete-note-btn" title="Move to Recycle Bin">🗑️</button>
            </div>
          </div>
        </transition-group>
        <div v-else class="empty-state">No active notes found. Click "+ New Note" to start.</div>
      </div>
    </div>


    <!-- Section 2: Image Explorer -->
    <div class="card" v-motion-fade-visible-once>
      <div class="card-header">
        <h2>🖼️ Image Archive</h2>
        <button v-if="!imagesLoaded" class="btn btn-secondary" @click="loadImages" :disabled="isLoadingImages">
          {{ isLoadingImages ? 'Loading...' : 'Load Images' }}
        </button>
      </div>
      
      <div v-if="imagesLoaded">
        <div v-if="isLoadingImages" class="loading-state">Loading images...</div>
        <div v-else-if="!images.length" class="empty-state">No images found in storage.</div>
        <transition-group v-else name="grid" tag="div" class="image-grid">
          <div v-for="image in images" :key="image.path" class="image-card">
            <a :href="image.url" target="_blank"><img :src="image.url" class="image-preview" loading="lazy" /></a>
            <div class="image-meta">
              <!-- FIXED: Display remarks -->
              <p v-if="image.remarks" class="image-remarks">"{{ image.remarks }}"</p>
              <p><strong>By:</strong> {{ image.uploaderEmail.split('@')[0] }}</p>
              <p><strong>On:</strong> {{ formatTimestamp(new Date(image.uploadTimestamp)) }}</p>
              <div class="image-actions">
                <a :href="image.url" class="btn btn-small" download>Download</a>
                <button @click="deleteImage(image.path)" class="btn btn-small btn-danger">Delete</button>
              </div>
            </div>
          </div>
        </transition-group>
      </div>
    </div>
  <RecycleBinModal
    v-if="isRecycleBinOpen"
    @close="isRecycleBinOpen = false"
    @restore="restoreNote"
  />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAuth } from '../composables/useAuth';
import { db, storage } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, serverTimestamp, doc, orderBy } from 'firebase/firestore';
import { listAll, getDownloadURL, getMetadata, ref as storageRef, deleteObject } from 'firebase/storage';
import TiptapEditor from '../components/TiptapEditor.vue';
import debounce from 'lodash.debounce';
import { formatTimestamp } from '../utils/formatters.js';
import RecycleBinModal from '../components/RecycleBinModal.vue';

const { user } = useAuth();

// --- Notes State & Logic ---
const allNotes = ref([]);
const isLoadingNotes = ref(true); // This will be our only loading flag
const isCreatingNote = ref(false);
const isRecycleBinOpen = ref(false);
let unsubscribeNotes = null;


const activeNotes = computed(() => allNotes.value.filter(n => !n.isDeleted));
const deletedNotesCount = computed(() => allNotes.value.filter(n => n.isDeleted).length);


onMounted(() => {
  const q = query(collection(db, "notes"), orderBy("lastEditedAt", "desc"));
  unsubscribeNotes = onSnapshot(q, (snapshot) => {
    allNotes.value = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      status: '', 
      ...doc.data() 
    }));
    // We only set loading to false AFTER the first batch of data has arrived.
    isLoadingNotes.value = false;
  }, (error) => {
    console.error("Error fetching notes:", error);
    isLoadingNotes.value = false; // Also stop loading on error
  });
});

onUnmounted(() => { if (unsubscribeNotes) unsubscribeNotes(); });

const createNewNote = async () => {
  isCreatingNote.value = true;
  try {
    const newNoteData = {
      content: '<h2>New Note</h2><p></p>', // Start with a title for better UX
      createdAt: serverTimestamp(),
      createdBy: user.value.email,
      lastEditedAt: serverTimestamp(),
      lastEditedBy: user.value.email,
      isDeleted: false,
      deletedAt: null,
    };
    await addDoc(collection(db, "notes"), newNoteData);
  } catch (e) {
    console.error("Error creating note: ", e);
  } finally {
    isCreatingNote.value = false;
  }
};

const onNoteUpdate = debounce(async (note, newContent) => {
  if (!note || !note.id) return;
  
  // Set status to 'saving' to show immediate feedback
  note.status = 'saving';

  const noteRef = doc(db, 'notes', note.id);
  try {
    await updateDoc(noteRef, {
      content: newContent,
      lastEditedAt: serverTimestamp(),
      lastEditedBy: user.value.email,
    });
    // On success, set status to 'saved'
    note.status = 'saved';
  } catch (error) {
    console.error("Error updating note:", error);
    note.status = 'error'; // Optionally handle error state
  } finally {
    // After 2 seconds, fade the status message out
    setTimeout(() => {
      if (note.status !== 'saving') { // Don't clear if user started typing again
        note.status = '';
      }
    }, 2000);
  }
}, 1000); // 1-second debounce timer

const moveToRecycleBin = async (noteId) => {
  if (!confirm('Are you sure you want to move this note to the recycle bin?')) return;
  const noteRef = doc(db, 'notes', noteId);
  await updateDoc(noteRef, { isDeleted: true, deletedAt: serverTimestamp() });
};

// --- Image Explorer State & Logic ---
const images = ref([]);
const imagesLoaded = ref(false);
const isLoadingImages = ref(false);

const loadImages = async () => {
  isLoadingImages.value = true;
  imagesLoaded.value = true;
  const listRef = storageRef(storage, 'images');
  try {
    const res = await listAll(listRef);
    const imagePromises = res.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);
      const metadata = await getMetadata(itemRef);
      const customMeta = metadata.customMetadata || {};
      return {
        path: itemRef.fullPath, url,
        uploaderEmail: customMeta.uploaderEmail || 'N/A',
        uploadTimestamp: customMeta.uploadTimestamp || metadata.timeCreated,
        remarks: customMeta.remarks || '', // <-- FIXED: Correctly fetch remarks
      };
    });
    const fetchedImages = await Promise.all(imagePromises);
    images.value = fetchedImages.sort((a,b) => new Date(b.uploadTimestamp) - new Date(a.uploadTimestamp));
  } catch(e) { console.error("Error loading images: ", e); }
  finally { isLoadingImages.value = false; }
};

const deleteImage = async (imagePath) => {
  if (!confirm('Are you sure you want to permanently delete this image?')) return;
  try {
    await deleteObject(storageRef(storage, imagePath));
    images.value = images.value.filter(img => img.path !== imagePath);
  } catch (e) { console.error("Error deleting image: ", e); }
};

// --- Utility: Relative Time Formatter ---
function formatRelativeTime(ts) {
  if (!ts?.toDate) return '...';
  const date = ts.toDate();
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffSeconds = Math.round(diff / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
</script>

<style scoped>
.note-card {
  background-color: var(--background-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;
}
.note-card:focus-within {
  box-shadow: 0 0 0 2px var(--accent-primary);
  border-color: var(--accent-primary);
}
.note-content { padding: 1rem; flex-grow: 1; }
.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  background-color: #111111;
  min-height: 42px; /* Ensure footer has a consistent height */
}
.note-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* NEW Save Status Indicator Styles */
.save-status {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: opacity 0.3s ease;
}
.save-status.saved {
  color: #4ade80; /* A success green */
}
.fade-status-enter-active,
.fade-status-leave-active {
  transition: opacity 0.5s ease;
}
.fade-status-enter-from,
.fade-status-leave-to {
  opacity: 0;
}


.delete-note-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 1.1rem; border-radius: 4px; padding: 0.25rem; }
.delete-note-btn:hover { color: var(--error-color); background-color: rgba(244, 63, 94, 0.1); }
.card { margin-bottom: 2rem; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.loading-state, .empty-state { padding: 3rem 1rem; text-align: center; color: var(--text-secondary); }

/* --- New Sticky Note Styles --- */
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.note-card {
  background-color: var(--background-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;
}
.note-card:focus-within {
  box-shadow: 0 0 0 2px var(--accent-primary);
  border-color: var(--accent-primary);
}
.note-content { padding: 1rem; flex-grow: 1; }
.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  background-color: #111111;
}
.note-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); }
.delete-note-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 1.1rem; border-radius: 4px; padding: 0.25rem; }
.delete-note-btn:hover { color: var(--error-color); background-color: rgba(244, 63, 94, 0.1); }


/* --- Image Explorer Styles --- */
.image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
.image-card { background: var(--background-secondary); border-radius: 8px; overflow: hidden; }
.image-preview { width: 100%; height: 150px; object-fit: cover; display: block; }
.image-meta { padding: 1rem; font-size: 0.9rem; }
.image-meta p { margin: 0 0 0.5rem 0; color: var(--text-secondary); }
.image-meta p strong { color: var(--text-primary); }
.image-remarks {
  font-style: italic;
  padding-left: 0.75rem;
  border-left: 3px solid var(--border-color);
  color: var(--text-primary) !important;
}
.image-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.btn-small { padding: 0.4rem 0.8rem; font-size: 0.9rem; }
.btn-danger { background-color: var(--error-color); }

/* --- Grid Animation --- */
.grid-enter-active, .grid-leave-active { transition: all 0.4s ease; }
.grid-enter-from, .grid-leave-to { opacity: 0; transform: scale(0.9); }
</style>