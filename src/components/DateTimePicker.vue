<template>
  <transition name="modal-fade">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Set Timestamp</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

        <div class="picker-body">
          <WheelPicker 
            class="wheel-date" 
            :items="dateItems" 
            v-model="selectedDate" 
          />
          <WheelPicker 
            class="wheel-hour"
            :items="hourItems" 
            v-model="selectedHour" 
          />
          <WheelPicker 
            class="wheel-minute"
            :items="minuteItems" 
            v-model="selectedMinute" 
          />
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" @click="save">Save</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue';
import WheelPicker from './WheelPicker.vue';

const props = defineProps({
  initialDate: { type: Date, required: true },
});
const emit = defineEmits(['close', 'update']);

// --- State for individual pickers ---
const selectedDate = ref(props.initialDate.toISOString().split('T')[0]); // YYYY-MM-DD
const selectedHour = ref(props.initialDate.getHours());
const selectedMinute = ref(props.initialDate.getMinutes());

// --- Generate items for each wheel ---
const dateItems = computed(() => {
  const items = [];
  const today = new Date();
  // Generate dates from 1 year ago to 1 year from now
  for (let i = -365; i <= 365; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    const value = d.toISOString().split('T')[0];
    let label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (value === today.toISOString().split('T')[0]) {
      label = `Today, ${label}`;
    }
    items.push({ label, value });
  }
  return items;
});

const hourItems = computed(() => 
  Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, '0'), value: i }))
);

const minuteItems = computed(() => 
  Array.from({ length: 60 }, (_, i) => ({ label: String(i).padStart(2, '0'), value: i }))
);

// --- Save Action ---
function save() {
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  // Reconstruct date from parts
  const newDate = new Date(year, month - 1, day, selectedHour.value, selectedMinute.value);
  emit('update', newDate);
  emit('close');
}
</script>

<style scoped>
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background-color: var(--background-secondary); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 90%; max-width: 500px; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); }
.modal-header h3 { margin: 0; }
.close-btn { background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; }

.picker-body {
  padding: 1rem;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}
.wheel-date { flex-grow: 2; }
.wheel-hour { flex-grow: 1; }
.wheel-minute { flex-grow: 1; }

.modal-footer { display: flex; justify-content: flex-end; gap: 1rem; padding: 1rem 1.5rem; background-color: #313138; border-top: 1px solid var(--border-color); border-radius: 0 0 12px 12px; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.95); }
</style>