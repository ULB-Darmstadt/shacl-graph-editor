<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { highlightTurtleLines } from './turtleHighlighting'

const props = defineProps<{ turtle: string }>()
const lines = computed(() => highlightTurtleLines(props.turtle))
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
watch(() => props.turtle, () => { copyState.value = 'idle' })

async function copyTurtle(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.turtle)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'failed'
  }
}
</script>

<template>
  <div class="turtle-code-preview">
    <div class="code-toolbar">
      <span class="code-language">Turtle <span class="code-readonly">Read-only</span></span>
      <button type="button" class="code-copy" :disabled="!turtle" @click="copyTurtle">
        <i :class="copyState === 'copied' ? 'pi pi-check' : 'pi pi-copy'" aria-hidden="true" />
        {{ copyState === 'copied' ? 'Copied' : 'Copy Turtle' }}
      </button>
    </div>
    <p v-if="copyState === 'failed'" class="helper-text" role="status">Could not copy automatically. Select the code and copy it.</p>
    <div class="code-scroll" tabindex="0" role="region" aria-label="Read-only Turtle source">
      <div class="code-gutter" aria-hidden="true">
        <span v-for="(_, index) in lines" :key="index">{{ index + 1 }}</span>
      </div>
      <pre class="code-source"><code><span v-for="(line, index) in lines" :key="index" class="code-line"><span v-for="(token, tokenIndex) in line" :key="tokenIndex" :class="`token-${token.kind}`">{{ token.text }}</span>{{ index < lines.length - 1 ? '\n' : '' }}</span></code></pre>
    </div>
  </div>
</template>

<style scoped lang="scss">
.turtle-code-preview {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.code-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--color-surface-2);
}

.code-language { font-size: 0.85rem; font-weight: 600; }
.code-readonly { margin-left: 10px; color: var(--color-text-muted); font-size: 0.75rem; font-weight: 400; }
.code-copy {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.code-copy:disabled { opacity: 0.5; cursor: not-allowed; }
.code-copy:hover:not(:disabled) { background: var(--color-primary-soft); }
.helper-text { padding: 8px 14px; margin: 0; }

.code-scroll {
  display: flex;
  max-height: 65vh;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.8rem;
  line-height: 1.6;
  tab-size: 2;
}
.code-scroll:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.code-gutter {
  position: sticky;
  left: 0;
  flex-shrink: 0;
  min-width: 3.5em;
  padding: 14px 12px;
  background: #1e293b;
  color: #94a3b8;
  text-align: right;
  user-select: none;
}
.code-gutter span { display: block; }
.code-source { margin: 0; padding: 14px 16px; font: inherit; white-space: pre; }
.code-source code { font: inherit; }
.token-comment { color: #94a3b8; }
.token-string { color: #a5d6a7; }
.token-iri { color: #93c5fd; }
.token-keyword { color: #c4b5fd; }
.token-prefix { color: #7dd3fc; }
.token-number { color: #fbbf24; }
.token-punctuation { color: #cbd5e1; }
</style>
