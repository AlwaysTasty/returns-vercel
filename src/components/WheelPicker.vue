<template>
  <div 
    class="wheel-wrapper" 
    ref="wrapperRef"
    @mousedown.prevent="onMouseDown"
    @touchstart.prevent="onTouchStart"
  >
    <div class="selection-indicator"></div>
    <div 
      class="wheel-list" 
      :style="wheelStyle" 
      :class="{ 'is-dragging': isDragging }"
    >
      <div 
        v-for="(item, index) in items" 
        :key="index"
        class="wheel-item"
      >
        {{ item.label }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
const ITEM_HEIGHT = 40;

const props = defineProps({
  items: { type: Array, required: true },
  modelValue: { required: true },
});
const emit = defineEmits(['update:modelValue']);

const currentY = ref(0);
const isDragging = ref(false);
const startDragY = ref(0);
const startY = ref(0);

const findInitialY = () => {
  const selectedIndex = props.items.findIndex(item => item.value === props.modelValue);
  return selectedIndex > -1 ? -selectedIndex * ITEM_HEIGHT : 0;
};
currentY.value = findInitialY();

watch(() => props.modelValue, () => {
  if (!isDragging.value) {
    currentY.value = findInitialY();
  }
});

const wheelStyle = computed(() => ({
  transform: `translateY(${currentY.value}px)`,
  transition: isDragging.value ? 'none' : 'transform 0.2s ease-out',
}));

const onMouseDown = (e) => startDrag(e.clientY);
const onTouchStart = (e) => startDrag(e.touches[0].clientY);

function startDrag(y) {
  isDragging.value = true;
  startDragY.value = y;
  startY.value = currentY.value;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('touchmove', onTouchMove);
  window.addEventListener('touchend', onTouchEnd);
}

const onMouseMove = (e) => drag(e.clientY);
const onTouchMove = (e) => drag(e.touches[0].clientY);

function drag(y) {
  if (!isDragging.value) return;
  const delta = y - startDragY.value;
  currentY.value = startY.value + delta;
}

const onMouseUp = () => endDrag();
const onTouchEnd = () => endDrag();

function endDrag() {
  if (!isDragging.value) return;
  isDragging.value = false;
  snapToValue();
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
}

function snapToValue() {
  const closestIndex = Math.round(-currentY.value / ITEM_HEIGHT);
  const targetIndex = Math.max(0, Math.min(props.items.length - 1, closestIndex));
  
  if (props.items[targetIndex]) {
    emit('update:modelValue', props.items[targetIndex].value);
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
});

</script>


<style scoped>
.wheel-wrapper {
  height: 200px; /* 5 items * 40px */
  overflow: hidden;
  position: relative;
  cursor: grab;
  touch-action: none; /* Prevents page scroll on touch devices */
}
.wheel-wrapper:active {
  cursor: grabbing;
}
.selection-indicator {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 40px;
  left: 0;
  right: 0;
  background-color: rgba(0, 120, 212, 0.15);
  border-top: 1px solid var(--accent-primary);
  border-bottom: 1px solid var(--accent-primary);
  pointer-events: none;
  z-index: 2;
}
.wheel-wrapper::before, .wheel-wrapper::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 80px; /* 2 items height */
  background: linear-gradient(to bottom, var(--background-secondary) 10%, transparent 100%);
  z-index: 1;
  pointer-events: none;
}
.wheel-wrapper::after {
  top: auto;
  bottom: 0;
  background: linear-gradient(to top, var(--background-secondary) 10%, transparent 100%);
}
.wheel-wrapper::before { top: 0; }

.wheel-list {
  /* This padding centers the list vertically within the 200px container */
  padding-top: 80px;
  padding-bottom: 80px;
}
.wheel-item {
  height: 40px;
  line-height: 40px;
  text-align: center;
  font-size: 1.1rem;
  color: var(--text-primary);
}
</style>