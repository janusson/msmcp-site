# msmcp.dev deployment checklist

Use only after the owner explicitly authorises the merge and deployment.

## Before merge

- [ ] `release/site-1.0.2` is rebased/reconciled against current `main`.
- [ ] PR checks are green: Gate (`make all`) and Build.
- [ ] `npm audit` reports 0 vulnerabilities.
- [ ] The 15 tool names match the approved MSMCP candidate; no q-value, FDR or
      identification-confidence claim is present.
- [ ] Install text still says source install (PyPI publication is separate).
- [ ] Canonical metadata still points at `https://msmcp.dev/`; robots and sitemap
      are unchanged except for intentional content changes.
- [ ] Desktop 1440 px and mobile 390 px renders have no document-level horizontal
      overflow and every nav anchor resolves.

## Merge and deploy

- [ ] Owner approves and merges the site PR to `main`.
- [ ] Pages workflow runs: Gate → Build → Deploy. A failed Gate must stop the
      deployment; do not bypass it.
- [ ] Confirm the deploy job used the merge commit, not an older run.

## Verify after deploy

```bash
gh run list --repo janusson/msmcp-site --workflow pages.yml --limit 3
gh run view <run-id> --repo janusson/msmcp-site --log-failed
curl -sS https://msmcp.dev/ | grep -E 'canonical|og:url|<title>'
curl -sS https://msmcp.dev/robots.txt
curl -sS https://msmcp.dev/sitemap.xml
curl -sSI https://www.msmcp.dev | head -5
```

- [ ] Expected title: `MSMCP — a local MCP server for mass spectrometry`.
- [ ] Canonical and `og:url` are `https://msmcp.dev/`.
- [ ] The rendered page lists 15 tools and no q-value/FDR table.
- [ ] GitHub, `msmcp.dev`, and `www.ericjanusson.ca` links resolve.
- [ ] `robots.txt` names `https://msmcp.dev/sitemap.xml`; the sitemap lists the
      home page.
- [ ] `https://www.msmcp.dev` redirects to the apex.
- [ ] If anything differs, revert the merge or fix forward with a new PR; do not
      add a second deployment workflow.

## Rollback

Revert the site merge on `main` and let the Pages workflow redeploy the previous
commit. DNS and hosting settings are not part of this change and should not be
edited during rollback.
