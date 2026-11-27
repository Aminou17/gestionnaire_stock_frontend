import { Component, ElementRef, OnInit, inject, input, output, signal } from "@angular/core";

import { GoogleButtonText, GoogleSignIn } from "../../../core/auth/google-sign-in";
import { ThemeService } from "../../../core/theme/theme.service";

// Bouton « Continuer avec Google » ; rien ne s'affiche si Google n'est pas configuré
@Component({
    selector: "app-google-button",
    template: `
        <div class="wrap" [hidden]="!shown()">
            <div class="google"></div>
            <p class="or"><span>ou</span></p>
        </div>
    `,
    styles: `
        :host {
            display: block;
        }

        .google {
            display: flex;
            justify-content: center;
            min-height: 40px;
        }

        .or {
            display: flex;
            align-items: center;
            gap: 14px;
            margin: 18px 0 0;
            color: var(--text-muted);
            font-size: 13px;
        }

        .or::before,
        .or::after {
            content: "";
            flex: 1;
            height: 1px;
            background: color-mix(in srgb, var(--text) 10%, var(--surface));
        }
    `,
})
export class GoogleButton implements OnInit {
    private google = inject(GoogleSignIn);
    private host = inject<ElementRef<HTMLElement>>(ElementRef);
    private theme = inject(ThemeService);

    text = input<GoogleButtonText>("continue_with");
    credential = output<string>();
    shown = signal(false);

    async ngOnInit() {
        const id = await this.google.load();
        if (!id) return;

        this.google.onCredential((credential) => this.credential.emit(credential));

        const target = this.host.nativeElement.querySelector<HTMLElement>(".google")!;
        // Le bouton est caché tant que Google ne l'a pas dessiné : on mesure donc l'hôte
        // Google dessine le bouton en pixels : entre 200 et 400
        const width = Math.min(400, Math.max(200, Math.round(this.host.nativeElement.clientWidth)));

        id.renderButton(target, {
            type: "standard",
            // En mode sombre, un bouton noir plutôt qu'un bloc blanc dans la carte
            theme: this.theme.theme() === "dark" ? "filled_black" : "outline",
            size: "large",
            shape: "rectangular",
            text: this.text(),
            locale: "fr",
            width,
        });
        this.shown.set(true);
    }
}
