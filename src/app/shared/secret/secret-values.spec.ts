import { TestBed } from "@angular/core/testing";

import { SecretValues } from "./secret-values";

describe("SecretValues", () => {
    let secret: SecretValues;

    beforeEach(() => {
        secret = TestBed.inject(SecretValues);
    });

    it("should stay hidden by default", () => {
        expect(secret.revealed()).toBe(false);
    });

    it("should reveal on click and hide again on the next click", () => {
        secret.toggle();
        expect(secret.revealed()).toBe(true);

        secret.toggle();
        expect(secret.revealed()).toBe(false);
    });
});
