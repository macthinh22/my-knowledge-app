import { describe, expect, it } from "vitest";

import { applyQuickFilter, parseBrowseFilters } from "@/lib/browseFilters";

describe("parseBrowseFilters", () => {
  it("reads review_status from URL params", () => {
    const params = new URLSearchParams(
      "q=ai&review_status=never_viewed&sort=created_at_desc",
    );

    expect(parseBrowseFilters(params)).toMatchObject({
      search: "ai",
      reviewStatus: "never_viewed",
      sort: "created_at_desc",
    });
  });
});

describe("applyQuickFilter", () => {
  it("maps inbox quick filter to uncategorized category token", () => {
    const next = applyQuickFilter({ sort: "created_at_desc" }, "inbox");
    expect(next.category).toBe("__uncategorized__");
  });
});
