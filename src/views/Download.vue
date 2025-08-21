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
      <div class="image-grid-container">
        <div v-for="image in images" :key="image.path" class="image-display-card">
          <!-- The full-size image is now the main content -->
          <img :src="image.url" :alt="image.name" class="full-preview-img" />
          
          <div class="image-details-footer">
            <div class="file-info">
              <strong class="file-name">{{ image.name }}</strong>
              <span class="meta-item">By {{ image.uploaderEmail.split('@')[0] }} on {{ formatTimestamp(image.uploadTimestamp) }}</span>
              <p v-if="image.remarks" class="remarks-text">"{{ image.remarks }}"</p>
            </div>
            <div class="image-actions">
              <!-- NEW: Copy Image Button -->
              <button @click="copyImageToClipboard(image)" class="btn btn-secondary btn-small">Copy</button>
              <button @click="triggerDownload(image)" class="btn btn-primary btn-small">Download</button>
            </div>
          </div>
        </div>
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
import { formatTimestamp, forceFileDownload } from '../utils/formatters.js';

// --- Reactive State ---
const images = ref([]);
const csvFile = ref(null);
const csvRows = ref([]);
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


const triggerDownload = (image) => {
  setStatus(`Preparing to download ${image.name}...`, 'info', 2000);
  forceFileDownload(image.url, image.name);
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
  csvRows.value = [];

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

const downloadAllImages = async () => {
  if (!images.value.length) return;
  
  setStatus(`Starting batch download of ${images.value.length} images...`, 'info');

  for (const image of images.value) {
    // We now call the global, imported helper function
    await forceFileDownload(image.url, image.name);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  setStatus('✅ Batch download complete!', 'success');
};

const copyImageToClipboard = async (image) => {
  if (!navigator.clipboard || !navigator.clipboard.write) {
    setStatus('❌ Browser does not support copying images.', 'error');
    return;
  }
  
  try {
    setStatus(`Copying ${image.name}...`, 'info', 2000);
    // Fetch the image data as a blob
    const response = await fetch(image.url);
    const blob = await response.blob();
    
    // Use the Clipboard API to write the blob
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ]);
    
    setStatus(`✅ Image copied to clipboard!`, 'success');
  } catch (error) {
    console.error('Failed to copy image:', error);
    setStatus('❌ Could not copy image. Check console for details.', 'error');
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
.image-grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}
.image-display-card {
  background-color: var(--background-secondary);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}
.full-preview-img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: contain; /* Use 'contain' to show the full image without cropping */
  background-color: var(--background-primary); /* Dark background for transparent images */
  display: block;
}
.image-details-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.file-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-grow: 1;
  min-width: 0; /* Allows flex items to shrink properly */
}
.file-name {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta-item {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.remarks-text {
  margin: 0.5rem 0 0;
  font-style: italic;
  font-size: 0.9rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
}
.image-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
}
.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  min-width: 90px;
  text-align: center;
}
.btn-primary { background-color: var(--accent-primary); }
.btn-secondary { background-color: #4a4a52; }
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