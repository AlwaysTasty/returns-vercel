<template>
  <div class="app-wrapper">
    <AppHeader />
    <Navigation />
    <main class="content-wrapper">
      <router-view v-slot="{ Component, route }">
        <!-- The key triggers the re-render, and v-motion handles the animation -->
        <div :key="route.path" v-motion-fade-visible-once>
          <component :is="Component" />
        </div>
      </router-view>
    </main>
  </div>
</template>

<script setup>
// No motion-related imports are needed here anymore!
import AppHeader from '../components/AppHeader.vue';
import Navigation from '../components/Navigation.vue';
</script>

<style scoped>
.content-wrapper {
  margin-top: 1.5rem;
}
</style>