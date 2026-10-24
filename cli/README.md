# Kayman CLI (pilot)

`kayman` is a command line for the Kayman API. It is a small Go program that embeds [Restish](https://rest.sh/docs/reference/embedding/), which turns the backend's OpenAPI spec into commands.

## Build

```sh
mise install          # installs the pinned Go toolchain
mise run build:cli    # writes cli/kayman
```

The build task generates the backend's OpenAPI spec into `cli/openapi.json`, compiles it into the binary, and deletes it afterwards, so the binary never fetches the spec from a server. It also stamps `git describe` into the version (`kayman rsh version`). Outside the task, `openapi.json` doesn't exist, so a plain `go build` fails and editors flag the `go:embed` line.

Because the spec is fixed at build time, rebuild after backend API changes. A binary built from a newer commit than the server you point it at may offer commands that the server doesn't have yet.

## Setup

1. Add a `cli` client to `backend/instance/clients.json`.
2. Export its credentials as `KAYMAN_CLI_CLIENT` and `KAYMAN_CLI_PASSWORD`, for example in `instance/local.env`.
3. Set `KAYMAN_URL` to target a server other than `http://localhost:8000`.

## Usage

```sh
kayman --help          # list every operation
kayman read-accounts
kayman read-events --start 2026-10-01T00:00:00Z --end 2026-11-01T00:00:00Z
kayman rsh doctor      # Restish support commands live under `rsh`
```

Command names are the kebab-cased `operationId`s. Request bodies use Restish [shorthand](https://rest.sh/docs/reference/shorthand/).

## How auth works

The backend only issues tokens through the OAuth2 password grant (`POST /api/token`), which Restish doesn't support out of the box. [`main.go`](main.go) registers a `kayman-password` auth handler that logs in and caches the token in Restish's token store. When a cached token expires, the API answers 401, and Restish retries once after a fresh login.

The binary shares Restish's config directory (`~/.config/restish/`). Don't define an API named `kayman` there, because it would replace the built-in one entirely, including its auth.
