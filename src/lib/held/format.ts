import { CATEGORIES, type Category } from "./types";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function normName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function formatIdr(value: number) {
  return "Rp" + Math.round(value).toLocaleString("id-ID");
}

export function formatCardPrice(value: number) {
  if (value >= 1000) {
    return "Rp" + Math.round(value / 1000).toLocaleString("id-ID") + "rb";
  }
  return formatIdr(value);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatNoted(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  const m = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${m} ${year}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "H";
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function categorySlug(category: string) {
  return category.toLowerCase();
}

export function categoryFromSlug(slug: string) {
  return CATEGORIES.find((category) => categorySlug(category) === slug.toLowerCase()) ?? null;
}
