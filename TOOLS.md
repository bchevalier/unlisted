# TOOLS.md — Local Setup Notes

## GitHub Repo

- Repo: `git@github.com:bchevalier/unlisted.git`
- Local path: `/Users/bhopdelaquiche/openclaw/agents/chawd/unlisted`

## Deploy Key (workspace-only)

- Private key: `/Users/bhopdelaquiche/openclaw/agents/chawd/.openclaw/ssh/github_deploy_ed25519`
- Public key: `/Users/bhopdelaquiche/openclaw/agents/chawd/.openclaw/ssh/github_deploy_ed25519.pub`
- Known hosts: `/Users/bhopdelaquiche/openclaw/agents/chawd/.openclaw/ssh/known_hosts`

## SSH Command Template

```bash
GIT_SSH_COMMAND='ssh -i /Users/bhopdelaquiche/openclaw/agents/chawd/.openclaw/ssh/github_deploy_ed25519 \
  -o IdentitiesOnly=yes \
  -o UserKnownHostsFile=/Users/bhopdelaquiche/openclaw/agents/chawd/.openclaw/ssh/known_hosts \
  -o StrictHostKeyChecking=yes'
```

## Verification

```bash
git ls-remote git@github.com:bchevalier/unlisted.git
```
