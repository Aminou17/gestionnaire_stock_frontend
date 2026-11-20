import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { guardNumberInputs } from "./number-inputs";

describe("guardNumberInputs", () => {
    let input: HTMLInputElement;

    beforeAll(() => guardNumberInputs(document));

    afterEach(() => input?.remove());

    const addInput = (type: string) => {
        input = document.createElement("input");
        input.type = type;
        document.body.appendChild(input);
        return input;
    };

    const press = (target: HTMLElement, key: string) => {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event.defaultPrevented;
    };

    it("refuse e, -, + et la virgule dans un champ nombre", () => {
        const field = addInput("number");
        for (const key of ["e", "E", "-", "+", ",", "."]) {
            expect(press(field, key)).toBe(true);
        }
        expect(press(field, "5")).toBe(false);
        expect(press(field, "Backspace")).toBe(false);
    });

    it("laisse les champs texte tranquilles", () => {
        expect(press(addInput("text"), "e")).toBe(false);
    });

    it("quitte le champ actif quand on tourne la molette", () => {
        const field = addInput("number");
        field.focus();
        field.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        expect(document.activeElement).not.toBe(field);
    });

    it("demande le clavier à chiffres sur téléphone", () => {
        const field = addInput("number");
        field.focus();
        expect(field.getAttribute("inputmode")).toBe("numeric");
    });
});
