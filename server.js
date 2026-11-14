// ColdGuard server for Render: serves the chatbot page and proxies AI calls to the
// Anthropic API so the API key stays on the server (never in the browser).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const QUICK_MODEL = process.env.ANTHROPIC_QUICK_MODEL || "claude-haiku-5-5";
const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
const LIMIT = +(process.env.RATE_LIMIT_PER_10_MIN || 40);

const INDEX = fs.readFileSync(path.join(__dirname, "public", "index.html"));
const hits = new Map(); // ip -> [timestamps]

function rateOk(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  if (arr.length >= LIMIT) { hits.set(ip, arr); return false; }
  arr.push(now); hits.set(ip, arr); return true;
}
function send(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ""; req.on("data", (c) => { data += c; if (data.length > 200000) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { reject(e); } });
  });
}
async function callClaude(messages, quick, maxTokens) {
  const r = await fetch(BASE + "/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: quick ? QUICK_MODEL : MODEL, max_tokens: maxTokens, messages }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || "upstream error " + r.status); e.status = r.status; throw e; }
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}
function cleanMessages(msgs) {
  if (!Array.isArray(msgs)) return null;
  const out = msgs.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 30000) })).filter((m) => m.content);
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return null;
  return out;
}

const server = http.createServer(async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const url = req.url.split("?")[0];
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end(INDEX);
  }
  if (req.method === "GET" && url === "/api/health") return send(res, 200, { ok: true, ai: !!API_KEY, model: API_KEY ? MODEL : null });
  if (req.method === "POST" && (url === "/api/chat" || url === "/api/json")) {
    if (!API_KEY) return send(res, 503, { code: "not_configured", message: "AI is not configured on this server" });
    if (!rateOk(ip)) return send(res, 429, { code: "rate_limited", message: "Too many questions, please wait a few minutes" });
    try {
      const body = await readBody(req);
      if (url === "/api/chat") {
        const msgs = cleanMessages(body.messages);
        if (!msgs) return send(res, 400, { code: "bad_request", message: "messages must end with a user message" });
        const text = await callClaude(msgs, body.tier === "quick", 900);
        return send(res, 200, { text });
      }
      const prompt = String(body.prompt || "").slice(0, 30000);
      const text = await callClaude([{ role: "user", content: prompt + "\n\nRespond with JSON only, no other text." }], true, 300);
      const m = text.match(/\{[\s\S]*\}/);
      let value = null; try { value = m ? JSON.parse(m[0]) : null; } catch (e) { value = null; }
      return send(res, 200, { value });
    } catch (e) {
      return send(res, e.status === 429 ? 429 : 502, { code: e.status === 429 ? "rate_limited" : "upstream_error", message: String(e.message || e).slice(0, 200) });
    }
  }
  send(res, 404, { error: "not found" });
});
server.listen(PORT, () => console.log(`ColdGuard running on port ${PORT} · AI ${API_KEY ? "on (" + MODEL + ")" : "off: set ANTHROPIC_API_KEY"}`));
