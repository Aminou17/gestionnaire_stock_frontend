import {
    afterNextRender,
    Component,
    DestroyRef,
    ElementRef,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
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

interface Slide {
    src: string;
    alt: string;
}

// Une page montrée sur ordinateur et sur téléphone
interface Tab {
    label: string;
    icon: IconName;
    pc: string;
    tel: string;
    title: string;
    pcAlt: string;
    telAlt: string;
}

interface Step {
    title: string;
    text: string;
}

// Page d'accueil publique : choisir entre se connecter et créer sa boutique
@Component({
    selector: "app-landing",
    imports: [RouterLink, Icon, NgTemplateOutlet],
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

    // Page montrée dans l'aperçu ; elle change seule tant que le visiteur n'a pas choisi
    tabIndex = signal(0);
    private picked = false;

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
            title: "Vos clients et leurs crédits",
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

    // En-tête sur ordinateur : les pages défilent dans le navigateur
    heroPc: Slide[] = [
        {
            src: "/landing/pc-accueil.webp",
            alt: "Accueil sur ordinateur : ventes du jour, argent en caisse, bénéfice et graphique de la semaine",
        },
        {
            src: "/landing/pc-vente.webp",
            alt: "Nouvelle vente sur ordinateur : produits en images, panier, total et bouton Encaisser",
        },
        {
            src: "/landing/pc-produits.webp",
            alt: "Liste des produits sur ordinateur avec photo, prix, marge et stock de chaque produit",
        },
        {
            src: "/landing/pc-caisse.webp",
            alt: "Caisse du jour sur ordinateur : solde du tiroir et mouvements de la journée",
        },
    ];

    // En-tête sur téléphone : une vente, du premier produit à l'encaissement
    heroTel: Slide[] = [
        {
            src: "/landing/tel-vente-1.webp",
            alt: "Vente sur téléphone, étape 1 : le catalogue avec la photo et le prix de chaque produit",
        },
        {
            src: "/landing/tel-vente-2.webp",
            alt: "Vente sur téléphone, étape 2 : les produits touchés s'ajoutent, avec le total en bas",
        },
        {
            src: "/landing/tel-vente-3.webp",
            alt: "Vente sur téléphone, étape 3 : le panier, le mode de paiement et le bouton Encaisser",
        },
        {
            src: "/landing/tel-vente-4.webp",
            alt: "Vente sur téléphone, étape 4 : la vente est encaissée, le ticket part par WhatsApp",
        },
    ];

    tabs: Tab[] = [
        {
            label: "Vendre",
            icon: "cart",
            pc: "/landing/pc-vente.webp",
            tel: "/landing/tel-vente-3.webp",
            title: "Un panier clair, le paiement en un geste",
            pcAlt: "Nouvelle vente sur ordinateur : catalogue en images, panier, total et bouton Encaisser",
            telAlt: "Panier de vente sur téléphone : produits, total, espèces ou Mobile Money, bouton Encaisser",
        },
        {
            label: "Accueil",
            icon: "dashboard",
            pc: "/landing/pc-accueil.webp",
            tel: "/landing/tel-accueil.webp",
            title: "Vos ventes, votre bénéfice, votre caisse",
            pcAlt: "Accueil sur ordinateur : ventes du jour, caisse, crédits clients, bénéfice et graphique de la semaine",
            telAlt: "Accueil sur téléphone : ventes du jour, caisse, crédits, bénéfice et graphique de la semaine",
        },
        {
            label: "Produits",
            icon: "package",
            pc: "/landing/pc-produits.webp",
            tel: "/landing/tel-produits.webp",
            title: "Chaque produit avec sa photo, son prix et son stock",
            pcAlt: "Liste des produits sur ordinateur avec photo, catégorie, prix, marge et stock",
            telAlt: "Liste des produits sur téléphone avec photo, catégorie, prix et niveau de stock",
        },
        {
            label: "Caisse",
            icon: "banknote",
            pc: "/landing/pc-caisse.webp",
            tel: "/landing/tel-caisse.webp",
            title: "L'argent du tiroir, mouvement par mouvement",
            pcAlt: "Caisse du jour sur ordinateur : solde du tiroir, ajouts, dépenses, retraits et mouvements",
            telAlt: "Caisse du jour sur téléphone : solde du tiroir, ajout, dépense, retrait et mouvements",
        },
        {
            label: "Clients",
            icon: "user",
            pc: "/landing/pc-clients.webp",
            tel: "/landing/tel-clients.webp",
            title: "Qui vous doit de l'argent, et depuis quand",
            pcAlt: "Clients et crédits sur ordinateur : la liste des clients avec le total dépensé de chacun",
            telAlt: "Clients et crédits sur téléphone : la liste des clients avec le total dépensé de chacun",
        },
        {
            label: "Bilan",
            icon: "shield",
            pc: "/landing/pc-bilan.webp",
            tel: "/landing/tel-bilan.webp",
            title: "Votre bénéfice du jour, du mois ou de la période",
            pcAlt: "Bilan sur ordinateur : bénéfice net, ventes de la période, dépenses et valeur du stock",
            telAlt: "Bilan sur téléphone : bénéfice net, ventes de la période, dépenses et valeur du stock",
        },
        {
            label: "Alertes",
            icon: "alert",
            pc: "/landing/pc-alertes.webp",
            tel: "/landing/tel-alertes.webp",
            title: "Les produits à commander, par fournisseur",
            pcAlt: "Alertes de stock sur ordinateur : produits presque épuisés, regroupés par fournisseur",
            telAlt: "Alertes de stock sur téléphone : produits presque épuisés, regroupés par fournisseur",
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
            if (this.animated) {
                this.watchSections();
                this.rotateTabs();
                this.watchMotion();
            }
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

    // Les appareils s'inclinent vers la souris (--mx, --my) et prennent de la profondeur
    // quand on fait défiler la page, y compris au doigt sur téléphone (--p)
    private watchMotion() {
        const stages = Array.from(
            this.host.nativeElement.querySelectorAll<HTMLElement>(".hero-devices, .pair"),
        );
        const cleanups: Array<() => void> = [];

        for (const stage of stages) {
            const move = (event: PointerEvent) => {
                // Seule la souris incline : au doigt, c'est le défilement qui anime
                if (event.pointerType !== "mouse") return;

                const box = stage.getBoundingClientRect();
                const x = ((event.clientX - box.left) / box.width) * 2 - 1;
                const y = ((event.clientY - box.top) / box.height) * 2 - 1;
                stage.style.setProperty("--mx", x.toFixed(3));
                stage.style.setProperty("--my", y.toFixed(3));
            };
            const leave = () => {
                stage.style.setProperty("--mx", "0");
                stage.style.setProperty("--my", "0");
            };

            stage.addEventListener("pointermove", move);
            stage.addEventListener("pointerleave", leave);
            cleanups.push(() => {
                stage.removeEventListener("pointermove", move);
                stage.removeEventListener("pointerleave", leave);
            });
        }

        let waiting = false;
        const update = () => {
            waiting = false;
            for (const stage of stages) {
                const box = stage.getBoundingClientRect();
                const middle = box.top + box.height / 2;
                const progress = (middle - window.innerHeight / 2) / window.innerHeight;
                stage.style.setProperty("--p", Math.max(-1, Math.min(1, progress)).toFixed(3));
            }
        };
        const onScroll = () => {
            if (waiting) return;
            waiting = true;
            requestAnimationFrame(update);
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        update();

        this.destroyRef.onDestroy(() => {
            window.removeEventListener("scroll", onScroll);
            for (const cleanup of cleanups) cleanup();
        });
    }

    selectTab(index: number) {
        this.picked = true;
        this.tabIndex.set(index);
    }

    // L'aperçu passe à la page suivante toutes les 5 secondes, seulement s'il est à l'écran
    private rotateTabs() {
        const stage = this.host.nativeElement.querySelector("#apercu .pair");
        if (!stage) return;

        let visible = false;
        const observer = new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
        });
        observer.observe(stage);

        const timer = setInterval(() => {
            if (!visible || this.picked) return;
            this.tabIndex.update((index) => (index + 1) % this.tabs.length);
        }, 5000);

        this.destroyRef.onDestroy(() => {
            clearInterval(timer);
            observer.disconnect();
        });
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
