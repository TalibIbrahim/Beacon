#!/usr/bin/env python3
"""Beacon - probe Minecraft on Minecraft-Premium from arm-free (Python 3 standard library only).

  mc-probe.py ping --host 10.0.0.16 [--port 25565]

Prints one line of JSON for mc-agent.sh to put in its poll:
  {"online": true, "players": ["Steve", ...] | null, "count": 2, "max": 20, "version": "Paper 1.21.4"}
or `null` when Minecraft does not answer (two attempts, 3 seconds each).

"players" is null when the list is incomplete: the server-list ping only carries a sample of
names (Paper sends up to 12), and players who turned off "Allow Server Listings" show as
anonymous. Beacon then leaves playtime alone rather than guessing who left.
"""

import argparse
import json
import socket
import struct
import sys

ANONYMOUS_UUID = "00000000-0000-0000-0000-000000000000"
MAX_RESPONSE = 1024 * 1024  # the status JSON can carry a base64 favicon
MAX_NAMES = 200


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


def status(host: str, port: int, timeout: float) -> dict:
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


def cmd_ping(args: argparse.Namespace) -> None:
    for _attempt in range(2):
        try:
            print(json.dumps(summarise(status(args.host, args.port, 3.0)), separators=(",", ":")))
            return
        except (OSError, ValueError, IndexError, json.JSONDecodeError):
            continue
    print("null")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    ping = sub.add_parser("ping", help="server list ping")
    ping.add_argument("--host", required=True)
    ping.add_argument("--port", type=int, default=25565)
    ping.set_defaults(func=cmd_ping)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
