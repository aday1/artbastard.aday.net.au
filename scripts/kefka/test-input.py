#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest

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


if __name__ == "__main__":
    unittest.main()
