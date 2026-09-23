<script setup lang="ts">
import Toast from 'primevue/toast'
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
const isPublicPage = computed(() => route.meta.public === true)
</script>

<template>
  <Toast />
  <header
    v-if="!isPublicPage"
    class="top-bar"
  >
    <RouterLink
      to="/"
      class="brand"
    >
      Stick Generator
    </RouterLink>
  </header>
  <RouterView />
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #1f1f1f;
}

.brand {
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}
</style>
