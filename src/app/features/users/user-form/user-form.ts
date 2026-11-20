import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    computed,
    inject,
    output,
    signal,
    viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { AuthService, UserRole } from "../../../core/auth/auth.service";
import { Icon } from "../../../shared/icon/icon";
import { generatePassword } from "../user-display";
import { UserAccount, UserInput } from "../user.model";
import { UserService } from "../user.service";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
    selector: "app-user-form",
    imports: [ReactiveFormsModule, Icon],
    templateUrl: "./user-form.html",
    styleUrl: "./user-form.css",
})
export class UserForm {
    private toast = inject(ToastService);
    private userService = inject(UserService);
    private auth = inject(AuthService);
    private destroyRef = inject(DestroyRef);

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
    private firstNameInput = viewChild.required<ElementRef<HTMLInputElement>>("firstNameInput");

    saved = output<UserAccount>();

    editing = signal<UserAccount | null>(null);
    saving = signal(false);
    formError = signal<string | null>(null);
    showPassword = signal(false);

    // le backend refuse qu'on change son propre rôle
    isSelf = computed(() => this.editing()?.id === this.auth.user()?.id);

    roles: { value: UserRole; label: string; hint: string }[] = [
        {
            value: "manager",
            label: "Employé",
            hint: "Vend, encaisse et clôture la caisse. Ne voit ni les prix d'achat ni les paramètres.",
        },
        {
            value: "admin",
            label: "Administrateur",
            hint: "Accès complet : stock, fournisseurs, caisse, utilisateurs et paramètres.",
        },
    ];

    // mêmes limites que le backend (50 pour le prénom et le nom, 100 pour l'email, mot de passe de 8 caractères au moins)
    form = inject(NonNullableFormBuilder).group({
        firstName: ["", [Validators.required, Validators.maxLength(50)]],
        lastName: ["", Validators.maxLength(50)],
        email: ["", [Validators.required, Validators.email, Validators.maxLength(100)]],
        role: ["manager" as UserRole, Validators.required],
        password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    });

    openNew() {
        this.open(null);
    }

    openEdit(user: UserAccount) {
        this.open(user);
    }

    private open(user: UserAccount | null) {
        this.editing.set(user);
        this.formError.set(null);
        this.showPassword.set(false);
        this.form.reset({
            firstName: user?.first_name ?? "",
            lastName: user?.last_name ?? "",
            email: user?.email ?? "",
            role: user?.role ?? "manager",
            password: user ? "" : generatePassword(),
        });
        // un mot de passe est proposé d'emblée : il reste visible pour le transmettre
        if (!user) this.showPassword.set(true);

        // le mot de passe ne se change pas ici, mais depuis Nouveau mot de passe
        if (user) this.form.controls.password.disable();
        else this.form.controls.password.enable();

        if (this.isSelf()) this.form.controls.role.disable();
        else this.form.controls.role.enable();

        this.dialog().nativeElement.showModal();
        this.firstNameInput().nativeElement.focus();
    }

    close() {
        if (this.saving()) return;
        this.dialog().nativeElement.close();
    }

    onBackdrop(event: MouseEvent) {
        if (event.target !== event.currentTarget || this.form.dirty) return;
        this.close();
    }

    onCancel(event: Event) {
        if (this.saving()) event.preventDefault();
    }

    toggleShowPassword() {
        this.showPassword.update((show) => !show);
    }

    fillPassword() {
        this.form.controls.password.setValue(generatePassword());
        this.form.controls.password.markAsDirty();
        this.showPassword.set(true);
    }

    invalid(field: "firstName" | "email" | "password") {
        const control = this.form.controls[field];
        return control.touched && control.invalid;
    }

    submit() {
        if (this.saving()) return;

        const value = this.form.getRawValue();
        this.form.patchValue({
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            email: value.email.trim().toLowerCase(),
        });
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const editing = this.editing();
        const input: UserInput = {
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            email: value.email.trim().toLowerCase(),
            role: value.role,
        };

        if (
            editing &&
            editing.first_name === input.firstName &&
            editing.last_name === input.lastName &&
            editing.email === input.email &&
            editing.role === input.role
        ) {
            this.close();
            return;
        }

        if (!editing) input.password = value.password;

        this.saving.set(true);
        this.formError.set(null);

        const request = editing
            ? this.userService.updateUser(editing.id, input)
            : this.userService.createUser(input);

        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (res) => {
                this.saving.set(false);
                // son propre nom est aussi affiché dans l'en-tête
                if (this.isSelf()) this.auth.refreshUser().subscribe({ error: () => {} });
                this.close();
                this.saved.emit(res.user);
                this.toast.show(editing ? "Utilisateur enregistré" : "Utilisateur ajouté");
            },
            error: (err: HttpErrorResponse) => {
                this.saving.set(false);
                this.formError.set(err.error?.message ?? "Impossible d'enregistrer l'utilisateur.");
            },
        });
    }
}
