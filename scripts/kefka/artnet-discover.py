#!/usr/bin/env python3
"""Read-only ArtPoll discovery without binding the running server's UDP port.

Run on Kefka with CAP_NET_RAW/root. Sends one ArtPoll from this interface's
own address on UDP 6454 and captures its reply for 3.3 seconds. No ArtDMX,
ArtAddress, ArtIpProg, configuration changes, or socket reuse are performed.
"""

import argparse
import datetime
import ipaddress
import json
import pathlib
import socket
import struct
import subprocess
import time
import urllib.request


def checksum(data):
    if len(data) % 2:
        data += b"\0"
    total = sum(struct.unpack("!" + str(len(data) // 2) + "H", data))
    while total >> 16:
        total = (total & 65535) + (total >> 16)
    return (~total) & 65535


def make_poll_frame(mac, source, destination):
    source_bytes = socket.inet_aton(source)
    destination_bytes = socket.inet_aton(destination)
    poll = b"Art-Net\0" + struct.pack("<H", 0x2000) + struct.pack("!HBB", 14, 0, 0)
    udp = struct.pack("!HHHH", 6454, 6454, 8 + len(poll), 0)
    pseudo = source_bytes + destination_bytes + struct.pack("!BBH", 0, 17, len(udp) + len(poll))
    udp = struct.pack("!HHHH", 6454, 6454, len(udp) + len(poll), checksum(pseudo + udp + poll) or 65535)
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(udp) + len(poll), 0x4150, 0, 64, 17, 0, source_bytes, destination_bytes)
    ip = ip[:10] + struct.pack("!H", checksum(ip)) + ip[12:]
    assert len(poll) == 14 and checksum(ip) == 0 and checksum(pseudo + udp + poll) == 0
    return b"\xff" * 6 + mac + struct.pack("!H", 0x0800) + ip + udp + poll


def parse_reply(data, source, source_port):
    if len(data) < 207:
        return {"source": source, "source_port": source_port, "reply_length": len(data),
                "error": "ArtPollReply shorter than 207 bytes"}
    def cstring(start, size):
        return data[start:start + size].split(b"\0", 1)[0].decode("ascii", "replace")
    net, sub = data[18] & 127, data[19] & 15
    count = struct.unpack("!H", data[172:174])[0]
    ports = []
    for index in range(min(count, 4)):
        kind, status, swout = data[174 + index], data[182 + index], data[190 + index] & 15
        ports.append({
            "index": index + 1, "port_type_hex": hex(kind),
            "is_dmx_output": bool(kind & 128) and kind & 63 == 0,
            "swout": swout, "port_address": (net << 8) | (sub << 4) | swout,
            "good_output_hex": hex(status), "output_active_flag": bool(status & 128),
            "output_protocol": "sACN" if status & 1 else "Art-Net",
        })
    return {
        "source": source, "source_port": source_port, "reply_length": len(data),
        "advertised_ip": socket.inet_ntoa(data[10:14]),
        "firmware_bytes": list(data[16:18]),
        "firmware_uint16": struct.unpack("!H", data[16:18])[0],
        "short_name": cstring(26, 18), "long_name": cstring(44, 64),
        "node_report": cstring(108, 64),
        "mac": ":".join(f"{value:02x}" for value in data[201:207]),
        "net": net, "subnet": sub, "num_ports": count, "ports": ports,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interface", default="enp4s0f3u1u4")
    parser.add_argument("--source", default="192.168.1.20")
    parser.add_argument("--target", default="192.168.1.199")
    args = parser.parse_args()
    source_ip, target_ip = ipaddress.IPv4Address(args.source), ipaddress.IPv4Address(args.target)
    interfaces = json.loads(subprocess.check_output(["ip", "-j", "-4", "address", "show", "dev", args.interface]))
    matches = [address for interface in interfaces for address in interface.get("addr_info", [])
               if address.get("local") == str(source_ip)]
    if len(matches) != 1:
        raise SystemExit("Source must be an existing IPv4 address on the selected interface")
    network = ipaddress.IPv4Network(f"{source_ip}/{matches[0]['prefixlen']}", strict=False)
    if target_ip not in network or network.prefixlen > 30:
        raise SystemExit("Target must be on the selected interface's broadcast-capable subnet")
    broadcast = str(network.broadcast_address)
    with urllib.request.urlopen("http://127.0.0.1:3030/api/state", timeout=3) as response:
        state = json.load(response)
    channels = state.get("dmxChannels", [])
    if len(channels) != 512 or any(channels):
        raise SystemExit("This diagnostic expects Artbastard's 512 channels to be zero")
    mac = bytes.fromhex(pathlib.Path("/sys/class/net", args.interface, "address").read_text().strip().replace(":", ""))
    frame = make_poll_frame(mac, str(source_ip), broadcast)
    replies = []
    # ETH_P_IP captures inbound replies without promiscuous mode. It does not
    # capture existing outgoing ArtDMX; absence of such frames is not evidence.
    with socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800)) as capture:
        capture.bind((args.interface, 0))
        capture.settimeout(0.2)
        sent = capture.send(frame)
        started = datetime.datetime.now(datetime.timezone.utc).isoformat()
        deadline = time.monotonic() + 3.3
        while time.monotonic() < deadline:
            try:
                packet = capture.recv(4096)
            except socket.timeout:
                continue
            if len(packet) < 42 or packet[12:14] != b"\x08\x00":
                continue
            ihl = (packet[14] & 15) * 4
            if ihl < 20 or packet[23] != 17 or len(packet) < 14 + ihl + 8:
                continue
            source = socket.inet_ntoa(packet[26:30])
            if source != str(target_ip):
                continue
            offset = 14 + ihl
            sport, dport, length, _ = struct.unpack("!HHHH", packet[offset:offset + 8])
            data = packet[offset + 8:offset + length]
            if sport != 6454 or dport != 6454 or data[:10] != b"Art-Net\0\x00\x21":
                continue
            reply = parse_reply(data, source, sport)
            reply["destination"] = socket.inet_ntoa(packet[30:34])
            reply["destination_port"] = dport
            replies.append(reply)
    print(json.dumps({
        "utc": started, "query": "ArtPoll only", "interface": args.interface,
        "source": f"{source_ip}:6454", "destination": f"{broadcast}:6454",
        "artnet_hex": frame[-14:].hex(), "ethernet_bytes_sent": sent,
        "capture_seconds": 3.3, "server_dmx_nonzero_before": 0, "replies": replies,
    }, indent=2))


if __name__ == "__main__":
    main()
