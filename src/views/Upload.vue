<template>
  <div>
    <!-- Card 1: Image Staging Area -->
    <div class="card" v-motion-fade-visible-once>
      <h2>📤 Image Staging Area</h2>
      <h4>Select images</h4>
      <div class="actions-header">
        <label for="imageInput" class="btn btn-primary">+ Add Images to Stage</label>
        <button 
          class="btn btn-secondary" 
          @click="uploadImages" 
          :disabled="!stagedFiles.length || isUploading"
        >
          {{ isUploading ? 'Uploading Images...' : `Upload All ${stagedFiles.length} Image(s)` }}
        </button>
      </div>
      <input type="file" id="imageInput" accept="image/*" multiple @change="handleFileSelection" hidden />

      <div class="file-staging-area">
        <div v-if="!stagedFiles.length" class="empty-state">
          Your selected images will appear here.
        </div>
        <transition-group v-else name="grid" tag="div" class="file-grid">
          <div v-for="item in stagedFiles" :key="item.id" class="file-card">
            <div class="card-preview">
              <img :src="item.previewUrl" :alt="item.file.name" />
              <!-- NEW: Crop button overlay -->
              <div class="preview-overlay">
                <button @click="openCropper(item)" class="overlay-btn crop-btn" title="Crop Image">✂️</button>
                <a :href="item.previewUrl" target="_blank" class="overlay-btn view-btn" title="View Full Image">🔍</a>
              </div>
              <button @click="removeFile(item.id)" class="remove-btn-corner" title="Remove file">×</button>
            </div>
            
            <div class="card-body">
              <div class="filename-container">
                <div v-if="!item.isEditingName" class="filename-display">
                  <span>{{ item.editableName }}</span><span class="file-ext">{{ item.extension }}</span>
                  <button @click="startNameEdit(item)" class="edit-name-btn" title="Edit name">✏️</button>
                </div>
                <div v-else class="filename-edit">
                  <input type="text" v-model="item.editableName" :ref="el => { if (el) item.inputRef = el }" @blur="saveName(item)" @keydown.enter.prevent="saveName(item)" @keydown.esc.prevent="cancelNameEdit(item)" />
                  <span class="file-ext">{{ item.extension }}</span>
                </div>
              </div>
              <div class="card-meta">
                <button class="timestamp-btn" @click="openPicker(item)">
                  🗓️ {{ formatTimestamp(item.uploadDate) }}
                </button>
                <textarea v-model="item.remarks" rows="2" placeholder="Optional remarks..."></textarea>
              </div>
            </div>
          </div>
        </transition-group>
      </div>
    </div>
    
    <!-- Card 2: General File Uploader -->
    <div class="card">
      <h2>🗂️ Other File Uploader</h2>
      <p>Upload other file types to 'Files'.</p>
      
      <div 
        class="drop-zone"
        :class="{ 'is-dragover': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleGeneralFileDrop"
      >
        <div v-if="!generalFilesToUpload.length" class="drop-zone-prompt">
          <p>Drag & Drop Files Here</p>
          <span>or</span>
          <label for="generalFileInput" class="btn btn-secondary">Browse Files</label>
        </div>
        <div v-else class="general-file-list-container">
           <transition-group name="list" tag="ul" class="general-file-list">
            <li v-for="(file, index) in generalFilesToUpload" :key="file.name + index">
              <span class="file-icon">📄</span>
              <div class="general-file-info">
                <span>{{ file.name }}</span>
                <small>{{ formatFileSize(file.size) }}</small>
              </div>
              <button @click="removeGeneralFile(index)" class="remove-btn-simple">×</button>
            </li>
          </transition-group>
        </div>
      </div>
      
      <input type="file" id="generalFileInput" @change="handleGeneralFileSelection" multiple hidden />
      
      <div class="actions-footer">
        <button class="btn btn-primary" @click="uploadGeneralFiles" :disabled="!generalFilesToUpload.length || isUploadingGeneralFiles">
          {{ isUploadingGeneralFiles ? 'Uploading...' : `Upload ${generalFilesToUpload.length} File(s)` }}
        </button>
      </div>
    </div>

    <div v-if="uploadLog.length" class="status-container">
      <h4>Upload Log</h4>
      <div class="status-log">
        <p v-for="(log, index) in uploadLog" :key="index" :class="log.type">{{ log.message }}</p>
      </div>
    </div>


    <DateTimePicker
    v-if="isPickerOpen"
    :initial-date="editingFile.uploadDate"
    @close="closePicker"
    @update="handleDateUpdate"
  />

  <!-- NEW: Add the cropper modal instance -->
  <ImageCropperModal
    v-if="isCropperOpen"
    :src="editingFileForCrop.previewUrl"
    @close="closeCropper"
    @crop="handleCrop"
  />
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import { useAuth } from '../composables/useAuth';
import { storage } from '../services/firebase';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import DateTimePicker from '../components/DateTimePicker.vue';
import ImageCropperModal from '../components/ImageCropperModal.vue'; // <-- Import new component

// --- State for Image Uploader ---
const { user } = useAuth();
const stagedFiles = ref([]);
const isUploading = ref(false);
const editingFile = ref(null);
const isPickerOpen = ref(false);

// --- NEW State for the Cropper ---
const isCropperOpen = ref(false);
const editingFileForCrop = ref(null);

// --- State for General File Uploader ---
const generalFilesToUpload = ref([]);
const isUploadingGeneralFiles = ref(false);
const isDragOver = ref(false);

// --- Common State ---
const uploadLog = ref([]);

// --- NEW Logic for Cropper ---
const handleCrop = (croppedBlob) => {
  const fileItem = editingFileForCrop.value;
  if (fileItem) {
    URL.revokeObjectURL(fileItem.previewUrl);
    fileItem.previewUrl = URL.createObjectURL(croppedBlob);
    const finalName = `${fileItem.editableName}${fileItem.extension}`;
    const newFile = new File([croppedBlob], finalName, { type: croppedBlob.type });
    fileItem.file = newFile;
  }
  closeCropper();
};

const openCropper = (item) => {
  editingFileForCrop.value = item;
  isCropperOpen.value = true;
};

const closeCropper = () => {
  isCropperOpen.value = false;
  editingFileForCrop.value = null;
};


// --- All Other Logic (unchanged from your file) ---
const handleFileSelection = (event) => { const newFiles = Array.from(event.target.files).map(file => { const parts = file.name.split('.'); const extension = parts.length > 1 ? `.${parts.pop()}` : ''; const name = parts.join('.'); return { id: Date.now() + Math.random(), file, previewUrl: URL.createObjectURL(file), uploadDate: new Date(), remarks: '', editableName: name, originalName: name, extension, isEditingName: false, inputRef: null, }; }); stagedFiles.value.push(...newFiles); event.target.value = ''; };
const removeFile = (id) => { const fileToRemove = stagedFiles.value.find(item => item.id === id); if (fileToRemove) URL.revokeObjectURL(fileToRemove.previewUrl); stagedFiles.value = stagedFiles.value.filter(item => item.id !== id); };
const startNameEdit = async (item) => { item.isEditingName = true; await nextTick(); if (item.inputRef) { item.inputRef.focus(); item.inputRef.select(); } };
const saveName = (item) => { if (item.editableName.trim() === '') { item.editableName = item.originalName; } item.originalName = item.editableName; item.isEditingName = false; };
const cancelNameEdit = (item) => { item.editableName = item.originalName; item.isEditingName = false; };
const openPicker = (fileItem) => { editingFile.value = fileItem; isPickerOpen.value = true; };
const closePicker = () => { isPickerOpen.value = false; editingFile.value = null; };
const handleDateUpdate = (newDate) => { if (editingFile.value) editingFile.value.uploadDate = newDate; };
const formatTimestamp = (date) => date.toLocaleString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
const formatFileSize = (bytes) => { if (bytes === 0) return '0 B'; const k = 1024; const i = Math.floor(Math.log(bytes) / Math.log(k)); return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${['B', 'KB', 'MB', 'GB'][i]}`; };
const uploadImages = async () => { isUploading.value = true; uploadLog.value = [{ type: 'info', message: '🚀 Starting image uploads...' }]; for (const item of stagedFiles.value) { const finalName = `${item.editableName.trim()}${item.extension}`; const metadata = { customMetadata: { uploaderEmail: user.value?.email || 'unknown', uploadTimestamp: item.uploadDate.toISOString(), remarks: item.remarks || '' } }; const fileName = `images/${item.uploadDate.getTime()}_${finalName}`; uploadLog.value.push({ type: 'info', message: `Compressing ${finalName}...` }); try { const compressedBlob = await compressImageToTargetSize(item.file); await uploadBytes(storageRef(storage, fileName), compressedBlob, metadata); uploadLog.value.push({ type: 'success', message: `✅ Uploaded ${finalName}` }); } catch (error) { console.error("Upload failed for", finalName, error); uploadLog.value.push({ type: 'error', message: `❌ Failed ${finalName}` }); } } isUploading.value = false; uploadLog.value.push({ type: 'info', message: '🏁 All image uploads finished.' }); stagedFiles.value.forEach(item => URL.revokeObjectURL(item.previewUrl)); stagedFiles.value = []; };
async function compressImageToTargetSize(file, targetSizeKB = 150, maxWidth = 1920) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => { const scale = Math.min(1, maxWidth / img.width); const canvas = document.createElement("canvas"); canvas.width = img.width * scale; canvas.height = img.height * scale; const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); let quality = 0.8; const attemptCompression = (q) => { canvas.toBlob( (blob) => { if (!blob) { return reject(new Error('Canvas to Blob conversion failed')); } if (blob.size / 1024 <= targetSizeKB || q <= 0.4) { resolve(blob); } else { attemptCompression(q - 0.1); } }, "image/jpeg", q ); }; attemptCompression(quality); }; img.onerror = (err) => reject(err); img.src = event.target.result; }; reader.onerror = (err) => reject(err); reader.readAsDataURL(file); }); }
const handleGeneralFileDrop = (event) => { isDragOver.value = false; const files = event.dataTransfer.files; if (files) { generalFilesToUpload.value.push(...Array.from(files)); } };
const handleGeneralFileSelection = (event) => { const files = event.target.files; if (files) { generalFilesToUpload.value.push(...Array.from(files)); } event.target.value = ''; };
const removeGeneralFile = (index) => { generalFilesToUpload.value.splice(index, 1); };
const uploadGeneralFiles = async () => { isUploadingGeneralFiles.value = true; uploadLog.value.push({ type: 'info', message: '🚀 Starting general file uploads...' }); const metadata = { customMetadata: { uploaderEmail: user.value?.email || 'unknown' } }; for (const file of generalFilesToUpload.value) { const fileName = `files/${Date.now()}_${file.name}`; uploadLog.value.push({ type: 'info', message: `Uploading ${file.name}...` }); try { await uploadBytes(storageRef(storage, fileName), file, metadata); uploadLog.value.push({ type: 'success', message: `✅ Uploaded ${file.name}` }); } catch (error) { console.error("General upload failed for", file.name, error); uploadLog.value.push({ type: 'error', message: `❌ Failed ${file.name}` }); } } isUploadingGeneralFiles.value = false; uploadLog.value.push({ type: 'info', message: '🏁 All general file uploads finished.' }); generalFilesToUpload.value = []; };
</script>

<style scoped>
/* Main Layout & Header */
h2 { margin-bottom: 0.5rem; }
p { margin-top: 0; color: var(--text-secondary); }
/* /src/views/Upload.vue */
.actions-header {
  display: flex;
  /* NEW: Use a gap for spacing instead of justify-content: space-between */
  gap: 1rem;
  align-items: center; /* This vertically aligns the items */
  padding: 1rem;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 1.5rem;
}
.file-staging-area { margin-top: 1.5rem; min-height: 40vh; }
.empty-state { display: flex; justify-content: center; align-items: center; height: 100%; min-height: 30vh; color: var(--text-secondary); border: 2px dashed var(--border-color); border-radius: 8px; }
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
.card { margin-bottom: 2rem; }

/* File Card */
.file-card { background-color: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
.card-preview { position: relative; width: 100%; aspect-ratio: 16 / 10; background-color: var(--background-primary); }
.card-preview img { width: 100%; height: 100%; object-fit: cover; }
.remove-btn-corner { position: absolute; top: 8px; right: 8px; z-index: 10; width: 30px; height: 30px; border-radius: 50%; background: rgba(0,0,0,0.6); border: none; color: white; font-size: 1.2rem; line-height: 1; cursor: pointer; display: grid; place-content: center; transition: background-color 0.2s, transform 0.2s; }
.remove-btn-corner:hover { background: var(--error-color); transform: scale(1.1); }
.card-body { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }

/* NEW Preview Overlay Styles */
.preview-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.3s ease; display: flex; justify-content: center; align-items: center; gap: 1rem; }
.file-card:hover .preview-overlay { opacity: 1; }
.overlay-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: rgba(30,30,30,0.8); color: white; font-size: 1.2rem; cursor: pointer; display: grid; place-content: center; transition: transform 0.2s, background-color 0.2s; }
.overlay-btn:hover { transform: scale(1.1); background: var(--accent-primary); }

/* Filename Editing Styles */
.filename-container { display: flex; align-items: center; gap: 0.25rem; }
.filename-display, .filename-edit { display: flex; align-items: center; width: 100%; }
.filename-display span:first-child { font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.file-ext { color: var(--text-secondary); margin-left: 0.25rem; flex-shrink: 0; }
.edit-name-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary); margin-left: auto; padding: 0.25rem; border-radius: 4px; }
.edit-name-btn:hover { background-color: var(--border-color); }
.filename-edit input { width: 100%; background-color: var(--background-primary); border: 1px solid var(--accent-primary); border-radius: 4px; color: var(--text-primary); padding: 0.25rem 0.5rem; outline: none; }

/* Meta & Status Log */
.card-meta { display: flex; flex-direction: column; gap: 0.75rem; }
.timestamp-btn { background-color: #4a4a52; border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.6rem 1rem; border-radius: 6px; cursor: pointer; text-align: left; font-family: inherit; font-size: 0.95rem; transition: background-color 0.2s, border-color 0.2s; }
.timestamp-btn:hover { background-color: #5a5a64; border-color: #6a6a72; }
textarea { background-color: var(--background-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: inherit; padding: 0.5rem 0.75rem; resize: vertical; min-height: 50px; }
textarea:focus { outline: none; border-color: var(--accent-primary); }
.status-container { margin-top: 2rem; }
h4 { border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; }
.status-log { background-color: var(--background-secondary); border-radius: 8px; padding: 0.5rem 1.5rem; max-height: 200px; overflow-y: auto; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; }
.grid-enter-active, .grid-leave-active { transition: all 0.4s ease; }
.grid-enter-from, .grid-leave-to { opacity: 0; transform: scale(0.9); }
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(20px); }

/* General Uploader Styles */
.drop-zone { margin-top: 1.5rem; border: 2px dashed var(--border-color); border-radius: 12px; padding: 2rem; transition: border-color 0.2s, background-color 0.2s; background-color: var(--background-secondary); }
.drop-zone.is-dragover { border-color: var(--accent-primary); background-color: #313138; }
.drop-zone-prompt { display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center; color: var(--text-secondary); }
.general-file-list-container { max-height: 300px; overflow-y: auto; }
.general-file-list { list-style: none; padding: 0; margin: 0; }
.general-file-list li { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; border-radius: 6px; background-color: #313138; }
.general-file-list li:not(:last-child) { margin-bottom: 0.5rem; }
.file-icon { font-size: 1.5rem; }
.general-file-info { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
.general-file-info span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.general-file-info small { color: var(--text-secondary); }
.remove-btn-simple { background: none; border: none; color: var(--text-secondary); font-size: 1.2rem; cursor: pointer; padding: 0 0.5rem; border-radius: 4px; }
.remove-btn-simple:hover { background-color: var(--error-color); color: white; }
.actions-footer { display: flex; justify-content: flex-end; margin-top: 1.5rem; }
</style>