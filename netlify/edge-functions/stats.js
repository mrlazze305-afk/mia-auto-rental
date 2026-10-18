// Devuelve las métricas agregadas para el panel privado. Requiere la clave en el header x-key.
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/stats", cache: "manual" };

const TZ = "America/New_York";
function fmt(d, opts) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, ...opts }).format(d); }
function dayOf(d) { return fmt(d, { year: "numeric", month: "2-digit", day: "2-digit" }); }
function hourOf(d) { return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d), 10) % 24; }

export default async (req) => {
  const url = new URL(req.url);
  const expected = (Netlify.env.get("PANEL_KEY") || "2121").trim();
  const given = (req.headers.get("x-key") || url.searchParams.get("key") || "").trim();
  if (!given || given !== expected) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  const today = dayOf(new Date());
  const from = (url.searchParams.get("from") || today).slice(0, 10);
  const to = (url.searchParams.get("to") || today).slice(0, 10);

  const store = getStore("analytics");
  const { blobs } = await store.list({ prefix: "ev/" });
  const days = {}; // day -> {pv,wa,call,form,v:Set}
  const src = {}, dev = { m: 0, d: 0 }, lang = { es: 0, en: 0 }, hours = new Array(24).fill(0);
  const tot = { pv: 0, wa: 0, call: 0, form: 0 }, uniq = new Set();
  const ctaV = new Set();
  let firstDay = null;
  for (const b of blobs) {
    const m = /^ev\/(\d{4}-\d{2}-\d{2})\/(\d+)-(pv|wa|call|form)-(m|d)-([a-z]+)-(es|en)-([a-z0-9]+)$/i.exec(b.key);
    if (!m) continue;
    const [, day, ts, t, dv, s, lg, v] = m;
    if (!firstDay || day < firstDay) firstDay = day;
    if (day < from || day > to) continue;
    const row = days[day] || (days[day] = { pv: 0, wa: 0, call: 0, form: 0, v: new Set() });
    row[t]++; tot[t]++;
    if (t === "pv") {
      row.v.add(v); uniq.add(v);
      src[s] = (src[s] || 0) + 1; dev[dv]++; lang[lg]++;
      hours[hourOf(new Date(parseInt(ts, 10)))]++;
    } else { ctaV.add(v); }
  }
  const out = {
    from, to, today, firstDay,
    totals: { ...tot, uv: uniq.size, cta: tot.wa + tot.call + tot.form, ctaUsers: ctaV.size },
    days: Object.keys(days).sort().map((d) => ({ day: d, pv: days[d].pv, uv: days[d].v.size, wa: days[d].wa, call: days[d].call, form: days[d].form })),
    src, dev, lang, hours,
  };
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
};
