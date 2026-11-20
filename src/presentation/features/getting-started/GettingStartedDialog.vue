<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import { gettingStartedSlides } from './gettingStartedSlides'
import { preloadGettingStartedMedia } from './preloadGettingStartedMedia'

const emit = defineEmits<{ close: [] }>()
const index = ref(0)
const paused = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
const mediaError = ref(false)
const loadedAnimations = ref(new Set<string>())
const slide = computed(() => gettingStartedSlides[index.value]!)
const lastSlide = computed(() => index.value === gettingStartedSlides.length - 1)

// Start fetching the other slides while the first is being watched. Respect
// reduced motion by postponing animated-image downloads until playback is chosen.
onMounted(() => { if (!paused.value) preloadGettingStartedMedia() })
watch(paused, value => { if (!value) preloadGettingStartedMedia() })

function goTo(next: number) {
  if (next < 0 || next >= gettingStartedSlides.length || next === index.value) return
  mediaError.value = false
  index.value = next
}

function close() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    goTo(index.value + (event.key === 'ArrowRight' ? 1 : -1))
  }
}

</script>

<template>
  <Dialog
    :visible="true"
    modal
    header="Getting Started with SHACL Editor"
    :style="{ width: 'min(1000px, 96vw)' }"
    :draggable="false"
    @update:visible="!$event && close()"
  >
    <div class="tour" @keydown="onKeydown">
      <nav class="tour__steps" aria-label="Getting Started slides">
        <button
          v-for="(item, position) in gettingStartedSlides"
          :key="item.id"
          type="button"
          :aria-current="position === index ? 'step' : undefined"
          :aria-label="`Slide ${position + 1}: ${item.label}`"
          @click="goTo(position)"
        ><span>{{ position + 1 }}</span>{{ item.label }}</button>
      </nav>

      <div class="tour__media">
        <img
          class="tour__poster"
          :src="slide.poster"
          :alt="paused || mediaError ? slide.description : ''"
          :aria-hidden="!paused && !mediaError"
        />
        <img
          v-if="!paused && !mediaError"
          :key="slide.id"
          class="tour__animation"
          :class="{ 'tour__animation--loading': !loadedAnimations.has(slide.animation) }"
          :src="slide.animation"
          :alt="slide.description"
          decoding="async"
          @load="loadedAnimations.add(slide.animation)"
          @error="mediaError = true"
        />
        <span v-if="!paused && !mediaError && !loadedAnimations.has(slide.animation)" class="tour__loading" role="status">Loading animation…</span>
        <button type="button" class="tour__arrow tour__arrow--left" :disabled="index === 0" aria-label="Previous slide" title="Previous slide" @click="goTo(index - 1)">
          <i class="pi pi-arrow-left" aria-hidden="true" />
        </button>
        <button type="button" class="tour__arrow tour__arrow--right" :disabled="lastSlide" aria-label="Next slide" title="Next slide" @click="goTo(index + 1)">
          <i class="pi pi-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <p v-if="mediaError" class="tour__media-error" role="status">
        This animation could not be loaded. <a :href="slide.animation" target="_blank" rel="noopener">Open the GIF</a>.
      </p>
      <div class="tour__copy" aria-live="polite" aria-atomic="true">
        <h2>{{ slide.headline }}</h2>
        <p id="getting-started-description">{{ slide.description }}</p>
      </div>
      <div class="tour__footer">
        <button type="button" class="tour__motion-toggle" :aria-pressed="!paused" @click="paused = !paused">{{ paused ? 'Play animation' : 'Pause animation' }}</button>
        <span>{{ index + 1 }} / {{ gettingStartedSlides.length }}</span>
        <div class="tour__finish"><button v-if="lastSlide" type="button" class="tour__button tour__button--primary" @click="close()">Finish<i class="pi pi-check" aria-hidden="true" /></button></div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.tour { display: grid; gap: 16px; color: var(--color-text); }
.tour button { font: inherit; cursor: pointer; }
.tour button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.tour__steps { display: flex; gap: 6px; }
.tour__steps button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 4px; border: 0; border-radius: var(--radius-sm); background: var(--color-surface-2); color: var(--color-text-muted); font-size: .8rem; }
.tour__steps button[aria-current] { background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; }
.tour__steps button span { font-size: .72rem; }
.tour__media { position: relative; width: 100%; aspect-ratio: 1280 / 610; max-height: 50vh; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
.tour__poster, .tour__animation { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.tour__animation--loading { opacity: 0; }
.tour__loading { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); padding: 5px 10px; border-radius: var(--radius-sm); background: rgba(255, 255, 255, .94); color: var(--color-text-muted); font-size: .75rem; }
.tour__arrow { position: absolute; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--color-border); border-radius: 50%; color: var(--color-primary); background: rgba(255, 255, 255, .94); box-shadow: var(--shadow-md); }
.tour__arrow--left { left: 12px; }
.tour__arrow--right { right: 12px; }
.tour__arrow:hover:not(:disabled) { background: var(--color-primary); color: white; }
.tour__arrow:disabled { opacity: .35; cursor: default; }
.tour button.tour__motion-toggle { border: 0; padding: 8px 0; background: transparent; color: var(--color-primary); font-size: .8rem; }
.tour__finish { min-width: 115px; }
.tour__media-error { margin: 0; font-size: .85rem; }
.tour__media-error a { color: var(--color-primary); }
.tour__copy { min-height: 100px; }
.tour__copy h2 { font-size: 1.35rem; margin: 0 0 10px; line-height: 1.3; }
.tour__copy p { color: var(--color-text-muted); margin: 0; line-height: 1.6; font-size: .94rem; }
.tour__footer { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; border-top: 1px solid var(--color-border); padding-top: 16px; }
.tour__footer > :first-child { justify-self: start; }
.tour__footer > :last-child { justify-self: end; }
.tour__footer > span { color: var(--color-text-muted); font-size: .8rem; }
.tour__button { display: flex; align-items: center; justify-content: center; gap: 9px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 10px 16px; background: var(--color-surface); color: var(--color-text); min-width: 95px; }
.tour__button:disabled { opacity: .4; cursor: default; }
.tour__button--primary { background: var(--color-primary); border-color: var(--color-primary); color: white; }
@media (max-width: 560px) {
  .tour { gap: 12px; }
  .tour__steps { display: grid; grid-template-columns: repeat(3, 1fr); }
  .tour__steps button { font-size: .75rem; }
  .tour__copy { min-height: 135px; }
  .tour__copy h2 { font-size: 1.15rem; }
}
</style>
