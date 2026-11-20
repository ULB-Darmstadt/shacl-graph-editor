<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import { quantityDefinitionError, type QuantityDefinition, type QuantityResource } from '@/application/profiles/quantityGenerator'
import { loadQuantityKinds, loadQuantityUnits } from '@/infrastructure/external/qudtService'
const props = defineProps<{ initialName: string; initialPath: string; busy: boolean; error: string | null }>()
const emit = defineEmits<{ close: []; add: [definition: QuantityDefinition] }>()
const name = ref(props.initialName)
const description = ref('')
const path = ref(props.initialPath)
const kinds = ref<QuantityResource[]>([])
const units = ref<QuantityResource[]>([])
const kind = ref<QuantityResource | null>(null)
const selectedUnits = ref<QuantityResource[]>([])
const datatype = ref<'integer' | 'double'>('double')
const minimum = ref('')
const maximum = ref('')
const minCount = ref(1)
const maxCount = ref<number | null>(1)
const loadingKinds = ref(false)
const loadingUnits = ref(false)
const kindError = ref('')
const unitError = ref('')
const lifetime = new AbortController()
let unitRequest: AbortController | undefined
const definition = computed<QuantityDefinition>(() => ({ name: name.value, description: description.value, path: path.value.trim(), quantityKind: kind.value ?? { iri: '', label: '' }, units: selectedUnits.value, datatype: datatype.value, minimum: minimum.value, maximum: maximum.value, minCount: minCount.value, maxCount: maxCount.value === null || String(maxCount.value) === '' ? null : maxCount.value }))
const validation = computed(() => quantityDefinitionError(definition.value))
async function fetchKinds() {
  loadingKinds.value = true
  kindError.value = ''
  try { kinds.value = await loadQuantityKinds(lifetime.signal) }
  catch (error) { if (!lifetime.signal.aborted) kindError.value = error instanceof Error ? error.message : 'Could not load quantity kinds.' }
  finally { if (!lifetime.signal.aborted) loadingKinds.value = false }
}
async function fetchUnits() {
  unitRequest?.abort()
  const request = new AbortController()
  unitRequest = request
  units.value = []
  selectedUnits.value = []
  unitError.value = ''
  if (!kind.value) { loadingUnits.value = false; return }
  loadingUnits.value = true
  try { const result = await loadQuantityUnits(kind.value.iri, AbortSignal.any([request.signal, lifetime.signal])); if (!request.signal.aborted && !lifetime.signal.aborted) units.value = result }
  catch (error) { if (!request.signal.aborted && !lifetime.signal.aborted) unitError.value = error instanceof Error ? error.message : 'Could not load units.' }
  finally { if (!request.signal.aborted && !lifetime.signal.aborted) loadingUnits.value = false }
}
watch(kind, fetchUnits)
onMounted(fetchKinds)
onBeforeUnmount(() => { lifetime.abort(); unitRequest?.abort() })
</script>
<template>
  <Dialog :visible="true" modal header="Quantity Generator" :closable="!busy" :close-on-escape="!busy" class="quantity-generator-dialog" :style="{ width: 'min(720px, 95vw)' }" @update:visible="!$event && !busy && emit('close')">
    <form class="quantity-generator" @submit.prevent="!busy && !validation && !loadingUnits && emit('add', definition)">
      <p>Create a parameter profile based on m4i Numerical Variable and connect this field to it.</p>
      <fieldset :disabled="busy">
        <label>Parameter name<input v-model="name" required type="text" /></label>
        <label>Description<textarea v-model="description" rows="2" /></label>
        <label>Field IRI<input v-model="path" required type="url" /></label>
        <label for="quantity-kind">Quantity kind</label>
        <Select v-model="kind" input-id="quantity-kind" aria-label="Quantity kind" :options="kinds" option-label="label" data-key="iri" filter placeholder="Select a quantity kind" :loading="loadingKinds" :disabled="busy || loadingKinds" />
        <p v-if="kindError" role="alert">{{ kindError }} <button type="button" @click="fetchKinds">Retry quantity kinds</button></p>
        <p v-else-if="!loadingKinds && !kinds.length">No English quantity kinds are available.</p>
        <label for="quantity-units">Allowed units</label>
        <MultiSelect v-model="selectedUnits" input-id="quantity-units" aria-label="Allowed units" :options="units" option-label="label" data-key="iri" filter display="chip" placeholder="Select allowed units" :loading="loadingUnits" :disabled="busy || !kind || loadingUnits" />
        <p v-if="unitError" role="alert">{{ unitError }} <button type="button" @click="fetchUnits">Retry units</button></p>
        <p v-else-if="kind && !loadingUnits && !units.length">No English units are available for this quantity kind.</p>
        <label>Numeric datatype<select v-model="datatype"><option value="double">Double</option><option value="integer">Integer</option></select></label>
        <div class="quantity-generator__pair">
          <label>Minimum value<input v-model="minimum" type="text" inputmode="decimal" placeholder="Unbounded" /></label>
          <label>Maximum value<input v-model="maximum" type="text" inputmode="decimal" placeholder="Unbounded" /></label>
        </div>
        <small>Bounds are inclusive and require exactly one selected unit. No unit conversion is applied.</small>
        <div class="quantity-generator__pair">
          <label>Minimum count<input v-model.number="minCount" type="number" min="0" step="1" /></label>
          <label>Maximum count<input v-model.number="maxCount" type="number" min="0" step="1" placeholder="Unbounded" /></label>
        </div>
      </fieldset>
      <p v-if="validation" class="quantity-generator__hint">{{ validation }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <button type="button" class="quantity-generator__cancel" :disabled="busy" @click="emit('close')">Cancel</button>
      <button type="button" class="quantity-generator__add" :disabled="busy || !!validation || loadingUnits" @click="emit('add', definition)"><i v-if="busy" class="pi pi-spin pi-spinner" aria-hidden="true" /> {{ busy ? 'Adding…' : 'Add' }}</button>
    </template>
  </Dialog>
</template>
<style scoped>
.quantity-generator { display: flex; flex-direction: column; gap: 12px; }
.quantity-generator p { margin: 0; color: var(--color-text-muted); font-size: 0.85rem; }
.quantity-generator fieldset { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; border: 0; min-width: 0; }
.quantity-generator label { display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; }
.quantity-generator input, .quantity-generator textarea, .quantity-generator select { width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; }
.quantity-generator__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.quantity-generator small { color: var(--color-text-muted); }
.quantity-generator__cancel, .quantity-generator__add { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; cursor: pointer; }
.quantity-generator__cancel { background: var(--color-surface); color: var(--color-text); }
.quantity-generator__add { background: var(--color-primary); color: white; }
.quantity-generator__add:disabled, .quantity-generator__cancel:disabled { opacity: 0.5; cursor: default; }
</style>
