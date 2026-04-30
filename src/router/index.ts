import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * Application has two main views:
 *   - /app:    unified mapping canvas (setup + mapping + export combined)
 *   - /browse: list/card browser over generated RDF subjects (auto-validates)
 */
export const APP_MODES = [
  { key: 'app',    label: 'Mapping', icon: 'pi pi-share-alt', path: '/app' },
  { key: 'browse', label: 'Browse',  icon: 'pi pi-th-large',  path: '/browse' },
] as const

export type AppModeKey = (typeof APP_MODES)[number]['key']

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/app' },
  {
    path: '/app',
    name: 'app',
    component: () => import('@/views/AppView.vue'),
  },
  {
    path: '/browse',
    name: 'browse',
    component: () => import('@/views/BrowseView.vue'),
  },
  // Backwards-compat redirects
  { path: '/setup', redirect: '/app' },
  { path: '/mapping', redirect: '/app' },
  { path: '/export', redirect: '/app' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
