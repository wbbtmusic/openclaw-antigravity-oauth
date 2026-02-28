const { authorizeAntigravity } = require("./dist/src/antigravity/oauth");
const {
    ANTIGRAVITY_CLIENT_ID,
    ANTIGRAVITY_CLIENT_SECRET,
    ANTIGRAVITY_REDIRECT_URI,
} = require("./dist/src/constants");
const readline = require("readline");
const https = require("https");
const { URL } = require("url");

const PROVIDER_ID = "google-antigravity";
const PROVIDER_LABEL = "Google Antigravity (OAuth)";
const CLIENT_ID = ANTIGRAVITY_CLIENT_ID;
const CLIENT_SECRET = ANTIGRAVITY_CLIENT_SECRET;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_URI = ANTIGRAVITY_REDIRECT_URI;

const MODEL_CATALOG = [
    { id: "gemini-3-pro-high", name: "Gemini 3 Pro (High Thinking)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65535 },
    { id: "gemini-3-pro-low", name: "Gemini 3 Pro (Low Thinking)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65535 },
    { id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro (High)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65535 },
    { id: "gemini-3.1-pro-low", name: "Gemini 3.1 Pro (Low)", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65535 },
    { id: "gemini-3-flash", name: "Gemini 3 Flash", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1048576, maxTokens: 65536 },
    { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 Thinking", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 64000 },
    { id: "claude-opus-4-5-thinking", name: "Claude Opus 4.5 Thinking", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 64000 },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", reasoning: false, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 64000 },
];

function askQuestion(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => { rl.close(); resolve(answer); });
    });
}

function exchangeCodeForTokens(code, codeVerifier) {
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams({
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
            code_verifier: codeVerifier,
        }).toString();

        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
                "Accept": "application/json",
                "Accept-Encoding": "identity",
            },
        };

        const req = https.request(TOKEN_URL, options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk.toString(); });
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) {
                        reject(new Error("Google OAuth error: " + json.error + " - " + (json.error_description || "")));
                    } else {
                        resolve(json);
                    }
                } catch (e) {
                    reject(new Error("Failed to parse token response: " + data.substring(0, 200)));
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

async function getUserInfo(accessToken) {
    return new Promise((resolve) => {
        https.get("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: "Bearer " + accessToken, "Accept-Encoding": "identity" }
        }, (res) => {
            let data = "";
            res.on("data", (c) => { data += c.toString(); });
            res.on("end", () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
            });
        }).on("error", () => resolve({}));
    });
}

module.exports = function register(api) {
    api.registerProvider({
        id: PROVIDER_ID,
        label: PROVIDER_LABEL,
        auth: [
            {
                id: "oauth",
                label: "Google OAuth (Antigravity)",
                kind: "oauth",
                run: async (ctx) => {
                    try {
                        const auth = await authorizeAntigravity();

                        // Extract verifier from state parameter
                        const stateData = JSON.parse(Buffer.from(
                            auth.url.match(/state=([^&]+)/)[1], "base64url"
                        ).toString());
                        const verifier = stateData.verifier;

                        console.log("\n🔗 Open this URL in your browser:\n");
                        console.log(auth.url);
                        console.log("\nSign in with Google. Then paste the redirect URL here.");
                        console.log("(It will look like: http://localhost:51121/oauth-callback?code=XXXX&state=YYYY)\n");

                        if (ctx.openUrl) { try { await ctx.openUrl(auth.url); } catch (e) { } }

                        let input;
                        try {
                            if (ctx.prompter && typeof ctx.prompter.input === "function") {
                                input = await ctx.prompter.input("Paste redirect URL or code:");
                            } else {
                                input = await askQuestion("Paste redirect URL or code: ");
                            }
                        } catch (e) {
                            input = await askQuestion("Paste redirect URL or code: ");
                        }

                        if (!input || input.trim().length === 0) throw new Error("Empty input!");

                        input = input.trim();
                        let code = input;
                        if (input.includes("code=")) {
                            const url = new URL(input);
                            code = url.searchParams.get("code") || input;
                        }

                        console.log("🔄 Exchanging token...");
                        const tokens = await exchangeCodeForTokens(code, verifier);
                        console.log("✅ Token received!");

                        const userInfo = await getUserInfo(tokens.access_token);
                        const email = userInfo.email || "default";
                        console.log("✅ OAuth successful! Email:", email);

                        return {
                            profiles: [{
                                profileId: PROVIDER_ID + ":" + email,
                                credential: {
                                    type: "oauth",
                                    provider: PROVIDER_ID,
                                    access: tokens.access_token,
                                    refresh: tokens.refresh_token,
                                    expires: Date.now() + (tokens.expires_in * 1000),
                                },
                            }],
                            defaultModel: PROVIDER_ID + "/gemini-3-flash",
                            configPatch: {
                                models: {
                                    providers: {
                                        [PROVIDER_ID]: {
                                            baseUrl: "https://generativelanguage.googleapis.com/v1beta",
                                            apiKey: tokens.access_token,
                                            api: "google-generative-ai",
                                            models: MODEL_CATALOG,
                                        },
                                    },
                                },
                            },
                        };
                    } catch (err) {
                        console.error("[google-antigravity] Error:", err.message);
                        throw err;
                    }
                },
            },
        ],
    });
};

module.exports.default = module.exports;
