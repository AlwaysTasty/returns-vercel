<template>
  <button
    class="btn"
    :class="btnClass"
    v-motion
    :initial="{ scale: 1 }"
    :hovered="{ scale: 1.05 }"
    :tapped="{ scale: 0.95 }"
  >
    <!-- The <slot> is a placeholder where the button's text or icon will go -->
    <slot/>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // We accept a 'variant' prop to determine the button's color and style
  variant: {
    type: String,
    default: 'primary', // 'primary', 'secondary', 'danger', etc.
  },
});

// A computed property to dynamically apply the correct class
const btnClass = computed(() => {
  return `btn-${props.variant}`;
});
</script>

<style scoped>
/*
  These are styles that are SPECIFIC to the button component itself.
  Global button styles (like .btn, .btn-primary) should remain in main.css
*/

/* We can add a transition specifically for the transform property
   to make the v-motion animation even smoother. */
.btn {
  transition: transform 0.1s ease-out;
}
</style>