# DMX Edge Decision Spike

Status: open decision, implementation deferred.

## Candidate paths

1. Tailscale/WireGuard mesh
2. Outbound bridge agent on venue LAN
3. Hybrid translator/control-plane service

## Acceptance criteria

- End-to-end latency and jitter
- Packet reliability under load
- Reconnect behavior after drop
- Key management and security posture
- Operational complexity for live shows

## Minimal spike plan

1. Deploy browser control to `test.artbastard.aday.net.au`.
2. Run one-universe test with one candidate.
3. Capture metrics and failure behavior.
4. Record go/no-go and next candidate.
