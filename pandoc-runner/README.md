# TypeScript Pandoc Runner

TypeScript implementation of the pandoc server with Unix socket communication.

## Features

- Unix socket server for pandoc conversion requests
- Markdown to Redmine-Textile conversion
- JSON-based request/response protocol
- Command-line interface with options
- Comprehensive error handling and logging

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Start the server
npm start

# Start with custom socket path
npm start -- --socket /tmp/custom-pandoc-runner.sock

# Start with verbose logging
npm start -- --verbose

# Development mode
npm run dev
```

## API

The server accepts JSON requests via Unix socket with the following format:

### Convert Request
```json
{
  "action": "convert",
  "from": "markdown",
  "to": "redmine-textile", 
  "content": "# Hello\n\nMarkdown content here"
}
```

### Ping Request
```json
{
  "action": "ping"
}
```

## Testing

```bash
npm test
npm run test:watch
```

## Build

```bash
npm run build
npm run clean
```