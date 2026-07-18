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

## Deploying the new image in Portainer

- **Git stack (recommended):** point Portainer at this repo + `portainer-stack.yml`
  and enable the stack's **redeploy webhook**. Add a final step to the workflow
  (a `curl` to that webhook URL, stored as a repo secret) to auto-roll-out.
- **Manual:** in Portainer, **Pull and redeploy** the stack after each release.
