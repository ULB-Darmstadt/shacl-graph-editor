import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * Application has main views for prepare, review, analyze, and publish:
 *   - /prepare: unified setup canvas for sources, mapping, and schema work
 *   - /review:  list/card browser over generated RDF subjects
 *   - /analyze: SHACL-guided chart builder over generated RDF subjects
 *   - /publish: RO-Crate metadata + publish workflow
 */
export const APP_MODES = [
  { key: 'prepare', label: 'Prepare', icon: 'pi pi-share-alt', path: '/prepare' },
  { key: 'review', label: 'Review', icon: 'pi pi-th-large', path: '/review' },
  { key: 'analyze', label: 'Analyze', icon: 'pi pi-chart-bar', path: '/analyze' },
  { key: 'publish', label: 'Publish', icon: 'pi pi-download', path: '/publish' },
] as const

export type AppModeKey = (typeof APP_MODES)[number]['key']

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/prepare' },
  {
    path: '/prepare',
    name: 'prepare',
    component: () => import('@/views/PrepareView.vue'),
  },
  {
    path: '/review',
    name: 'review',
    component: () => import('@/views/ReviewView.vue'),
  },
  {
    path: '/publish',
    name: 'publish',
    component: () => import('@/views/PublishView.vue'),
  },
  {
    path: '/analyze',
    name: 'analyze',
    component: () => import('@/views/AnalyzeView.vue'),
  },
  // Backwards-compat redirects
  { path: '/setup', redirect: '/prepare' },
  { path: '/mapping', redirect: '/prepare' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})


