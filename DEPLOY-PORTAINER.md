# Deploying MDViewer in Portainer

Deployment method: **pre-built local image** (Portainer and this repo on the same host).

## 1. Build the image (on the Portainer host, once)

```bash
cd "/home/damian/Development/server hosted .md file viewer"
docker build -t mdviewer:latest .
```

Rebuild with the same command whenever you change the app, then redeploy the stack
(Portainer: **Stacks → mdviewer → Editor → Update the stack**, or **Pull and redeploy**).

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
