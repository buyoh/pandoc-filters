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
pnpm install --frozen-lockfile
pnpm build
```

## Usage

```bash
# Start the server
pnpm start

# Start with custom socket path
pnpm start --socket /tmp/custom-pandoc-runner.sock

# Start with verbose logging
pnpm start --verbose

# Development mode
pnpm dev
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
pnpm test
pnpm test:watch
```

## Build

```bash
pnpm build
pnpm clean
```