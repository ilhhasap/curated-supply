const BLOCKED = [
  "shopee.com",
  "shopee.co.id",
  "shopee.sg",
  "shopee.co.th",
  "shopee.vn",
  "shopee.ph",
  "shopee.com.my",
  "tokopedia.com",
  "lazada.com",
  "lazada.co.id",
  "lazada.sg",
  "lazada.co.th",
  "bukalapak.com",
  "blibli.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "whatsapp.com",
  "wa.me",
  "telegram.org",
  "t.me",
  "telegram.me",
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "buff.ly",
  "cutt.ly",
  "rb.gy",
  "s.id",
  "is.gd",
  "rebrand.ly",
  "linktr.ee",
];

const TRACKING = new Set([
  "gclid",
  "fbclid",
  "fb_action_ids",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "ref",
  "ref_src",
]);

export const SEED_ALLOWLIST = [
  "apple.com",
  "samsung.com",
  "sony.com",
  "bose.com",
  "nintendo.com",
  "logitech.com",
  "keychron.com",
  "nuphy.com",
  "nativeunion.com",
  "dyson.com",
  "dell.com",
  "asus.com",
  "lenovo.com",
  "google.com",
  "store.google.com",
  "nothing.tech",
  "anker.com",
  "belkin.com",
  "sennheiser.com",
  "shure.com",
  "audio-technica.com",
  "fujifilm.com",
  "canon.com",
  "nikon.com",
  "peakdesign.com",
  "dji.com",
];

function bareHost(host: string) {
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function isBlockedHost(host: string) {
  const h = bareHost(host);
  if (/(^|\.)shopee\./.test(h) || h.includes("tokopedia.") || h.includes("lazada.")) return true;
  return BLOCKED.some((domain) => h === domain || h.endsWith("." + domain));
}

export function isAllowlisted(host: string, allow: readonly string[]) {
  const h = bareHost(host);
  return allow.some((domain) => {
    const d = bareHost(domain);
    return h === d || h.endsWith("." + d);
  });
}

export type ParsedUrl =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: string };

export function canonicalUrl(raw: string): ParsedUrl {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Add the official https link." };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Enter a full https URL." };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "Only https links." };
  const host = bareHost(parsed.hostname);
  if (!host || host.includes(" ") || !host.includes(".")) {
    return { ok: false, reason: "That domain does not look usable." };
  }
  if (isBlockedHost(host)) {
    return { ok: false, reason: "Marketplace, social, and short links are not accepted." };
  }
  const path = parsed.pathname.toLowerCase();
  if (
    path === "/search" ||
    path === "/cart" ||
    path === "/checkout" ||
    /(^|\/)(search|cart|checkout|seller|sellers)(\/|$)/.test(path)
  ) {
    return { ok: false, reason: "Search, cart, and seller pages are not official product links." };
  }
  const params = new URLSearchParams(parsed.search);
  for (const key of [...params.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || TRACKING.has(lower)) params.delete(key);
  }
  const keys = [...params.keys()].sort();
  const sorted = new URLSearchParams();
  for (const key of keys) {
    for (const value of params.getAll(key)) sorted.append(key, value);
  }
  const qs = sorted.toString();
  const pathClean = parsed.pathname.replace(/\/+$/, "") || "/";
  return { ok: true, url: `https://${host}${pathClean}${qs ? `?${qs}` : ""}`, host };
}
