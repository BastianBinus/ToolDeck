#!/usr/bin/env python3
"""Ein YouTube-Video als MP4 speichern. Gedacht für a-Shell auf dem iPhone.

    python3 ytmp4.py '<YouTube-Link>'           beste Qualität
    python3 ytmp4.py '<Link>#h=720'             höchstens 720p (so schickt es ToolDeck)
    python3 ytmp4.py '<Link>' 1080              dasselbe als zweites Argument

Die Datei landet in ~/Documents/YouTube, in der Dateien-App unter a-Shell.
Braucht yt-dlp (pip install -U yt-dlp). Ohne ffmpeg gibt es nur die MP4-Formate,
in denen Bild und Ton schon zusammen liegen; bei YouTube meist höchstens 360p.
"""
import os
import re
import sys

ID = re.compile(r"[A-Za-z0-9_-]{11}")
# The same link shapes src/tools/mitschnitt/youtube.js accepts.
LINK = re.compile(
    r"(?:youtube(?:-nocookie)?\.com/(?:watch\?(?:.*&)?v=|shorts/|live/|embed/|v/|e/)|youtu\.be/)"
    r"([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"
)
HEIGHTS = {"360", "480", "720", "1080", "1440", "2160"}
OUT = os.path.expanduser("~/Documents/YouTube")


def parse(args):
    """(video_id, height or None) from the command line; raises ValueError."""
    if not args:
        raise ValueError("Kein Link angegeben.")
    text = args[0].strip()
    height = None
    m = re.search(r"#h=([^#]*)$", text)
    if m:
        height, text = m.group(1), text[: m.start()]
    if len(args) > 1:
        height = args[1].strip().rstrip("p")
    if height is not None and height not in HEIGHTS:
        raise ValueError(f"Unbekannte Höhe: {height}")

    if ID.fullmatch(text):
        return text, height
    m = LINK.search(text)
    if not m:
        raise ValueError(f"Kein YouTube-Link: {text}")
    return m.group(1), height


def formats(height, merge):
    """yt-dlp format selector for an MP4 no taller than height."""
    h = f"[height<={height}]" if height else ""
    if merge:
        # Separate video and audio streams, muxed into MP4 by ffmpeg.
        return f"bv*{h}[ext=mp4]+ba[ext=m4a]/b{h}[ext=mp4]/b[ext=mp4]"
    # No ffmpeg: only formats that already carry picture and sound.
    return f"b{h}[ext=mp4]/b[ext=mp4]"


def main(argv):
    try:
        vid, height = parse(argv)
    except ValueError as e:
        print(e, file=sys.stderr)
        print(__doc__, file=sys.stderr)
        return 2

    try:
        from yt_dlp import YoutubeDL
        from yt_dlp.postprocessor.ffmpeg import FFmpegPostProcessor
    except ImportError:
        print("yt-dlp fehlt. Einmal ausführen: pip install -U yt-dlp", file=sys.stderr)
        return 1

    merge = FFmpegPostProcessor().available
    if not merge:
        print("Hinweis: kein ffmpeg gefunden, die Qualität ist deshalb begrenzt.")

    os.makedirs(OUT, exist_ok=True)
    options = {
        "format": formats(height, merge),
        "merge_output_format": "mp4",
        "outtmpl": os.path.join(OUT, "%(title).90B [%(id)s].%(ext)s"),
        "noplaylist": True,
    }
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}")
    except Exception as e:
        print(f"\nFehlgeschlagen: {e}", file=sys.stderr)
        print("Oft hilft ein Update: pip install -U yt-dlp", file=sys.stderr)
        return 1

    done = (info.get("requested_downloads") or [{}])[0]
    path = done.get("filepath") or OUT
    size = f"{done['height']}p" if done.get("height") else "unbekannte Auflösung"
    print(f"\nFertig ({size}): {path}")
    print("Zu finden in Dateien → a-Shell → YouTube.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
