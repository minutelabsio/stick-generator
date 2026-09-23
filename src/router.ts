import { createRouter, createWebHistory } from 'vue-router'
import BatchView from './views/batch-view.vue'
import BatchesView from './views/batches-view.vue'
import EntryEditorView from './views/entry-editor-view.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'batches', component: BatchesView },
    { path: '/batches/:batchId', name: 'batch', component: BatchView, props: true },
    { path: '/entries/:entryId', name: 'entry', component: EntryEditorView, props: true },
  ],
})
