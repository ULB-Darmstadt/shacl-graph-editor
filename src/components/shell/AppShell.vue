<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { APP_MODES } from '@/router'

const route = useRoute()
const router = useRouter()

const activeMode = computed(() => route.name as string)

function go(modeKey: string): void {
  router.push(`/${modeKey}`)
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <i class="pi pi-sitemap brand-icon" />
        <div>
          <div class="brand-title">Architectural RDM-Pipeline</div>
        </div>
      </div>

      <nav class="tabs">
        <button
          v-for="mode in APP_MODES"
          :key="mode.key"
          class="tab"
          :class="{ active: activeMode === mode.key }"
          @click="go(mode.key)"
        >
          <i :class="mode.icon" />
          <span>{{ mode.label }}</span>
        </button>
      </nav>
    </header>

    <main class="app-main">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  .brand-icon { font-size: 1.5rem; color: var(--color-primary); }
  .brand-title { font-weight: 700; font-size: 1.05rem; }
}

.tabs {
  display: flex;
  gap: var(--space-1);
  background: var(--color-bg);
  padding: var(--space-1);
  border-radius: var(--radius-md);
}

.tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  transition: all 0.15s ease;

  &:hover { background: var(--color-surface); color: var(--color-text); }

  &.active {
    background: var(--color-primary);
    color: white;
  }
}

.app-main {
  flex: 1;
  overflow: auto;
}
</style>


