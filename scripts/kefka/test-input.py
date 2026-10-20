#!/usr/bin/env python3
import importlib.util
import json
import os
from pathlib import Path
import socket
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("deck_input", Path(__file__).with_name("deck-input.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class ReaderTests(unittest.TestCase):
    def test_hid_steam_button_layout_matches_standard_gamepad(self):
        info = {20: (0, 0, 32767, 0, 0, 0), 21: (0, 0, 32767, 0, 0, 0)}
        for code, index in [(0x130, 0), (0x131, 1), (0x133, 2), (0x134, 3),
                            (0x136, 4), (0x137, 5), (0x220, 12), (0x221, 13),
                            (0x222, 14), (0x223, 15)]:
            pad = bridge.make_pad({code: True}, {20: 0, 21: 0}, info, 42)
            self.assertEqual(pad["buttons"][index], 1)
            self.assertEqual(sum(pad["buttons"]), 1)
            self.assertEqual(pad["connection"], 42)

    def test_triggers_have_correct_side_and_are_bounded(self):
        info = {20: (0, 0, 100, 0, 0, 0), 21: (0, 0, 100, 0, 0, 0)}
        pad = bridge.make_pad({}, {20: 25, 21: 100}, info, 1)
        self.assertEqual(pad["buttons"][6:8], [1, .25])
        self.assertEqual(bridge.trigger_value(-10, info[20]), 0)
        self.assertEqual(bridge.trigger_value(110, info[20]), 1)
        self.assertEqual(bridge.trigger_value(1, (0, 0, 0, 0, 0, 0)), 0)


class NativeGateTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix="ab-gate-")
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.runtime = self.root / "run"
        self.proc = self.root / "proc"
        self.mapper = self.runtime / "deckhypr"
        self.mapper.mkdir(parents=True)
        self.mapper.joinpath("pid").write_text("123")
        self.process(123, "deckhypr")
        self.state()
        self.gate = bridge.NativeInputGate(self.runtime, self.proc, os.getuid())
        self.active = {"class": bridge.DECK_CLASS, "address": "0xabc"}
        self.pad = {"connection": 1, "buttons": [0] * 16}

    def process(self, pid, name, status="S", started="100"):
        folder = self.proc / str(pid)
        folder.mkdir(parents=True, exist_ok=True)
        folder.joinpath("comm").write_text(name + "\n")
        folder.joinpath("stat").write_text(
            f"{pid} ({name}) " + " ".join([status] + ["0"] * 18 + [started]))

    def state(self, mode="game", pad="kernel", launcher="closed"):
        self.mapper.joinpath("state.json").write_text(json.dumps(
            {"mode": mode, "pad": pad, "launcher": launcher, "ts": 1}))

    def check(self):
        with patch.object(self.gate, "active_window", return_value=self.active):
            self.gate.check()
        return self.gate.snapshot(self.pad)

    def test_old_mode_timestamp_is_valid_only_with_live_mapper_and_exact_window(self):
        state = self.check()
        self.assertTrue(state["connected"])
        self.assertTrue(state["nativeAllowed"])
        self.assertEqual(state["pad"]["buttons"], self.pad["buttons"])
        self.assertEqual(state["pad"]["connection"], "1:1")

    def test_desktop_menu_missing_mapper_and_invalid_state_fail_closed(self):
        for mode in ("desktop", "menu", None):
            self.state(mode=mode)
            state = self.check()
            self.assertTrue(state["connected"], "Reader health remains independent of mode")
            self.assertFalse(state["nativeAllowed"])
            self.assertIsNone(state["pad"])
        self.state()
        self.mapper.joinpath("pid").unlink()
        self.assertFalse(self.check()["nativeAllowed"], "Stale GAME state cannot replace a live process")
        self.mapper.joinpath("pid").write_text("123")
        for broken in ("{", "null", "[]"):
            self.mapper.joinpath("state.json").write_text(broken)
            self.assertFalse(self.check()["nativeAllowed"])

    def test_dead_stopped_reused_or_unreadable_mapper_is_rejected(self):
        for status in ("Z", "X", "T", "t"):
            self.process(123, "deckhypr", status=status)
            self.assertFalse(self.check()["nativeAllowed"])
        self.process(123, "other-process")
        self.assertFalse(self.check()["nativeAllowed"])
        self.proc.joinpath("123/stat").write_text("unreadable")
        self.assertFalse(self.check()["nativeAllowed"])

    def test_focus_pad_handoff_or_stale_check_revokes_native_input(self):
        original = self.check()["pad"]["connection"]
        self.active = {"class": "google-chrome", "address": "0xdef"}
        self.assertFalse(self.check()["nativeAllowed"])
        self.active = {"class": bridge.DECK_CLASS, "address": "0xabc"}
        self.assertNotEqual(self.check()["pad"]["connection"], original,
                            "Returning after handoff must require a new neutral gate")
        for params in ({"pad": "steam"}, {"pad": "none"}, {"launcher": "open"}):
            self.state(**params)
            self.assertFalse(self.check()["nativeAllowed"])
        self.state()
        self.check()
        self.gate.checked_at = time.monotonic() - 1
        self.assertFalse(self.gate.snapshot(self.pad)["nativeAllowed"])
        self.assertIsNone(self.gate.snapshot(self.pad)["pad"])

    def test_active_window_query_ignores_stale_signatures(self):
        self.process(456, "Hyprland")
        live = self.runtime / "hypr" / "live"
        stale = self.runtime / "hypr" / "stale"
        live.mkdir(parents=True)
        stale.mkdir()
        live.joinpath("hyprland.lock").write_text("456\nwayland-1\n")
        stale.joinpath("hyprland.lock").write_text("999\nwayland-0\n")
        stale.joinpath(".socket.sock").touch()
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.addCleanup(listener.close)
        listener.bind(str(live / ".socket.sock"))
        listener.listen(1)
        requests = []

        def answer():
            connection, _ = listener.accept()
            with connection:
                requests.append(connection.recv(1024))
                connection.sendall(json.dumps(self.active).encode())

        worker = threading.Thread(target=answer, daemon=True)
        worker.start()
        self.gate.check()
        worker.join(timeout=1)
        self.assertEqual(requests, [b"j/activewindow"])
        self.assertTrue(self.gate.snapshot(self.pad)["nativeAllowed"])


if __name__ == "__main__":
    unittest.main()
