# Getting Started GIFs

Open the six-slide introduction from the start screen or Settings > Getting Started.
Each slide pairs one recording with a headline and descriptive sentence.

The original MP4s in SHACL-Editor-Videos remain unchanged. Generated GIFs and
static WebP fallback frames live in src/assets/getting-started and are imported
through Vite for deployment-aware asset URLs.

All six GIFs are 1280 x 610 pixels, 12 frames per second, and loop automatically.
Each complete recording is sped up to fit a ten-second loop without trimming.
Small differences in source aspect ratio are padded with white, preserving the
entire editor view. The responsive container matches this aspect ratio and uses
object-fit: contain to avoid cropping on smaller screens.

Previous and next arrows overlay the media, with unavailable directions disabled
on the first and last slides. Keyboard arrows and the step navigation still work.
Finish closes the dialog on the final slide. Only the active animation is mounted.
A motion toggle switches between the GIF and its static fallback; reduced-motion
users see the static image by default and can opt into playback.

To regenerate after changing the recordings:

```sh
python -m pip install imageio-ffmpeg pillow
python scripts/generate-getting-started-gifs.py
```

The conversion script verifies frame counts, loop metadata, and duration.
Slide captions and asset mappings live in
src/presentation/features/getting-started/gettingStartedSlides.ts.
