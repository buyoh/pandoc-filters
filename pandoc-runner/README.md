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

### Socket file

- After listening, the socket file is set to mode `0660`: only processes with the same user or group as the runner can connect. Run the client (app-server) with the same UID/GID, or a shared group.
- At startup, an existing path is removed only if it is a stale socket (nothing accepts connections on it). The server refuses to start if the path is a non-socket file, a socket another server is listening on, or a socket whose state cannot be determined.
- With `--verbose`, requests and responses are logged by length only; their content is never logged.

On SIGINT / SIGTERM the server stops accepting connections, waits up to 5 seconds for in-flight requests, destroys any remaining connections, removes the socket file and exits.

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
pnpm typecheck   # type-check src/ including src/tests (tsconfig.test.json)
```

`tsx --test` does not type-check, and the build (`tsconfig.json`) excludes `src/tests`, so run `pnpm typecheck` to catch type errors in tests.

## Build

```bash
pnpm build
pnpm clean
```