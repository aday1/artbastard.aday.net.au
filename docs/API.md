# ArtBastard API Documentation

## Overview

ArtBastard provides a RESTful API and WebSocket interface for controlling DMX lighting systems. This document describes all available endpoints and their usage.

## Base URL

- Development: `http://localhost:3030`
- Production: Configured via environment variables

## Authentication

Currently, ArtBastard does not require authentication for local use. Future versions may include authentication for remote access.

## REST API Endpoints

### DMX Control

#### Update Single DMX Channel
```http
POST /api/dmx
Content-Type: application/json

{
  "channel": 1,
  "value": 128
}
```

**Response:**
```json
{
  "success": true,
  "channel": 1,
  "value": 128
}
```

#### Update Multiple DMX Channels (Batch)
```http
POST /api/dmx/batch
Content-Type: application/json

{
  "0": 128,
  "1": 255,
  "2": 64
}
```

**Response:**
```json
{
  "success": true,
  "updated": 3
}
```

#### Get Current DMX State
```http
GET /api/dmx
```

**Response:**
```json
{
  "channels": [0, 128, 255, ...],
  "universe": 0
}
```

### Scene Management

#### List All Scenes
```http
GET /api/scenes
```

**Response:**
```json
{
  "scenes": [
    {
      "name": "Scene 1",
      "channelValues": [128, 255, 0, ...],
      "oscAddress": "/scene/1"
    }
  ]
}
```

#### Get Scene
```http
GET /api/scenes/:name
```

**Response:**
```json
{
  "name": "Scene 1",
  "channelValues": [128, 255, 0, ...],
  "oscAddress": "/scene/1",
  "timeline": {
    "enabled": true,
    "duration": 10000,
    "keyframes": [...]
  }
}
```

#### Create/Update Scene
```http
POST /api/scenes
Content-Type: application/json

{
  "name": "Scene 1",
  "channelValues": [128, 255, 0, ...],
  "oscAddress": "/scene/1"
}
```

**Response:**
```json
{
  "success": true,
  "scene": {
    "name": "Scene 1",
    ...
  }
}
```

#### Delete Scene
```http
DELETE /api/scenes/:name
```

**Response:**
```json
{
  "success": true
}
```

### Fixture Management

#### List All Fixtures
```http
GET /api/fixtures
```

**Response:**
```json
{
  "fixtures": [
    {
      "id": "fixture-1",
      "name": "LED Wash 1",
      "type": "RGB Wash",
      "startAddress": 1,
      "channels": [...]
    }
  ]
}
```

#### Get Fixture
```http
GET /api/fixtures/:id
```

#### Create/Update Fixture
```http
POST /api/fixtures/:id
Content-Type: application/json

{
  "name": "LED Wash 1",
  "type": "RGB Wash",
  "startAddress": 1,
  "channels": [...]
}
```

#### Delete Fixture
```http
DELETE /api/fixtures/:id
```

### Configuration

#### Get Configuration
```http
GET /api/config
```

**Response:**
```json
{
  "artNetConfig": {
    "ip": "192.168.1.199",
    "subnet": 0,
    "universe": 0,
    "net": 0,
    "port": 6454
  },
  "oscConfig": {
    "host": "127.0.0.1",
    "port": 8000
  }
}
```

#### Update Configuration
```http
POST /api/config
Content-Type: application/json

{
  "artNetConfig": {
    "ip": "192.168.1.200",
    "universe": 1
  }
}
```

### Factory Reset

#### Check Factory Reset Status
```http
GET /api/factory-reset-check
```

**Response:**
```json
{
  "factoryReset": false
}
```

## WebSocket API

ArtBastard uses Socket.io for real-time communication.

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3030');
```

### Events

#### Client → Server

**dmx:update**
```javascript
socket.emit('dmx:update', {
  channel: 1,
  value: 128
});
```

**scene:load**
```javascript
socket.emit('scene:load', {
  name: 'Scene 1'
});
```

**midi:message**
```javascript
socket.emit('midi:message', {
  channel: 1,
  note: 60,
  velocity: 127
});
```

#### Server → Client

**dmx:update**
```javascript
socket.on('dmx:update', (data) => {
  console.log('DMX updated:', data);
  // { channel: 1, value: 128 }
});
```

**artnetStatus**
```javascript
socket.on('artnetStatus', (status) => {
  console.log('Art-Net status:', status);
  // { status: 'connected', message: '...' }
});
```

**osc:message**
```javascript
socket.on('osc:message', (message) => {
  console.log('OSC message:', message);
  // { address: '/test', args: [...] }
});
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input data
- `NOT_FOUND` - Resource not found
- `SERVER_ERROR` - Internal server error
- `NETWORK_ERROR` - Network/connection error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- DMX updates: 1000 requests per minute
- Scene operations: 100 requests per minute
- Configuration: 10 requests per minute

## Examples

### JavaScript/TypeScript

```typescript
// Update DMX channel
async function updateDmxChannel(channel: number, value: number) {
  const response = await fetch('http://localhost:3030/api/dmx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, value })
  });
  return response.json();
}

// Load scene
async function loadScene(name: string) {
  const response = await fetch(`http://localhost:3030/api/scenes/${name}`, {
    method: 'GET'
  });
  return response.json();
}

// WebSocket connection
import io from 'socket.io-client';
const socket = io('http://localhost:3030');

socket.on('dmx:update', (data) => {
  console.log(`Channel ${data.channel} = ${data.value}`);
});
```

### Python

```python
import requests
import socketio

# Update DMX channel
response = requests.post('http://localhost:3030/api/dmx', json={
    'channel': 1,
    'value': 128
})

# WebSocket connection
sio = socketio.Client()
sio.connect('http://localhost:3030')

@sio.on('dmx:update')
def on_dmx_update(data):
    print(f"Channel {data['channel']} = {data['value']}")
```

## Versioning

Current API version: `v1`

API versioning is handled via URL path (future):
- `/api/v1/dmx`
- `/api/v2/dmx`

## Changelog

### v1.0.0
- Initial API release
- DMX control endpoints
- Scene management
- Fixture management
- WebSocket support

