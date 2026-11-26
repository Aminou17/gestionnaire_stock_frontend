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
    // Nom complet : prénom, espace, nom
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role: UserRole;
    avatar?: string | null;
    // Mot de passe provisoire donné par le service client : à changer avant tout le reste
    mustChangePassword?: boolean;
    // Double authentification du propriétaire
    twoFactorEnabled?: boolean;
}

// Accès de la boutique : essai, payé, délai de grâce, terminé ; null pour le propriétaire
export type AccessState = "unlimited" | "trial" | "paid" | "grace" | "ended" | "suspended";

export interface Access {
    state: AccessState;
    endsAt: string | null;
    // Jours avant la fin (pendant la grâce : avant la coupure)
    daysLeft: number | null;
    blocked: boolean;
    // Accès terminé : c'était un essai ou une période payée
    lastPeriod?: "trial" | "paid";
}

interface LoginResponse {
    message: string;
    token: string;
    // Session de 30 jours de cet appareil, pour obtenir un nouveau jeton sans se reconnecter
    refreshToken: string;
    user: User;
    access: Access | null;
}

// Propriétaire avec la double authentification : le mot de passe ne suffit pas, il faut encore un code
export interface TwoFactorChallenge {
    twoFactorRequired: true;
    twoFactorToken: string;
}

export interface TwoFactorSetup {
    secret: string;
    otpauthUrl: string;
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

// Compte Google sans boutique : il reste à la créer (nom, téléphone, pays, ville)
export interface GoogleSignup {
    credential: string;
    email: string;
    firstName: string;
    lastName: string;
}

export interface GoogleRegisterData {
    credential: string;
    shopName: string;
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
    // Propriétaire du logiciel : il gère les boutiques, pas une boutique
    isOwner = computed(() => this._user()?.role === "owner");
    roleLabel = computed(() => getRoleLabel(this._user()?.role));

    get token() {
        return this._token();
    }

    get refreshToken() {
        return this.storage.getItem("refreshToken");
    }

    // Le jeton court expire après 1 h ; tant que la session de l'appareil existe, il se renouvelle tout seul
    isLoggedIn() {
        const token = this._token();
        if (!token) return false;

        if (!this.tokenExpired() || this.refreshToken) return true;

        this.clearSession();
        return false;
    }

    // Expiré ou sur le point de l'être : on le renouvelle avant d'envoyer la requête
    tokenExpired(marginSeconds = 30) {
        const token = this._token();
        const exp = token ? tokenExpiry(token) : null;
        return !exp || exp * 1000 < Date.now() + marginSeconds * 1000;
    }

    // Un seul renouvellement à la fois, partagé par les requêtes qui l'attendent
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

    // L'API a refusé une requête car l'essai ou l'abonnement est terminé
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
            .post<LoginResponse | TwoFactorChallenge>(`${API_URL}/auth/login`, { email, password })
            .pipe(
                tap((res) => {
                    // Avec la double authentification, la session s'ouvre à l'étape du code
                    if (!("twoFactorRequired" in res)) this.openSession(res, remember);
                }),
                map((res) => ("twoFactorRequired" in res ? res : null)),
            );
    }

    // Compte Google en attente de sa boutique, gardé en mémoire entre la connexion et l'inscription
    googleSignup = signal<GoogleSignup | null>(null);

    // Renvoie true si la session est ouverte ; false si cette adresse n'a pas encore de boutique
    loginWithGoogle(credential: string) {
        return this.http
            .post<
                | LoginResponse
                | { registrationRequired: true; email: string; firstName: string; lastName: string }
            >(`${API_URL}/auth/google`, { credential })
            .pipe(
                map((res) => {
                    if ("registrationRequired" in res) {
                        this.googleSignup.set({
                            credential,
                            email: res.email,
                            firstName: res.firstName,
                            lastName: res.lastName,
                        });
                        return false;
                    }
                    this.openSession(res, true);
                    return true;
                }),
            );
    }

    // La boutique est créée et la session ouverte : l'adresse est déjà confirmée par Google
    registerWithGoogle(data: GoogleRegisterData) {
        return this.http.post<LoginResponse>(`${API_URL}/auth/google/register`, data).pipe(
            tap((res) => {
                this.openSession(res, true);
                this.googleSignup.set(null);
            }),
        );
    }

    // Deuxième étape : le jeton reçu avec le mot de passe et un code (ou un code de secours)
    verifyTwoFactor(twoFactorToken: string, code: string, remember = true) {
        return this.http
            .post<LoginResponse>(`${API_URL}/auth/2fa/verify`, { twoFactorToken, code })
            .pipe(tap((res) => this.openSession(res, remember)));
    }

    setupTwoFactor() {
        return this.http.post<TwoFactorSetup>(`${API_URL}/auth/2fa/setup`, {});
    }

    // Renvoie les codes de secours, visibles une seule fois
    enableTwoFactor(code: string) {
        return this.http.post<{ backupCodes: string[] }>(`${API_URL}/auth/2fa/enable`, { code });
    }

    disableTwoFactor(password: string, code: string) {
        return this.http.post<{ message: string }>(`${API_URL}/auth/2fa/disable`, {
            password,
            code,
        });
    }

    // L'état de la double authentification est lu sur le compte : on le met à jour sans recharger
    setTwoFactorEnabled(enabled: boolean) {
        const user = this._user();
        if (user) this.saveUser({ ...user, twoFactorEnabled: enabled });
    }

    // La boutique est créée ; le commerçant confirme ensuite son e-mail avec le code reçu
    // website et elapsedMs servent de piège à robots
    register(data: RegisterData & { website: string; elapsedMs: number }) {
        return this.http.post<RegisterResult>(`${API_URL}/auth/register`, data);
    }

    // Code à 6 chiffres reçu par e-mail : l'adresse est confirmée et la personne est connectée
    verifyEmail(email: string, code: string) {
        return this.http
            .post<LoginResponse>(`${API_URL}/auth/verify-email`, { email, code })
            .pipe(tap((res) => this.openSession(res, true)));
    }

    resendCode(email: string) {
        return this.http.post<{ message: string }>(`${API_URL}/auth/resend-code`, { email });
    }

    // Le numéro est-il déjà celui d'une autre boutique ?
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

    // Le serveur a refusé une requête : le mot de passe provisoire n'est pas encore changé
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

    // Le nom, le rôle ou l'accès de la boutique ont pu changer depuis la connexion
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
                // La réponse ne renvoie pas la photo : on garde celle qu'on a
                this.saveUser({ ...user, avatar: this._user()?.avatar });
            }),
        );
    }

    // Image en data URL, ou null pour retirer la photo
    updateAvatar(avatar: string | null) {
        return this.http
            .put<User>(`${API_URL}/auth/me/avatar`, { avatar })
            .pipe(tap((user) => this.saveUser(user)));
    }

    private saveUser(user: User) {
        this.storage.setItem("user", JSON.stringify(user));
        this._user.set(user);
    }

    // Sert à ré-afficher une valeur masquée : ne change ni le token ni la session
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
                    // Les anciennes sessions sont refusées par le backend : celle-ci garde l'appareil connecté
                    this.storage.setItem("token", res.token);
                    if (res.refreshToken) this.storage.setItem("refreshToken", res.refreshToken);
                    this._token.set(res.token);
                    const user = this._user();
                    if (user?.mustChangePassword)
                        this.saveUser({ ...user, mustChangePassword: false });
                }),
            );
    }

    // Les boutons Déconnexion demandent d'abord confirmation ; logout() déconnecte tout de suite
    logoutAsked = signal(false);

    logout() {
        this.logoutAsked.set(false);

        // La session de l'appareil est fermée côté serveur ; sans réseau, elle expirera seule
        const refreshToken = this.refreshToken;
        if (refreshToken) {
            this.http
                .post(`${API_URL}/auth/logout`, { refreshToken })
                .subscribe({ error: () => {} });
        }

        this.clearSession();
        this.router.navigate(["/login"]);
    }

    // Ferme les sessions de tous les appareils, puis celle-ci
    logoutAll() {
        return this.http.post(`${API_URL}/auth/logout-all`, {}).pipe(
            tap(() => {
                this.clearSession();
                this.router.navigate(["/login"]);
            }),
        );
    }

    // Fin de session sans changer de page (après un nouveau mot de passe choisi avec le lien reçu)
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
        // La valeur du stock ne reste pas visible pour le prochain connecté
        this.secret.revealed.set(false);
    }
}

// Valeur corrompue dans le stockage : on repart d'une session vide au lieu de planter
function readJson<T>(storage: Storage, key: string): T | null {
    try {
        return JSON.parse(storage.getItem(key) ?? "null");
    } catch {
        return null;
    }
}

function tokenExpiry(token: string): number | null {
    try {
        // Le payload d'un JWT est en base64url
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(payload)).exp ?? null;
    } catch {
        return null;
    }
}
