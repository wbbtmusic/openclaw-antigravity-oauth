<p align="center">
  <img src="https://img.shields.io/badge/🔐_OpenClaw_Antigravity_OAuth-Plugin-blueviolet?style=for-the-badge&labelColor=1a1a2e" alt="OpenClaw Antigravity OAuth Plugin" />
</p>

<h3 align="center">Access Gemini 3 Pro · Gemini 3.1 Pro · Gemini 3 Flash · Claude Opus 4.6 · Sonnet 4.6<br/>in OpenClaw — No API Key Required</h3>

<p align="center">
  <a href="https://buymeacoffee.com/wbbt"><img src="https://img.shields.io/badge/☕_Support_This_Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
</p>

<p align="center">
  <a href="https://github.com/wbbtmusic/openclaw-antigravity-oauth/stargazers"><img src="https://img.shields.io/github/stars/wbbtmusic/openclaw-antigravity-oauth?style=flat-square&color=yellow" /></a>
  <a href="https://github.com/wbbtmusic/openclaw-antigravity-oauth/network/members"><img src="https://img.shields.io/github/forks/wbbtmusic/openclaw-antigravity-oauth?style=flat-square&color=blue" /></a>
  <a href="https://github.com/wbbtmusic/openclaw-antigravity-oauth/issues"><img src="https://img.shields.io/github/issues/wbbtmusic/openclaw-antigravity-oauth?style=flat-square&color=orange" /></a>
  <img src="https://img.shields.io/badge/OpenClaw-v2026.2.x-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" />
</p>

---

Google removed the built-in `google-antigravity-auth` provider from **OpenClaw v2026.2.x**. This plugin brings it back as an external extension — authenticate with your Google account via OAuth and use Antigravity's full model catalog directly in OpenClaw.

> **🚀 Zero API keys · Zero cost · Just your Google account**

---

## ⚠️ IMPORTANT — Risk of Account Restriction

> [!CAUTION]
> **Using this plugin may violate Google's Terms of Service.**
> A small number of users have reported their Google accounts being **banned or shadow-banned** when using unofficial Antigravity integrations.

| Risk Level | Scenario |
|:---:|---|
| 🔴 **VERY HIGH** | Fresh / new Google accounts |
| 🔴 **HIGH** | New accounts with Pro/Ultra subscriptions |
| � **MODERATE** | Excessive API usage or unusual traffic patterns |
| 🟢 **LOWER** | Established accounts with normal usage |

**By using this plugin, you acknowledge:**
- ❌ This is an **unofficial tool**, not endorsed by Google
- ❌ Your Google account **may be suspended or permanently banned**
- ❌ You **assume all risks** associated with using this plugin
- ❌ The authors are **not responsible** for any consequences

> 💡 **Recommendation:** Use an established Google account that you don't rely on for critical services.

---

## 🎯 Available Models

<table>
<tr>
<th colspan="4" align="center">🟣 Antigravity Quota — Google Models</th>
</tr>
<tr><th>Model ID</th><th>Name</th><th>Context</th><th>Max Output</th></tr>
<tr><td><code>gemini-3-pro-high</code></td><td>Gemini 3 Pro (High Thinking)</td><td>1M</td><td>65K</td></tr>
<tr><td><code>gemini-3-pro-low</code></td><td>Gemini 3 Pro (Low Thinking)</td><td>1M</td><td>65K</td></tr>
<tr><td><code>gemini-3.1-pro-high</code></td><td>Gemini 3.1 Pro (High)</td><td>1M</td><td>65K</td></tr>
<tr><td><code>gemini-3.1-pro-low</code></td><td>Gemini 3.1 Pro (Low)</td><td>1M</td><td>65K</td></tr>
<tr><td><code>gemini-3-flash</code></td><td>Gemini 3 Flash</td><td>1M</td><td>65K</td></tr>
<tr>
<th colspan="4" align="center">🔵 Antigravity Quota — Claude Models (via Google)</th>
</tr>
<tr><th>Model ID</th><th>Name</th><th>Context</th><th>Max Output</th></tr>
<tr><td><code>claude-opus-4-6-thinking</code></td><td>Claude Opus 4.6 (Thinking)</td><td>200K</td><td>64K</td></tr>
<tr><td><code>claude-opus-4-5-thinking</code></td><td>Claude Opus 4.5 (Thinking)</td><td>200K</td><td>64K</td></tr>
<tr><td><code>claude-sonnet-4-6</code></td><td>Claude Sonnet 4.6</td><td>200K</td><td>64K</td></tr>
</table>

> All models accessed via **Google Antigravity's OAuth** — no API keys, no billing.

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
<summary><strong>📋 Click to expand step-by-step instructions</strong></summary>

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

#### Step 3 — Add Plugin to Config

Edit `~/.openclaw/openclaw.json`:

```jsonc
{
  "plugins": {
    "entries": {
      "opencode-antigravity-auth": {
        "enabled": true
      }
    }
  }
}
```

> ⚠️ **Remove** any old `google-antigravity-auth` entry — that was the bundled version.

#### Step 4 — Add Models to Config

In `agents.defaults.models`:

```jsonc
"google-antigravity/gemini-3-pro-high": {},
"google-antigravity/gemini-3-pro-low": {},
"google-antigravity/gemini-3.1-pro-high": {},
"google-antigravity/gemini-3.1-pro-low": {},
"google-antigravity/gemini-3-flash": {},
"google-antigravity/claude-opus-4-6-thinking": {},
"google-antigravity/claude-opus-4-5-thinking": {},
"google-antigravity/claude-sonnet-4-6": {}
```

Set fallbacks:

```jsonc
"model": {
  "primary": "google-antigravity/gemini-3-flash",
  "fallbacks": [
    "google-antigravity/gemini-3.1-pro-high",
    "google-antigravity/claude-opus-4-6-thinking"
  ]
}
```

</details>

---

## 🔑 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR TERMINAL (SSH)                       │
│                                                             │
│  $ openclaw models auth login --provider google-antigravity │
│                                                             │
│  🔗 Open this URL in your browser:                          │
│  https://accounts.google.com/o/oauth2/v2/auth?...           │
│                                                             │
│  Paste redirect URL: █                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   BROWSER   │
                    │  (any PC)   │
                    ├─────────────┤
                    │ 1. Open URL │
                    │ 2. Sign in  │
                    │    Google   │
                    │ 3. Copy the │
                    │  redirect   │
                    │    URL      │
                    └──────┬──────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Paste redirect URL: http://localhost:51121/oauth-callb...   │
│                                                             │
│  🔄 Exchanging token...                                     │
│  ✅ Token received!                                          │
│  ✅ OAuth successful! Email: you@gmail.com                   │
└─────────────────────────────────────────────────────────────┘
```

### 🖥️ Headless Server (VPS / No Browser)

1. Run the auth command on your server
2. Copy the OAuth URL from the terminal
3. Open it in a browser **on your local machine**
4. After signing in, the browser redirects to `localhost:51121/...` 
   - The page will fail to load — **that's expected!**
5. Copy the URL from the address bar anyway
6. Paste it back in the SSH terminal

---

## 🔄 Post-Authentication

```bash
# Restart gateway
openclaw gateway restart          # or: pm2 restart openclaw

# Verify models
openclaw models list | grep antigravity

# Set default model (optional)
openclaw config set agents.defaults.model.primary google-antigravity/gemini-3-flash
```

---

## 🛠️ Troubleshooting

<details>
<summary><strong>"plugin removed: google-antigravity-auth"</strong></summary>

This means you still have the old bundled plugin entry. Remove it:

```bash
nano ~/.openclaw/openclaw.json
# Delete "google-antigravity-auth" from plugins.entries
# Keep "opencode-antigravity-auth"
```

</details>

<details>
<summary><strong>"Unknown provider: google-antigravity"</strong></summary>

Checklist:
- [ ] Plugin files in `~/.openclaw/extensions/opencode-antigravity-auth/`
- [ ] `npm install` was run in the plugin directory
- [ ] `openclaw.plugin.json` exists
- [ ] OpenClaw was restarted

</details>

<details>
<summary><strong>OAuth redirect fails on headless server</strong></summary>

The redirect goes to `localhost:51121` — on a headless server this won't open. Copy the URL from your browser's address bar (even if the page shows an error) and paste it in the terminal.

</details>

<details>
<summary><strong>"invalid_grant" error</strong></summary>

Authorization code expired. Run the auth flow again — codes are single-use and expire quickly.

</details>

---

## 📁 Project Structure

```
opencode-antigravity-auth/
├── 🔑 openclaw-entry.js          # OpenClaw wrapper (register API bridge)
├── 📋 openclaw.plugin.json       # Plugin manifest
├── 📦 package.json               # npm config + openclaw.extensions
├── 🚀 install.sh                 # One-line installer
├── 📄 LICENSE                    # MIT
├── 📖 README.md                  # This file
└── 📁 dist/                      # Core OAuth (from opencode-antigravity-auth)
    └── src/
        ├── antigravity/oauth.js  # Google OAuth PKCE flow
        ├── constants.js          # Client IDs, endpoints
        └── plugin.js             # Original plugin logic
```

---

## ⚙️ How It Works

```
┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   OpenClaw    │────▶│  openclaw-entry   │────▶│  Google OAuth    │
│  register()   │     │  .js (wrapper)    │     │  PKCE Flow      │
└───────────────┘     └──────────────────┘     └────────┬────────┘
                              │                          │
                              │ configPatch              │ access_token
                              ▼                          ▼
                      ┌──────────────────┐     ┌─────────────────┐
                      │  Model Catalog   │     │  Antigravity    │
                      │  (8 models)      │     │  API Endpoint   │
                      └──────────────────┘     └─────────────────┘
```

1. **OAuth Flow** — Uses Google OAuth 2.0 with PKCE
2. **Token Exchange** — Custom handler bypasses gzip issues
3. **Provider Registration** — Registers via `api.registerProvider()`
4. **Model Injection** — Injects catalog via `configPatch`
5. **API Adapter** — Uses OpenClaw's native `google-generative-ai` adapter

---

## 🤝 Compatibility

| Platform | Status |
|:---|:---:|
| OpenClaw v2026.2.x | ✅ |
| OpenClaw v2026.1.x (ClawdBot) | ✅ |
| Linux (Ubuntu/Debian) | ✅ |
| macOS | ✅ |
| Windows (WSL) | ✅ |
| Headless VPS | ✅ |
| Node.js 18+ | ✅ |

---

## 📝 Credits

- **OAuth engine**: [opencode-antigravity-auth](https://www.npmjs.com/package/opencode-antigravity-auth) on npm
- **OpenClaw wrapper**: Custom bridge for OpenClaw's `register(api)` system
- **Maintained by**: [WBBT Group](https://github.com/wbbtmusic)

---

<p align="center">
  <a href="https://buymeacoffee.com/wbbt"><img src="https://img.shields.io/badge/☕_Enjoyed_this%3F_Buy_us_a_coffee!-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
</p>

<p align="center">
  <sub>MIT License · do whatever you want with it</sub>
</p>

---

<sub>**Keywords**: openclaw plugin, google antigravity, oauth, gemini 3 pro, gemini 3.1 pro, gemini 3 flash, claude opus 4.6, claude sonnet 4.6, opencode, clawdbot, moltbot, free ai models, no api key, google oauth plugin, headless vps, antigravity auth</sub>
