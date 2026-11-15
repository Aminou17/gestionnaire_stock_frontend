import { TestBed } from "@angular/core/testing";
import { HttpClient, provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { authInterceptor } from "./auth.interceptor";
import { AuthService } from "./auth.service";

describe("authInterceptor", () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let auth: {
        token: string | null;
        logout: ReturnType<typeof vi.fn>;
        requirePasswordChange: ReturnType<typeof vi.fn>;
    };

    const unauthorized = { status: 401, statusText: "Unauthorized" };

    beforeEach(() => {
        auth = { token: "abc123", logout: vi.fn(), requirePasswordChange: vi.fn() };

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: auth },
            ],
        });

        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it("should add the Bearer token to requests", () => {
        http.get("/api/products").subscribe();

        const req = httpMock.expectOne("/api/products");
        expect(req.request.headers.get("Authorization")).toBe("Bearer abc123");
        req.flush([]);
    });

    it("should not add the header when there is no token", () => {
        auth.token = null;
        http.get("/api/products").subscribe();

        const req = httpMock.expectOne("/api/products");
        expect(req.request.headers.has("Authorization")).toBe(false);
        req.flush([]);
    });

    it("should not send the token to the login endpoint", () => {
        http.post("/api/auth/login", {}).subscribe();

        const req = httpMock.expectOne("/api/auth/login");
        expect(req.request.headers.has("Authorization")).toBe(false);
        req.flush({});
    });

    it("should not send the token to another domain", () => {
        http.get("https://api.exemple.com/taux").subscribe();

        const req = httpMock.expectOne("https://api.exemple.com/taux");
        expect(req.request.headers.has("Authorization")).toBe(false);
        req.flush({});
    });

    it("should logout on a 401 response", () => {
        http.get("/api/products").subscribe({ error: () => {} });

        httpMock
            .expectOne("/api/products")
            .flush({ message: "Token invalide ou expiré." }, unauthorized);

        expect(auth.logout).toHaveBeenCalled();
    });

    it("should not logout on a 401 from the login endpoint", () => {
        http.post("/api/auth/login", {}).subscribe({ error: () => {} });

        httpMock
            .expectOne("/api/auth/login")
            .flush({ message: "Email ou mot de passe incorrect." }, unauthorized);

        expect(auth.logout).not.toHaveBeenCalled();
    });

    it("should ask for a password change on a 403 PASSWORD_CHANGE_REQUIRED", () => {
        http.get("/api/products").subscribe({ error: () => {} });

        httpMock.expectOne("/api/products").flush(
            {
                code: "PASSWORD_CHANGE_REQUIRED",
                message: "Vous devez d'abord choisir votre propre mot de passe.",
            },
            { status: 403, statusText: "Forbidden" },
        );

        expect(auth.requirePasswordChange).toHaveBeenCalled();
        expect(auth.logout).not.toHaveBeenCalled();
    });

    it("should not ask for a password change on another 403", () => {
        http.get("/api/products").subscribe({ error: () => {} });

        httpMock
            .expectOne("/api/products")
            .flush({ message: "Accès refusé." }, { status: 403, statusText: "Forbidden" });

        expect(auth.requirePasswordChange).not.toHaveBeenCalled();
    });
});
