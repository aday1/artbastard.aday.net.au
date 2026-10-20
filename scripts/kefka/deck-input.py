#!/usr/bin/env python3
"""Read-only Steam Deck buttons for ArtBastard. Never grabs or synthesizes input."""
import fcntl
import glob
import json
import os
import select
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

EVENT = struct.Struct("llHHi")
# A/B/X/Y, shoulders, triggers, View/Menu, stick clicks, D-pad.
BUTTON_CODES = (0x130, 0x131, 0x133, 0x134, 0x136, 0x137, 0x138, 0x139,
                0x13A, 0x13B, 0x13D, 0x13E, 0x220, 0x221, 0x222, 0x223)
ORIGINS = frozenset(os.environ.get(
    "ARTBASTARD_DECK_ORIGINS", "http://127.0.0.1:3030,http://localhost:3030").split(","))
PORT = int(os.environ.get("ARTBASTARD_DECK_INPUT_PORT", "18782"))
LOCK = threading.Lock()
STATE = {"pad": None}


def device_name(fd):
    buffer = bytearray(256)
    fcntl.ioctl(fd, 0x81004506, buffer, True)
    return bytes(buffer).split(b"\0")[0].decode(errors="replace")


def abs_info(fd, code):
    buffer = bytearray(24)
    fcntl.ioctl(fd, 0x80184540 + code, buffer, True)
    return struct.unpack("6i", buffer)


def key_state(fd):
    buffer = bytearray(128)
    fcntl.ioctl(fd, 0x80804518, buffer, True)
    return {code: bool(buffer[code // 8] & (1 << (code % 8))) for code in BUTTON_CODES}


def trigger_value(value, info):
    low, high = info[1], info[2]
    return max(0.0, min(1.0, (value - low) / (high - low))) if high > low else 0.0


def make_pad(keys, values, info, connection):
    buttons = [float(keys.get(code, False)) for code in BUTTON_CODES]
    buttons[6] = trigger_value(values[21], info[21])  # left trigger
    buttons[7] = trigger_value(values[20], info[20])  # right trigger
    return {"buttons": buttons, "connection": connection}


def reader():
    connection = 0
    while True:
        fd = None
        try:
            for path in sorted(glob.glob("/dev/input/event*")):
                candidate = None
                try:
                    candidate = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
                    if device_name(candidate) == "Steam Deck":
                        fd = candidate
                        break
                except OSError:
                    pass
                if candidate is not None:
                    os.close(candidate)
            if fd is None:
                time.sleep(2)
                continue
            connection += 1
            info = {code: abs_info(fd, code) for code in (20, 21)}
            values = {code: data[0] for code, data in info.items()}
            keys = key_state(fd)
            dropped = False

            def publish():
                with LOCK:
                    STATE["pad"] = make_pad(keys, values, info, connection)

            publish()
            while True:
                if not select.select([fd], [], [], 1)[0]:
                    continue
                data = os.read(fd, EVENT.size * 256)
                if not data:
                    break
                for _, _, kind, code, value in EVENT.iter_unpack(data):
                    if kind == 0 and code == 3:  # SYN_DROPPED: resync at next report.
                        dropped = True
                    elif kind == 0 and code == 0:
                        if dropped:
                            info = {code: abs_info(fd, code) for code in (20, 21)}
                            values = {code: data[0] for code, data in info.items()}
                            keys = key_state(fd)
                            # Reset the browser's neutral gate after missing input.
                            connection += 1
                            dropped = False
                        publish()
                    elif not dropped and kind == 3 and code in values:
                        values[code] = value
                    elif not dropped and kind == 1 and code in BUTTON_CODES:
                        keys[code] = bool(value)
        except (OSError, ValueError, struct.error):
            pass
        finally:
            if fd is not None:
                os.close(fd)
            with LOCK:
                STATE["pad"] = None
        time.sleep(1)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        origin = self.headers.get("Origin")
        if origin not in ORIGINS or self.path not in ("/events", "/health"):
            self.send_error(403)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream" if self.path == "/events" else "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.end_headers()
        if self.path == "/health":
            with LOCK:
                payload = {"connected": STATE["pad"] is not None}
            self.wfile.write(json.dumps(payload).encode())
            return
        try:
            while True:
                with LOCK:
                    payload = json.dumps(STATE, separators=(",", ":"))
                self.wfile.write(("data: " + payload + "\n\n").encode())
                self.wfile.flush()
                time.sleep(0.025)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass


if __name__ == "__main__":
    threading.Thread(target=reader, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
