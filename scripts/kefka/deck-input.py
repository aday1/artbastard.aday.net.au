#!/usr/bin/env python3
"""Read-only Steam Deck buttons for ArtBastard. Never grabs or synthesizes input."""
import fcntl
import glob
import json
import os
from pathlib import Path
import select
import socket
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
DECK_CLASS = "chrome-127.0.0.1__deck-control.html-Default"


class NativeInputGate:
    """Read desktop ownership without changing the mapper or compositor."""

    def __init__(self, runtime=None, proc=None, uid=None):
        self.uid = os.getuid() if uid is None else uid
        self.runtime = Path(runtime or os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{self.uid}"))
        self.proc = Path(proc or "/proc")
        self.lock = threading.Lock()
        self.allowed = False
        self.reason = "Checking Deck desktop input mode"
        self.checked_at = 0
        self.generation = 0
        self.identity = None

    def live_process(self, pid, name):
        """A PID file or old mode timestamp alone does not prove a live mapper."""
        try:
            process = self.proc / str(int(pid))
            if int(pid) <= 1 or process.stat().st_uid != self.uid:
                return None
            if (process / "comm").read_text().strip() != name:
                return None
            fields = (process / "stat").read_text().rsplit(")", 1)[1].split()
            if fields[0] in ("Z", "X", "x", "T", "t"):
                return None
            return str(pid), fields[19]  # PID + start time protects against reuse.
        except (OSError, ValueError, IndexError):
            return None

    def mapper_state(self):
        try:
            mapper = self.runtime / "deckhypr"
            identity = self.live_process((mapper / "pid").read_text().strip(), "deckhypr")
            if identity is None:
                return None, "Deck desktop mapper is not running"
            state = json.loads((mapper / "state.json").read_text())
            if state.get("mode") != "game":
                return None, "Open ArtBastard Deck from the launcher for native controls"
            if state.get("pad") != "kernel" or state.get("launcher") != "closed":
                return None, "Deck desktop mapper is not ready for native controls"
            # deckhypr writes only on transitions: an old ts is valid while
            # this same live process remains in GAME mode.
            return identity, None
        except (OSError, ValueError, AttributeError):
            return None, "Deck desktop mapper state is unavailable"

    def active_window(self):
        """Query a live compositor directly, ignoring stale manager signatures."""
        candidates = []
        for path in (self.runtime / "hypr").glob("*/.socket.sock"):
            try:
                pid = (path.parent / "hyprland.lock").read_text().splitlines()[0]
                if self.live_process(pid, "Hyprland"):
                    candidates.append(path)
            except (OSError, IndexError):
                continue
        # Normally there is one live session. Decline ambiguous sessions rather
        # than accepting a game window on a different desktop.
        if len(candidates) != 1:
            return None
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
            connection.settimeout(0.1)
            connection.connect(str(candidates[0]))
            connection.sendall(b"j/activewindow")
            data = bytearray()
            while len(data) < 65536:
                chunk = connection.recv(65536 - len(data))
                if not chunk:
                    break
                data.extend(chunk)
            return json.loads(data)

    def check(self):
        identity, reason = self.mapper_state()
        if identity:
            try:
                active = self.active_window()
                if not isinstance(active, dict) or active.get("class") != DECK_CLASS or not active.get("address"):
                    identity, reason = None, "Focus the ArtBastard Deck launcher window for native controls"
                else:
                    identity = (*identity, active["address"])
            except (OSError, ValueError):
                identity, reason = None, "Deck window focus is unavailable"
        with self.lock:
            if identity != self.identity:
                self.generation += 1
            self.identity = identity
            self.allowed = identity is not None
            self.reason = reason
            self.checked_at = time.monotonic()

    def run(self):
        while True:
            self.check()
            time.sleep(0.2)

    def snapshot(self, pad):
        with self.lock:
            allowed = self.allowed and time.monotonic() - self.checked_at < 0.5
            reason = self.reason if allowed or not self.allowed else "Deck desktop input check is stale"
            generation = self.generation
        return {
            "connected": pad is not None,
            "nativeAllowed": allowed,
            "nativeReason": reason,
            "pad": {**pad, "connection": f"{pad['connection']}:{generation}"} if allowed and pad else None,
        }


GATE = NativeInputGate()


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
                payload = GATE.snapshot(STATE["pad"])
            del payload["pad"]
            self.wfile.write(json.dumps(payload).encode())
            return
        try:
            while True:
                with LOCK:
                    payload = json.dumps(GATE.snapshot(STATE["pad"]), separators=(",", ":"))
                self.wfile.write(("data: " + payload + "\n\n").encode())
                self.wfile.flush()
                time.sleep(0.025)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass


if __name__ == "__main__":
    threading.Thread(target=reader, daemon=True).start()
    threading.Thread(target=GATE.run, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
