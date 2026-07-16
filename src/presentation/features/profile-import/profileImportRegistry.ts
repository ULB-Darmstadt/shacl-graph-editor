import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
const AimsProfileCatalogPanel = defineAsyncComponent(() => import('@/presentation/features/profile-import/components/AimsProfileCatalogPanel.vue'))

export type ProfileImportDialogId = string

export interface ProfileImportDialogPayload {
  nodeId?: string
}

export interface ProfileImportDialogDefinition {
  id: ProfileImportDialogId
  header: string
  width: string
  component: Component
  buildProps?: (payload?: ProfileImportDialogPayload) => Record<string, unknown>
}

export interface ProfileImportSourceDefinition {
  id: string
  label: string
  icon: string
  action: 'upload-files' | 'open-dialog'
  dialogId?: ProfileImportDialogId
}

const dialogDefinitions: ProfileImportDialogDefinition[] = [
  {
    id: 'aims-profile-catalog',
    header: 'Load SHACL Profile from Metadata Profile Service',
    width: 'min(1200px, 96vw)',
    component: AimsProfileCatalogPanel,
  },
]

export const profileImportSources: ProfileImportSourceDefinition[] = [
  {
    id: 'ttl-upload',
    label: 'Upload TTL file',
    icon: 'pi pi-file-import',
    action: 'upload-files',
  },
  {
    id: 'aims-profile-service',
    label: 'Metadata Profile Service',
    icon: 'pi pi-server',
    action: 'open-dialog',
    dialogId: 'aims-profile-catalog',
  },
]

export function getProfileImportDialogDefinition(dialogId: ProfileImportDialogId | null): ProfileImportDialogDefinition | null {
  if (!dialogId) return null
  return dialogDefinitions.find(definition => definition.id === dialogId) ?? null
}
