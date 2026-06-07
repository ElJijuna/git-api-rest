# git-api-rest

Configurable REST API for querying cloned git repositories. Exposes commits, files, blame, history, branches, tags, contributors, and stats over HTTP. Includes a React dashboard with real-time API metrics.

## Features

- Clones one or many repositories at startup (blobless clone)
- Compatible with Bitbucket Datacenter, GitHub, GitLab, and any git server
- All endpoints support `?ref=<branch|tag|commit>` to read at any point in history
- React 19 dashboard with repo status, commit activity, and live API metrics
- Multi-arch Docker image (amd64 + arm64) published to DockerHub via GitHub Actions

---

## Quick start

```bash
cp repos.example.yml repos.yml   # edit with your repos
cp .env.example .env              # adjust variables
npm install
npm run dev                       # API on :3000
npm run ui:dev:mock               # UI on :5173 with mock data
```

---

## Repository configuration

### `repos.yml`

```yaml
repos:
  # Bitbucket Datacenter — URL auto-constructed from BITBUCKET_* vars
  - key: MYPROJECT
    repo: my-repo
    branch: main

  # Explicit SSH URL (key mounted via SSH_KEY_PATH)
  - key: INFRA
    repo: k8s-config
    url: git@github.com:org/k8s.git
    branch: main

  # HTTPS with token auth (injected into URL at clone time, never logged)
  - key: OTHER
    repo: private-repo
    url: https://github.com/org/private-repo.git
    branch: main
    auth:
      token: ghp_xxxxxxxxxxxx   # or env var AUTH_TOKEN_OTHER_PRIVATEREPO

  # Public repo — no auth needed
  - key: OSS
    repo: public-lib
    url: https://github.com/org/public-lib.git
    branch: main
```

Alternatively, configure via environment variable as a JSON array:

```bash
REPOS='[{"key":"MYPROJECT","repo":"my-repo","url":"https://github.com/org/my-repo.git","branch":"main"}]'
```

---

## Environment variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `REPOS_CONFIG_PATH` | `./repos.yml` | Path to the config file |
| `REPOS` | — | JSON array alternative to repos.yml |
| `CLONE_BASE_PATH` | `/data/repos` | Base directory for cloned repos |
| `GIT_PULL_INTERVAL` | `60` | Seconds between background pulls |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment (`development` / `production`) |
| `LOG_LEVEL` | `info` | Pino log level |

### Bitbucket Datacenter (optional)

| Variable | Description |
| -------- | ----------- |
| `BITBUCKET_SERVER_HOST` | Server URL (e.g. `https://bitbucket.company.com`) |
| `BITBUCKET_USER` | Username |
| `BITBUCKET_TOKEN` | API token (used as HTTP password for HTTPS clones) |
| `GIT_CLONE_PROTOCOL` | `ssh` (default) or `https` |
| `BITBUCKET_SSH_PORT` | `7999` |

When `BITBUCKET_SERVER_HOST` is set, repos without an explicit `url` have their clone URL auto-constructed (`ssh://git@host:port/scm/KEY/repo.git` or `https://user:token@host/scm/KEY/repo.git`).

---

## Endpoints

### Navigation

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | API and repo clone status |
| GET | `/api/projects` | List configured project keys |
| GET | `/api/projects/:key/repos` | Repos for a project |
| GET | `/api/repos` | All repos |

### Repository

| Method | Path | Query params | Description |
| ------ | ---- | ------------ | ----------- |
| GET | `/api/projects/:key/repos/:repo` | `?ref=` | Repo info + last commit |
| GET | `/api/projects/:key/repos/:repo/branches` | — | All branches |
| GET | `/api/projects/:key/repos/:repo/tags` | — | All tags |
| GET | `/api/projects/:key/repos/:repo/contributors` | `?ref=` | Authors with commit count |
| GET | `/api/projects/:key/repos/:repo/stats` | `?ref=` | Summary (commits, files, contributors) |
| GET | `/api/projects/:key/repos/:repo/stats/activity` | `?period=weekly&ref=` | Commit frequency (daily/weekly/monthly) |

### Commits

| Method | Path | Query params | Description |
| ------ | ---- | ------------ | ----------- |
| GET | `/api/projects/:key/repos/:repo/commits` | `?ref=&limit=20&page=1&author=&search=` | Paginated git log |

### Files

| Method | Path | Query params | Description |
| ------ | ---- | ------------ | ----------- |
| GET | `/api/projects/:key/repos/:repo/files` | `?ref=&path=` | File tree |
| GET | `/api/projects/:key/repos/:repo/files/:path` | `?ref=` | File content |
| GET | `/api/projects/:key/repos/:repo/history/:path` | `?ref=&limit=&page=` | File commit history |
| GET | `/api/projects/:key/repos/:repo/blame/:path` | `?ref=` | Line-by-line blame |

### Compare

| Method | Path | Query params | Description |
| ------ | ---- | ------------ | ----------- |
| GET | `/api/projects/:key/repos/:repo/compare` | `?from=&to=` | Changed files between two refs |
| GET | `/api/projects/:key/repos/:repo/diff/:path` | `?from=&to=` | Unified diff of a file |

### Metrics

| Method | Path | Query params | Description |
| ------ | ---- | ------------ | ----------- |
| GET | `/api/metrics` | `?window=1h` | Summary: total, errors, avg ms |
| GET | `/api/metrics/endpoints` | `?limit=10&window=1h` | Top endpoints by hit count |
| GET | `/api/metrics/stream` | — | SSE: live request events |

---

## Docker

### docker-compose

```bash
cp repos.example.yml repos.yml   # edit with your repos

docker-compose up -d
docker-compose logs -f git-api
```

`repos.yml` is mounted as a read-only volume. Cloned repos are persisted in a named Docker volume.

### Manual build

```bash
make docker-build
make docker-run
```

### SSH keys

The SSH key directory is mounted from `SSH_KEY_PATH` (default: `~/.ssh`). For Bitbucket Datacenter, `docker-entrypoint.sh` runs `ssh-keyscan` automatically to add the host to `known_hosts`.

---

## DockerHub publishing

The workflow `.github/workflows/docker-publish.yml` publishes automatically on push to `main` or on `v*.*.*` tags.

### Required GitHub secrets

| Secret | Description |
| ------ | ----------- |
| `DOCKER_USERNAME` | DockerHub username |
| `DOCKER_TOKEN` | DockerHub access token |
| `DOCKER_PASSWORD` | DockerHub password (for updating repository description) |

### Generated tags

| Event | Tags |
| ----- | ---- |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `latest` |
| Push to `main` | `edge` |
| Any push | short SHA |

---

## Development

```bash
make install      # install dependencies
make dev          # API in watch mode (tsx)
make ui-mock      # UI with mock data, no backend needed
make ui-dev       # UI proxied to API on :3000
make build        # compile TypeScript + build UI
make typecheck    # type-check without emitting
make lint         # ESLint on src/ and ui/src/
```

---

## Architecture

```
src/
├── config/           # repos.yml loading, URL construction, types
├── middleware/        # Logger (pino), error handler, metrics collector
├── routes/           # health, projects, repo-info, commits, files, compare, metrics
├── services/
│   ├── git-manager.ts     # Clone, pull, all git operations (simple-git)
│   ├── repo-store.ts      # In-memory registry of repos and their state
│   └── metrics-store.ts   # Circular request buffer + SSE broadcast
└── index.ts          # Entry point with top-level await

ui/src/
├── routes/           # Dashboard, Repos, Metrics, Logs (TanStack Router)
├── hooks/            # useApi (polling + error handling)
└── mock/             # Mock data for development without a backend
```

**Clone strategy**: blobless clone (`--filter=blob:none`) without `--single-branch` — fetches all branches and tags but defers blob downloads. File contents are fetched on demand via `git show ref:path`.

**Concurrency**: per-repo promise-chain mutex serializes reads and background pulls, preventing race conditions.
