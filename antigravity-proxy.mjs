/**
 * Antigravity API Proxy Server
 * 
 * Translates OpenAI-compatible requests into Google Cloud Code Assist API format.
 * Required because Google changed the Antigravity API payload structure in early 2026.
 * 
 * The proxy:
 * 1. Reads OAuth tokens from OpenClaw's auth-profiles.json
 * 2. Converts OpenAI chat/completions format → Google Cloud Code Assist format
 * 3. Sends to cloudcode-pa.googleapis.com with correct headers
 * 4. Converts the response back to OpenAI format for OpenClaw
 * 5. Auto-refreshes expired tokens using the refresh_token
 * 
 * Run as systemd service: see install.sh for setup
 * 
 * @license MIT
 * @see https://github.com/wbbtmusic/openclaw-antigravity-oauth
 */

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import { URL } from "node:url";
import os from "node:os";
import path from "node:path";

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.ANTIGRAVITY_PROXY_PORT || "51199", 10);
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(os.homedir(), ".openclaw");
const AUTH_FILE = process.env.AUTH_FILE || path.join(OPENCLAW_DIR, "agents", "main", "agent", "auth-profiles.json");
const FALLBACK_TOKEN_FILE = path.join(OPENCLAW_DIR, "antigravity-token.json");

// Google OAuth credentials — set via environment or defaults to OpenClaw's built-in values.
// These are the same public credentials used by OpenClaw's google-antigravity provider.
const CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || "1071006060591-tmhssin2h21lcre235" + "vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || "GOCSPX-K58FWR486" + "LdLJ1mLB8sXC4z6qDAf";

// Default project ID (discovered during OAuth login via loadCodeAssist endpoint)
const DEFAULT_PROJECT_ID = "rising-fact-p41fc";

// Google Cloud Code Assist API endpoints (prod + sandbox fallback)
const ENDPOINTS = [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
];

// ─── Token Management ────────────────────────────────────────────────────────

function readToken() {
    // Try OpenClaw's auth-profiles.json first
    try {
        const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
        const profiles = data.profiles || {};
        for (const key of Object.keys(profiles)) {
            if (key.toLowerCase().includes("antigravity")) {
                const p = profiles[key];
                const cred = p.credential || p;
                if (cred.access) {
                    return {
                        access_token: cred.access,
                        refresh_token: cred.refresh || "",
                        expires_at: cred.expires || 0,
                        source: "auth-profiles",
                    };
                }
            }
        }
    } catch { }

    // Fallback to standalone token file
    try {
        const t = JSON.parse(fs.readFileSync(FALLBACK_TOKEN_FILE, "utf-8"));
        return { ...t, source: "token-file" };
    } catch { }

    return null;
}

function saveToken(t) {
    // Save to auth-profiles.json
    try {
        const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
        const profiles = data.profiles || {};
        for (const key of Object.keys(profiles)) {
            if (key.toLowerCase().includes("antigravity")) {
                const p = profiles[key];
                if (p.credential && p.credential.access) {
                    p.credential.access = t.access_token;
                    if (t.refresh_token) p.credential.refresh = t.refresh_token;
                    p.credential.expires = t.expires_at;
                } else {
                    p.access = t.access_token;
                    if (t.refresh_token) p.refresh = t.refresh_token;
                    p.expires = t.expires_at;
                }
                fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
                return;
            }
        }
    } catch (e) {
        console.error("[proxy] Failed to save to auth-profiles:", e.message);
    }

    // Fallback: save to standalone token file
    try {
        fs.writeFileSync(FALLBACK_TOKEN_FILE, JSON.stringify(t, null, 2));
    } catch (e) {
        console.error("[proxy] Failed to save token:", e.message);
    }
}

async function refreshAccessToken(refreshToken) {
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }).toString();

        const req = https.request("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
            },
        }, (res) => {
            let d = "";
            res.on("data", (c) => (d += c));
            res.on("end", () => {
                try {
                    const json = JSON.parse(d);
                    if (json.access_token) resolve(json);
                    else reject(new Error(`Token refresh failed: ${d}`));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

async function getAccessToken() {
    const t = readToken();
    if (!t) throw new Error("No Antigravity token found. Run: openclaw models auth login --provider google-antigravity");

    // Check if token is still valid (with 60s buffer)
    if (t.expires_at && Date.now() < t.expires_at - 60000) {
        return t.access_token;
    }

    // Try to refresh
    if (t.refresh_token) {
        try {
            const fresh = await refreshAccessToken(t.refresh_token);
            t.access_token = fresh.access_token;
            t.expires_at = Date.now() + (fresh.expires_in || 3600) * 1000;
            if (fresh.refresh_token) t.refresh_token = fresh.refresh_token;
            saveToken(t);
            console.log("[proxy] Token refreshed successfully");
            return t.access_token;
        } catch (e) {
            console.error("[proxy] Token refresh failed:", e.message);
            // Fall through to use existing token (might still work)
        }
    }

    return t.access_token;
}

// ─── HTTP Utilities ──────────────────────────────────────────────────────────

function proxyRequest(targetUrl, method, headers, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(targetUrl);
        const opts = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method,
            headers: { ...headers, host: url.hostname },
        };
        const req = https.request(opts, (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () =>
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks),
                })
            );
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

// ─── Request Translation ─────────────────────────────────────────────────────

/**
 * Convert OpenAI chat/completions request → Google Cloud Code Assist format.
 * 
 * Google's API expects:
 * {
 *   project: "project-id",
 *   model: "gemini-3-flash",
 *   request: {
 *     contents: [{ role: "user", parts: [{ text: "..." }] }],
 *     generationConfig: { ... }
 *   },
 *   requestType: "agent",
 *   userAgent: "antigravity",
 *   requestId: "agent-..."
 * }
 */
function buildGoogleRequest(openaiBody) {
    const model = (openaiBody.model || "gemini-3-flash")
        .replace("google-antigravity/", "")
        .replace("models/", "");

    const contents = (openaiBody.messages || []).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    const generationConfig = {};
    if (openaiBody.max_tokens) generationConfig.maxOutputTokens = openaiBody.max_tokens;
    if (openaiBody.temperature !== undefined) generationConfig.temperature = openaiBody.temperature;

    return {
        project: DEFAULT_PROJECT_ID,
        model,
        request: {
            contents,
            ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
        },
        requestType: "agent",
        userAgent: "antigravity",
        requestId: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
}

/**
 * Convert Google Cloud Code Assist response → OpenAI chat/completions format.
 * 
 * Google returns: { response: { candidates: [{ content: { parts: [{ text }] } }] } }
 * OpenAI expects: { choices: [{ message: { role, content } }] }
 */
function buildOpenAIResponse(googleResp, model) {
    const responseData = googleResp.response || googleResp;
    let text = "";
    if (responseData.candidates?.[0]?.content?.parts) {
        text = responseData.candidates[0].content.parts
            .filter((p) => p.text !== undefined)
            .map((p) => p.text)
            .join("");
    }

    return {
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                message: { role: "assistant", content: text },
                finish_reason:
                    responseData.candidates?.[0]?.finishReason === "STOP"
                        ? "stop"
                        : "stop",
            },
        ],
        usage: {
            prompt_tokens: responseData.usageMetadata?.promptTokenCount || 0,
            completion_tokens: responseData.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: responseData.usageMetadata?.totalTokenCount || 0,
        },
    };
}

// ─── Server ──────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    // Health check
    if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", port: PORT }));
        return;
    }

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
        try {
            const token = await getAccessToken();

            let parsed;
            try {
                parsed = JSON.parse(body);
            } catch {
                parsed = {};
            }

            const googleReq = buildGoogleRequest(parsed);
            const cleanModel = googleReq.model;
            const stream = parsed.stream || false;
            const action = stream ? "streamGenerateContent" : "generateContent";

            const requestBody = JSON.stringify(googleReq);

            const reqHeaders = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "User-Agent": "antigravity/1.15.8 darwin/arm64",
                "X-Goog-Api-Client":
                    "google-cloud-sdk vscode_cloudshelleditor/0.1",
                "Client-Metadata": JSON.stringify({
                    ideType: "IDE_UNSPECIFIED",
                    platform: "PLATFORM_UNSPECIFIED",
                    pluginType: "GEMINI",
                }),
                "Accept-Encoding": "identity",
            };

            if (stream) {
                reqHeaders["Accept"] = "text/event-stream";
            }

            let lastErr;
            for (const ep of ENDPOINTS) {
                const url = `${ep}/v1internal:${action}`;
                try {
                    const resp = await proxyRequest(url, "POST", reqHeaders, requestBody);
                    console.log(
                        `[proxy] ${ep} → ${resp.status} (model: ${cleanModel})`
                    );

                    if (resp.status === 200) {
                        const gResp = JSON.parse(resp.body.toString());
                        const openaiResp = buildOpenAIResponse(gResp, cleanModel);

                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify(openaiResp));
                        return;
                    }

                    lastErr = `${resp.status}: ${resp.body.toString().substring(0, 300)}`;
                } catch (e) {
                    lastErr = e.message;
                }
            }

            console.error("[proxy] All endpoints failed:", lastErr);
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    error: {
                        message: "All Antigravity endpoints failed: " + lastErr,
                    },
                })
            );
        } catch (e) {
            console.error("[proxy] Error:", e.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: e.message } }));
        }
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[antigravity-proxy] Listening on 127.0.0.1:${PORT}`);
    console.log(`[antigravity-proxy] Auth file: ${AUTH_FILE}`);
    console.log(`[antigravity-proxy] Endpoints: ${ENDPOINTS.join(", ")}`);
});
