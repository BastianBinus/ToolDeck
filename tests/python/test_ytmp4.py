"""Argument parsing of public/mitschnitt/ytmp4.py. Needs no yt-dlp.

    python3 -m unittest discover -s tests/python
"""
import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[2] / "public" / "mitschnitt" / "ytmp4.py"
spec = importlib.util.spec_from_file_location("ytmp4", path)
ytmp4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ytmp4)

ID = "dQw4w9WgXcQ"


class Parse(unittest.TestCase):
    def test_link_shapes(self):
        for link in [
            ID,
            f"https://www.youtube.com/watch?v={ID}",
            f"https://www.youtube.com/watch?feature=share&v={ID}&t=42",
            f"https://m.youtube.com/watch?v={ID}",
            f"https://music.youtube.com/watch?v={ID}&list=RD",
            f"https://youtu.be/{ID}?si=abc",
            f"https://www.youtube.com/shorts/{ID}",
            f"https://www.youtube.com/live/{ID}?feature=share",
            f"https://www.youtube-nocookie.com/embed/{ID}",
            f"  youtube.com/watch?v={ID}  ",
        ]:
            with self.subTest(link=link):
                self.assertEqual(ytmp4.parse([link]), (ID, None))

    def test_height_from_fragment_or_argument(self):
        self.assertEqual(ytmp4.parse([f"https://www.youtube.com/watch?v={ID}#h=720"]), (ID, "720"))
        self.assertEqual(ytmp4.parse([f"https://youtu.be/{ID}", "1080"]), (ID, "1080"))
        self.assertEqual(ytmp4.parse([f"https://youtu.be/{ID}", "360p"]), (ID, "360"))

    def test_rejects(self):
        for args in [
            [],
            [""],
            ["https://example.com/watch?v=" + ID],
            [f"https://www.youtube.com/watch?v={ID}x"],
            ["https://www.youtube.com/watch?v=short"],
            [f"https://youtu.be/{ID}", "999"],
            [f"https://youtu.be/{ID}#h=abc"],
        ]:
            with self.subTest(args=args):
                with self.assertRaises(ValueError):
                    ytmp4.parse(args)


class Formats(unittest.TestCase):
    def test_merge_limits_height_and_stays_mp4(self):
        self.assertEqual(
            ytmp4.formats("720", True),
            "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b[ext=mp4]",
        )

    def test_without_ffmpeg_only_progressive(self):
        self.assertEqual(ytmp4.formats(None, False), "b[ext=mp4]/b[ext=mp4]")
        self.assertNotIn("+", ytmp4.formats("1080", False))


class Main(unittest.TestCase):
    def test_bad_input_exits_2_before_importing_yt_dlp(self):
        self.assertEqual(ytmp4.main(["not a link"]), 2)


if __name__ == "__main__":
    unittest.main()
