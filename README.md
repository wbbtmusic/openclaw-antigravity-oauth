# OpenClaw Antigravity OAuth Plugin + API Proxy

> **Access Gemini 3 Pro · Gemini 3.1 Pro · Gemini 3 Flash · Claude Opus 4.6 · Sonnet 4.6 in OpenClaw — No API Key Required**

Google removed the built-in `google-antigravity-auth` provider from OpenClaw v2026.2.x **and** changed the Cloud Code Assist API format. This plugin brings it back with a local API proxy that handles the new format.

```
google-antigravity-auth
```

🚀 Zero API keys · Zero cost · Just your Google account

---

## ⚠️ Google API Format Change (March 2026)

Google changed the Cloud Code Assist API payload structure. OpenClaw's built-in `google-antigravity` provider sends requests in the old format, causing **400 Bad Request** errors.

**What changed:**
- The API endpoint (`cloudcode-pa.googleapis.com/v1internal:generateContent`) now expects a different JSON structure
- Old format: `{ httpBody: { data: "..." }, projectId: "..." }` → **Rejected**
- New format: `{ project: "...", model: "...", request: { contents: [...] }, requestType: "agent" }` → **Works**
- Response is now wrapped: `{ response: { candidates: [...] } }` instead of `{ candidates: [...] }`

**This plugin solves it** by running a lightweight local proxy that:
1. Accepts requests from OpenClaw in OpenAI format
2. Translates them to Google's new Cloud Code Assist format
3. Sends them to `cloudcode-pa.googleapis.com` with correct headers
4. Translates the response back to OpenAI format

---

## 🎯 Available Models

| Model | Provider | Type |
|-------|----------|------|
| `gemini-3-flash` | Google | Fast reasoning |
| `gemini-3-pro-high` | Google | High quality |
| `gemini-3-pro-low` | Google | Balanced |
| `gemini-3.1-pro-high` | Google | Latest Pro |
| `gemini-3.1-pro-low` | Google | Latest Pro balanced |
| `claude-opus-4-6-thinking` | Anthropic | Deep reasoning |
| `claude-opus-4-5-thinking` | Anthropic | Reasoning |
| `claude-sonnet-4-6` | Anthropic | Fast |
| `claude-sonnet-4-5` | Anthropic | Fast |
| `gpt-oss-120b-medium` | OpenAI OSS | Open source |

---

## 🚀 Quick Start

### Option A — One-Line Install

```bash
curl -sL https://raw.githubusercontent.com/wbbtmusic/openclaw-antigravity-oauth/main/install.sh | bash
```

### Option B — Manual Install

```bash
# 1. Clone plugin
git clone https://github.com/wbbtmusic/openclaw-antigravity-oauth.git \
  ~/.openclaw/extensions/opencode-antigravity-auth

cd ~/.openclaw/extensions/opencode-antigravity-auth

# 2. Install dependencies
npm install --production

# 3. Create dist symlink (if needed)
ln -sf "$(pwd)/node_modules/opencode-antigravity-auth/dist" dist

# 4. Deploy the API proxy
cp antigravity-proxy.mjs ~/.openclaw/antigravity-proxy.mjs

# 5. Create systemd service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/antigravity-proxy.service << EOF
[Unit]
Description=Antigravity API Proxy (OpenClaw)
After=network.target

[Service]
Type=simple
ExecStart=$(command -v node) $HOME/.openclaw/antigravity-proxy.mjs
Restart=always
RestartSec=5
Environment=NODE_NO_WARNINGS=1

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable antigravity-proxy.service
systemctl --user start antigravity-proxy.service

# 6. Register plugin in openclaw.json
# Add "opencode-antigravity-auth": true to plugins.entries
# Set google-antigravity provider baseUrl to http://127.0.0.1:51199/v1
# See install.sh for the full config
```

---

## 🔑 Authentication Flow

After installation, log in with your Google account:

```bash
openclaw models auth login --provider google-antigravity
```

1. A URL opens in your browser (or prints in terminal for headless servers)
2. Sign in with your Google account
3. Authorize the Antigravity scopes
4. The callback saves your OAuth tokens

### ⚠️ Critical: Add projectId

After login, you **must** add `projectId` to your auth profile, or token refresh will fail:

```bash
python3 -c "
import json
f = '$HOME/.openclaw/agents/main/agent/auth-profiles.json'
d = json.load(open(f))
for k,v in d.get('profiles',{}).items():
  if 'antigravity' in k: v['projectId'] = 'rising-fact-p41fc'
json.dump(d, open(f,'w'), indent=2)
print('projectId added successfully')
"
```

Then restart:

```bash
systemctl --user restart openclaw-gateway.service
```

### 🖥️ Headless Server (VPS / No Browser)

On a headless server, the OAuth URL won't auto-open. Copy the printed URL, open it in any browser, complete login, then copy the redirect URL from your browser's address bar (even if the page shows an error) and paste it in the terminal.

The redirect goes to `localhost:51121` — use SSH port forwarding if needed:

```bash
ssh -L 51121:localhost:51121 user@your-server
```

---

## 🔄 Post-Authentication

```bash
# Restart gateway
systemctl --user restart openclaw-gateway.service

# Verify proxy is running
curl -s http://127.0.0.1:51199/health

# Verify models
openclaw models list | grep antigravity

# Test with a direct API call
curl -s -X POST http://127.0.0.1:51199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-3-flash","messages":[{"role":"user","content":"Hello!"}]}'

# Set default model (optional)
openclaw config set agents.defaults.model.primary google-antigravity/gemini-3-flash
```

---

## 🛠️ Troubleshooting

### "OAuth token refresh failed"

The auth profile is missing `projectId`. Run the python command in the Authentication section above.

### "400 Bad Request" or "Unknown name"

The proxy is not running or not configured correctly:
```bash
# Check proxy status
systemctl --user status antigravity-proxy.service

# Check proxy logs
journalctl --user -u antigravity-proxy.service -n 20 --no-pager

# Restart proxy
systemctl --user restart antigravity-proxy.service
```

### "Missing token" or "No API key"

You haven't logged in yet:
```bash
openclaw models auth login --provider google-antigravity
```

### Plugin conflicts

If you see errors about `google-antigravity-auth` (the old bundled plugin):
```bash
# Edit openclaw.json
nano ~/.openclaw/openclaw.json
# Remove "google-antigravity-auth" from plugins.entries
# Keep "opencode-antigravity-auth"
```

---

## 📁 Project Structure

```
opencode-antigravity-auth/
├── 🔑 openclaw-entry.js         # OpenClaw wrapper (register API bridge)
├── 📋 openclaw.plugin.json      # Plugin manifest
├── 📦 package.json              # npm config + openclaw.extensions
├── 🚀 install.sh                # One-line installer (v2.0 with proxy)
├── 🌐 antigravity-proxy.mjs     # API proxy (OpenAI ↔ Google format)
├── 📄 LICENSE                   # MIT
├── 📖 README.md                 # This file
└── 📁 dist/                     # Core OAuth (from opencode-antigravity-auth)
    └── src/
        ├── antigravity/oauth.js  # Google OAuth PKCE flow
        ├── constants.js          # Client IDs, endpoints
        └── plugin.js             # Original plugin logic
```

---

## ⚙️ How It Works

```
┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   OpenClaw    │────▶│  openclaw-entry   │────▶│  Google OAuth   │
│ register()    │     │  .js (wrapper)    │     │  PKCE Flow      │
└───────┬───────┘     └──────────────────┘     └────────┬────────┘
        │                                               │
        │ API request                                   │ access_token
        ▼                                               ▼
┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  OpenClaw     │────▶│ antigravity-     │────▶│  Google Cloud   │
│ openai-compat │     │ proxy.mjs        │     │  Code Assist    │
│ request       │     │ (format bridge)  │     │  API            │
└───────────────┘     └──────────────────┘     └─────────────────┘
```

### Flow:
1. **OAuth Flow** — Uses Google OAuth 2.0 with PKCE via `openclaw-entry.js`
2. **Token Storage** — Saved in `~/.openclaw/agents/main/agent/auth-profiles.json`
3. **API Proxy** — `antigravity-proxy.mjs` listens on port 51199
4. **Format Translation** — Converts OpenAI `chat/completions` → Google `v1internal:generateContent`
5. **Auto Refresh** — Proxy auto-refreshes expired tokens using the refresh_token
6. **Provider Config** — OpenClaw treats `google-antigravity` as an OpenAI-compatible provider pointing to the local proxy

### Why a Proxy?

Google changed the Cloud Code Assist API format in early 2026. The old `google-generative-ai` adapter in OpenClaw sends requests in the standard Gemini format (`{ contents: [...] }`), but the Antigravity endpoint now expects a wrapper (`{ project, model, request: { contents }, requestType }`). A proxy is the cleanest solution because:

- **No OpenClaw source modification** — Works with any OpenClaw version
- **Auto-updates** — When Google changes the format again, only the proxy needs updating
- **Token management** — Handles refresh independently of OpenClaw's internal logic
- **Version agnostic** — Works whether the built-in provider is blocked or not

---

## 📝 Credits

- [OpenClaw](https://github.com/openclaw/openclaw) — The AI coding assistant
- Google Cloud Code Assist — The underlying API
- WBBT Music — Plugin maintenance

## 📄 License

MIT — see [LICENSE](LICENSE)
