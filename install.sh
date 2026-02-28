#!/bin/bash
# OpenClaw Antigravity OAuth Plugin — Automated Installer
# Usage: curl -sL https://raw.githubusercontent.com/wbbtmusic/openclaw-antigravity-oauth/main/install.sh | bash

set -e

PLUGIN_ID="opencode-antigravity-auth"
REPO="https://github.com/wbbtmusic/openclaw-antigravity-oauth"
INSTALL_DIR="${HOME}/.openclaw/extensions/${PLUGIN_ID}"

echo ""
echo "🔧 OpenClaw Antigravity OAuth Plugin Installer"
echo "================================================"
echo ""

# 1. Clone or download
if command -v git &>/dev/null; then
  echo "📦 Cloning repository..."
  rm -rf /tmp/openclaw-antigravity-oauth
  git clone --depth 1 "$REPO" /tmp/openclaw-antigravity-oauth
else
  echo "📦 Downloading repository..."
  curl -sL "${REPO}/archive/refs/heads/main.tar.gz" | tar xz -C /tmp
  mv /tmp/openclaw-antigravity-oauth-main /tmp/openclaw-antigravity-oauth
fi

# 2. Install to extensions directory
echo "📁 Installing to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"
cp -r /tmp/openclaw-antigravity-oauth/* "$INSTALL_DIR/"

# 3. Install npm dependencies
echo "📥 Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production 2>&1 | tail -3

# 4. Update openclaw.json — add plugin entry
OPENCLAW_CONFIG="${HOME}/.openclaw/openclaw.json"
if [ -f "$OPENCLAW_CONFIG" ]; then
  echo "⚙️  Updating openclaw.json..."
  python3 -c "
import json, sys
with open('$OPENCLAW_CONFIG', 'r') as f: d = json.load(f)
plugins = d.setdefault('plugins', {}).setdefault('entries', {})
if '$PLUGIN_ID' not in plugins:
    plugins['$PLUGIN_ID'] = {'enabled': True, 'config': {}}
    with open('$OPENCLAW_CONFIG', 'w') as f: json.dump(d, f, indent=2)
    print('  ✅ Plugin entry added')
else:
    print('  ℹ️  Plugin entry already exists')
" 2>/dev/null || echo "  ⚠️  Could not auto-update config. Add manually (see README)."
fi

# 5. Cleanup
rm -rf /tmp/openclaw-antigravity-oauth

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Run: openclaw models auth login --provider google-antigravity"
echo "  2. Open the URL in your browser and sign in with Google"
echo "  3. Paste the redirect URL back in the terminal"
echo "  4. Run: openclaw gateway restart"
echo ""
echo "☕ Support: https://buymeacoffee.com/wbbt"
echo ""
