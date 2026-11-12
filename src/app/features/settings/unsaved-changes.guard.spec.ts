import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { HasUnsavedChanges, unsavedChangesGuard } from "./unsaved-changes.guard";

describe("unsavedChangesGuard", () => {
    const run = (page: HasUnsavedChanges) =>
        TestBed.runInInjectionContext(() =>
            unsavedChangesGuard(
                page,
                {} as ActivatedRouteSnapshot,
                {} as RouterStateSnapshot,
                {} as RouterStateSnapshot,
            ),
        );

    it("should let the user leave when the page allows it", () => {
        expect(run({ canLeave: () => true })).toBe(true);
    });

    it("should block the navigation when the page refuses", async () => {
        expect(await run({ canLeave: () => Promise.resolve(false) })).toBe(false);
    });
});
