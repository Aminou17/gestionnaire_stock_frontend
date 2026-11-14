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

    it("should ask for the password instead of revealing on click", () => {
        secret.toggle();

        expect(secret.askOpen()).toBe(true);
        expect(secret.revealed()).toBe(false);
    });

    it("should reveal only after the password is accepted", () => {
        secret.toggle();
        secret.unlock();

        expect(secret.revealed()).toBe(true);
        expect(secret.askOpen()).toBe(false);
    });

    it("should hide again on click, and ask the password once more to reveal", () => {
        secret.unlock();
        secret.toggle();

        expect(secret.revealed()).toBe(false);

        secret.toggle();

        expect(secret.askOpen()).toBe(true);
    });
});
