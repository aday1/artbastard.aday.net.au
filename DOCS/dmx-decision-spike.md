# DMX Edge Decision Spike

Status: provisional decision selected for first implementation.

## Candidate paths considered

1. Tailscale/WireGuard mesh
2. Outbound bridge agent on venue LAN
3. Hybrid translator/control-plane service

## Provisional decision

Implement **outbound bridge agent on venue LAN** first.

Why this first:
- avoids inbound UDP exposure from internet to venue LAN;
- keeps cloud control plane simple (HTTPS/WebSocket only);
- works across changing venue networks without static port forwards.

Tailscale remains a valid fallback path if bridge reliability is insufficient.

## Acceptance criteria

- End-to-end latency and jitter
- Packet reliability under load
- Reconnect behavior after drop
- Key management and security posture
- Operational complexity for live shows

## Spike success targets (v1)

- Median command-to-output latency <= 80 ms
- P95 latency <= 150 ms
- Packet delivery success >= 99.9% over 10 minute run
- Automatic reconnect <= 5 seconds after tunnel interruption
- No manual operator steps required after reconnect

## Minimal spike plan (one universe)

1. Deploy browser control to `test.artbastard.aday.net.au`.
2. Run local bridge agent on LAN machine with fixture output enabled.
3. Bind cloud events over secure WebSocket to bridge.
4. Capture metrics and failure behavior.
5. Record go/no-go and next candidate.

## Bridge contract draft

- Cloud -> Bridge transport: WebSocket (`wss`) with token auth.
- Bridge -> Fixtures: Art-Net/sACN UDP on local network.
- Message payload includes:
  - `universe`
  - `channelValues` (1..512)
  - `sequence`
  - `timestamp`

## Deferred items

- Multi-universe routing optimization
- Local failover queue for long WAN outages
- Tailscale comparative benchmark run
