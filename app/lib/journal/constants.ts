// Journal vocabularies shared by the DB schema, validation, and client forms.
// Kept dependency-free so client components can import it without pulling in
// Drizzle.

export const METHODS = ["flower", "vape", "concentrate", "edible", "tincture", "other"] as const;
export type Method = (typeof METHODS)[number];

export const TIMES_OF_DAY = ["morning", "afternoon", "evening", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const WISHLIST_SOURCES = ["manual", "graph", "rec"] as const;
export type WishlistSource = (typeof WISHLIST_SOURCES)[number];

// Starter suggestions; free tags are allowed too (normalized on save).
export const FLAVOR_SUGGESTIONS = [
  "berry", "cheese", "citrus", "coffee", "diesel", "earthy", "floral", "grape", "herbal",
  "lemon", "mint", "pepper", "pine", "skunky", "spicy", "sweet", "tropical", "vanilla", "woody",
];

export const TERPENE_SUGGESTIONS = [
  "bisabolol", "caryophyllene", "humulene", "limonene", "linalool", "myrcene", "ocimene",
  "pinene", "terpinolene",
];

export const LIMITS = { tag: 40, tags: 20, notes: 5000, shortText: 120 } as const;
