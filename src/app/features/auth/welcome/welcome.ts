import { Component, ElementRef, inject, signal, viewChild } from "@angular/core";
import { Router, RouterLink } from "@angular/router";

import { PRODUCT_NAME } from "../../../core/brand";
import { Icon } from "../../../shared/icon/icon";
import type { IconName } from "../../../shared/icon/icons";
import { markWelcomeSeen } from "./welcome.guard";

interface Slide {
    icon: IconName;
    title: string;
    text: string;
}

@Component({
    selector: "app-welcome",
    imports: [RouterLink, Icon],
    templateUrl: "./welcome.html",
    styleUrl: "./welcome.css",
})
export class Welcome {
    private router = inject(Router);
    private track = viewChild.required<ElementRef<HTMLElement>>("track");

    productName = PRODUCT_NAME;
    current = signal(0);

    slides: Slide[] = [
        {
            icon: "cart",
            title: "Vendez en quelques secondes",
            text: "Encaissez au comptoir depuis votre téléphone, imprimez ou envoyez le reçu.",
        },
        {
            icon: "box",
            title: "Gardez votre stock sous contrôle",
            text: "Chaque vente met le stock à jour. Vous êtes prévenu avant la rupture.",
        },
        {
            icon: "trending-up",
            title: "Sachez ce que vous gagnez",
            text: "Ventes, bénéfice et caisse du jour, lisibles d'un coup d'œil.",
        },
    ];

    isLast() {
        return this.current() === this.slides.length - 1;
    }

    // le défilement natif gère le geste, on suit simplement la page affichée
    onScroll() {
        const el = this.track().nativeElement;
        this.current.set(Math.round(el.scrollLeft / el.clientWidth));
    }

    goTo(index: number) {
        const el = this.track().nativeElement;
        el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    }

    next() {
        if (this.isLast()) {
            this.finish("/register");
            return;
        }
        this.goTo(this.current() + 1);
    }

    finish(target: string) {
        markWelcomeSeen();
        this.router.navigate([target]);
    }
}
