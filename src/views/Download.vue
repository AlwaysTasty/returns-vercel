<template>
  <div>
    <!-- Section for COI Images -->
    <div class="card" v-motion-fade-visible-once>
      <div class="card-header">
        <h2>📥 Today's COI</h2>
        <div class="actions">
          <button @click="downloadAllImages" class="btn btn-secondary" :disabled="!images.length || isLoading.images">
            Download All
          </button>
          <button @click="clearFolder('images')" class="btn btn-danger" :disabled="isLoading.images">
            Clear All
          </button>
        </div>
      </div>

      <div v-if="isLoading.images" class="loading-state">Loading images...</div>
      <div v-else-if="!images.length" class="empty-state">No images found from today or yesterday.</div>
      <div v-else class="table-container">
        <table class="item-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Details</th>
              <th>Remarks</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="image in images" :key="image.path">
              <td>
                <a :href="image.url" target="_blank" title="View full image">
                  <img :src="image.url" :alt="image.name" class="preview-img" />
                </a>
              </td>
              <td>
                <div class="file-details">
                  <strong class="file-name">{{ image.name }}</strong>
                  <span class="meta-item"><strong>Uploaded by:</strong> {{ image.uploaderEmail.split('@')[0] }}</span>
                  <span class="meta-item"><strong>On:</strong> {{ formatTimestamp(image.uploadTimestamp) }}</span>
                </div>
              </td>
              <td class="remarks-cell">
                <p>{{ image.remarks || '–' }}</p>
              </td>
              <td class="text-right">
                <a :href="image.url" :download="image.name" class="btn btn-small">Download</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section for Today's Returns CSV -->
    <div class="card" v-motion-fade-visible-once>
      <div class="card-header">
        <h2>📄 Today's Returns</h2>
        <div class="actions">
          <button @click="clearFolder('returns')" class="btn btn-danger" :disabled="isLoading.returns">
            Clear All
          </button>
        </div>
      </div>

      <div v-if="isLoading.returns" class="loading-state">Loading returns...</div>
      <div v-else-if="!csvFile" class="empty-state">No returns file found for today.</div>
      <div v-else class="table-container">
        <h4>Preview: {{ csvFile.name }}</h4>
          <table class="item-table csv-preview-table">
            <thead v-if="csvHeaders.length > 0">
              <tr>
                <th v-for="(header, index) in csvHeaders" :key="index">{{ header }}</th>
              </tr>
            </thead>
            <tbody v-if="csvBody.length > 0">
              <tr v-for="(row, rowIndex) in csvBody" :key="rowIndex">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
      </div>
    </div>

    <!-- Global Status Message -->
    <transition name="fade">
      <div v-if="statusMessage" class="status-message" :class="statusType">
        {{ statusMessage }}
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive,computed } from 'vue';
import { storage } from '../services/firebase';
import { listAll, getDownloadURL, getMetadata, deleteObject, ref as storageRef } from 'firebase/storage';
import { formatTimestamp } from '../utils/formatters.js';

// --- Reactive State ---
const images = ref([]);
const csvFile = ref(null);
const csvContent = ref([]);
const isLoading = reactive({ images: true, returns: true });
const statusMessage = ref('');
const statusType = ref('');

// --- NEW: Defensive Computed Properties for CSV ---
const csvHeaders = computed(() => {
  // Return the first row as headers, or an empty array if no data exists
  return csvRows.value.length > 0 ? csvRows.value[0] : [];
});

const csvBody = computed(() => {
  // Return all rows except the first, or an empty array
  return csvRows.value.length > 1 ? csvRows.value.slice(1) : [];
});

// --- Lifecycle Hook ---
onMounted(() => {
  fetchImages();
  fetchCsv();
});


const setStatus = (message, type, duration = 4000) => {
  statusMessage.value = message;
  statusType.value = type;
  setTimeout(() => statusMessage.value = '', duration);
};

// --- Core Fetching Logic ---
const fetchImages = async () => {
  isLoading.images = true;
  images.value = [];
  const imageFolderRef = storageRef(storage, 'images');

  try {
    const res = await listAll(imageFolderRef);
    const filePromises = res.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);
      const metadata = await getMetadata(itemRef);
      
      const uploadTimestamp = metadata.customMetadata?.uploadTimestamp || metadata.timeCreated;
      
      return {
        name: itemRef.name,
        path: itemRef.fullPath,
        url,
        uploadTimestamp: new Date(uploadTimestamp),
        uploaderEmail: metadata.customMetadata?.uploaderEmail || 'N/A',
        remarks: metadata.customMetadata?.remarks || ''
      };
    });

    const allFiles = await Promise.all(filePromises);

// --- NEW & ROBUST DATE LOGIC ---
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    images.value = allFiles
      .filter(file => {
        const fileDateStr = file.uploadTimestamp.toISOString().split('T')[0];
        return fileDateStr === todayStr || fileDateStr === yesterdayStr;
      })
      .sort((a, b) => b.uploadTimestamp - a.uploadTimestamp);

  } catch (error) {
    console.error("Failed to load images:", error);
    setStatus('❌ Failed to load images.', 'error');
  } finally {
    isLoading.images = false;
  }
};


const fetchCsv = async () => {
  isLoading.returns = true;
  const returnsFolderRef = storageRef(storage, 'returns');
  csvFile.value = null;
  csvContent.value = [];

  try {
    const res = await listAll(returnsFolderRef);
    if (res.items.length === 0) return;

    const filePromises = res.items.map(async (itemRef) => {
      const metadata = await getMetadata(itemRef);
      return { ref: itemRef, name: itemRef.name, created: new Date(metadata.timeCreated) };
    });
    const allFiles = await Promise.all(filePromises);

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todaysFile = allFiles
      .filter(file => new Date(file.created.setHours(0, 0, 0, 0)).getTime() === todayStart.getTime())
      .sort((a, b) => b.created - a.created)[0];

    if (!todaysFile) return;

    const url = await getDownloadURL(todaysFile.ref);
    csvFile.value = { name: todaysFile.name, url };

    const response = await fetch(url);
    const text = await response.text();

    // NEW: Improved parsing logic
    csvRows.value = text
      .trim()
      .split('\n')
      .map(row => row.trim())
      .filter(row => row && !row.startsWith('Terminal:') && !row.startsWith('==='))
      .map(row => row.split(',').map(cell => cell.replace(/"/g, '')));

  } catch (error) {
    console.error("Failed to load CSV:", error);
    setStatus('❌ Failed to load returns CSV.', 'error');
  } finally {
    isLoading.returns = false;
  }
};

// --- Action Methods ---
// Located in /src/views/Download.vue

const clearFolder = async (folderPath) => {
  // We only handle the 'images' case for this special logic
  if (folderPath === 'images') {
    // 1. Check if there are any images currently displayed.
    if (!images.value.length) {
      setStatus('There are no images from today to delete.', 'info');
      return;
    }

    // 2. Confirm with the user, stating exactly what will be deleted.
    if (!confirm(`Are you sure you want to permanently delete the ${images.value.length} displayed image(s)? `)) return;

    setStatus(`Deleting ${images.value.length} image(s)...`, 'info');

    try {
      // 3. Create delete promises ONLY for the files in the local 'images' array.
      const deletePromises = images.value.map(image => {
        const imageRef = storageRef(storage, image.path); // Use the path stored on the image object
        return deleteObject(imageRef);
      });

      // 4. Wait for all deletions to complete.
      await Promise.all(deletePromises);
      
      setStatus(`✅ Successfully deleted ${images.value.length} image(s).`, 'success');

    } catch (error) {
      console.error(`Failed to delete displayed images:`, error);
      setStatus(`❌ An error occurred during deletion. See console.`, 'error');
    } finally {
      // 5. Refresh the view. After deletion, the list will be empty.
      fetchImages();
    }

  } else if (folderPath === 'returns') {
    if (!confirm(`Are you sure you want to permanently delete ALL files in the "/${folderPath}" folder?`)) return;

    setStatus(`Clearing /${folderPath}...`, 'info');
    const folderRef = storageRef(storage, folderPath);

    try {
      const res = await listAll(folderRef);
      if (res.items.length === 0) {
        setStatus(`✅ Folder /${folderPath} is already empty.`, 'success');
        return;
      }
      const deletePromises = res.items.map(itemRef => deleteObject(itemRef));
      await Promise.all(deletePromises);
      
      setStatus(`✅ Successfully deleted ${res.items.length} files from /${folderPath}.`, 'success');
    } catch (error) {
      console.error(`Failed to clear folder ${folderPath}:`, error);
      setStatus(`❌ Error clearing folder. See console.`, 'error');
    } finally {
      fetchCsv();
    }
  }
};
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}
.card-header h2 {
  margin: 0;
}
.actions {
  display: flex;
  gap: 1rem;
}
.btn-danger {
  background-color: #d13438;
}
.btn-danger:hover {
  background-color: #a4262c;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  background-color: var(--background-secondary);
  border-radius: 8px;
}

.table-container {
  overflow-x: auto;
}

.item-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 0.5rem;
}

.item-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  border-bottom: 2px solid var(--border-color);
}

.item-table td {
  background-color: var(--background-secondary);
  padding: 0.75rem 1rem;
  vertical-align: middle;
}
.item-table tr:hover td {
  background-color: #313138;
}

/* Rounded corners for table rows */
.item-table td:first-child { border-radius: 8px 0 0 8px; }
.item-table td:last-child { border-radius: 0 8px 8px 0; }

.preview-img {
  max-width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  transition: transform 0.2s ease;
}
.preview-img:hover {
  transform: scale(1.1);
}

.file-name {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9rem;
  word-break: break-all;
}
.text-right {
  text-align: right;
}

.btn-small {
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
  background-color: #4a4a52;
  text-decoration: none;
  display: inline-block;
}
.btn-small:hover {
  background-color: #5a5a64;
}

.status-message {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  z-index: 1000;
}
.status-message.success { background-color: #107c10; }
.status-message.error { background-color: #d13438; }
.status-message.info { background-color: var(--accent-primary); }

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s, transform 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.file-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
}
.meta-item {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.remarks-cell p {
  margin: 0;
  font-style: italic;
  color: var(--text-secondary);
  max-width: 300px; /* Limit width */
  white-space: pre-wrap; /* Allow wrapping */
}

.csv-preview-table {
  border-collapse: collapse; /* Switch to collapse for borders */
  border-spacing: 0;
  border: 1px solid #555; /* Outer border for the table */
  font-size: 0.9rem;
}

.csv-preview-table th,
.csv-preview-table td {
  /* High-contrast black and white theme */
  background-color: #fff;
  color: #000;
  border: 1px solid #000; /* Black borders for all cells */
  padding: 0.6rem 1rem;
  /* Reset styles from .item-table */
  border-radius: 0; 
}

.csv-preview-table th {
  font-weight: 700;
  background-color: #eee; /* Slightly off-white for the header */
}

/* Override the hover effect from .item-table for our new table */
.csv-preview-table tr:hover td {
  background-color: #f0f0f0; 
}
</style>