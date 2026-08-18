<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { loadAimsProfiles, fetchAimsProfileTurtle, type AimsProfile } from '@/infrastructure/external/aimsProfileService'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'

const emit = defineEmits<{ added: [] }>()

const toast = useToast()
const profileStore = useProfileEditorStore()

const profiles = ref<AimsProfile[]>([])
const search = ref('')
const isLoading = ref(false)
const submittingProfileUrl = ref<string | null>(null)
const error = ref<string | null>(null)

const filteredProfiles = computed(() => {
  const needle = search.value.trim().toLowerCase()
  if (!needle) return profiles.value
  return profiles.value.filter(profile => {
    const haystack = [profile.name, profile.description, profile.creator]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
})

async function loadProfiles(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    profiles.value = await loadAimsProfiles()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

async function addProfile(profile: AimsProfile): Promise<void> {
  submittingProfileUrl.value = profile.base_url
  error.value = null
  try {
    const turtle = await fetchAimsProfileTurtle(profile)
    await profileStore.addProfileFromTurtle(turtle, `${profile.name}.ttl`, profile.base_url)
    toast.add({
      severity: 'success',
      summary: 'Profile loaded',
      detail: `${profile.name} was loaded from the NFDI4ING Metadata Profile Service.`,
      life: 3500,
    })
    if (profileStore.lastResolveErrors.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Some imports were not resolved',
        detail: profileStore.lastResolveErrorsSummary,
        life: 9000,
      })
    }
    emit('added')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    submittingProfileUrl.value = null
  }
}

onMounted(() => { void loadProfiles() })
</script>

<template>
  <div class="aims-profile-panel">
    <div class="toolbar">
      <label class="field field-stack search-field">
        <span>Search NFDI4ING Metadata Profile Service</span>
        <input v-model="search" class="profile-search-input" type="search" placeholder="Search profiles" />
      </label>
    </div>

    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>

    <div class="list-shell">
      <aside class="profile-list" :class="{ loading: isLoading }">
        <button
          v-for="profile in filteredProfiles"
          :key="profile.base_url"
          class="profile-option"
          :class="{ loading: submittingProfileUrl === profile.base_url }"
          :disabled="submittingProfileUrl !== null"
          @click="addProfile(profile)"
        >
          <span class="profile-option__main">
            <strong>{{ profile.name }}</strong>
            <i v-if="submittingProfileUrl === profile.base_url" class="pi pi-spin pi-spinner" />
          </span>
          <span class="profile-option__description">{{ profile.description || profile.base_url }}</span>
        </button>
        <div v-if="!isLoading && filteredProfiles.length === 0" class="empty-list">
          No matching profiles found.
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.aims-profile-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.search-field {
  min-width: min(460px, 100%);
  flex: 1;
}

.profile-search-input {
  width: 100%;
  min-height: 36px;
  padding: 8px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-1);
  color: var(--color-text);
  font: inherit;
  outline: none;
}

.profile-search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
}

.list-shell {
  min-height: 0;
  flex: 1;
  padding: 0;
}

.profile-list {
  height: 100%;
  overflow: auto;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profile-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;

  strong {
    font-size: 0.95rem;
  }

  &:hover {
    background: var(--color-surface-1);
    box-shadow: var(--shadow-sm);
  }

  &.loading {
    border-color: var(--color-accent);
    background: rgba(99, 102, 241, 0.06);
  }

  &:disabled {
    cursor: wait;
  }
}

.profile-option__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-text);
}

.profile-option__description {
  color: var(--color-text-muted);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.empty-list {
  margin: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  text-align: center;
}
</style>
