#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# OpenClaw Antigravity OAuth — Installer v2.0
# 
# Installs the Antigravity OAuth plugin AND the API proxy required since
# Google changed the Cloud Code Assist API format in early 2026.
#
# Usage:
#   curl -sL https://raw.githubusercontent.com/wbbtmusic/openclaw-antigravity-oauth/main/install.sh | bash
#
# What it does:
#   1. Clones the plugin into ~/.openclaw/extensions/
#   2. Installs npm dependencies
#   3. Registers the plugin in openclaw.json
#   4. Deploys the API proxy as a systemd user service
#   5. Configures the google-antigravity provider to route through the proxy
#   6. Restarts OpenClaw gateway
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

OPENCLAW_DIR="$HOME/.openclaw"
EXT_DIR="$OPENCLAW_DIR/extensions/opencode-antigravity-auth"
CONFIG="$OPENCLAW_DIR/openclaw.json"
PROXY_PORT=51199

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}"; exit 1; }
info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  OpenClaw Antigravity OAuth — Installer v2.0               ║${NC}"
echo -e "${CYAN}║  Gemini 3 · Claude Opus 4.6 · Sonnet 4.6 — No API Key     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────

command -v node >/dev/null 2>&1 || err "Node.js is required but not installed."
command -v npm >/dev/null 2>&1  || err "npm is required but not installed."

if [ ! -d "$OPENCLAW_DIR" ]; then
  err "OpenClaw directory not found at $OPENCLAW_DIR. Install OpenClaw first."
fi

# ── Step 1: Clone/Update Plugin ──────────────────────────────────────────────

info "Step 1/6: Installing plugin..."

if [ -d "$EXT_DIR" ]; then
  warn "Plugin directory exists. Updating..."
  cd "$EXT_DIR"
  git pull origin main 2>/dev/null || true
else
  mkdir -p "$(dirname "$EXT_DIR")"
  git clone https://github.com/wbbtmusic/openclaw-antigravity-oauth.git "$EXT_DIR"
  cd "$EXT_DIR"
fi

log "Plugin cloned to $EXT_DIR"

# ── Step 2: Install Dependencies ─────────────────────────────────────────────

info "Step 2/6: Installing npm dependencies..."

# Fix package.json name if needed (OpenClaw expects this exact name)
if command -v python3 >/dev/null 2>&1; then
  python3 -c "
import json
with open('package.json', 'r') as f:
    pkg = json.load(f)
if pkg.get('name') != 'opencode-antigravity-auth':
    pkg['name'] = 'opencode-antigravity-auth'
    with open('package.json', 'w') as f:
        json.dump(pkg, f, indent=2)
    print('  Fixed package.json name')
"
fi

npm install --production 2>/dev/null

# Create dist symlink if needed
if [ ! -d "dist" ] && [ -d "node_modules/opencode-antigravity-auth/dist" ]; then
  ln -sf "$(pwd)/node_modules/opencode-antigravity-auth/dist" dist
  log "Created dist/ symlink"
fi

log "Dependencies installed"

# ── Step 3: Register Plugin ──────────────────────────────────────────────────

info "Step 3/6: Registering plugin in openclaw.json..."

if [ -f "$CONFIG" ]; then
  python3 << 'PYEOF'
import json, os

config_path = os.path.expanduser("~/.openclaw/openclaw.json")
with open(config_path, "r") as f:
    cfg = json.load(f)

# Ensure plugins section exists
plugins = cfg.setdefault("plugins", {})
entries = plugins.setdefault("entries", {})

# Remove old bundled plugin if present
entries.pop("google-antigravity-auth", None)

# Add our plugin
if "opencode-antigravity-auth" not in entries:
    entries["opencode-antigravity-auth"] = True
    print("  Added opencode-antigravity-auth to plugins")

with open(config_path, "w") as f:
    json.dump(cfg, f, indent=2)
PYEOF
  log "Plugin registered"
else
  warn "openclaw.json not found, skipping plugin registration"
fi

# ── Step 4: Deploy API Proxy ─────────────────────────────────────────────────

info "Step 4/6: Deploying Antigravity API proxy..."

# Copy proxy script
cp "$EXT_DIR/antigravity-proxy.mjs" "$OPENCLAW_DIR/antigravity-proxy.mjs"

# Create systemd user service
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/antigravity-proxy.service << EOF
[Unit]
Description=Antigravity API Proxy (OpenClaw)
After=network.target

[Service]
Type=simple
ExecStart=$(command -v node) $OPENCLAW_DIR/antigravity-proxy.mjs
Restart=always
RestartSec=5
Environment=NODE_NO_WARNINGS=1
Environment=ANTIGRAVITY_PROXY_PORT=$PROXY_PORT

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable antigravity-proxy.service
systemctl --user restart antigravity-proxy.service

sleep 2
log "Proxy service started on port $PROXY_PORT"

# ── Step 5: Configure Provider ───────────────────────────────────────────────

info "Step 5/6: Configuring google-antigravity provider..."

python3 << PYEOF
import json, os

config_path = os.path.expanduser("~/.openclaw/openclaw.json")
with open(config_path, "r") as f:
    cfg = json.load(f)

providers = cfg.setdefault("models", {}).setdefault("providers", {})
providers["google-antigravity"] = {
    "baseUrl": "http://127.0.0.1:$PROXY_PORT/v1",
    "apiKey": "proxy-handled",
    "api": "openai-completions",
    "models": [
        {"id": "gemini-3-flash", "name": "Gemini 3 Flash"},
        {"id": "gemini-3-pro-high", "name": "Gemini 3 Pro High"},
        {"id": "gemini-3-pro-low", "name": "Gemini 3 Pro Low"},
        {"id": "gemini-3.1-pro-high", "name": "Gemini 3.1 Pro High"},
        {"id": "gemini-3.1-pro-low", "name": "Gemini 3.1 Pro Low"},
        {"id": "claude-opus-4-6-thinking", "name": "Claude Opus 4.6 Thinking"},
        {"id": "claude-opus-4-5-thinking", "name": "Claude Opus 4.5 Thinking"},
        {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6"},
        {"id": "claude-sonnet-4-5", "name": "Claude Sonnet 4.5"},
        {"id": "gpt-oss-120b-medium", "name": "GPT-OSS 120B Medium"},
    ]
}

with open(config_path, "w") as f:
    json.dump(cfg, f, indent=2)
print("  Provider configured → proxy@127.0.0.1:$PROXY_PORT")
PYEOF

log "Provider configured"

# ── Step 6: Restart Gateway ──────────────────────────────────────────────────

info "Step 6/6: Restarting OpenClaw gateway..."

if systemctl --user is-active openclaw-gateway.service >/dev/null 2>&1; then
  systemctl --user restart openclaw-gateway.service
  log "Gateway restarted"
else
  warn "Gateway service not found. Restart OpenClaw manually."
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Installation Complete!                                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Next step: ${CYAN}Log in with your Google account:${NC}"
echo ""
echo -e "  ${YELLOW}openclaw models auth login --provider google-antigravity${NC}"
echo ""
echo -e "After login, add ${CYAN}projectId${NC} to your auth profile:"
echo ""
echo -e "  ${YELLOW}python3 -c \"${NC}"
echo -e "  ${YELLOW}import json${NC}"
echo -e "  ${YELLOW}f = '$HOME/.openclaw/agents/main/agent/auth-profiles.json'${NC}"
echo -e "  ${YELLOW}d = json.load(open(f))${NC}"
echo -e "  ${YELLOW}for k,v in d.get('profiles',{}).items():${NC}"
echo -e "  ${YELLOW}  if 'antigravity' in k: v['projectId'] = 'rising-fact-p41fc'${NC}"
echo -e "  ${YELLOW}json.dump(d, open(f,'w'), indent=2)${NC}"
echo -e "  ${YELLOW}print('Done')\"${NC}"
echo ""
echo -e "Then restart the gateway:"
echo ""
echo -e "  ${YELLOW}systemctl --user restart openclaw-gateway.service${NC}"
echo ""
echo -e "Verify:"
echo ""
echo -e "  ${YELLOW}curl -s http://127.0.0.1:$PROXY_PORT/health${NC}"
echo -e "  ${YELLOW}openclaw models list | grep antigravity${NC}"
echo ""
