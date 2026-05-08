# SHARING.md

## Media sharing flow (OpenClaw)

Use this flow to send screenshots/files to chat channels (Telegram/Discord/Signal/etc.) without direct API calls.

1. **Capture**
   - Use the browser screenshot flow/tool to render and save an image file (`.jpg`, `.png`, etc.).
   - Typical output path example: `MEDIA:/Users/.../.openclaw/media/browser/<id>.jpg`

2. **Echo the MEDIA line in reply text**
   - Include the exact media path line in the assistant reply.
   - Format:
     - `MEDIA:/absolute/path/to/file.jpg`
   - Rules:
     - The `MEDIA:` line must be on its **own line**.
     - Path must point to an existing local file.

3. **OpenClaw handles delivery**
   - Gateway detects `MEDIA:` lines, strips them from visible text, reads the file, and attaches it to the outgoing message.
   - Remaining text is sent as caption or companion message.

### Notes
- No manual Telegram/Discord/Signal API calls are needed.
- Same pattern works across supported channels.
