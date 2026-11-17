<script setup lang="ts">
import Dialog from 'primevue/dialog'
import type { ProfileDeletionPlan } from '@/application/profiles/profileDeletion'
defineProps<{ plan: ProfileDeletionPlan; includeParents: boolean; hasParents: boolean; busy: boolean }>()
const emit = defineEmits<{ close: []; confirm: []; 'update:includeParents': [value: boolean] }>()
</script>
<template>
  <Dialog :visible="true" modal header="Delete profiles" :style="{ width: 'min(420px, 94vw)' }" @update:visible="!$event && emit('close')">
    <div class="profile-deletion">
      <label v-if="hasParents" class="profile-deletion__parents"><input type="checkbox" :checked="includeParents" @change="emit('update:includeParents', ($event.target as HTMLInputElement).checked)" /> Also delete inherited parent profiles</label>
      <p>{{ plan.deleted.length }} {{ plan.deleted.length === 1 ? 'profile' : 'profiles' }} will be deleted.</p>
      <p v-if="plan.skipped.length" class="profile-deletion__kept">{{ plan.skipped.length }} {{ plan.skipped.length === 1 ? 'profile is' : 'profiles are' }} kept because of locked profiles or references.</p>
    </div>
    <template #footer><button type="button" class="profile-deletion__cancel" @click="emit('close')">Cancel</button><button type="button" class="profile-deletion__delete" :disabled="!plan.deleted.length || busy" @click="emit('confirm')">Delete {{ plan.deleted.length }} {{ plan.deleted.length === 1 ? 'profile' : 'profiles' }}</button></template>
  </Dialog>
</template>
<style scoped>
.profile-deletion { display: flex; flex-direction: column; gap: 12px; color: var(--color-text); font-size: 0.85rem; }
.profile-deletion p { margin: 0; line-height: 1.5; }
.profile-deletion__kept { color: var(--color-text-muted); }
.profile-deletion__parents { display: flex; gap: 8px; align-items: center; }
.profile-deletion__parents input { accent-color: var(--color-primary); }
.profile-deletion__cancel, .profile-deletion__delete { padding: 8px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; cursor: pointer; }
.profile-deletion__delete { color: white; background: #b42323; border-color: #b42323; }
.profile-deletion__delete:disabled { opacity: 0.5; cursor: default; }
</style>
