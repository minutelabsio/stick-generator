import { createRouter, createWebHistory } from 'vue-router'
import BatchView from './views/batch-view.vue'
import BatchesView from './views/batches-view.vue'
import ChannelsView from './views/channels-view.vue'
import EntryEditorView from './views/entry-editor-view.vue'
import HomeView from './views/home-view.vue'
import IntakeFormView from './views/intake-form-view.vue'
import JoinView from './views/join-view.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/channels', name: 'channels', component: ChannelsView },
    { path: '/c/:channelSlug', name: 'batches', component: BatchesView, props: true },
    { path: '/c/:channelSlug/intake', name: 'intake', component: IntakeFormView, props: true },
    { path: '/batches/:batchId', name: 'batch', component: BatchView, props: true },
    { path: '/entries/:entryId', name: 'entry', component: EntryEditorView, props: true },
    { path: '/join', name: 'join', component: JoinView },
  ],
})
