#!/usr/bin/env python3
"""Offline launcher/lifecycle checks; subprocesses are local recording stubs."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parent
CLASSES = {
    "deck": "chrome-127.0.0.1__deck-control.html-Default",
    "console": "chrome-127.0.0.1__kefka-console-Default",
}


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="artbastard-lifecycle-")
        self.root = Path(self.tmp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.env = {**os.environ, "PATH": str(self.bin) + ":" + os.environ["PATH"],
                    "XDG_RUNTIME_DIR": str(self.root), "TEST_ROOT": str(self.root)}
        self.write("clients.json", "[]")
        self.stub("python3", """
import os, sys
if sys.argv[1] == "-":
    print("isolated-test-compositor")
else:
    os.execv("/usr/bin/python3", ["/usr/bin/python3", *sys.argv[1:]])
""")
        self.stub("hyprctl", """
import json, os, sys
from pathlib import Path
r = Path(os.environ["TEST_ROOT"])
if sys.argv[1:] == ["clients", "-j"]:
    print((r / "clients.json").read_text())
else:
    with (r / "actions").open("a") as f: f.write(json.dumps(sys.argv[1:]) + "\\n")
""")
        self.stub("systemctl", """
import json, os, sys
from pathlib import Path
r = Path(os.environ["TEST_ROOT"])
args = sys.argv[1:]
if "is-active" in args:
    raise SystemExit(0 if (r / "active").exists() else 3)
with (r / "actions").open("a") as f: f.write(json.dumps(args) + "\\n")
surface = "console" if "console" in args[-1] else "deck"
name = "kefka-console" if surface == "console" else "deck-control.html"
clients = json.loads((r / "clients.json").read_text())
clients.append({"class": "chrome-127.0.0.1__" + name + "-Default", "address": "0x123"})
(r / "clients.json").write_text(json.dumps(clients))
(r / "active").touch()
""")
        self.stub("flatpak-stub", """
import json, os, sys
from pathlib import Path
r = Path(os.environ["TEST_ROOT"])
with (r / "flatpak-actions").open("a") as f: f.write(json.dumps(sys.argv[1:]) + "\\n")
if sys.argv[1] == "run":
    os.write(3, b"987654")
""")
        for surface in CLASSES:
            (self.bin / f"artbastard-{surface}-open").symlink_to(SOURCE / "artbastard-surface-open")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, name, value):
        (self.root / name).write_text(value)

    def stub(self, name, code):
        target = self.bin / name
        target.write_text("#!/usr/bin/python3\n" + code)
        target.chmod(0o755)

    def actions(self, name="actions"):
        file = self.root / name
        return [json.loads(line) for line in file.read_text().splitlines()] if file.exists() else []

    def open(self, surface):
        subprocess.run(["bash", str(self.bin / f"artbastard-{surface}-open")],
                       env=self.env, check=True, timeout=8)

    def test_existing_exact_window_is_focused_without_service_start(self):
        self.write("clients.json", json.dumps([{"class": CLASSES["deck"], "address": "0xabc"}]))
        self.open("deck")
        self.open("deck")
        self.assertEqual(self.actions(), [["dispatch", "focuswindow", "address:0xabc"]] * 2)

    def test_concurrent_opens_start_only_one_window(self):
        processes = [subprocess.Popen(["bash", str(self.bin / "artbastard-deck-open")], env=self.env)
                     for _ in range(3)]
        for process in processes:
            self.assertEqual(process.wait(timeout=8), 0)
        self.assertEqual(sum("start" in action for action in self.actions()), 1)
        self.assertEqual(len(json.loads((self.root / "clients.json").read_text())), 1)

    def test_console_restarts_active_windowless_service_and_keeps_other_windows(self):
        self.write("active", "")
        self.write("clients.json", json.dumps([{"class": CLASSES["console"] + "-other", "address": "0xother"}]))
        self.open("console")
        self.open("console")
        self.assertEqual(sum("restart" in action for action in self.actions()), 1)
        self.assertEqual(len(json.loads((self.root / "clients.json").read_text())), 2)

    def test_units_capture_and_stop_only_the_recorded_numeric_instance(self):
        for surface in CLASSES:
            with self.subTest(surface=surface):
                runtime = self.root / f"artbastard-{surface}"
                runtime.mkdir()
                lines = (SOURCE / f"artbastard-{surface}.service").read_text().splitlines()
                commands = {}
                for kind in ("ExecStart", "ExecStop"):
                    text = next(line.split("=", 1)[1] for line in lines if line.startswith(kind + "="))
                    text = text.removeprefix("-").replace("$$", "$").replace("%t", str(self.root)).replace("%h", str(self.root))
                    text = text.replace("/usr/bin/flatpak", str(self.bin / "flatpak-stub"))
                    commands[kind] = shlex.split(text)
                subprocess.run(commands["ExecStart"], env=self.env, check=True)
                start = self.actions("flatpak-actions")[-1]
                profile = "artbastard-browser" if surface == "deck" else "artbastard-console-browser"
                self.assertIn(f"--persist=.local/share/{profile}", start)
                self.assertIn("--die-with-parent", start)
                self.assertEqual((runtime / "instance").read_text(), "987654")
                subprocess.run(commands["ExecStop"], env=self.env, check=True)
                self.assertEqual(self.actions("flatpak-actions")[-1], ["kill", "987654"])
                count = len(self.actions("flatpak-actions"))
                (runtime / "instance").write_text("com.google.Chrome")
                self.assertNotEqual(subprocess.run(commands["ExecStop"], env=self.env).returncode, 0)
                self.assertEqual(len(self.actions("flatpak-actions")), count)


if __name__ == "__main__":
    unittest.main()
