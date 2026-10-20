// Recibe eventos de la página (visita, clic WhatsApp, llamada, formulario) y los guarda en Netlify Blobs.
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/hit" };

const TZ = "America/New_York";
const TYPES = new Set(["pv", "wa", "call", "form"]);

function dayKey(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function srcOf(ref, q) {
  q = String(q || "");
  if (/[?&](gclid|gbraid|wbraid)=/.test(q) || /utm_medium=(cpc|ppc|paid)/i.test(q)) return "ads";
  let h = "";
  try { h = ref ? new URL(ref).hostname.toLowerCase() : ""; } catch { h = ""; }
  if (!h) return "direct";
  if (h.includes("miaautorental.com")) return "direct";
  if (h.includes("google")) return "google";
  if (h.includes("bing")) return "bing";
  if (h.includes("facebook") || h.includes("fb.")) return "facebook";
  if (h.includes("instagram")) return "instagram";
  if (h.includes("whatsapp")) return "whatsapp";
  if (h.includes("tiktok")) return "tiktok";
  if (h.includes("yahoo") || h.includes("duckduckgo")) return "search";
  if (h.includes("chatgpt") || h.includes("openai") || h.includes("perplexity") || h.includes("claude") || h.includes("gemini")) return "ai";
  return "other";
}

export default async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawl|spider|headless|lighthouse|preview|facebookexternalhit|whatsapp\//i.test(ua)) return new Response(null, { status: 204 });
  let b = {};
  try { b = JSON.parse(await req.text()); } catch { return new Response(null, { status: 204 }); }
  const t = String(b.t || "pv");
  if (!TYPES.has(t)) return new Response(null, { status: 204 });
  const vid = String(b.v || "").replace(/[^a-z0-9]/gi, "").slice(0, 10) || "anon";
  const dev = b.d === "m" ? "m" : "d";
  const src = srcOf(b.r, b.q);
  const lang = b.l === "en" ? "en" : "es";
  const now = new Date();
  const key = `ev/${dayKey(now)}/${now.getTime()}-${t}-${dev}-${src}-${lang}-${vid}`;
  try {
    const store = getStore("analytics");
    await store.set(key, "1");
  } catch (e) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
