import {
    afterNextRender,
    Component,
    DestroyRef,
    ElementRef,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";

import { COMPANY_NAME, PRODUCT_NAME } from "../../core/brand";
import { Icon } from "../../shared/icon/icon";
import type { IconName } from "../../shared/icon/icons";

interface Reason {
    icon: IconName;
    title: string;
    text: string;
}

interface Atout {
    icon: IconName;
    title: string;
    text: string;
}

interface Shot {
    src: string;
    label: string;
    title: string;
    alt: string;
}

interface Step {
    title: string;
    text: string;
}

// Page d'accueil publique : choisir entre se connecter et créer sa boutique
@Component({
    selector: "app-landing",
    imports: [RouterLink, Icon],
    templateUrl: "./landing.html",
    styleUrl: "./landing.css",
    host: { "[class.animated]": "animated" },
})
export class Landing {
    private host = inject<ElementRef<HTMLElement>>(ElementRef);
    private destroyRef = inject(DestroyRef);

    private heroCta = viewChild<ElementRef<HTMLElement>>("heroCta");
    private finalCta = viewChild<ElementRef<HTMLElement>>("finalCta");

    productName = PRODUCT_NAME;
    companyName = COMPANY_NAME;
    year = new Date().getFullYear();

    // Le bouton fixe n'apparaît que lorsque les deux boutons de la page sont hors de l'écran
    showSticky = signal(false);

    // Les sections ne sont cachées avant leur apparition que si le navigateur sait les révéler
    animated = canAnimate();

    // Photo affichée dans l'aperçu sur téléphone, pour les points sous le carrousel
    shotIndex = signal(0);

    also = [
        "Plusieurs boutiques dans un compte",
        "Export de vos données",
        "Installation comme une application",
    ];

    atouts: Atout[] = [
        { icon: "check", title: "Gratuit", text: "Sans carte bancaire" },
        { icon: "zap", title: "Sans internet", text: "Les ventes partent au retour du réseau" },
        { icon: "message", title: "Ticket WhatsApp", text: "Envoyé au client en un geste" },
        { icon: "banknote", title: "Mobile Money", text: "Avec les espèces, dans la caisse" },
    ];

    reasons: Reason[] = [
        {
            icon: "cart",
            title: "Vendez en quelques secondes",
            text: "Scannez ou touchez un produit, encaissez en espèces ou en Mobile Money, envoyez le ticket par WhatsApp.",
        },
        {
            icon: "box",
            title: "Un stock toujours juste",
            text: "Chaque vente met le stock à jour. Alertes avant la rupture, entrées de stock, inventaires et fournisseurs au même endroit.",
        },
        {
            icon: "banknote",
            title: "Une caisse sans mauvaise surprise",
            text: "Ouverture et clôture de la caisse, dépenses, retraits, et l'écart du jour calculé pour vous.",
        },
        {
            icon: "users",
            title: "Vos clients et leurs dettes",
            text: "Qui doit quoi, acomptes et ventes à payer plus tard, avec le téléphone du client pour le relancer.",
        },
        {
            icon: "shield",
            title: "Votre équipe sous contrôle",
            text: "Administrateur et vendeurs, remises limitées par vous, et un journal de toutes les actions.",
        },
        {
            icon: "zap",
            title: "Continuez sans internet",
            text: "Les ventes faites sans réseau restent sur le téléphone et partent dès le retour de la connexion.",
        },
    ];

    shots: Shot[] = [
        {
            src: "/landing/tel-vente.webp",
            label: "Vendre",
            title: "Un panier clair, le paiement en un geste",
            alt: "Panier de vente sur téléphone : deux produits, total, choix espèces ou Mobile Money, bouton Encaisser",
        },
        {
            src: "/landing/tel-accueil.webp",
            label: "Suivre",
            title: "Vos ventes, votre bénéfice, votre caisse",
            alt: "Accueil sur téléphone : ventes du jour, argent en caisse, bénéfice et graphique des 7 derniers jours",
        },
        {
            src: "/landing/tel-caisse.webp",
            label: "Encaisser",
            title: "L'argent du tiroir, mouvement par mouvement",
            alt: "Page Caisse sur téléphone : solde du tiroir, ajouts, dépenses, retraits et liste des mouvements du jour",
        },
        {
            src: "/landing/tel-alertes.webp",
            label: "Réapprovisionner",
            title: "Les produits à commander, par fournisseur",
            alt: "Alertes de stock sur téléphone : produits en rupture ou presque, regroupés par fournisseur",
        },
    ];

    steps: Step[] = [
        {
            title: "Créez votre boutique",
            text: "Un nom, un téléphone, un mot de passe : c'est prêt en deux minutes.",
        },
        {
            title: "Ajoutez vos produits",
            text: "Avec leur prix et leur stock de départ, à la main ou en scannant le code-barres.",
        },
        {
            title: "Ouvrez la caisse et vendez",
            text: "Le stock, la caisse et vos chiffres se mettent à jour à chaque vente.",
        },
    ];

    constructor() {
        afterNextRender(() => {
            if (this.animated) this.watchSections();
            this.watchButtons();
        });
    }

    // Chaque bloc marqué "reveal" s'affiche une seule fois, quand il entre dans l'écran
    private watchSections() {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    entry.target.classList.add("shown");
                    observer.unobserve(entry.target);
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
        );

        this.host.nativeElement.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
        this.destroyRef.onDestroy(() => observer.disconnect());
    }

    private watchButtons() {
        if (typeof IntersectionObserver === "undefined") return;

        const hidden = new Map<Element, boolean>();
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) hidden.set(entry.target, !entry.isIntersecting);
            const buttons = [this.heroCta(), this.finalCta()];
            const away = buttons.every((button) => button && hidden.get(button.nativeElement));
            this.showSticky.set(away);
        });

        for (const button of [this.heroCta(), this.finalCta()]) {
            if (button) observer.observe(button.nativeElement);
        }
        this.destroyRef.onDestroy(() => observer.disconnect());
    }

    onShotsScroll(event: Event) {
        const list = event.target as HTMLElement;
        const max = list.scrollWidth - list.clientWidth;
        if (max <= 0) return;

        this.shotIndex.set(Math.round((list.scrollLeft / max) * (this.shots.length - 1)));
    }

    scrollTo(id: string) {
        const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        document.getElementById(id)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
}

// Sans observateur, ou si l'utilisateur limite les animations, tout reste visible tout de suite
function canAnimate(): boolean {
    if (typeof IntersectionObserver === "undefined") return false;

    return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
