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
import { Router } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { getRoleLabel } from "../../core/auth/role-label";
import { PageHeader } from "../../layout/page-header/page-header";
import { ActionItem, ActionMenu } from "../../shared/action-menu/action-menu";
import { Icon } from "../../shared/icon/icon";
import { EmptyState } from "../../shared/empty-state/empty-state";
import { Pagination, clientPaging } from "../../shared/pagination/pagination";
import { Avatar } from "../../shared/avatar/avatar";
import { PasswordDialog } from "./password-dialog/password-dialog";
import { UserForm } from "./user-form/user-form";
import { formatDeletion, formatLastLogin } from "./user-display";
import { UserAccount } from "./user.model";
import { UserService } from "./user.service";

type View = "active" | "deleted";

// Page réservée à l'administrateur (adminGuard sur la route, 403 côté backend)
@Component({
    selector: "app-users",
    imports: [
        PageHeader,
        Icon,
        Avatar,
        ActionMenu,
        UserForm,
        PasswordDialog,
        Pagination,
        EmptyState,
    ],
    templateUrl: "./users.html",
    styleUrl: "./users.css",
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

    activeCount = computed(() => this.all().filter((u) => u.is_active).length);
    deletedCount = computed(() => this.all().filter((u) => !u.is_active).length);

    // Quelques comptes seulement : on filtre dans le navigateur
    list = computed(() => {
        const search = this.search().trim().toLowerCase();
        const showDeleted = this.view() === "deleted";
        return this.all().filter(
            (u) =>
                u.is_active !== showDeleted &&
                (u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)),
        );
    });

    paging = clientPaging(
        () => this.list(),
        "users",
        () => this.search() + this.view(),
    );

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
        this.restoreError.set(null);
    }

    openUser(user: UserAccount) {
        this.router.navigate(["/users", user.id]);
    }

    menuItems(user: UserAccount): ActionItem[] {
        const items: ActionItem[] = [{ id: "edit", label: "Modifier", icon: "edit" }];

        if (this.isMe(user)) {
            items.push({
                id: "password",
                label: "Mon mot de passe",
                icon: "key",
                link: "/settings/account",
            });
        } else {
            items.push(
                { id: "reset", label: "Nouveau mot de passe", icon: "key" },
                { id: "delete", label: "Supprimer", icon: "trash", danger: true },
            );
        }

        return items;
    }

    onMenu(user: UserAccount, action: string) {
        if (action === "edit") this.editUser(user);
        if (action === "reset") this.resetPassword(user);
        if (action === "delete") this.askDelete(user);
    }

    newUser() {
        this.userForm().openNew();
    }

    editUser(user: UserAccount) {
        this.userForm().openEdit(user);
    }

    resetPassword(user: UserAccount) {
        this.passwordDialog().open(user);
    }

    onSaved() {
        // L'employé enregistré doit être visible, quelle que soit la recherche en cours
        this.search.set("");
        this.view.set("active");
        this.users.reload();
    }

    askDelete(user: UserAccount) {
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
                        err.error?.message ?? "Impossible de supprimer l'employé.",
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
                        err.error?.message ?? "Impossible de restaurer l'employé.",
                    );
                },
            });
    }
}
