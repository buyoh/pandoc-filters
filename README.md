# pandoc filters

## features

Convert following cases

- markdown -> redmine style textile

## How to use

```
pandoc input.md -o out.textile --filter=dist/ToRedmine.js 
```

## Web application (docker compose)

```
pnpm install
pnpm build && pnpm pandoc-runner:build
bash third_party/pull.sh   # download pandoc into third_party/pandoc
docker compose up -d
```

Open http://127.0.0.1:3000/ . `docker-compose.yml` is for development and local use:

- The app-server port is bound to `127.0.0.1` only. To expose it, put a reverse proxy (with TLS) in front of it instead of changing the binding to all interfaces.
- Both containers run as UID/GID `1000` (the `node` user in the image), and the repository is mounted read-only. The built `dist/` directories and `third_party/pandoc` must be readable by UID 1000.
- The socket is shared via a tmpfs volume (`pandoc-socket`) owned by UID/GID 1000, and the socket file is created with mode `0660`. The old `common` volume from earlier versions is no longer used; remove it with `docker volume rm pandoc-filters_common` if it remains.
