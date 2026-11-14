import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { tap } from "rxjs";

import { API_URL } from "../api.config";
import { SecretValues } from "../../shared/secret/secret-values";
import { getRoleLabel } from "./role-label";

export type UserRole = "owner" | "admin" | "manager";

export interface User {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string | null;
}

interface LoginResponse {
    message: string;
    token: string;
    user: User;
}

export interface RegisterData {
    shopName: string;
    adminName: string;
    email: string;
    password: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private secret = inject(SecretValues);

    // "Se souvenir de moi" coché -> localStorage, sinon la session s'arrête à la fermeture du navigateur
    private storage = localStorage.getItem("token") ? localStorage : sessionStorage;

    private _token = signal(this.storage.getItem("token"));
    private _user = signal<User | null>(readUser(this.storage));

    user = this._user.asReadonly();
    isAdmin = computed(() => this._user()?.role === "admin");
    // propriétaire du logiciel : il gère les boutiques, pas une boutique
    isOwner = computed(() => this._user()?.role === "owner");
    roleLabel = computed(() => getRoleLabel(this._user()?.role));

    get token() {
        return this._token();
    }

    isLoggedIn() {
        const token = this._token();
        if (!token) return false;

        // le token expire après 1h côté backend ; un token illisible est traité comme expiré
        const exp = tokenExpiry(token);
        if (!exp || exp * 1000 < Date.now()) {
            this.clearSession();
            return false;
        }
        return true;
    }

    login(email: string, password: string, remember = true) {
        return this.http
            .post<LoginResponse>(`${API_URL}/auth/login`, { email, password })
            .pipe(tap((res) => this.openSession(res, remember)));
    }

    // la boutique est créée et le commerçant est connecté tout de suite
    register(data: RegisterData) {
        return this.http
            .post<LoginResponse>(`${API_URL}/auth/register`, data)
            .pipe(tap((res) => this.openSession(res, true)));
    }

    private openSession(res: LoginResponse, remember: boolean) {
        this.clearSession();
        this.storage = remember ? localStorage : sessionStorage;
        this.storage.setItem("token", res.token);
        this.storage.setItem("user", JSON.stringify(res.user));
        this._token.set(res.token);
        this._user.set(res.user);
    }

    // le nom ou le rôle a pu changer depuis la connexion
    refreshUser() {
        return this.http.get<User>(`${API_URL}/auth/me`).pipe(
            tap((user) => {
                this.storage.setItem("user", JSON.stringify(user));
                this._user.set(user);
            }),
        );
    }

    updateProfile(name: string, email: string) {
        return this.http.put<User>(`${API_URL}/auth/me`, { name, email }).pipe(
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
            .put<{ message: string; token: string }>(`${API_URL}/auth/password`, {
                currentPassword,
                newPassword,
            })
            .pipe(
                tap((res) => {
                    // les anciens tokens sont refusés par le backend : celui-ci garde la session ouverte
                    this.storage.setItem("token", res.token);
                    this._token.set(res.token);
                }),
            );
    }

    logout() {
        this.clearSession();
        this.router.navigate(["/login"]);
    }

    private clearSession() {
        for (const store of [localStorage, sessionStorage]) {
            store.removeItem("token");
            store.removeItem("user");
        }
        this._token.set(null);
        this._user.set(null);
        // la valeur du stock ne reste pas visible pour le prochain connecté
        this.secret.revealed.set(false);
    }
}

// valeur corrompue dans le stockage : on repart d'une session vide au lieu de planter
function readUser(storage: Storage): User | null {
    try {
        return JSON.parse(storage.getItem("user") ?? "null");
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
