"""Convert the supplied tutorial recordings without modifying the MP4 originals.

Requires: pip install imageio-ffmpeg pillow
Run from any directory: python scripts/generate-getting-started-gifs.py
"""
from pathlib import Path
import re
import subprocess

import imageio_ffmpeg
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/assets/getting-started"
OUTPUT.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

for source in sorted((ROOT / "SHACL-Editor-Videos").glob("*.mp4")):
    probe = subprocess.run([ffmpeg, "-i", str(source)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", probe.stderr)
    if not match:
        raise RuntimeError(f"Cannot read duration: {source.name}")
    hours, minutes, seconds = map(float, match.groups())
    duration = hours * 3600 + minutes * 60 + seconds
    factor = min(1, 10 / duration)
    target = OUTPUT / f"{source.stem}.gif"
    filters = (
        f"setpts={factor:.8f}*(PTS-STARTPTS),fps=12,scale=1280:-2:flags=lanczos,"
        "pad=1280:610:(ow-iw)/2:(oh-ih)/2:color=white,"
        "split[frames][colors];[colors]palettegen=stats_mode=diff[palette];"
        "[frames][palette]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle"
    )
    subprocess.run([
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
        "-filter_complex", filters, "-an", "-loop", "0", str(target),
    ], check=True)
    with Image.open(target) as animation:
        # A representative frame is also the reduced-motion / pause fallback.
        animation.seek(min(6, animation.n_frames - 1))
        animation.convert("RGB").save(OUTPUT / f"{source.stem}.webp", quality=90)
        total_ms = 0
        for frame in range(animation.n_frames):
            animation.seek(frame)
            total_ms += animation.info.get("duration", 0)
        assert animation.info.get("loop") == 0, "GIF must loop automatically"
        assert 0 < total_ms <= 10100, "GIF should fit the ten-second budget"
        print(f"{target.name}: {animation.size}, {animation.n_frames} frames, "
              f"{total_ms / 1000:.2f}s, {target.stat().st_size / 1_000_000:.2f} MB", flush=True)
