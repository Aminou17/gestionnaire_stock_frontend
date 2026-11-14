import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { Router, provideRouter } from "@angular/router";

import { AuthService, User } from "./auth.service";
import { fakeToken } from "../../../testing/fake-token";

describe("AuthService", () => {
    let service: AuthService;
    let httpMock: HttpTestingController;

    const user: User = { id: 1, name: "Awa", email: "awa@test.com", role: "manager" };

    function setup() {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
        });
        service = TestBed.inject(AuthService);
        httpMock = TestBed.inject(HttpTestingController);
    }

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => httpMock.verify());

    it("should call the login endpoint and store the session in localStorage", () => {
        setup();
        const token = fakeToken();

        service.login("awa@test.com", "secret").subscribe();

        const req = httpMock.expectOne("/api/auth/login");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ email: "awa@test.com", password: "secret" });
        req.flush({ message: "Connexion réussie.", token, user });

        expect(localStorage.getItem("token")).toBe(token);
        expect(service.user()).toEqual(user);
        expect(service.isLoggedIn()).toBe(true);
        expect(service.isAdmin()).toBe(false);
    });

    it('should use sessionStorage when "remember me" is unchecked', () => {
        setup();
        const token = fakeToken();

        service.login("awa@test.com", "secret", false).subscribe();
        httpMock.expectOne("/api/auth/login").flush({ message: "", token, user });

        expect(sessionStorage.getItem("token")).toBe(token);
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("should restore the session from storage", () => {
        localStorage.setItem("token", fakeToken());
        localStorage.setItem("user", JSON.stringify(user));
        setup();

        expect(service.isLoggedIn()).toBe(true);
        expect(service.user()?.name).toBe("Awa");
    });

    it("should not be logged in when the token is expired", () => {
        localStorage.setItem("token", fakeToken(-60));
        localStorage.setItem("user", JSON.stringify(user));
        setup();

        expect(service.isLoggedIn()).toBe(false);
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("should not crash on corrupted storage values", () => {
        localStorage.setItem("token", "pas-un-jwt");
        localStorage.setItem("user", "{cassé");
        setup();

        expect(service.user()).toBeNull();
        expect(service.isLoggedIn()).toBe(false);
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("should refresh the user from /auth/me", () => {
        localStorage.setItem("token", fakeToken());
        localStorage.setItem("user", JSON.stringify(user));
        setup();

        service.refreshUser().subscribe();
        httpMock.expectOne("/api/auth/me").flush({ ...user, name: "Awa B.", role: "admin" });

        expect(service.user()?.name).toBe("Awa B.");
        expect(service.isAdmin()).toBe(true);
        expect(JSON.parse(localStorage.getItem("user")!).name).toBe("Awa B.");
    });

    it("should update the profile and keep the new name in the session", () => {
        setup();

        service.updateProfile("Awa Traoré", "awa@test.com").subscribe();
        const req = httpMock.expectOne("/api/auth/me");
        expect(req.request.method).toBe("PUT");
        expect(req.request.body).toEqual({ name: "Awa Traoré", email: "awa@test.com" });
        req.flush({ id: 1, name: "Awa Traoré", email: "awa@test.com", role: "admin" });

        expect(service.user()?.name).toBe("Awa Traoré");
    });

    it("should send both passwords to change the password", () => {
        setup();

        service.changePassword("ancien-mdp", "nouveau-mdp").subscribe();
        const req = httpMock.expectOne("/api/auth/password");
        expect(req.request.method).toBe("PUT");
        expect(req.request.body).toEqual({
            currentPassword: "ancien-mdp",
            newPassword: "nouveau-mdp",
        });
        req.flush({ message: "Mot de passe modifié.", token: "nouveau-token" });

        expect(service.token).toBe("nouveau-token");
        expect(localStorage.getItem("token") ?? sessionStorage.getItem("token")).toBe(
            "nouveau-token",
        );
    });

    it("should post the email to the forgot-password endpoint", () => {
        setup();

        service.forgotPassword("awa@test.com").subscribe();

        const req = httpMock.expectOne("/api/auth/forgot-password");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ email: "awa@test.com" });
        expect(req.request.headers.has("Authorization")).toBe(false);
        req.flush({ message: "ok" });
    });

    it("should post the token and the new password to the reset-password endpoint", () => {
        setup();

        service.resetPassword("a".repeat(64), "nouveau-mdp").subscribe();

        const req = httpMock.expectOne("/api/auth/reset-password");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ token: "a".repeat(64), newPassword: "nouveau-mdp" });
        req.flush({ message: "ok" });
    });

    it("should remove mustChangePassword from the kept user after changing the password", () => {
        localStorage.setItem("token", fakeToken());
        localStorage.setItem("user", JSON.stringify({ ...user, mustChangePassword: true }));
        setup();
        expect(service.user()?.mustChangePassword).toBe(true);

        service.changePassword("provisoire", "nouveau-mdp").subscribe();
        httpMock.expectOne("/api/auth/password").flush({ message: "ok", token: fakeToken() });

        expect(service.user()?.mustChangePassword).toBe(false);
        expect(JSON.parse(localStorage.getItem("user")!).mustChangePassword).toBe(false);
    });

    it("should clear the session and redirect to /login on logout", () => {
        localStorage.setItem("token", fakeToken());
        localStorage.setItem("user", JSON.stringify(user));
        setup();
        const navigate = vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

        service.logout();

        expect(service.isLoggedIn()).toBe(false);
        expect(service.user()).toBeNull();
        expect(localStorage.getItem("token")).toBeNull();
        expect(navigate).toHaveBeenCalledWith(["/login"]);
    });
});
