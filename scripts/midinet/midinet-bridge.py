"""Send a USB MIDI keyboard on this machine (e.g. a Launchkey 49 on ULTIMA) to Kefka over the LAN.

Kefka's midinet-server.js turns each port into an ALSA virtual port "<port> (<HOST>)", so ArtBastard, Chrome
(Web MIDI) and Macroverse on Kefka see the keyboard as if it were plugged into the Deck. Messages sent back to
that port (LED feedback) are played to the keyboard here.

Windows lets only one program open a MIDI input, so this bridge also mirrors everything it reads to a local
loopback port (LoopBe by default) for browsers and apps on this machine.

  python midinet-bridge.py               run (reconnects forever)
  python midinet-bridge.py --list        show MIDI ports
Settings: MIDINET_HOST (comma list tried in order, default kefka.lan; put Kefka's Tailscale address first; ULTIMA reaches Kefka's LAN address only through the router), MIDINET_PORT (18790), MIDINET_MATCH (Launchkey), MIDINET_MIRROR (LoopBe),
MIDINET_NAME (computer name).
"""
import json, os, queue, socket, struct, sys, threading, time
import rtmidi

HOSTS = [h.strip() for h in os.environ.get("MIDINET_HOST", "kefka.lan").split(",") if h.strip()]
PORT = int(os.environ.get("MIDINET_PORT", "18790"))
MATCH = [m.strip().lower() for m in os.environ.get("MIDINET_MATCH", "Launchkey").split(",") if m.strip()]
MIRROR = os.environ.get("MIDINET_MIRROR", "LoopBe").lower()
NAME = os.environ.get("MIDINET_NAME", os.environ.get("COMPUTERNAME", socket.gethostname())).upper()
LOG = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "kefka-midinet", "bridge.log")


def log(*parts):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(str(p) for p in parts)
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        if os.path.getsize(LOG) > 2_000_000:
            os.replace(LOG, LOG + ".1")
    except OSError:
        pass
    if sys.stdout:
        print(line, flush=True)


def clean(name):
    """Windows port name -> stable friendly name shared by the input and output side.

    "Launchkey 49 2" -> "Launchkey 49"; "MIDIIN2 (Launchkey 49) 3" / "MIDIOUT2 (Launchkey 49) 4" ->
    "Launchkey 49 InControl" (Novation's second port)."""
    parts = name.rsplit(" ", 1)
    name = parts[0] if len(parts) == 2 and parts[1].isdigit() else name
    for prefix in ("MIDIIN", "MIDIOUT"):
        if name.upper().startswith(prefix) and "(" in name and name.endswith(")"):
            inner = name[name.index("(") + 1:-1]
            return f"{inner} InControl" if "launchkey" in inner.lower() else f"{inner} port {name[len(prefix):name.index('(')].strip()}"
    return name


def scan():
    probe_in, probe_out = rtmidi.MidiIn(), rtmidi.MidiOut()
    ins = [(i, n) for i, n in enumerate(probe_in.get_ports()) if any(m in n.lower() for m in MATCH)]
    outs = {clean(n): i for i, n in enumerate(probe_out.get_ports()) if any(m in n.lower() for m in MATCH)}
    mirror = next((i for i, n in enumerate(probe_out.get_ports()) if MIRROR and MIRROR in n.lower()), None)
    del probe_in, probe_out
    return ins, outs, mirror


def run_once():
    ins, outs, mirror_index = scan()
    if not ins:
        return "no matching MIDI input (is the keyboard plugged in?)"
    sock, host = None, None
    for host in HOSTS:
        try:
            sock = socket.create_connection((host, PORT), timeout=3)
            break
        except OSError as e:
            log(f"{host}:{PORT} unreachable:", e)
    if sock is None:
        raise OSError("no Kefka address reachable")
    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    sock.settimeout(2.0)
    ports, opened = [], []
    mirror = None
    if mirror_index is not None:
        try:
            mirror = rtmidi.MidiOut()
            mirror.open_port(mirror_index)
        except Exception as e:  # noqa: BLE001 - a busy loopback must not stop the bridge
            log("mirror port unavailable:", e)
            mirror = None
    sendq = queue.Queue()
    for pid, (index, name) in enumerate(ins):
        dev = rtmidi.MidiIn()
        try:
            dev.open_port(index)
        except Exception as e:  # noqa: BLE001
            log(f"cannot open '{name}' (another program has it open?):", e)
            continue
        dev.ignore_types(sysex=False, timing=True, active_sense=True)

        def cb(event, data=None, pid=pid, label=clean(name)):
            message = event[0]
            sendq.put(struct.pack(">BH", pid, len(message)) + bytes(message))
            if mirror is not None and pid == 0:   # mirror the keys/main port only
                try:
                    mirror.send_message(message)
                except Exception:  # noqa: BLE001
                    pass
        dev.set_callback(cb)
        opened.append(dev)
        out = None
        if clean(name) in outs:
            out = rtmidi.MidiOut()
            try:
                out.open_port(outs[clean(name)])
            except Exception:  # noqa: BLE001
                out = None
        ports.append({"id": pid, "name": clean(name), "out": out})
    if not opened:
        sock.close()
        return "could not open any keyboard port"
    sock.sendall((json.dumps({"hello": 1, "host": NAME, "ports": [{"id": p["id"], "name": p["name"]} for p in ports]}) + "\n").encode())
    log("connected to", f"{host}:{PORT}", "ports", [p["name"] for p in ports], "mirror", "on" if mirror else "off")
    stop = threading.Event()

    def sender():
        while not stop.is_set():
            try:
                frame = sendq.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                sock.sendall(frame)
            except OSError:
                stop.set()
    threading.Thread(target=sender, daemon=True).start()
    buffer = b""
    try:
        while not stop.is_set():
            try:
                chunk = sock.recv(4096)
            except socket.timeout:
                # Quiet link: check the keyboard is still plugged in, then keep waiting.
                if not any(any(m in n.lower() for m in MATCH) for n in rtmidi.MidiIn().get_ports()):
                    break
                continue
            if not chunk:
                break
            buffer += chunk
            if b"\n" in buffer and buffer.startswith(b"{"):
                line, buffer = buffer.split(b"\n", 1)
                log("kefka says", line.decode(errors="replace")[:200])
            while len(buffer) >= 3:
                pid, length = struct.unpack(">BH", buffer[:3])
                if len(buffer) < 3 + length:
                    break
                data, buffer = list(buffer[3:3 + length]), buffer[3 + length:]
                port = next((p for p in ports if p["id"] == pid), None)
                if port and port["out"] is not None:
                    port["out"].send_message(data)
    finally:
        stop.set()
        for dev in opened:
            dev.close_port()
        for p in ports:
            if p["out"] is not None:
                p["out"].close_port()
        if mirror is not None:
            mirror.close_port()
        sock.close()
    return "connection closed"


def main():
    if "--list" in sys.argv:
        print("IN ", rtmidi.MidiIn().get_ports())
        print("OUT", rtmidi.MidiOut().get_ports())
        return
    delay = 1
    while True:
        try:
            reason = run_once()
            delay = 1 if reason == "connection closed" else min(delay * 2, 10)
            log(reason, f"- retrying in {delay}s")
        except OSError as e:
            delay = min(delay * 2, 10)
            log("kefka unreachable:", e, f"- retrying in {delay}s")
        time.sleep(delay)


if __name__ == "__main__":
    main()
