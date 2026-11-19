import { gettingStartedSlides } from './gettingStartedSlides'

// Retain the images across dialog openings so their requests and decoded images
// can be reused. Failed requests are removed so reopening can retry them.
const preloadedImages = new Map<string, HTMLImageElement>()

export function preloadGettingStartedMedia(): void {
  for (const slide of gettingStartedSlides) {
    for (const source of [slide.poster, slide.animation]) {
      if (preloadedImages.has(source)) continue
      const image = new Image()
      image.decoding = 'async'
      image.fetchPriority = 'low'
      image.onerror = () => preloadedImages.delete(source)
      preloadedImages.set(source, image)
      image.src = source
    }
  }
}
