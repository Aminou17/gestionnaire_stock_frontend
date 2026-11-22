import { isUnreachable } from "./network.interceptor";

describe("isUnreachable", () => {
    it("should treat no answer and the service worker 504 as offline", () => {
        expect(isUnreachable(0)).toBe(true);
        expect(isUnreachable(504)).toBe(true);
        expect(isUnreachable(502)).toBe(true);
        expect(isUnreachable(503)).toBe(true);
    });

    it("should keep real server answers as online", () => {
        for (const status of [400, 401, 403, 404, 409, 429, 500]) {
            expect(isUnreachable(status)).toBe(false);
        }
    });
});
