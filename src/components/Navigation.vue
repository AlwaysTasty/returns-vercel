<template>
  <nav class="nav-links">
    <RouterLink to="/returns">Returns</RouterLink>
    <RouterLink to="/upload">Upload</RouterLink>
    <RouterLink to="/download">Download</RouterLink>
    <RouterLink to="/files">Files</RouterLink>
    <RouterLink to="/archive">Archive</RouterLink>
    <RouterLink to="/settings">Settings</RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.nav-links a {
  color: #e0e0e0;
  text-decoration: none;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  transition: all 0.15s ease;
  font-weight: 500;
  position: relative;
  overflow: hidden;
}

.nav-links a:hover {
  background-color: #3a3a44;
  color: #ffffff;
}

.nav-links a.router-link-exact-active {
  background-color: var(--accent-primary);
  color: var(--text-primary);
  box-shadow: 0 4px 14px var(--accent-primary-glow);
}
</style>