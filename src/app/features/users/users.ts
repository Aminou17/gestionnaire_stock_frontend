import { HttpErrorResponse } from "@angular/common/http";
import {
    Component,
    DestroyRef,
    ElementRef,
    LOCALE_ID,
    computed,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { getRoleLabel } from "../../core/auth/role-label";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { PasswordDialog } from "./password-dialog/password-dialog";
import { UserForm } from "./user-form/user-form";
import { formatDeletion, formatLastLogin, getInitials } from "./user-display";
import { UserAccount } from "./user.model";
import { UserService } from "./user.service";

type View = "active" | "deleted";

// Page réservée au propriétaire (adminGuard sur la route, 403 côté backend)
@Component({
    selector: "app-users",
    imports: [RouterLink, PageHeader, Icon, UserForm, PasswordDialog],
    templateUrl: "./users.html",
    styleUrl: "./users.css",
    host: {
        "(document:click)": "onDocumentClick($event)",
        "(document:keydown.escape)": "menuFor.set(null)",
    },
})
export class Users {
    private userService = inject(UserService);
    private auth = inject(AuthService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    private locale = inject(LOCALE_ID);

    private userForm = viewChild.required(UserForm);
    private passwordDialog = viewChild.required(PasswordDialog);
    private confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>("confirmBox");

    users = rxResource({ stream: () => this.userService.getUsers("all") });
    all = computed(() => (this.users.hasValue() ? this.users.value() : []));

    search = signal("");
    view = signal<View>("active");
    menuFor = signal<number | null>(null);

    activeCount = computed(() => this.all().filter((u) => u.is_active).length);
    deletedCount = computed(() => this.all().filter((u) => !u.is_active).length);

    // quelques comptes seulement : on filtre dans le navigateur
    list = computed(() => {
        const search = this.search().trim().toLowerCase();
        const showDeleted = this.view() === "deleted";
        return this.all().filter(
            (u) =>
                u.is_active !== showDeleted &&
                (u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)),
        );
    });

    protected getInitials = getInitials;
    protected getRoleLabel = getRoleLabel;

    toDelete = signal<UserAccount | null>(null);
    deleting = signal(false);
    deleteError = signal<string | null>(null);

    restoringId = signal<number | null>(null);
    restoreError = signal<string | null>(null);

    isMe(user: UserAccount) {
        return user.id === this.auth.user()?.id;
    }

    lastLogin(user: UserAccount) {
        return formatLastLogin(user.last_login_at, this.locale);
    }

    deletion(user: UserAccount) {
        return formatDeletion(user, this.locale);
    }

    selectView(view: View) {
        this.view.set(view);
        this.menuFor.set(null);
        this.restoreError.set(null);
    }

    openUser(user: UserAccount) {
        this.router.navigate(["/users", user.id]);
    }

    toggleMenu(id: number) {
        this.menuFor.set(this.menuFor() === id ? null : id);
    }

    onDocumentClick(event: Event) {
        if (!(event.target as HTMLElement).closest(".row-menu")) {
            this.menuFor.set(null);
        }
    }

    newUser() {
        this.userForm().openNew();
    }

    editUser(user: UserAccount) {
        this.menuFor.set(null);
        this.userForm().openEdit(user);
    }

    resetPassword(user: UserAccount) {
        this.menuFor.set(null);
        this.passwordDialog().open(user);
    }

    onSaved() {
        // l'utilisateur enregistré doit être visible, quelle que soit la recherche en cours
        this.search.set("");
        this.view.set("active");
        this.users.reload();
    }

    askDelete(user: UserAccount) {
        this.menuFor.set(null);
        this.toDelete.set(user);
        this.deleteError.set(null);
        this.confirmDialog().nativeElement.showModal();
    }

    closeConfirm() {
        if (this.deleting()) return;
        this.confirmDialog().nativeElement.close();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.closeConfirm();
    }

    onConfirmCancel(event: Event) {
        if (this.deleting()) event.preventDefault();
    }

    deleteUser() {
        const user = this.toDelete();
        if (!user || this.deleting()) return;

        this.deleting.set(true);
        this.deleteError.set(null);

        this.userService
            .deleteUser(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.deleting.set(false);
                    this.closeConfirm();
                    this.users.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.deleting.set(false);
                    this.deleteError.set(
                        err.error?.message ?? "Impossible de supprimer l'utilisateur.",
                    );
                },
            });
    }

    restoreUser(user: UserAccount) {
        if (this.restoringId() !== null) return;

        this.restoringId.set(user.id);
        this.restoreError.set(null);

        this.userService
            .restoreUser(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.restoringId.set(null);
                    this.users.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.restoringId.set(null);
                    this.restoreError.set(
                        err.error?.message ?? "Impossible de restaurer l'utilisateur.",
                    );
                },
            });
    }
}
