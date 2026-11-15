import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from "./privacy/privacy-content";
import { TERMS_SECTIONS } from "./terms/terms-content";

describe("contenu légal", () => {
    it("a des ancres uniques et des sections non vides", () => {
        for (const sections of [PRIVACY_SECTIONS, TERMS_SECTIONS]) {
            const ids = sections.map((s) => s.id);

            expect(new Set(ids).size).toBe(ids.length);
            expect(sections.every((s) => s.title && s.body.length > 0)).toBe(true);
        }
    });

    it("indique la date de mise à jour", () => {
        expect(PRIVACY_UPDATED).toContain("15 novembre 2026");
    });
});
