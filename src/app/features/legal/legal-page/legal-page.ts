import { Location } from "@angular/common";
import {
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    inject,
    input,
    signal,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { COMPANY_NAME, PRODUCT_NAME } from "../../../core/brand";
import { Icon } from "../../../shared/icon/icon";
import { LegalBlock, LegalSection } from "./legal-section";

// Gabarit des pages publiques (confidentialité, conditions, contact) : visible sans session
@Component({
    selector: "app-legal-page",
    imports: [RouterLink, Icon],
    templateUrl: "./legal-page.html",
    styleUrl: "./legal-page.css",
})
export class LegalPage {
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    private host = inject<ElementRef<HTMLElement>>(ElementRef);
    protected auth = inject(AuthService);

    title = input.required<string>();
    // texte court sous le titre
    intro = input<string>();
    // « Dernière mise à jour : … »
    updated = input<string>();
    sections = input<LegalSection[]>([]);

    protected productName = PRODUCT_NAME;
    protected companyName = COMPANY_NAME;
    protected year = new Date().getFullYear();

    protected tocOpen = signal(false);
    protected activeId = signal<string | null>(null);

    constructor() {
        afterNextRender(() => this.watchSections());
    }

    private location = inject(Location);

    protected back() {
        // ouverte depuis l'application : on recule ; lien ouvert directement : accueil à la place
        if (this.router.lastSuccessfulNavigation()?.previousNavigation) this.location.back();
        else this.router.navigateByUrl("/", { replaceUrl: true });
    }

    protected isList(block: LegalBlock): block is string[] {
        return Array.isArray(block);
    }

    protected goTo(event: Event, id: string) {
        event.preventDefault();
        this.tocOpen.set(false);
        this.activeId.set(id);

        const target = this.host.nativeElement.querySelector<HTMLElement>(`[id="${id}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        // l'adresse garde l'ancre pour pouvoir partager le lien d'une section
        history.replaceState(history.state, "", `${location.pathname}#${id}`);
    }

    // met en avant dans le sommaire la section en cours de lecture
    private watchSections() {
        if (typeof IntersectionObserver === "undefined") return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.find((entry) => entry.isIntersecting);
                if (visible) this.activeId.set(visible.target.id);
            },
            { rootMargin: "-80px 0px -65% 0px" },
        );
        this.host.nativeElement
            .querySelectorAll("section[id]")
            .forEach((section) => observer.observe(section));

        this.destroyRef.onDestroy(() => observer.disconnect());
    }
}
