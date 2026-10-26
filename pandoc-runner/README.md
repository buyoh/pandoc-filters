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

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `PF_PANDOC_PATH` | `pandoc` (from `PATH`) | Path to the pandoc executable |
| `PF_FILTER_PATH` | `<repository root>/dist/src/ToRedmine.js` | Path to the ToRedmine filter. The default does not depend on the working directory. Build it with `pnpm build` at the repository root |

The server exits at startup if the filter file does not exist or pandoc is not available.
With `docker-compose.yml` (which bind-mounts the repository), run `pnpm build` and `pnpm pandoc-runner:build` at the repository root beforehand; otherwise the `pandoc-runner` container keeps restarting.

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

Requests and responses are newline-terminated JSON lines (UTF-8). For the full protocol specification (response format, error codes, connection model), see `docs-ai/architecture/pandoc-runner-protocol.md`.

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