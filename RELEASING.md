# Releasing

CI/CD lives in [`.github/workflows/release.yml`](./.github/workflows/release.yml).

## What happens on a release

1. You publish a **GitHub Release** with a tag (e.g. `v1.2.0`).
2. The workflow builds the Docker image and pushes it to **GHCR**:
   - `ghcr.io/damianryan95/mdmanager:v1.2.0`
   - `ghcr.io/damianryan95/mdmanager:latest`
3. The workflow rewrites the `image:` tag in `portainer-stack.yml` and
   `docker-compose.yml` to the new version and commits that back to `main`.

## Cut a release

```bash
# tag the commit you want to ship, then create the release
git tag v1.2.0 && git push origin v1.2.0
gh release create v1.2.0 --generate-notes
```

Or use the GitHub UI: **Releases → Draft a new release → choose tag → Publish**.

You can also trigger a build manually from the **Actions** tab
(**Release → Run workflow**), optionally passing a tag.

## First-time setup (one-off)

- **GHCR package visibility.** The first published image package is *private* by
  default even in a public repo. To let Portainer pull without auth, open
  `https://github.com/users/damianryan95/packages/container/mdmanager/settings`
  and set visibility to **Public**. (Or keep it private and add a GHCR registry
  credential in Portainer — see `portainer-stack.yml`.)
- No secrets are required — the workflow authenticates to GHCR with the built-in
  `GITHUB_TOKEN`.

## Auto-redeploy in Portainer (webhook)

The workflow's final step POSTs to a Portainer **stack redeploy webhook** so a
release rolls out automatically. It's optional — if the `PORTAINER_WEBHOOK_URL`
secret isn't set, the step is skipped (the release still succeeds).

**One-time setup:**

1. In Portainer, create the stack as a **Git stack** pointing at
   `damianryan95/mdManager` + `portainer-stack.yml` (Repository → set repo, ref
   `main`, compose path `portainer-stack.yml`).
2. On that stack, enable **Webhooks / Automatic updates** and copy the webhook
   URL — it looks like `https://<portainer-host>/api/stacks/webhooks/<uuid>`.
3. Store it as a repo secret so the workflow can call it:

   ```bash
   gh secret set PORTAINER_WEBHOOK_URL --repo damianryan95/mdManager
   # paste the webhook URL when prompted
   ```

That's it — the next release will build → push to GHCR → bump the YAML tag →
POST the webhook → Portainer re-pulls and redeploys.

> Portainer must be reachable from GitHub-hosted runners. If it's only on your
> LAN, either run a **self-hosted runner** on your network, expose the webhook
> through a tunnel/reverse proxy, or drop the secret and **Pull and redeploy**
> the stack manually.
