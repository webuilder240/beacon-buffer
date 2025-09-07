# Beacon Buffer

A lightweight, configurable JavaScript library for buffering and sending data using the Beacon API. Features a clean API for flexible, predictable usage across your application.

## About Beacon API

The Beacon API provides a way to send data to web servers that is specifically designed to work reliably even when pages are being unloaded. Unlike traditional HTTP requests (such as `fetch` or `XMLHttpRequest`), beacon requests are:

- **Guaranteed delivery**: The browser ensures beacon requests are sent even if the page unloads
- **Non-blocking**: Requests don't delay page navigation or user interactions
- **Asynchronous**: Fire-and-forget mechanism that doesn't wait for responses
- **Optimized for analytics**: Perfect for sending user behavior data, error reports, and metrics

This makes the Beacon API ideal for analytics, logging, and any scenario where you need to reliably send data as users navigate away from your pages.

Learn more: [Beacon API - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Beacon_API)

## Features

- 🚀 Automatic data buffering in localStorage
- 📡 Reliable data transmission using Beacon API
- ⚡ Sends data on page unload/hide automatically
- ⏱️ Configurable send intervals
- 🔧 Custom HTTP headers support
- 💾 Persistent storage across page reloads
- 🎯 Zero dependencies
- 📦 Small footprint
- 🎨 Clean API with flexible buffer management

## Installation

### NPM
```bash
npm install beacon-buffer
```

## Quick Start

```javascript
import BeaconBuffer from 'beacon-buffer';

// Create a buffer instance
const buffer = new BeaconBuffer({
  endpointUrl: 'https://api.example.com/logs',
  sendInterval: 30000,
  autoStart: true // Optional: automatically start sending
});

// If not using autoStart, manually start
buffer.start();

// Add data to the buffer
buffer.addLog({
  event: 'user_action',
  timestamp: Date.now(),
  data: { /* your data */ }
});
```

## API Reference

### BeaconBuffer Class

#### Constructor: `new BeaconBuffer(config)`
Creates a new beacon buffer instance.

**Configuration Options:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `endpointUrl` | string | Yes | - | The URL to send buffered data to |
| `sendInterval` | number | No | 20000 | Interval in milliseconds between automatic sends |
| `headers` | object | No | {} | Custom headers to include in the request |
| `bufferKey` | string | No | 'beaconBuffer' | LocalStorage key for storing buffered data |
| `dataKey` | string | No | 'logs' | Key name for the data array in the request body |
| `autoStart` | boolean | No | false | Automatically start sending after initialization |

#### Methods

#### `addLog(data)`
Adds data to the buffer.
- **Parameters**: `data` (object) - The data to buffer
- **Returns**: void

#### `start()`
Starts automatic sending.
- **Returns**: void

#### `stop()`
Stops automatic sending.
- **Returns**: void

#### `sendNow()`
Immediately sends all buffered data.
- **Returns**: boolean - true if successful, false otherwise

#### `getBuffer()`
Returns the current buffer contents.
- **Returns**: array - Current buffered data

#### `clearBuffer()`
Clears all buffered data.
- **Returns**: void

#### `getConfig()`
Returns the current configuration.
- **Returns**: object - Current configuration

#### `isStarted()`
Checks if automatic sending is active.
- **Returns**: boolean - true if automatic sending is active

## Usage Examples

### Basic Usage

```javascript
import BeaconBuffer from 'beacon-buffer';

// Create buffer instance
const buffer = new BeaconBuffer({
  endpointUrl: 'https://api.example.com/events',
  autoStart: true
});

// Use throughout your app
buffer.addLog( { event: 'page_view', url: window.location.href });
```

### With Custom Headers

```javascript
const buffer = new BeaconBuffer({
  endpointUrl: 'https://api.example.com/events',
  headers: {
    'X-API-Key': 'your-api-key',
    'X-Client-Version': '1.0.0'
  },
  autoStart: true
});
```

### Custom Send Interval

```javascript
const buffer = new BeaconBuffer({
  endpointUrl: 'https://api.example.com/events',
  sendInterval: 60000, // Send every minute
  autoStart: true
});
```

### Manual Control

```javascript
import BeaconBuffer from 'beacon-buffer';

const buffer = new BeaconBuffer({
  endpointUrl: 'https://api.example.com/events'
  // Note: NOT using autoStart
});

// Add logs without automatic sending
buffer.addLog( { message: 'Important event' });

// Send manually when needed
document.getElementById('send-button').addEventListener('click', () => {
  buffer.sendNow();
});

// Start automatic sending later
setTimeout(() => buffer.start(), 5000);

// Stop when needed
document.getElementById('stop-button').addEventListener('click', () => {
  buffer.stop();
});
```

### Error Tracking

```javascript
import BeaconBuffer from 'beacon-buffer';

const errorBuffer = new BeaconBuffer({
  endpointUrl: 'https://errors.example.com/capture',
  bufferKey: 'errorBuffer',
  dataKey: 'errors',
  autoStart: true
});

window.addEventListener('error', (event) => {
  errorBuffer.addLog({
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno
  });
});
```

### Multiple Buffers

You can create multiple independent buffers for different purposes:

```javascript
import BeaconBuffer from 'beacon-buffer';

// Analytics buffer
const analyticsBuffer = new BeaconBuffer({
  endpointUrl: 'https://analytics.example.com/events',
  sendInterval: 30000,
  autoStart: true
});

// Error tracking buffer
const errorBuffer = new BeaconBuffer({
  endpointUrl: 'https://errors.example.com/capture',
  sendInterval: 10000,
  bufferKey: 'errorBuffer',
  dataKey: 'errors',
  autoStart: true
});

// Use different buffers for different purposes
analyticsBuffer.addLog({ event: 'user_clicked', element: 'button' });
errorBuffer.addLog({ error: 'Network timeout', timestamp: Date.now() });
```

### Clean Wrapper Pattern

Create a wrapper module for cleaner usage:

```javascript
// logger.js
import BeaconBuffer from 'beacon-buffer';

const buffer = new BeaconBuffer({
  endpointUrl: process.env.LOG_ENDPOINT,
  sendInterval: 30000,
  autoStart: true
});

export function log(data) {
  buffer.addLog(data);
}
```

```javascript
// In your application files
import { log } from './logger.js';

log({ event: 'user_clicked', element: 'button' });
```

### Functional API Wrapper

You can create a functional API wrapper around BeaconBuffer for different usage patterns:

```javascript
// logger-wrapper.js
import BeaconBuffer from 'beacon-buffer';

const LOG_BUFFER_KEY = 'logBuffer';
const SEND_INTERVAL_MS = 20000; // 20 seconds

// Create a shared buffer instance
let buffer = null;

export function addLog(logData) {
  if (!logData) return;
  
  // Initialize buffer if not already created
  if (!buffer) {
    console.warn('Logger not initialized. Call initLogSender() first.');
    return;
  }
  
  // Add custom timestamp field as 'time' instead of 'timestamp'
  const logWithTime = { ...logData, time: new Date().toISOString() };
  buffer.addLog(logWithTime);
}

export function initLogSender(customHeaders = {}) {
  // Create buffer with custom configuration
  buffer = new BeaconBuffer({
    endpointUrl: 'https://api.example.com/logs',
    sendInterval: SEND_INTERVAL_MS,
    bufferKey: LOG_BUFFER_KEY,
    dataKey: 'logs',
    headers: customHeaders, // Support for dynamic headers (e.g., CSRF tokens)
    autoStart: true
  });
  
  console.log('Log sender initialized with 20 second interval');
}

// Optional: Export buffer for advanced usage
export function getLogBuffer() {
  return buffer;
}

// Optional: Manual send function
export function sendLogs() {
  if (buffer) {
    return buffer.sendNow();
  }
  return false;
}
```

**Usage in your application:**

```javascript
import { addLog, initLogSender } from './logger-wrapper.js';

// Initialize with custom headers (e.g., CSRF token)
const customHeaders = {
  'X-CSRF-Token': 'your-csrf-token-here'
};
initLogSender(customHeaders);

// Use the familiar functional API
addLog({ event: 'user_action', page: '/dashboard' });
addLog({ event: 'error', message: 'Network timeout' });
```

**Benefits of this pattern:**
- **Simple function-based API**: Clean interface for basic logging needs
- **Centralized configuration**: One-time setup with shared buffer instance  
- **Custom data formatting**: Easy to add custom fields like `time` instead of `timestamp`
- **Header flexibility**: Support for dynamic headers like CSRF tokens

## How It Works

1. **Buffer Creation**: Create independent buffer instances using `new BeaconBuffer()`
2. **Data Buffering**: When you call `buffer.addLog(data)`, data is stored in localStorage with a timestamp
3. **Automatic Sending**: If started, the buffer sends data at regular intervals
4. **Page Unload**: Data is automatically sent when the page is unloaded or hidden
5. **Reliable Delivery**: Uses the Beacon API for reliable, non-blocking data transmission
6. **Persistence**: Data persists in localStorage until successfully sent
7. **Independence**: Multiple buffers operate independently with their own configurations

## Browser Support

This library requires support for:
- Beacon API (Chrome 39+, Firefox 31+, Edge 14+, Safari 11.1+)
- localStorage
- ES6 Classes and private fields (or use with a transpiler)

## Request Format

The library sends data in the following JSON format:

```json
{
  "your-custom-headers": "values",
  "logs": [
    {
      "timestamp": "2024-01-01T12:00:00.000Z",
      "your": "data"
    }
  ]
}
```

The key for the data array (`logs` by default) can be customized using the `dataKey` configuration option.

## Best Practices

1. **Create buffers early**: Create buffer instances as early as possible in your application lifecycle
2. **Use autoStart**: Enable `autoStart` in configuration for simpler setup
3. **Share buffer instances**: Pass buffer instances to modules that need them, or use wrapper functions
4. **Multiple buffers**: Use separate buffers for different data types (analytics, errors, etc.)
5. **Batch Size**: The Beacon API has a 64KB limit; consider sending more frequently if you have large payloads
6. **Error Handling**: The library handles errors gracefully but consider implementing fallback mechanisms for critical data
7. **Testing**: Use browser DevTools to monitor network requests and localStorage


## Development

### Prerequisites
```bash
npm install
```

### Building
```bash
# Compile TypeScript to JavaScript
npm run build

# Watch mode for development
npm run watch
```

### Testing
```bash
# Run all tests
npm test

# Watch mode for testing
npm run test:watch
```

### Project Structure
```
beacon-buffer/
├── src/
│   └── beacon-buffer.ts    # TypeScript source code
├── dist/
│   ├── beacon-buffer.js    # Compiled JavaScript
│   └── beacon-buffer.d.ts  # Type definitions
├── test/
│   └── beacon-buffer.test.ts # Mocha test suite
├── package.json
├── tsconfig.json           # TypeScript configuration
├── .mocharc.json          # Mocha configuration
└── README.md
```


## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the GitHub issue tracker.