# Deploying MDViewer in Portainer

Deployment method: **image pulled from GHCR**, published by CI on each release.
See [`RELEASING.md`](./RELEASING.md) for how the image is built and versioned.

## 1. Get the image

The image is built and pushed automatically when you publish a GitHub Release:
`ghcr.io/damianryan95/mdmanager:<version>` (and `:latest`). You don't build it by
hand. One-off: make the GHCR package **public** (or add a GHCR registry credential
in Portainer) so the host can pull it — see `RELEASING.md`.

> Local dev only: `docker compose up --build` still builds from source.

## 2. Create the stack in Portainer

1. Portainer → **Stacks** → **Add stack**.
2. Name: `mdviewer`.
3. Build method: **Web editor**.
4. Paste the contents of [`portainer-stack.yml`](./portainer-stack.yml).
5. **Deploy the stack**.

## 3. First launch

- Open `http://<host>:3502`.
- Add browse locations via the UI. Host folders are mounted read-only under `/mnt`
  (e.g. the `/home/damian` mount appears as path `/mnt/home`).
- To expose more host folders, add another `- /host/path:/mnt/name:ro` line under
  `volumes:` in the stack and redeploy.

## Notes

- Config + search index persist in the named volume `mdviewer-data` across redeploys.
- The container exposes a health check at `/api/health`; Portainer shows it as *healthy*.
- Changing the published port: edit `"3502:3502"` (left side = host port).
