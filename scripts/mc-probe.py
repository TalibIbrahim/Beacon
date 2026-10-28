#!/usr/bin/env python3
"""Beacon - probe Minecraft on Minecraft-Premium from arm-free (Python 3 standard library only).

  mc-probe.py status --host 10.0.0.16 [--port 25565] [--rcon-port 25575] [--ssh ubuntu@10.0.0.16]
  mc-probe.py ping   --host 10.0.0.16 [--port 25565]

`status` prints one line of JSON for mc-agent.sh's poll:
  {"minecraft": {"online": true, "players": [...] | null, "count": 2, "max": 20, "version": "..."} | null,
   "health": {"tps": 19.9, "mspt": 12.3, "rssBytes": ..., "uptimeSec": ..., "memTotalBytes": ...} | null}

- minecraft: from the server-list ping (two attempts, 3 seconds each); null when Minecraft does not
  answer. "players" is null when the list is incomplete: the ping only carries a sample of names
  (Paper sends up to 12) and players who turned off "Allow Server Listings" show as anonymous.
- With RCON_PASSWORD in the environment (never on the command line), RCON adds `list` (every
  name), `tps` and `mspt`. Anything it cannot parse is null, shown as "unavailable".
- With --ssh, one fixed command over SSH reads the Java process's memory and uptime and the VM's
  total memory. It only runs when Minecraft answered, so a stopped VM costs no SSH timeout.
- health is null when Minecraft is not answering.

`ping` prints just the "minecraft" part.
"""

import argparse
import json
import os
import re
import socket
import struct
import subprocess
import sys

ANONYMOUS_UUID = "00000000-0000-0000-0000-000000000000"
MAX_RESPONSE = 1024 * 1024  # the status JSON can carry a base64 favicon
MAX_NAMES = 200
SECTION = chr(0xA7)  # Minecraft colour codes: the section sign followed by one character
COLOUR_CODE = re.compile(SECTION + ".")
NUMBER = re.compile(r"\*?(\d+(?:\.\d+)?)")


# --- Server-list ping -----------------------------------------------------------------------------

def varint(n: int) -> bytes:
    out = b""
    n &= 0xFFFFFFFF
    while True:
        byte = n & 0x7F
        n >>= 7
        if n:
            out += bytes([byte | 0x80])
        else:
            return out + bytes([byte])


def recv_exact(sock: socket.socket, n: int) -> bytes:
    data = b""
    while len(data) < n:
        chunk = sock.recv(n - len(data))
        if not chunk:
            raise ConnectionError("connection closed")
        data += chunk
    return data


def read_varint(sock: socket.socket) -> int:
    value = 0
    for shift in range(0, 35, 7):
        byte = recv_exact(sock, 1)[0]
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value
    raise ValueError("varint too long")


def varint_from(data: bytes, pos: int) -> "tuple[int, int]":
    value = 0
    for shift in range(0, 35, 7):
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
    raise ValueError("varint too long")


def server_status(host: str, port: int, timeout: float) -> dict:
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        host_bytes = host.encode("utf-8")
        # Handshake (protocol version is ignored for status), next state 1 = status; then request
        handshake = b"\x00" + varint(767) + varint(len(host_bytes)) + host_bytes + struct.pack(">H", port) + varint(1)
        sock.sendall(varint(len(handshake)) + handshake + varint(1) + b"\x00")
        length = read_varint(sock)
        if length <= 0 or length > MAX_RESPONSE:
            raise ValueError("bad response length")
        payload = recv_exact(sock, length)
    # Packet id (0x00), then the JSON as a varint-prefixed string
    packet_id, pos = varint_from(payload, 0)
    if packet_id != 0:
        raise ValueError("unexpected packet")
    str_len, pos = varint_from(payload, pos)
    if pos + str_len > len(payload):
        raise ValueError("truncated status")
    return json.loads(payload[pos:pos + str_len].decode("utf-8", errors="replace"))


def summarise(raw: dict) -> dict:
    players = raw.get("players") if isinstance(raw.get("players"), dict) else {}
    count = players.get("online") if isinstance(players.get("online"), int) else None
    maximum = players.get("max") if isinstance(players.get("max"), int) else None
    sample = players.get("sample") if isinstance(players.get("sample"), list) else []
    names = []
    for entry in sample:
        if not isinstance(entry, dict):
            continue
        name, uuid = entry.get("name"), entry.get("id")
        if isinstance(name, str) and 0 < len(name) <= 64 and uuid != ANONYMOUS_UUID:
            names.append(name)
    complete = count is not None and count == len(names) and count <= MAX_NAMES
    version = raw.get("version", {}).get("name") if isinstance(raw.get("version"), dict) else None
    return {
        "online": True,
        "players": names if complete else None,
        "count": max(0, min(count, 100000)) if count is not None else None,
        "max": max(0, min(maximum, 100000)) if maximum is not None else None,
        "version": version[:100] if isinstance(version, str) else None,
    }


def ping(host: str, port: int):
    for _attempt in range(2):
        try:
            return summarise(server_status(host, port, 3.0))
        except (OSError, ValueError, IndexError, json.JSONDecodeError):
            continue
    return None


# --- RCON -----------------------------------------------------------------------------------------

class Rcon:
    AUTH, COMMAND = 3, 2

    def __init__(self, host: str, port: int, password: str, timeout: float = 4.0):
        self.sock = socket.create_connection((host, port), timeout=timeout)
        self.sock.settimeout(timeout)
        self.next_id = 1
        if self._send(self.AUTH, password)[0] == -1:
            self.sock.close()
            raise PermissionError("RCON password rejected")

    def _send(self, kind: int, body: str) -> "tuple[int, str]":
        request_id = self.next_id
        self.next_id += 1
        data = body.encode("utf-8")
        packet = struct.pack("<ii", request_id, kind) + data + b"\x00\x00"
        self.sock.sendall(struct.pack("<i", len(packet)) + packet)
        while True:
            (length,) = struct.unpack("<i", recv_exact(self.sock, 4))
            if length < 10 or length > 1024 * 1024:
                raise ValueError("bad RCON packet")
            raw = recv_exact(self.sock, length)
            got_id, got_kind = struct.unpack("<ii", raw[:8])
            # The server answers an auth with an empty response packet first, then the result
            if kind == self.AUTH and got_kind != 2:
                continue
            return got_id, raw[8:-2].decode("utf-8", errors="replace")

    def command(self, cmd: str) -> str:
        return self._send(self.COMMAND, cmd)[1]

    def close(self) -> None:
        self.sock.close()


def plain(text: str) -> str:
    return COLOUR_CODE.sub("", text)


def parse_tps(text: str):
    # "TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.97" (a leading * means "above 20")
    line = plain(text)
    if ":" not in line:
        return None
    values = NUMBER.findall(line.split(":", 1)[1])
    return round(min(float(values[0]), 100.0), 2) if values else None


def parse_mspt(text: str):
    # "Server tick times (avg/min/max) from last 5s, 10s, 1m:" then "x/y/z, x/y/z, x/y/z": take the 5s average
    lines = [ln for ln in plain(text).splitlines() if ln.strip()]
    for i, ln in enumerate(lines):
        if "tick" in ln.lower() and i + 1 < len(lines):
            values = NUMBER.findall(lines[i + 1])
            return round(float(values[0]), 2) if values else None
    return None


def parse_list(text: str):
    # "There are 2 of a max of 20 players online: Steve, alex_01"
    line = plain(text).strip()
    m = re.match(r"There are (\d+) of a max(?: of)? (\d+) players online:?\s*(.*)$", line, re.S)
    if not m:
        return None
    count, maximum, rest = int(m.group(1)), int(m.group(2)), m.group(3).strip()
    names = [n.strip() for n in rest.split(",") if n.strip()] if rest else []
    if len(names) != count or count > MAX_NAMES or any(len(n) > 64 for n in names):
        return None
    return {"players": names, "count": count, "max": maximum}


def rcon_readings(host: str, port: int, password: str) -> dict:
    out = {"tps": None, "mspt": None, "list": None}
    try:
        rcon = Rcon(host, port, password)
    except (OSError, ValueError, PermissionError, struct.error):
        return out
    try:
        for key, cmd, parse in (("list", "list", parse_list), ("tps", "tps", parse_tps), ("mspt", "mspt", parse_mspt)):
            try:
                out[key] = parse(rcon.command(cmd))
            except (OSError, ValueError, IndexError, struct.error):
                out[key] = None
    finally:
        rcon.close()
    return out


# --- Process stats over SSH ------------------------------------------------------------------------

# Fixed command: the java process's resident memory (KiB) and age (s), then the VM's total memory
REMOTE_STATS = "ps -C java -o rss=,etimes= --sort=-rss | head -n 1; grep -m 1 MemTotal /proc/meminfo"


def ssh_stats(target: str) -> dict:
    out = {"rssBytes": None, "uptimeSec": None, "memTotalBytes": None}
    try:
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", target, REMOTE_STATS],
            capture_output=True, text=True, timeout=12,
        )
    except (OSError, subprocess.TimeoutExpired):
        return out
    lines = result.stdout.splitlines()
    for line in lines:
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            out["rssBytes"] = int(parts[0]) * 1024
            out["uptimeSec"] = int(parts[1])
        elif parts[:1] == ["MemTotal:"] and len(parts) >= 2 and parts[1].isdigit():
            out["memTotalBytes"] = int(parts[1]) * 1024
    return out


# --- Commands -------------------------------------------------------------------------------------

def emit(value) -> None:
    print(json.dumps(value, separators=(",", ":")))


def cmd_ping(args: argparse.Namespace) -> None:
    emit(ping(args.host, args.port))


def cmd_status(args: argparse.Namespace) -> None:
    minecraft = ping(args.host, args.port)
    if minecraft is None:
        emit({"minecraft": None, "health": None})
        return
    health = {"tps": None, "mspt": None, "rssBytes": None, "uptimeSec": None, "memTotalBytes": None}
    password = os.environ.get("RCON_PASSWORD", "")
    if password:
        readings = rcon_readings(args.host, args.rcon_port, password)
        health["tps"], health["mspt"] = readings["tps"], readings["mspt"]
        if readings["list"] is not None:
            # RCON's list has every name; prefer it over the ping's sample
            minecraft.update(readings["list"])
    if args.ssh:
        health.update(ssh_stats(args.ssh))
    emit({"minecraft": minecraft, "health": health})


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe Minecraft for Beacon")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_ping = sub.add_parser("ping", help="server list ping only")
    p_ping.add_argument("--host", required=True)
    p_ping.add_argument("--port", type=int, default=25565)
    p_ping.set_defaults(func=cmd_ping)
    p_status = sub.add_parser("status", help="ping, RCON and process stats")
    p_status.add_argument("--host", required=True)
    p_status.add_argument("--port", type=int, default=25565)
    p_status.add_argument("--rcon-port", type=int, default=25575)
    p_status.add_argument("--ssh", default="", help="ssh target for process stats, e.g. ubuntu@10.0.0.16")
    p_status.set_defaults(func=cmd_status)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
