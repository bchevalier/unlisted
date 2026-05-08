# SHARE_FILES.md — Sending Images and Files in Chat

Use this exact flow when sharing screenshots or other local files through OpenClaw-supported chat channels.

## How it works

1. Capture or generate the file locally.
   - Example for browser screenshots: the browser tool can save an image to disk and return a path like:
     - `MEDIA:/Users/.../.openclaw/media/browser/7ddfd4dc-....jpg`
2. In the reply text, include the exact `MEDIA:` line.
3. OpenClaw intercepts the `MEDIA:` line, strips it from the visible text, reads the file from disk, and attaches it to the outgoing message.

## Required format

- The `MEDIA:` line must be on its **own line**.
- The line must start with `MEDIA:` immediately followed by an **absolute local file path**.
- The path must point to a real file on disk (`.jpg`, `.png`, etc.).
- No direct Telegram/Discord/Signal API calls are needed — OpenClaw handles the channel adapter.

## Canonical example

MEDIA:/absolute/path/to/image.jpg

## Notes

- This works across supported channels (Telegram, Discord, Signal, etc.).
- The rest of the reply can go with the media as caption text or as a separate message depending on the adapter.
- If a screenshot/file exists locally, the assistant should prefer this flow over merely mentioning the file path in plain text.
