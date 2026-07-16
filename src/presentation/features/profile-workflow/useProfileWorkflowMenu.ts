import { computed, ref } from 'vue'
import {
  getProfileImportDialogDefinition,
  profileImportSources,
  type ProfileImportDialogId,
  type ProfileImportDialogPayload,
} from '@/presentation/features/profile-import/profileImportRegistry'
import { downloadProfilesAsTurtle } from '@/application/profiles/useCases/exportShaclProfiles'
import type { useProfileEditorStore } from '@/application/profiles/profileEditorStore'

type ProfileStore = ReturnType<typeof useProfileEditorStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface ConfirmLike {
  require(options: {
    header: string
    message: string
    icon?: string
    acceptLabel?: string
    rejectLabel?: string
    acceptClass?: string
    accept: () => void
  }): void
}

interface UseProfileWorkflowMenuOptions {
  profileStore: ProfileStore
  toast: ToastLike
  confirm: ConfirmLike
  resetUiState?: () => void
}

export function useProfileWorkflowMenu(options: UseProfileWorkflowMenuOptions) {
  const schemaInputRef = ref<HTMLInputElement | null>(null)
  const activeImportDialogId = ref<ProfileImportDialogId | null>(null)
  const activeImportDialogPayload = ref<ProfileImportDialogPayload | undefined>(undefined)
  const activeImportDialogKey = ref(0)

  function triggerSchemaUpload(): void {
    schemaInputRef.value?.click()
  }

  function openImportDialog(dialogId: ProfileImportDialogId, payload?: ProfileImportDialogPayload): void {
    activeImportDialogId.value = dialogId
    activeImportDialogPayload.value = payload
    activeImportDialogKey.value += 1
  }

  function closeImportDialog(): void {
    activeImportDialogId.value = null
    activeImportDialogPayload.value = undefined
  }

  async function onSchemaFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    const files = Array.from(input.files)
    try {
      await options.profileStore.addTurtleFiles(files)
      options.toast.add({
        severity: 'success',
        summary: 'Profiles loaded',
        detail: `${files.length} TTL file(s) added.`,
        life: 3000,
      })
      if (options.profileStore.lastResolveErrors.length > 0) {
        options.toast.add({
          severity: 'warn',
          summary: 'Some imports were not resolved',
          detail: options.profileStore.lastResolveErrorsSummary,
          life: 9000,
        })
      }
    } catch (error) {
      options.toast.add({
        severity: 'error',
        summary: 'Parse error',
        detail: error instanceof Error ? error.message : String(error),
        life: 5000,
      })
    } finally {
      input.value = ''
    }
  }

  function exportProfiles(): void {
    const filename = downloadProfilesAsTurtle(options.profileStore.profiles, 'shacl-profile-set')
    options.toast.add({
      severity: 'success',
      summary: 'SHACL exported',
      detail: `Saved as ${filename}.`,
      life: 3000,
    })
  }

  function confirmResetAll(): void {
    options.confirm.require({
      header: 'Reset editor',
      message: 'Alle geladenen SHACL-Profile werden aus dem Editor entfernt.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Reset',
      rejectLabel: 'Cancel',
      acceptClass: 'p-button-danger',
      accept: () => {
        options.resetUiState?.()
        options.profileStore.reset()
      },
    })
  }

  const activeImportDialogDefinition = computed(() => getProfileImportDialogDefinition(activeImportDialogId.value))
  const activeImportDialogVisible = computed({
    get: () => activeImportDialogId.value !== null,
    set: visible => {
      if (!visible) closeImportDialog()
    },
  })
  const activeImportDialogProps = computed(() =>
    activeImportDialogDefinition.value?.buildProps?.(activeImportDialogPayload.value) ?? {},
  )

  const menuItems = computed(() => [
    {
      label: 'Profiles',
      icon: 'pi pi-bookmark',
      items: profileImportSources.map(source => ({
        label: source.label,
        icon: source.icon,
        command: () => {
          if (source.action === 'upload-files') {
            triggerSchemaUpload()
            return
          }
          if (source.dialogId) openImportDialog(source.dialogId)
        },
      })),
    },
  ])

  return {
    schemaInputRef,
    activeImportDialogDefinition,
    activeImportDialogVisible,
    activeImportDialogKey,
    activeImportDialogProps,
    menuItems,
    onSchemaFiles,
    closeImportDialog,
    triggerSchemaUpload,
    openImportDialog,
    exportProfiles,
    confirmResetAll,
  }
}
