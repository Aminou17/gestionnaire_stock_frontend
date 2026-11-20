import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    inject,
    signal,
    viewChildren,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { Icon } from "../../../shared/icon/icon";

const RESEND_SECONDS = 60;

@Component({
    selector: "app-verify-email",
    imports: [RouterLink, Icon],
    templateUrl: "./verify-email.html",
    styleUrls: ["../auth-form.css", "./verify-email.css"],
})
export class VerifyEmail {
    private auth = inject(AuthService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    protected email = inject(ActivatedRoute).snapshot.queryParamMap.get("email") ?? "";
    protected digits = signal<string[]>(Array(6).fill(""));
    protected code = computed(() => this.digits().join(""));
    protected complete = computed(() => /^\d{6}$/.test(this.code()));

    loading = signal(false);
    error = signal<string | null>(null);
    notice = signal<string | null>(null);
    // secondes avant de pouvoir redemander un code
    wait = signal(RESEND_SECONDS);

    private boxes = viewChildren<ElementRef<HTMLInputElement>>("box");
    private timer = setInterval(() => this.wait.update((s) => Math.max(0, s - 1)), 1000);

    constructor() {
        this.destroyRef.onDestroy(() => clearInterval(this.timer));
        // sans adresse, on ne sait pas à qui renvoyer le code
        if (!this.email) this.router.navigate(["/login"]);
    }

    protected onInput(index: number, input: HTMLInputElement) {
        const typed = input.value.replace(/\D/g, "");

        // un code collé ou proposé par le clavier remplit toutes les cases
        if (typed.length > 1) {
            this.fill(typed);
            return;
        }

        this.setDigit(index, typed);
        input.value = typed;
        if (typed && index < 5) this.focus(index + 1);
        if (this.complete()) this.submit();
    }

    protected onKeydown(index: number, event: KeyboardEvent) {
        if (event.key === "Backspace" && !this.digits()[index] && index > 0) {
            this.setDigit(index - 1, "");
            this.focus(index - 1);
            event.preventDefault();
        } else if (event.key === "ArrowLeft" && index > 0) {
            this.focus(index - 1);
        } else if (event.key === "ArrowRight" && index < 5) {
            this.focus(index + 1);
        }
    }

    protected onPaste(event: ClipboardEvent) {
        const text = event.clipboardData?.getData("text") ?? "";
        if (/\d/.test(text)) {
            event.preventDefault();
            this.fill(text.replace(/\D/g, ""));
        }
    }

    private fill(value: string) {
        const next = value
            .slice(0, 6)
            .padEnd(6, " ")
            .split("")
            .map((c) => c.trim());
        this.digits.set(next);
        this.boxes().forEach((box, i) => (box.nativeElement.value = next[i]));
        this.focus(Math.min(value.length, 5));
        if (this.complete()) this.submit();
    }

    private setDigit(index: number, value: string) {
        this.digits.update((all) => all.map((digit, i) => (i === index ? value : digit)));
        this.error.set(null);
    }

    private focus(index: number) {
        this.boxes()[index]?.nativeElement.focus();
    }

    submit() {
        if (!this.complete() || this.loading()) return;

        this.loading.set(true);
        this.error.set(null);
        this.notice.set(null);

        this.auth
            .verifyEmail(this.email, this.code())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.router.navigate(["/dashboard"], { state: { welcome: true } }),
                error: (err: HttpErrorResponse) => {
                    this.loading.set(false);
                    this.error.set(
                        err.status === 0
                            ? "Impossible de joindre le serveur. Vérifiez votre connexion."
                            : (err.error?.message ?? "Code incorrect."),
                    );
                    // on recommence la saisie depuis la première case
                    this.digits.set(Array(6).fill(""));
                    this.boxes().forEach((box) => (box.nativeElement.value = ""));
                    this.focus(0);
                },
            });
    }

    resend() {
        if (this.wait() > 0) return;

        this.wait.set(RESEND_SECONDS);
        this.error.set(null);
        this.auth
            .resendCode(this.email)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.notice.set("Nouveau code envoyé."),
                error: (err: HttpErrorResponse) =>
                    this.error.set(err.error?.message ?? "Impossible d'envoyer un nouveau code."),
            });
    }
}
