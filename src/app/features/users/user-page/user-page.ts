import { DatePipe } from "@angular/common";
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
import { rxResource, takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { AuthService } from "../../../core/auth/auth.service";
import { getRoleLabel } from "../../../core/auth/role-label";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { Avatar } from "../../../shared/avatar/avatar";
import { getActivityIcon, getActivityLabel } from "../../../shared/activity-label";
import { groupByDay } from "../../../shared/day-label";
import { PasswordDialog } from "../password-dialog/password-dialog";
import { UserForm } from "../user-form/user-form";
import { formatDeletion, formatLastLogin } from "../user-display";
import { UserService } from "../user.service";
import { getBackLink } from "../../../core/back-link";

@Component({
    selector: "app-user-page",
    imports: [RouterLink, DatePipe, PageHeader, Icon, Avatar, UserForm, PasswordDialog],
    templateUrl: "./user-page.html",
    styleUrl: "./user-page.css",
})
export class UserPage {
    protected back = getBackLink("/users", "Retour aux utilisateurs");
    private userService = inject(UserService);
    private auth = inject(AuthService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    private locale = inject(LOCALE_ID);

    private userForm = viewChild(UserForm);
    private passwordDialog = viewChild(PasswordDialog);
    private confirmDialog = viewChild<ElementRef<HTMLDialogElement>>("confirmBox");

    private id = toSignal(
        inject(ActivatedRoute).paramMap.pipe(map((params) => Number(params.get("id")))),
    );

    // un identifiant qui n'est pas un entier n'est même pas demandé au backend
    validId = computed(() => {
        const id = this.id();
        return id !== undefined && Number.isInteger(id) && id > 0;
    });

    user = rxResource({
        params: () => (this.validId() ? this.id() : undefined),
        stream: ({ params }) => this.userService.getUser(params),
    });

    data = computed(() => (this.user.hasValue() ? this.user.value() : undefined));

    activity = rxResource({
        params: () => (this.validId() ? this.id() : undefined),
        stream: ({ params }) => this.userService.getActivity(params),
    });

    notFound = computed(
        () =>
            !this.validId() || (this.user.error() as HttpErrorResponse | undefined)?.status === 404,
    );

    isMe = computed(() => this.data()?.id === this.auth.user()?.id);

    protected getRoleLabel = getRoleLabel;
    protected getActivityLabel = getActivityLabel;

    restoring = signal(false);
    restoreError = signal<string | null>(null);

    deleting = signal(false);
    deleteError = signal<string | null>(null);

    deletion = computed(() => {
        const user = this.data();
        return user ? formatDeletion(user, this.locale) : "";
    });

    lastLogin = computed(() => formatLastLogin(this.data()?.last_login_at ?? null, this.locale));

    activityDays = computed(() =>
        this.activity.hasValue() ? groupByDay(this.activity.value(), this.locale) : [],
    );

    protected getActivityIcon = getActivityIcon;

    onSaved() {
        this.user.reload();
        this.activity.reload();
    }

    editUser() {
        const user = this.data();
        if (user) this.userForm()?.openEdit(user);
    }

    resetPassword() {
        const user = this.data();
        if (user) this.passwordDialog()?.open(user);
    }

    askDelete() {
        this.deleteError.set(null);
        this.confirmDialog()?.nativeElement.showModal();
    }

    closeConfirm() {
        if (this.deleting()) return;
        this.confirmDialog()?.nativeElement.close();
    }

    onConfirmBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) this.closeConfirm();
    }

    onConfirmCancel(event: Event) {
        if (this.deleting()) event.preventDefault();
    }

    deleteUser() {
        const user = this.data();
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
                    this.router.navigate(["/users"]);
                },
                error: (err: HttpErrorResponse) => {
                    this.deleting.set(false);
                    this.deleteError.set(
                        err.error?.message ?? "Impossible de supprimer l'utilisateur.",
                    );
                },
            });
    }

    restoreUser() {
        const user = this.data();
        if (!user || this.restoring()) return;

        this.restoring.set(true);
        this.restoreError.set(null);

        this.userService
            .restoreUser(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.restoring.set(false);
                    this.onSaved();
                },
                error: (err: HttpErrorResponse) => {
                    this.restoring.set(false);
                    this.restoreError.set(
                        err.error?.message ?? "Impossible de restaurer l'utilisateur.",
                    );
                },
            });
    }
}
