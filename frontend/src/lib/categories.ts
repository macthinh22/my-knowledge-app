const COLOR_CLASSES: Record<string, string> = {
    slate:
        "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    red:
        "bg-red-100 text-red-800 border-red-200 dark:bg-red-800 dark:text-red-200 dark:border-red-700",
    orange:
        "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-800 dark:text-orange-200 dark:border-orange-700",
    amber:
        "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-800 dark:text-amber-200 dark:border-amber-700",
    emerald:
        "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-800 dark:text-emerald-200 dark:border-emerald-700",
    teal:
        "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-800 dark:text-teal-200 dark:border-teal-700",
    blue:
        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:border-blue-700",
    indigo:
        "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-800 dark:text-indigo-200 dark:border-indigo-700",
    violet:
        "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-800 dark:text-violet-200 dark:border-violet-700",
    rose:
        "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-800 dark:text-rose-200 dark:border-rose-700",
};

export const PRESET_COLORS = Object.keys(COLOR_CLASSES);

const DEFAULT_CATEGORY_SLUGS = new Set([
    "technology",
    "business-finance",
    "personal-development",
    "knowledge-education",
    "other",
]);

export function getCategoryBadgeClass(color: string | null | undefined): string {
    return COLOR_CLASSES[color ?? "slate"] ?? COLOR_CLASSES.slate;
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

export function buildCategoryColorMap(
    categories: { slug: string; color: string | null }[],
): Record<string, string> {
    const map: Record<string, string> = {};
    for (const category of categories) {
        map[category.slug] = category.color ?? "slate";
    }
    return map;
}
