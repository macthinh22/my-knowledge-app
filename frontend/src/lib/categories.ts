const CATEGORY_COLORS: Record<string, string> = {
    technology: "bg-blue-100 text-blue-800 border-blue-200",
    "business-finance": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "personal-development": "bg-rose-100 text-rose-800 border-rose-200",
    "knowledge-education": "bg-amber-100 text-amber-800 border-amber-200",
    other: "bg-slate-100 text-slate-800 border-slate-200",
};

const DEFAULT_CATEGORY_SLUGS = new Set([
    "technology",
    "business-finance",
    "personal-development",
    "knowledge-education",
    "other",
]);

export function getCategoryBadgeClass(slug: string): string {
    return CATEGORY_COLORS[slug] ?? "bg-slate-100 text-slate-800 border-slate-200";
}

export function categoryLabel(
    slug: string,
    categoryNameMap?: Record<string, string>,
): string {
    return categoryNameMap?.[slug] ?? slug;
}

export function isDefaultCategory(slug: string): boolean {
    return DEFAULT_CATEGORY_SLUGS.has(slug);
}
