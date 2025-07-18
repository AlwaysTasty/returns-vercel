<template>
  <div class="card file-explorer-card" v-motion-fade-visible-once>
    <h2>🗂️ File Explorer</h2>
    <p>Browse, preview, and manage all uploaded files from your storage.</p>
    
    <div class="file-explorer-container">
      <!-- File List Panel (Left) -->
      <div class="file-list-panel">
        <div v-if="isLoading" class="panel-state">Loading files...</div>
        <div v-else-if="!allFiles.length" class="panel-state">No files found in the archive.</div>
        <table v-else class="item-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th class="actions-header-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="file in allFiles" 
              :key="file.path" 
              @click="handleFileSelect(file)"
              :class="{ selected: selectedFile && selectedFile.path === file.path }"
            >
              <td :title="file.name">
                <div class="name-cell-content">
                  <span class="file-name">{{ file.name }}</span>
                </div>
              </td>
              <td class="size-cell">{{ formatFileSize(file.size) }}</td>
                <td class="uploaded-cell">{{ formatTimestamp(file.created) }}</td>
                <td class="actions-cell">
                  <button @click.stop="deleteFile(file.path, file.name)" class="delete-btn" title="Delete File">🗑️</button>
                </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- File Preview Panel (Right) -->
      <div class="file-preview-panel">
        <div v-if="!selectedFile" class="panel-state">
          Select a file from the list to preview it here.
        </div>
        <div v-else class="preview-wrapper">
          <div class="preview-header">
            <span class="preview-filename">{{ selectedFile.name }}</span>
           <button @click="handleDownload(selectedFile)" class="btn btn-secondary btn-small">
              {{ isDownloading ? 'Downloading...' : 'Download' }}
            </button>
          </div>

          <div class="preview-content">
            <div v-if="isLoadingPreview" class="panel-state">Loading preview...</div>
            <img v-else-if="preview.type === 'image'" :src="preview.content" alt="Image preview" />
            <pre v-else-if="preview.type === 'text'"><code>{{ preview.content }}</code></pre>
            <iframe v-else-if="preview.type === 'pdf'" :src="preview.content" frameborder="0"></iframe>
            <audio v-else-if="preview.type === 'audio'" :src="preview.content" controls></audio>
            <video v-else-if="preview.type === 'video'" :src="preview.content" controls></video>
            <div v-else class="panel-state unsupported">
              <p>Preview is not available for this file type.</p>
              <span>(.{{ selectedFile.name.split('.').pop() }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { storage } from '../services/firebase';
import { listAll, getMetadata, getDownloadURL, deleteObject, ref as storageRef } from 'firebase/storage';
import { formatFileSize, formatTimestamp } from '../utils/formatters.js';

const isDownloading = ref(false); 


const handleDownload = async (file) => {
  if (!file || !file.url) return;
  isDownloading.value = true;
  
  try {
    // 1. Fetch the file data using the download URL.
    //    Because of CORS, this works for images just like it did for the CSV.
    const response = await fetch(file.url);
    if (!response.ok) throw new Error('Network response was not ok.');
    
    // 2. Get the data as a Blob (a file-like object).
    const blob = await response.blob();
    
    // 3. Create a temporary URL that points to the Blob data in the browser's memory.
    const blobUrl = window.URL.createObjectURL(blob);
    
    // 4. Create a temporary, hidden link element.
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.setAttribute('download', file.name); // Set the desired filename
    
    // 5. Add the link to the document, "click" it to trigger the download, then remove it.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 6. Clean up the temporary Blob URL.
    window.URL.revokeObjectURL(blobUrl);

  } catch (error) {
    console.error("Download failed:", error);
    alert("Could not download the file. See console for details.");
  } finally {
    isDownloading.value = false;
  }
};

const allFiles = ref([]);
const selectedFile = ref(null);
const isLoading = ref(true);
const isLoadingPreview = ref(false);
const preview = ref({ type: 'none', content: '' });

onMounted(() => { fetchAllFiles(); });
const deleteFile = async (filePath, fileName) => {
  if (!confirm(`Are you sure you want to permanently delete "${fileName}"? This cannot be undone.`)) return;
  
  try {
    await deleteObject(storageRef(storage, filePath));
    // Remove file from the local list for an instant UI update
    allFiles.value = allFiles.value.filter(f => f.path !== filePath);
    // If the deleted file was the selected one, clear the preview
    if (selectedFile.value && selectedFile.value.path === filePath) {
      selectedFile.value = null;
    }
    // You could add a success status message here if desired
  } catch (error) {
    console.error("Error deleting file:", error);
    alert("Failed to delete file. See console for details.");
  }
};


// --- File Fetching & Handling ---
const fetchAllFiles = async () => {
  isLoading.value = true;
  
  // *** THE FIX IS HERE ***
  // We now point directly to the 'files/' folder instead of the root.
  const filesFolderRef = storageRef(storage, 'files/');
  
  try {
    const res = await listAll(filesFolderRef);
    
    const fileDetailPromises = res.items.map(async (itemRef) => {
      const metadata = await getMetadata(itemRef);
      const customMeta = metadata.customMetadata || {};
      
      return {
        name: itemRef.name,
        path: itemRef.fullPath,
        size: metadata.size,
        created: new Date(customMeta.uploadTimestamp || metadata.timeCreated),
        contentType: metadata.contentType,
        url: null,
      };
    });

    const fetchedFiles = await Promise.all(fileDetailPromises);
    allFiles.value = fetchedFiles.sort((a, b) => b.created - a.created);

  } catch (error) {
    console.error("Error fetching files:", error);
  } finally {
    isLoading.value = false;
  }
};

const handleFileSelect = async (file) => {
  selectedFile.value = file;
  isLoadingPreview.value = true;
  preview.value = { type: 'none', content: '' };

  try {
    if (!file.url) {
      file.url = await getDownloadURL(storageRef(storage, file.path));
    }

    if (file.contentType?.startsWith('image/')) {
      preview.value = { type: 'image', content: file.url };
    } 
    else if (file.contentType?.startsWith('audio/')) {
      preview.value = { type: 'audio', content: file.url };
    } 
    else if (file.contentType?.startsWith('video/')) {
      preview.value = { type: 'video', content: file.url };
    } 
    else if (file.contentType === 'application/pdf') {
      preview.value = { type: 'pdf', content: file.url };
    }
    else if (file.contentType?.startsWith('text/')) {
      preview.value = { type: 'text', content: 'Loading content...' };
      const response = await fetch(file.url);
      preview.value.content = await response.text();
    }
    else {
      preview.value = { type: 'unsupported', content: '' };
    }
  } catch (error) {
    console.error("Error generating preview:", error);
    preview.value = { type: 'unsupported', content: 'Error loading preview.' };
  } finally {
    isLoadingPreview.value = false;
  }
};

// const formatDate = (date) => date ? date.toLocaleDateString() : 'N/A';
</script>

<style scoped>
/* Main Card & Layout */
.file-explorer-card {
  padding-bottom: 0;
}
.file-explorer-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  height: 70vh;
  min-height: 550px;
  padding-top: 1rem;
}

/* Panel Sizing */
.file-list-panel {
  flex: 1.5 1 500px;
  min-width: 450px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--background-secondary);
}
.file-preview-panel {
  flex: 1 1 400px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--background-secondary);
  display: flex;
  flex-direction: column;
}
.panel-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--text-secondary);
  text-align: center;
  padding: 1rem;
}
.panel-state.unsupported span {
  font-size: 0.9rem;
  opacity: 0.7;
  margin-top: 0.5rem;
  display: block;
}

/* --- NEW & IMPROVED Table Styles --- */
.item-table {
  width: 100%;
  border-collapse: collapse;
}
.item-table th, .item-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle; /* Ensures all cell content is vertically centered */
  text-align: left;
}
.item-table th {
  position: sticky;
  top: 0;
  background-color: #313138;
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  white-space: nowrap; /* Prevent headers from wrapping */
}
.item-table tbody tr {
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.item-table tbody tr:hover {
  background-color: #3a3a44;
}
.item-table tbody tr.selected {
  background-color: var(--accent-primary-glow);
}

/* --- Cell Formatting Fixes --- */
.name-cell-content {
  /* Use Flexbox for robust truncation */
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.file-icon {
  font-size: 1.2rem;
  flex-shrink: 0; /* Prevent icon from shrinking */
}
.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* This adds the "..." */
}
.size-cell, .uploaded-cell {
  white-space: nowrap; /* Prevent wrapping */
  width: 120px; /* Constrain the width of these columns */
}
.actions-cell {
  text-align: center;
  width: 80px;
}
.delete-btn {
  background: none; border: none; font-size: 1.1rem;
  color: var(--text-secondary); cursor: pointer;
  padding: 0.4rem; border-radius: 4px;
  width: 100%;
}
.delete-btn:hover {
  color: var(--error-color);
  background-color: rgba(244, 63, 94, 0.1);
}

/* Preview Panel Styles (unchanged) */
.preview-wrapper, .preview-content {
  display: flex; flex-direction: column;
  flex-grow: 1; height: 100%;
}
.preview-content {
  padding: 0; overflow: hidden;
}
.preview-content img, .preview-content video, .preview-content audio {
  max-width: 100%; max-height: 100%; display: block;
  border-radius: 4px; padding: 1rem; box-sizing: border-box;
}
.preview-content iframe, .preview-content pre {
  width: 100%; height: 100%; border: none;
}
.preview-content pre {
  white-space: pre-wrap; word-wrap: break-word; background-color: var(--background-primary);
  padding: 1rem; box-sizing: border-box; color: var(--text-primary);
}
.preview-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color);
  background-color: #313138; flex-shrink: 0;
}
.preview-filename {
  font-weight: 600; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
</style>