# 🔓 OpenClaw Antigravity OAuth Plugin + API Proxy

<div align="center">

### Access **Gemini 3 Pro** · **Gemini 3.1 Pro** · **Gemini 3 Flash** · **Claude Opus 4.6** · **Sonnet 4.6**
### in OpenClaw — No API Key Required

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-2026.2.x%20~%202026.3.x-blue)](https://github.com/openclaw/openclaw)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)

Google removed the built-in `google-antigravity-auth` provider from OpenClaw **and** changed the Cloud Code Assist API format. This plugin brings it back with a local API proxy that handles the new format.

```
🚀 Zero API keys · Zero cost · Just your Google account
```

</div>

---

> [!CAUTION]
> **Risk of Account Restriction**
>
> Using this plugin may violate Google's Terms of Service. A small number of users have reported their Google accounts being banned or shadow-banned when using unofficial Antigravity integrations.
>
> By using this plugin, you acknowledge:
> - ❌ This is an unofficial tool, not endorsed by Google
> - ❌ Your Google account may be suspended or permanently banned
> - ❌ You assume all risks associated with using this plugin
> - ❌ The authors are not responsible for any consequences
>
> 💡 **Recommendation:** Use a secondary Google account that you don't rely on for critical services.

---

## ⚠️ Google API Format Change (March 2026)

> [!IMPORTANT]
> Google changed the Cloud Code Assist API payload structure in early March 2026. OpenClaw's built-in driver sends requests in the **old format**, causing `400 Bad Request` errors.

**What changed:**

| | Old Format (Broken) | New Format (Working) |
|---|---|---|
| **Request** | `{ httpBody: { data: "..." }, projectId: "..." }` | `{ project: "...", model: "...", request: { contents: [...] } }` |
| **Response** | `{ candidates: [...] }` | `{ response: { candidates: [...] } }` |

**This plugin solves it** by running a lightweight local proxy that translates between formats automatically.

---

## 🎯 Available Models

| Model | Provider | Type |
|:------|:---------|:-----|
| `gemini-3-flash` | Google | ⚡ Fast reasoning |
| `gemini-3-pro-high` | Google | 🧠 High quality |
| `gemini-3-pro-low` | Google | ⚖️ Balanced |
| `gemini-3.1-pro-high` | Google | 🆕 Latest Pro |
| `gemini-3.1-pro-low` | Google | 🆕 Latest balanced |
| `claude-opus-4-6-thinking` | Anthropic | 🤔 Deep reasoning |
| `claude-opus-4-5-thinking` | Anthropic | 🤔 Reasoning |
| `claude-sonnet-4-6` | Anthropic | ⚡ Fast |

All models accessed via Google Antigravity's OAuth — no API keys, no billing.

---

## 🚀 Quick Start

### Option A — One-Line Install

```bash
curl -sL https://raw.githubusercontent.com/wbbtmusic/openclaw-antigravity-oauth/main/install.sh | bash
```

Then authenticate:

```bash
openclaw models auth login --provider google-antigravity
```

### Option B — Manual Install

<details>
<summary>Click to expand manual installation steps</summary>

#### Step 1 — Clone the Repository

```bash
git clone https://github.com/wbbtmusic/openclaw-antigravity-oauth.git \
  ~/.openclaw/extensions/opencode-antigravity-auth

cd ~/.openclaw/extensions/opencode-antigravity-auth
```

#### Step 2 — Install Dependencies

```bash
npm install --production
```

#### Step 3 — Create Dist Symlink

```bash
ln -sf "$(pwd)/node_modules/opencode-antigravity-auth/dist" dist
```

#### Step 4 — Deploy the API Proxy

```bash
cp antigravity-proxy.mjs ~/.openclaw/antigravity-proxy.mjs

# Create systemd service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/antigravity-proxy.service << EOF
[Unit]
Description=Antigravity API Proxy (OpenClaw)
After=network.target

[Service]
Type=simple
ExecStart=$(command -v node) \$HOME/.openclaw/antigravity-proxy.mjs
Restart=always
RestartSec=5
Environment=NODE_NO_WARNINGS=1

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable antigravity-proxy.service
systemctl --user start antigravity-proxy.service
```

#### Step 5 — Configure Provider

Edit `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "google-antigravity": {
        "baseUrl": "http://127.0.0.1:51199/v1",
        "apiKey": "proxy-handled",
        "api": "openai-completions",
        "models": [
          {"id": "gemini-3-flash", "name": "Gemini 3 Flash"},
          {"id": "gemini-3-pro-high", "name": "Gemini 3 Pro High"},
          {"id": "claude-opus-4-6-thinking", "name": "Claude Opus 4.6"}
        ]
      }
    }
  },
  "plugins": {
    "entries": {
      "opencode-antigravity-auth": true
    }
  }
}
```

> ⚠️ Remove any old `google-antigravity-auth` entry — that was the bundled version.

</details>

---

## 🔑 Authentication Flow

After installation, log in with your Google account:

```bash
openclaw models auth login --provider google-antigravity
```

1. 🌐 A URL opens in your browser (or prints in terminal for headless servers)
2. 🔐 Sign in with your Google account
3. ✅ Authorize the Antigravity scopes
4. 💾 Callback saves your OAuth tokens

### ⚠️ Critical: Add `projectId`

After login, you **must** add `projectId` to your auth profile, or token refresh will fail:

```bash
python3 -c "
import json
f = '$HOME/.openclaw/agents/main/agent/auth-profiles.json'
d = json.load(open(f))
for k,v in d.get('profiles',{}).items():
  if 'antigravity' in k: v['projectId'] = 'rising-fact-p41fc'
json.dump(d, open(f,'w'), indent=2)
print('✅ projectId added successfully')
"
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
# → {"status":"ok","port":51199}

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

<details>
<summary><b>❌ "OAuth token refresh failed"</b></summary>

The auth profile is missing `projectId`. Run:

```bash
python3 -c "
import json
f = '$HOME/.openclaw/agents/main/agent/auth-profiles.json'
d = json.load(open(f))
for k,v in d.get('profiles',{}).items():
  if 'antigravity' in k: v['projectId'] = 'rising-fact-p41fc'
json.dump(d, open(f,'w'), indent=2)
print('Fixed')
"
systemctl --user restart openclaw-gateway.service
```

</details>

<details>
<summary><b>❌ "400 Bad Request" or "Unknown name"</b></summary>

The proxy is not running or not configured:

```bash
# Check proxy status
systemctl --user status antigravity-proxy.service

# Check proxy logs
journalctl --user -u antigravity-proxy.service -n 20 --no-pager

# Restart proxy
systemctl --user restart antigravity-proxy.service
```

</details>

<details>
<summary><b>❌ "Invalid Google Cloud Code Assist credentials"</b></summary>

OpenClaw's provider config is pointing to Google directly instead of the proxy. Fix it:

```bash
python3 -c "
import json
f = '$HOME/.openclaw/openclaw.json'
d = json.load(open(f))
d.setdefault('models',{}).setdefault('providers',{})['google-antigravity'] = {
  'baseUrl': 'http://127.0.0.1:51199/v1',
  'apiKey': 'proxy-handled',
  'api': 'openai-completions'
}
json.dump(d, open(f,'w'), indent=2)
print('Fixed')
"
systemctl --user restart openclaw-gateway.service
```

> ⚠️ This commonly happens after OpenClaw updates — the update overwrites `openclaw.json`.

</details>

<details>
<summary><b>❌ Plugin conflicts</b></summary>

If you see errors about `google-antigravity-auth` (the old bundled plugin):

```bash
nano ~/.openclaw/openclaw.json
# Remove "google-antigravity-auth" from plugins.entries
# Keep "opencode-antigravity-auth"
```

</details>

---

## 📁 Project Structure

```
opencode-antigravity-auth/
├── 🔑 openclaw-entry.js          # OpenClaw wrapper (register API bridge)
├── 📋 openclaw.plugin.json       # Plugin manifest
├── 📦 package.json               # npm config + openclaw.extensions
├── 🚀 install.sh                 # One-line installer (v2.0 with proxy)
├── 🌐 antigravity-proxy.mjs      # API proxy (OpenAI ↔ Google format)
├── 📄 LICENSE                    # MIT
├── 📖 README.md                  # This file
└── 📁 dist/                      # Core OAuth (from opencode-antigravity-auth)
    └── src/
        ├── antigravity/oauth.js   # Google OAuth PKCE flow
        ├── constants.js           # Client IDs, endpoints
        └── plugin.js              # Original plugin logic
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
        │ (OpenAI format)                               │
        ▼                                               ▼
┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  OpenClaw     │────▶│ antigravity-     │────▶│  Google Cloud   │
│ chat/complete │     │ proxy.mjs        │     │  Code Assist    │
│ ions request  │     │ :51199           │     │  API            │
└───────────────┘     └──────────────────┘     └─────────────────┘
```

### Flow:
1. **OAuth Flow** — Uses Google OAuth 2.0 with PKCE via `openclaw-entry.js`
2. **Token Storage** — Saved in `~/.openclaw/agents/main/agent/auth-profiles.json`
3. **API Proxy** — `antigravity-proxy.mjs` listens on port `51199`
4. **Format Translation** — Converts OpenAI `chat/completions` → Google `v1internal:generateContent`
5. **Auto Refresh** — Proxy auto-refreshes expired tokens using the `refresh_token`
6. **Provider Config** — OpenClaw treats `google-antigravity` as an OpenAI-compatible provider pointing to the local proxy

### Why a Proxy?

Google changed the Cloud Code Assist API format in early 2026. The old `google-generative-ai` adapter in OpenClaw sends requests in the standard Gemini format (`{ contents: [...] }`), but the Antigravity endpoint now expects a wrapper (`{ project, model, request: { contents }, requestType }`).

A proxy is the cleanest solution because:

- 🔌 **No OpenClaw source modification** — Works with any OpenClaw version
- 🔄 **Auto-updates** — When Google changes the format again, only the proxy needs updating
- 🔑 **Token management** — Handles refresh independently of OpenClaw's internal logic
- 📦 **Version agnostic** — Works whether the built-in provider is blocked or not

---

## 📝 Credits

- [OpenClaw](https://github.com/openclaw/openclaw) — The AI coding assistant
- Google Cloud Code Assist — The underlying API
- [WBBT Music](https://github.com/wbbtmusic) — Plugin maintenance

## 📄 License

MIT — see [LICENSE](LICENSE)
