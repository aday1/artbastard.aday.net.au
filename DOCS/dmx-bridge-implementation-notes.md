# DMX Bridge Implementation Notes

This document tracks the first implementation path:

- Browser control hosted in cloud (`test` / `live`)
- LAN bridge agent connects outbound to cloud
- Bridge writes Art-Net/sACN to local fixtures

## Phase 1 scope

- single-universe support
- outbound authenticated WebSocket
- reconnect with exponential backoff
- structured logs for latency sampling

## Security baseline

- short-lived bridge token
- TLS-only cloud transport
- no inbound firewall openings required at venue side

## Test checklist

- steady state frame rate under 30/60 updates per second
- packet loss simulation during WAN jitter
- restart bridge process while cloud app remains active
- restart cloud app while bridge remains active
