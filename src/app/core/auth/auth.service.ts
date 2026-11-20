import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, finalize, map, shareReplay, tap } from "rxjs";

import { API_URL } from "../api.config";
import { SecretValues } from "../../shared/secret/secret-values";
import { getRoleLabel } from "./role-label";

export type UserRole = "owner" | "admin" | "manager";

export interface User {
    id: number;
    // nom complet : prénom, espace, nom
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role: UserRole;
    avatar?: string | null;
    // mot de passe provisoire donné par le service client : à changer avant tout le reste
    mustChangePassword?: boolean;
}

// accès de la boutique : essai, payé, délai de grâce, terminé ; null pour le propriétaire
export type AccessState = "unlimited" | "trial" | "paid" | "grace" | "ended" | "suspended";

export interface Access {
    state: AccessState;
    endsAt: string | null;
    // jours avant la fin (pendant la grâce : avant la coupure)
    daysLeft: number | null;
    blocked: boolean;
    // accès terminé : c'était un essai ou une période payée
    lastPeriod?: "trial" | "paid";
}

interface LoginResponse {
    message: string;
    token: string;
    // session de 30 jours de cet appareil, pour obtenir un nouveau jeton sans se reconnecter
    refreshToken: string;
    user: User;
    access: Access | null;
}

export interface RegisterResult {
    verificationRequired: true;
    email: string;
}

export interface RegisterData {
    shopName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    country: string;
    city: string;
    logo?: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private secret = inject(SecretValues);

    // "Se souvenir de moi" coché -> localStorage, sinon la session s'arrête à la fermeture du navigateur
    private storage = localStorage.getItem("token") ? localStorage : sessionStorage;

    private _token = signal(this.storage.getItem("token"));
    private _user = signal<User | null>(readJson<User>(this.storage, "user"));
    private _access = signal<Access | null>(readJson<Access>(this.storage, "access"));
    private refreshing: Observable<string> | null = null;

    user = this._user.asReadonly();
    access = this._access.asReadonly();
    isAdmin = computed(() => this._user()?.role === "admin");
    // propriétaire du logiciel : il gère les boutiques, pas une boutique
    isOwner = computed(() => this._user()?.role === "owner");
    roleLabel = computed(() => getRoleLabel(this._user()?.role));

    get token() {
        return this._token();
    }

    get refreshToken() {
        return this.storage.getItem("refreshToken");
    }

    // le jeton court expire après 1 h ; tant que la session de l'appareil existe, il se renouvelle tout seul
    isLoggedIn() {
        const token = this._token();
        if (!token) return false;

        if (!this.tokenExpired() || this.refreshToken) return true;

        this.clearSession();
        return false;
    }

    // expiré ou sur le point de l'être : on le renouvelle avant d'envoyer la requête
    tokenExpired(marginSeconds = 30) {
        const token = this._token();
        const exp = token ? tokenExpiry(token) : null;
        return !exp || exp * 1000 < Date.now() + marginSeconds * 1000;
    }

    // un seul renouvellement à la fois, partagé par les requêtes qui l'attendent
    refresh(): Observable<string> {
        if (this.refreshing) return this.refreshing;

        this.refreshing = this.http
            .post<{ token: string; access: Access | null }>(`${API_URL}/auth/refresh`, {
                refreshToken: this.refreshToken,
            })
            .pipe(
                tap((res) => {
                    this.storage.setItem("token", res.token);
                    this._token.set(res.token);
                    this.saveAccess(res.access);
                }),
                map((res) => res.token),
                finalize(() => (this.refreshing = null)),
                shareReplay(1),
            );

        return this.refreshing;
    }

    saveAccess(access: Access | null) {
        if (access) this.storage.setItem("access", JSON.stringify(access));
        else this.storage.removeItem("access");
        this._access.set(access);
    }

    // l'API a refusé une requête car l'essai ou l'abonnement est terminé
    markAccessEnded() {
        const access = this._access();
        if (!access?.blocked) {
            this.saveAccess({
                state: "ended",
                endsAt: access?.endsAt ?? null,
                daysLeft: 0,
                blocked: true,
            });
        }
        this.router.navigate(["/access-ended"]);
    }

    login(email: string, password: string, remember = true) {
        return this.http
            .post<LoginResponse>(`${API_URL}/auth/login`, { email, password })
            .pipe(tap((res) => this.openSession(res, remember)));
    }

    // la boutique est créée ; le commerçant confirme ensuite son e-mail avec le code reçu
    // website et elapsedMs servent de piège à robots
    register(data: RegisterData & { website: string; elapsedMs: number }) {
        return this.http.post<RegisterResult>(`${API_URL}/auth/register`, data);
    }

    // code à 6 chiffres reçu par e-mail : l'adresse est confirmée et la personne est connectée
    verifyEmail(email: string, code: string) {
        return this.http
            .post<LoginResponse>(`${API_URL}/auth/verify-email`, { email, code })
            .pipe(tap((res) => this.openSession(res, true)));
    }

    resendCode(email: string) {
        return this.http.post<{ message: string }>(`${API_URL}/auth/resend-code`, { email });
    }

    // le numéro est-il déjà celui d'une autre boutique ?
    isPhoneAvailable(phone: string) {
        return this.http.get<{ available: boolean; message?: string }>(
            `${API_URL}/auth/phone-available`,
            { params: { phone } },
        );
    }

    forgotPassword(email: string) {
        return this.http.post<{ message: string }>(`${API_URL}/auth/forgot-password`, { email });
    }

    resetPassword(token: string, newPassword: string) {
        return this.http.post<{ message: string }>(`${API_URL}/auth/reset-password`, {
            token,
            newPassword,
        });
    }

    // le serveur a refusé une requête : le mot de passe provisoire n'est pas encore changé
    requirePasswordChange() {
        const user = this._user();
        if (user && !user.mustChangePassword) this.saveUser({ ...user, mustChangePassword: true });
        this.router.navigate(["/settings/password"]);
    }

    private openSession(res: LoginResponse, remember: boolean) {
        this.clearSession();
        this.storage = remember ? localStorage : sessionStorage;
        this.storage.setItem("token", res.token);
        if (res.refreshToken) this.storage.setItem("refreshToken", res.refreshToken);
        this.storage.setItem("user", JSON.stringify(res.user));
        this._token.set(res.token);
        this._user.set(res.user);
        this.saveAccess(res.access ?? null);
    }

    // le nom, le rôle ou l'accès de la boutique ont pu changer depuis la connexion
    refreshUser() {
        return this.http.get<User & { access?: Access | null }>(`${API_URL}/auth/me`).pipe(
            tap(({ access, ...user }) => {
                this.storage.setItem("user", JSON.stringify(user));
                this._user.set(user);
                if (access !== undefined) this.saveAccess(access);
            }),
        );
    }

    updateProfile(firstName: string, lastName: string, email: string) {
        return this.http.put<User>(`${API_URL}/auth/me`, { firstName, lastName, email }).pipe(
            tap((user) => {
                // la réponse ne renvoie pas la photo : on garde celle qu'on a
                this.saveUser({ ...user, avatar: this._user()?.avatar });
            }),
        );
    }

    // image en data URL, ou null pour retirer la photo
    updateAvatar(avatar: string | null) {
        return this.http
            .put<User>(`${API_URL}/auth/me/avatar`, { avatar })
            .pipe(tap((user) => this.saveUser(user)));
    }

    private saveUser(user: User) {
        this.storage.setItem("user", JSON.stringify(user));
        this._user.set(user);
    }

    // sert à ré-afficher une valeur masquée : ne change ni le token ni la session
    verifyPassword(password: string) {
        return this.http.post<{ message: string }>(`${API_URL}/auth/verify-password`, { password });
    }

    changePassword(currentPassword: string, newPassword: string) {
        return this.http
            .put<{ message: string; token: string; refreshToken?: string }>(
                `${API_URL}/auth/password`,
                {
                    currentPassword,
                    newPassword,
                },
            )
            .pipe(
                tap((res) => {
                    // les anciennes sessions sont refusées par le backend : celle-ci garde l'appareil connecté
                    this.storage.setItem("token", res.token);
                    if (res.refreshToken) this.storage.setItem("refreshToken", res.refreshToken);
                    this._token.set(res.token);
                    const user = this._user();
                    if (user?.mustChangePassword)
                        this.saveUser({ ...user, mustChangePassword: false });
                }),
            );
    }

    // les boutons Déconnexion demandent d'abord confirmation ; logout() déconnecte tout de suite
    logoutAsked = signal(false);

    logout() {
        this.logoutAsked.set(false);

        // la session de l'appareil est fermée côté serveur ; sans réseau, elle expirera seule
        const refreshToken = this.refreshToken;
        if (refreshToken) {
            this.http
                .post(`${API_URL}/auth/logout`, { refreshToken })
                .subscribe({ error: () => {} });
        }

        this.clearSession();
        this.router.navigate(["/login"]);
    }

    // fin de session sans changer de page (après un nouveau mot de passe choisi avec le lien reçu)
    endSession() {
        this.clearSession();
    }

    private clearSession() {
        for (const store of [localStorage, sessionStorage]) {
            store.removeItem("token");
            store.removeItem("refreshToken");
            store.removeItem("user");
            store.removeItem("access");
        }
        this._token.set(null);
        this._user.set(null);
        this._access.set(null);
        // la valeur du stock ne reste pas visible pour le prochain connecté
        this.secret.revealed.set(false);
    }
}

// valeur corrompue dans le stockage : on repart d'une session vide au lieu de planter
function readJson<T>(storage: Storage, key: string): T | null {
    try {
        return JSON.parse(storage.getItem(key) ?? "null");
    } catch {
        return null;
    }
}

function tokenExpiry(token: string): number | null {
    try {
        // le payload d'un JWT est en base64url
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(payload)).exp ?? null;
    } catch {
        return null;
    }
}
