export const CATEGORIES = ["Tech", "Audio", "Workspace", "Carry", "Home"] as const;
export type Category = (typeof CATEGORIES)[number];
export type SortKey = "featured" | "newest" | "price";
export type ProductStatus = "in_review" | "live" | "needs_edit";

export const REJECT_REASONS = [
  "not an official store",
  "photo is not the product",
  "duplicate",
  "not original",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type Credit = {
  handle: string;
  name: string;
  bio: string;
  city: string;
};

export type Card = {
  slug: string;
  name: string;
  photo: string;
  price: number;
  category: string;
  brandName: string;
  brandSlug: string;
  officialHost: string;
  official: boolean;
  featured: boolean;
  notedOn: string;
  credit: Credit;
  extraHolders: number;
  note?: string;
};

export type TextRow = {
  slug: string;
  name: string;
  count: number;
};

export type ProductDetail = {
  slug: string;
  name: string;
  photo: string;
  price: number;
  notedOn: string;
  category: string;
  brandName: string;
  brandSlug: string;
  officialHost: string;
  officialUrl: string;
  official: boolean;
  what: string;
  featured: boolean;
  note: string | null;
  sinceYear: number | null;
  credit: Credit;
  holders: Credit[];
  moreFromPerson: Card[];
  moreInCategory: Card[];
};

export type KitItem = {
  useId: string;
  slug: string;
  name: string;
  photo: string;
  brandName: string;
  category: string;
  price: number;
  officialUrl: string;
  officialHost: string;
  what: string;
  status: ProductStatus;
  note: string;
  sinceYear: number | null;
  rejectReason: string | null;
  introducedByMe: boolean;
};

export type ReviewItem = {
  slug: string;
  name: string;
  photo: string;
  brandName: string;
  officialUrl: string;
  officialHost: string;
  what: string;
  price: number;
  submitterName: string;
  submitterHandle: string;
  notedOn: string;
};

export type LiveFeature = { slug: string; name: string; featured: boolean };

export type AdminEditItem = ReviewItem & { rejectReason: string | null };

export type AdminLiveItem = {
  slug: string;
  name: string;
  photo: string;
  brandName: string;
  category: string;
  featured: boolean;
};

export type AdminHost = { host: string; addedAt: string };

export type AdminData = {
  forbidden: boolean;
  people: number;
  queue: ReviewItem[];
  returned: AdminEditItem[];
  live: AdminLiveItem[];
  allowlist: AdminHost[];
};

export type PersonProfile = {
  handle: string;
  name: string;
  bio: string;
  city: string;
  count: number;
  items: Card[];
};

export type ListDetail = {
  slug: string;
  title: string;
  sentence: string;
  authorName: string;
  authorHandle: string;
  items: Card[];
};

export type SessionPerson = {
  id: string;
  handle: string;
  name: string;
  role: "member" | "editor";
};

export type ActionResult =
  | { ok: true; slug: string; status: ProductStatus }
  | { ok: false; error: string; duplicateSlug?: string; duplicateLive?: boolean };

export type PreviewResult = {
  urlError: string | null;
  host: string | null;
  official: boolean;
  taken: boolean;
  live: boolean;
  duplicateSlug?: string;
};
