<template>
  <transition name="modal-fade">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Crop Image</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

        <div class="cropper-container">
          <Cropper
            ref="cropperRef"
            class="cropper"
            :src="src"
            :stencil-props="{
              aspectRatio: 16/10
            }"
          />
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" @click="cropAndSave">Apply Crop</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css'; // Import the library's CSS

const props = defineProps({
  src: { type: String, required: true },
});
const emit = defineEmits(['close', 'crop']);

const cropperRef = ref(null);

const cropAndSave = () => {
  if (cropperRef.value) {
    const { blob } = cropperRef.value.getResult();
    if (blob) {
      // Emit the cropped image data (as a Blob) back to the parent
      emit('crop', blob);
      emit('close');
    }
  }
};
</script>

<style scoped>
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background-color: var(--background-card); border-radius: 12px; width: 90vw; max-width: 600px; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); }
.modal-header h3 { margin: 0; }
.close-btn { background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; }
.cropper-container { height: 60vh; max-height: 500px; width: 100%; background-color: var(--background-primary); }
.cropper { height: 100%; width: 100%; }
.modal-footer { display: flex; justify-content: flex-end; gap: 1rem; padding: 1rem 1.5rem; background-color: #313138; border-top: 1px solid var(--border-color); border-radius: 0 0 12px 12px; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.95); }
</style>