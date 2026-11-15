import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { Avatar } from "./avatar";

describe("Avatar", () => {
    const render = (photo?: string | null) => {
        const fixture = TestBed.createComponent(Avatar);
        if (photo !== undefined) fixture.componentRef.setInput("photo", photo);
        fixture.detectChanges();
        return fixture.nativeElement.querySelector("img") as HTMLImageElement;
    };

    it("montre la silhouette par défaut sans photo", () => {
        expect(render(null).getAttribute("src")).toBe("/avatar-default.png");
        expect(render("").getAttribute("src")).toBe("/avatar-default.png");
    });

    it("montre la photo quand elle existe", () => {
        const photo = "data:image/jpeg;base64,/9j/4AAQ";
        expect(render(photo).getAttribute("src")).toBe(photo);
    });

    it("retombe sur la silhouette quand la photo ne charge pas", () => {
        const img = render("data:image/jpeg;base64,xx");
        img.dispatchEvent(new Event("error"));
        TestBed.inject(ApplicationRef).tick();
        expect(img.getAttribute("src")).toBe("/avatar-default.png");
    });
});
