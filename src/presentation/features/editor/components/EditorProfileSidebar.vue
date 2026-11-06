<script lang="ts">
import type { AimsProfileBadge } from '@/infrastructure/external/aimsProfileService'

export interface CanvasProfileSidebarItem {
  shapeIri: string
  label: string
  description: string | null
  isDraft: boolean
  badges: AimsProfileBadge[]
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ items: CanvasProfileSidebarItem[]; selectedShapeIri: string | null }>()
const emit = defineEmits<{
  (event: 'select', item: CanvasProfileSidebarItem): void
  (event: 'highlight', shapeIri: string | null): void
  (event: 'contextmenu', item: CanvasProfileSidebarItem, mouseEvent: MouseEvent): void
}>()
const search = ref('')
const filtered = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase()
  return props.items.filter(item => !needle || [item.label, item.description, item.shapeIri, ...item.badges.map(badge => badge.label)]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle))
})
const groups = computed(() => [
  { label: 'Drafts', items: filtered.value.filter(item => item.isDraft) },
  { label: 'Existing', items: filtered.value.filter(item => !item.isDraft) },
])
</script>

<template>
  <aside class="profile-sidebar" aria-label="Profiles on canvas">
    <label class="profile-sidebar__search">
      <i class="pi pi-search" aria-hidden="true" />
      <input v-model="search" type="search" placeholder="Search profiles" aria-label="Search profiles on canvas" />
    </label>
    <div class="profile-sidebar__groups">
      <p v-if="search.trim() && !filtered.length" class="profile-sidebar__empty">No profiles match your search.</p>
      <section v-for="group in groups" :key="group.label" class="profile-sidebar__group" :aria-label="group.label">
        <h2 class="profile-sidebar__heading">{{ group.label }} <span>{{ group.items.length }}</span></h2>
        <p v-if="!group.items.length" class="profile-sidebar__empty">{{ group.label === 'Drafts' ? 'No draft profiles.' : 'No existing profiles.' }}</p>
        <button
          v-for="item in group.items"
          :key="item.shapeIri"
          type="button"
          class="profile-sidebar__item"
          :class="{ 'is-selected': selectedShapeIri === item.shapeIri }"
          :aria-current="selectedShapeIri === item.shapeIri ? 'true' : undefined"
          :title="`${item.label}\n${item.shapeIri}`"
          @mouseenter="emit('highlight', item.shapeIri)"
          @mouseleave="emit('highlight', null)"
          @focus="emit('highlight', item.shapeIri)"
          @blur="emit('highlight', null)"
          @click="emit('select', item)"
          @contextmenu.stop.prevent="emit('contextmenu', item, $event)"
        >
          <span class="profile-sidebar__text">
            <span class="profile-sidebar__name">{{ item.label }}</span>
            <span v-if="item.description" class="profile-sidebar__description">{{ item.description }}</span>
          </span>
          <span v-if="item.badges.length" class="profile-sidebar__badges">
            <span
              v-for="badge in item.badges"
              :key="badge.label"
              class="profile-sidebar__badge"
              :title="`Approved by ${badge.label} — NFDI4ING Metadata Profile Service`"
              :aria-label="`Approved by ${badge.label}`"
            >{{ badge.label }}</span>
          </span>
        </button>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.profile-sidebar { display: flex; flex-direction: column; flex: 0 0 240px; width: 240px; max-width: 35vw; min-width: 160px; min-height: 0; border-right: 1px solid var(--color-border); background: var(--color-surface); }
.profile-sidebar__search { display: flex; align-items: center; gap: 8px; margin: 14px 12px 8px; padding: 7px 9px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-muted); font-size: 0.78rem; }
.profile-sidebar__search:focus-within { border-color: var(--color-primary); }
.profile-sidebar__search input { width: 100%; min-width: 0; padding: 0; border: 0; outline: none; background: transparent; color: var(--color-text); font: inherit; }
.profile-sidebar__groups { flex: 1; min-height: 0; overflow: auto; padding: 4px 8px 16px; }
.profile-sidebar__group + .profile-sidebar__group { margin-top: 18px; }
.profile-sidebar__heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 10px 8px 6px; color: var(--color-text-muted); font-size: 0.78rem; font-weight: 600; }
.profile-sidebar__heading span { font-size: 0.72rem; font-weight: 400; }
.profile-sidebar__item { display: flex; align-items: flex-start; gap: 8px; width: 100%; padding: 9px 10px; border: 0; border-left: 2px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--color-text); font: inherit; text-align: left; cursor: pointer; }
.profile-sidebar__text { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.profile-sidebar__badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: 45%; flex-shrink: 0; margin-left: auto; }
.profile-sidebar__badge { padding: 1px 5px; border: 1px solid var(--color-border-strong); border-radius: 3px; background: var(--color-primary-soft); color: var(--color-primary); font-size: 0.65rem; line-height: 1.4; overflow-wrap: anywhere; }
.profile-sidebar__item:hover { background: var(--color-surface-2); }
.profile-sidebar__item.is-selected { border-left-color: var(--color-primary); background: var(--color-primary-soft); }
.profile-sidebar__item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.profile-sidebar__name { font-size: 0.83rem; line-height: 1.4; overflow-wrap: anywhere; }
.profile-sidebar__description { overflow: hidden; max-width: 100%; color: var(--color-text-muted); font-size: 0.72rem; line-height: 1.4; white-space: nowrap; text-overflow: ellipsis; }
.profile-sidebar__empty { margin: 8px; color: var(--color-text-muted); font-size: 0.75rem; line-height: 1.5; }
@media (max-width: 720px) { .profile-sidebar { flex-basis: 180px; width: 180px; } }
</style>
