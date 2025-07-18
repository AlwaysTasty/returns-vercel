<template>
  <div class="tiptap-wrapper">
    <editor-content :editor="editor" />
  </div>
</template>

<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
});
const emit = defineEmits(['update:modelValue']);

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Start typing your note...',
    }),
  ],
  onUpdate: () => {
    emit('update:modelValue', editor.value.getHTML());
  },
  editorProps: {
    attributes: {
      class: 'prose-mirror-editor',
    },
  },
});

// Watch for external changes to the note content (e.g., when a different note is selected)
watch(() => props.modelValue, (newValue) => {
  if (editor.value && editor.value.getHTML() !== newValue) {
    editor.value.commands.setContent(newValue, false);
  }
});
</script>

<style>
/* These styles need to be GLOBAL to properly style Tiptap's injected HTML.
   Place them in /src/assets/main.css or use <style> without "scoped" here. */
.tiptap-wrapper {
  background-color: var(--background-primary);
  color: var(--text-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  padding: 1rem;
}

.ProseMirror:focus {
  outline: none;
}

.prose-mirror-editor {
  min-height: 200px;
}
.prose-mirror-editor p {
  margin: 0;
}
.prose-mirror-editor p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-secondary);
  pointer-events: none;
  height: 0;
}
</style>
