import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import { URL } from "node:url";
import os from "node:os";
import path from "node:path";

const PORT = parseInt(process.env.ANTIGRAVITY_PROXY_PORT || "51199", 10);
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(os.homedir(), ".openclaw");
const AUTH_FILE = process.env.AUTH_FILE || path.join(OPENCLAW_DIR, "agents", "main", "agent", "auth-profiles.json");
const LOG_FILE = "/tmp/proxy-debug.log";

const CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || "1071006060591-tmhssin2h21lcre235" + "vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || "GOCSPX-K58FWR486" + "LdLJ1mLB8sXC4z6qDAf";
const DEFAULT_PROJECT_ID = "rising-fact-p41fc";

const ENDPOINTS = [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
];

fs.appendFileSync(LOG_FILE, `\n=== Proxy v11 Started ${new Date().toISOString()} ===\n`);
function logDbg(msg) {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

function readToken() {
    try {
        const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
        for (const [k, v] of Object.entries(data.profiles || {})) {
            if (k.toLowerCase().includes("antigravity")) {
                const c = v.credential || v;
                if (c.access) return { access_token: c.access, refresh_token: c.refresh || "", expires_at: c.expires || 0 };
            }
        }
    } catch { }
    return null;
}

function saveToken(t) {
    try {
        const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
        for (const [k, v] of Object.entries(data.profiles || {})) {
            if (k.toLowerCase().includes("antigravity")) {
                const target = v.credential && v.credential.access ? v.credential : v;
                target.access = t.access_token;
                if (t.refresh_token) target.refresh = t.refresh_token;
                target.expires = t.expires_at;
                fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
                return;
            }
        }
    } catch (e) { }
}

async function refreshAccessToken(rt) {
    return new Promise((resolve, reject) => {
        const b = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rt, grant_type: "refresh_token" }).toString();
        const r = https.request("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(b) } }, res => {
            let d = ""; res.on("data", c => d += c); res.on("end", () => { try { const j = JSON.parse(d); j.access_token ? resolve(j) : reject(new Error(d)); } catch (e) { reject(e); } });
        });
        r.on("error", reject); r.write(b); r.end();
    });
}

async function getAccessToken() {
    const t = readToken();
    if (!t) throw new Error("No token found");
    if (t.expires_at && Date.now() < t.expires_at - 60000) return t.access_token;
    if (t.refresh_token) {
        try {
            const f = await refreshAccessToken(t.refresh_token);
            t.access_token = f.access_token; t.expires_at = Date.now() + (f.expires_in || 3600) * 1000;
            if (f.refresh_token) t.refresh_token = f.refresh_token;
            saveToken(t);
            return t.access_token;
        } catch (e) { }
    }
    return t.access_token;
}

function extractText(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.filter(p => p.type === "text" || p.text).map(p => p.text || "").join("\n");
    if (content && typeof content === "object") return content.text || JSON.stringify(content);
    return String(content || "");
}

// Sanitize parameters to comply with Google Cloud Code API requirements
function sanitizeParamsForGoogle(params) {
    if (!params || typeof params !== 'object') return params;

    // 1) Remove JSON Schema fields Google doesn't support
    const UNSUPPORTED = [
        'patternProperties', 'additionalProperties', '$schema', '$id',
        '$ref', '$defs', 'definitions', 'if', 'then', 'else',
        'allOf', 'oneOf', 'anyOf', 'not', 'const', 'default',
        'examples', 'readOnly', 'writeOnly', 'deprecated',
        'minProperties', 'maxProperties', 'dependentRequired',
        'dependentSchemas', 'unevaluatedProperties', 'title',
    ];
    for (const key of UNSUPPORTED) {
        if (params[key] !== undefined) delete params[key];
    }

    // 2) Strip internal aliases
    const ALIASES = ['file_path', 'old_string', 'new_string', 'old_str', 'new_str'];
    if (params.properties) {
        for (const alias of ALIASES) {
            if (params.properties[alias]) {
                delete params.properties[alias];
                if (params.required) {
                    params.required = params.required.filter(r => r !== alias);
                }
            }
        }
        // 3) Recursively sanitize nested properties
        for (const key of Object.keys(params.properties)) {
            params.properties[key] = sanitizeParamsForGoogle(params.properties[key]);
        }
    }

    // 4) Sanitize items in arrays
    if (params.items) {
        params.items = sanitizeParamsForGoogle(params.items);
    }

    return params;
}

function convertOpenAIToGoogleFormat(parsedInfo) {
    const model = (parsedInfo.model || "gemini-3-flash").replace("google-antigravity/", "").replace("antigravity/", "").replace("models/", "");
    const contents = [];
    let systemInstructionText = "";

    for (const m of (parsedInfo.messages || [])) {
        const text = extractText(m.content);

        if (m.role === "system") {
            systemInstructionText += (systemInstructionText ? "\n\n" : "") + text;
            continue;
        }

        let role = m.role === "assistant" ? "model" : "user";

        const functionCalls = [];
        if (m.tool_calls) {
            for (const tc of m.tool_calls) {
                if (tc.type === "function") {
                    let args = {};
                    try { args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments; } catch { }
                    functionCalls.push({ name: tc.function.name, args: args });
                }
            }
        }

        const functionResponses = [];
        if (m.role === "tool") {
            role = "user";
            functionResponses.push({
                name: m.name || "unknown",
                response: { name: m.name || "unknown", content: { text: text } }
            });
        }

        const parts = [];
        if (text && m.role !== "tool") parts.push({ text });
        for (const fc of functionCalls) parts.push({ functionCall: fc });
        for (const fr of functionResponses) parts.push({ functionResponse: fr });

        if (parts.length === 0) continue;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts.push(...parts);
        } else {
            contents.push({ role, parts });
        }
    }

    if (contents.length > 0 && contents[0].role === "model") contents[0].role = "user";

    const req = {
        project: DEFAULT_PROJECT_ID, model, request: { contents },
        requestType: "agent", userAgent: "antigravity", requestId: `agent-${Date.now()}`
    };

    if (systemInstructionText) {
        req.request.systemInstruction = { role: "system", parts: [{ text: systemInstructionText }] };
    }

    if (parsedInfo.tools && parsedInfo.tools.length > 0) {
        const functionDeclarations = parsedInfo.tools.filter(t => t.type === "function").map(t => {
            const tool = { name: t.function.name, description: t.function.description || "" };
            if (Object.keys(t.function.parameters || {}).length > 0) tool.parameters = sanitizeParamsForGoogle(JSON.parse(JSON.stringify(t.function.parameters)));
            return tool;
        });
        if (functionDeclarations.length > 0) req.request.tools = [{ functionDeclarations }];
    }

    const gc = {};
    if (parsedInfo.max_tokens || parsedInfo.max_completion_tokens) gc.maxOutputTokens = parsedInfo.max_tokens || parsedInfo.max_completion_tokens;
    if (parsedInfo.temperature !== undefined) gc.temperature = parsedInfo.temperature;
    if (Object.keys(gc).length > 0) req.request.generationConfig = gc;

    return req;
}

function makeGoogleRequest(url, headers, requestBody) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname, port: 443, path: u.pathname + u.search,
            method: "POST", headers: { ...headers, host: u.hostname },
        }, (res) => resolve(res));
        req.on("error", reject);
        req.write(requestBody);
        req.end();
    });
}

const server = http.createServer(async (req, res) => {
    if (req.url === "/health" || req.url === "/v1/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", version: "11.0" })); return;
    }

    if (req.url === "/v1/models" || req.url === "/models") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            data: [
                { id: "gemini-3-flash", object: "model" },
                { id: "claude-opus-4-6-thinking", object: "model" }
            ]
        })); return;
    }

    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
        try {
            const token = await getAccessToken();
            let parsed = {};
            try { parsed = JSON.parse(body); } catch { }

            const cleanModel = (parsed.model || "gemini-3-flash").replace("google-antigravity/", "").replace("antigravity/", "");

            // Log incoming requests
            const toolNames = (parsed.tools || []).map(t => t.function?.name).filter(Boolean);
            const msgRoles = (parsed.messages || []).map(m => m.role);
            logDbg(`INCOMING: model=${cleanModel} tools=[${toolNames.join(',')}] msgs=${msgRoles.join(',')}`);

            const googleReq = convertOpenAIToGoogleFormat(parsed);
            const requestBody = JSON.stringify(googleReq);

            const reqHeaders = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "User-Agent": "antigravity/1.15.8",
                "X-Goog-Api-Client": "google-cloud-sdk vscode",
            };

            const chatId = "chatcmpl-" + Date.now();
            let lastErr;

            for (const ep of ENDPOINTS) {
                const url = `${ep}/v1internal:streamGenerateContent`;
                try {
                    const googleRes = await makeGoogleRequest(url, reqHeaders, requestBody);
                    console.log(`[proxy] ${ep} → ${googleRes.statusCode} streaming`);

                    if (googleRes.statusCode !== 200) {
                        const chunks = [];
                        googleRes.on("data", c => chunks.push(c));
                        await new Promise(r => googleRes.on("end", r));
                        lastErr = `${googleRes.statusCode}: ${Buffer.concat(chunks).toString().substring(0, 300)}`;
                        continue;
                    }

                    res.writeHead(200, {
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache", "Connection": "keep-alive"
                    });

                    // Handshake chunk
                    res.write(`data: ${JSON.stringify({
                        id: chatId, object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000), model: cleanModel,
                        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }]
                    })}\n\n`);

                    let buffer = "";
                    let finalUsage = {};
                    let emittedToolCalls = false;
                    let activeToolIdx = 0;

                    googleRes.on("data", (chunk) => {
                        const chunkStr = chunk.toString();
                        buffer += chunkStr;
                        logDbg(`RAW[${chunkStr.length}]: ${chunkStr.substring(0, 500)}`);

                        while (true) {
                            let startIndex = buffer.indexOf('{"response"');
                            if (startIndex === -1) break;

                            let openBraces = 0;
                            let endIndex = -1;
                            let inString = false;
                            let escape = false;

                            for (let i = startIndex; i < buffer.length; i++) {
                                const char = buffer[i];
                                if (escape) { escape = false; continue; }
                                if (char === '\\') { escape = true; continue; }
                                if (char === '"') { inString = !inString; continue; }
                                if (!inString) {
                                    if (char === '{') openBraces++;
                                    if (char === '}') {
                                        openBraces--;
                                        if (openBraces === 0) { endIndex = i; break; }
                                    }
                                }
                            }

                            if (endIndex === -1) break;

                            const jsonStr = buffer.substring(startIndex, endIndex + 1);
                            buffer = buffer.substring(endIndex + 1);

                            try {
                                const obj = JSON.parse(jsonStr);
                                const data = obj.response || obj;

                                if (data.candidates?.[0]?.content?.parts) {
                                    for (const part of data.candidates[0].content.parts) {
                                        if (part.text !== undefined) {
                                            res.write(`data: ${JSON.stringify({
                                                id: chatId, object: "chat.completion.chunk",
                                                created: Math.floor(Date.now() / 1000), model: cleanModel,
                                                choices: [{ index: 0, delta: { content: part.text }, finish_reason: null }]
                                            })}\n\n`);
                                        }

                                        if (part.functionCall !== undefined) {
                                            const fc = part.functionCall;
                                            const toolId = `call_${Date.now()}_${activeToolIdx}`;
                                            const argsStr = typeof fc.args === 'string' ? fc.args : JSON.stringify(fc.args || {});

                                            // Stream part 1: Tool ID and Name
                                            const deltaName = {
                                                tool_calls: [{
                                                    index: activeToolIdx,
                                                    id: toolId,
                                                    type: "function",
                                                    function: {
                                                        name: fc.name,
                                                        arguments: ""
                                                    }
                                                }]
                                            };
                                            res.write(`data: ${JSON.stringify({
                                                id: chatId, object: "chat.completion.chunk",
                                                created: Math.floor(Date.now() / 1000), model: cleanModel,
                                                choices: [{ index: 0, delta: deltaName, finish_reason: null }]
                                            })}\n\n`);

                                            // Stream part 2: Arguments
                                            const deltaArgs = {
                                                tool_calls: [{
                                                    index: activeToolIdx,
                                                    function: {
                                                        arguments: argsStr
                                                    }
                                                }]
                                            };
                                            res.write(`data: ${JSON.stringify({
                                                id: chatId, object: "chat.completion.chunk",
                                                created: Math.floor(Date.now() / 1000), model: cleanModel,
                                                choices: [{ index: 0, delta: deltaArgs, finish_reason: null }]
                                            })}\n\n`);

                                            activeToolIdx++;
                                            emittedToolCalls = true;
                                            logDbg(`TOOL EXECUTED: ${fc.name} with ${argsStr}`);
                                        }
                                    }
                                }
                                if (data.usageMetadata) finalUsage = data.usageMetadata;
                            } catch (e) { }
                        } // end while(true)
                    });

                    googleRes.on("end", () => {
                        const finishReason = emittedToolCalls ? "tool_calls" : "stop";
                        const usageObj = {
                            prompt_tokens: finalUsage.promptTokenCount || 0,
                            completion_tokens: finalUsage.candidatesTokenCount || 0,
                            total_tokens: finalUsage.totalTokenCount || 0,
                        };

                        res.write(`data: ${JSON.stringify({
                            id: chatId, object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000), model: cleanModel,
                            choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
                            usage: usageObj,
                        })}\n\n`);

                        res.write("data: [DONE]\n\n");
                        res.end();
                        logDbg(`STREAM COMPLETE: reason=${finishReason}`);
                    });

                    googleRes.on("error", (e) => {
                        res.write("data: [DONE]\n\n");
                        res.end();
                    });

                    return;
                } catch (e) { lastErr = e.message; }
            }

            console.error("[proxy] Error:", lastErr);
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: "All endpoints failed: " + lastErr } }));
        } catch (e) {
            console.error("[proxy] Fatal:", e.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: e.message } }));
        }
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[antigravity-proxy] v11.0 (Flawless Tools) on 127.0.0.1:${PORT}`);
});
