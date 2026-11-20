import { TestBed } from "@angular/core/testing";
import { HttpClient, provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { Subject, of, throwError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";

import { authInterceptor } from "./auth.interceptor";
import { AuthService } from "./auth.service";

describe("authInterceptor", () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let auth: {
        token: string | null;
        refreshToken: string | null;
        expired: boolean;
        tokenExpired: () => boolean;
        refresh: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        requirePasswordChange: ReturnType<typeof vi.fn>;
        markAccessEnded: ReturnType<typeof vi.fn>;
    };

    const unauthorized = { status: 401, statusText: "Unauthorized" };

    beforeEach(() => {
        auth = {
            token: "abc123",
            refreshToken: null,
            expired: false,
            tokenExpired: () => auth.expired,
            refresh: vi.fn(() => of("nouveau")),
            logout: vi.fn(),
            requirePasswordChange: vi.fn(),
            markAccessEnded: vi.fn(),
        };

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

    it("should not send the token to the login or refresh endpoints", () => {
        http.post("/api/auth/login", {}).subscribe();
        http.post("/api/auth/refresh", {}).subscribe();

        for (const url of ["/api/auth/login", "/api/auth/refresh"]) {
            const req = httpMock.expectOne(url);
            expect(req.request.headers.has("Authorization")).toBe(false);
            req.flush({});
        }
    });

    it("should not send the token to another domain", () => {
        http.get("https://api.exemple.com/taux").subscribe();

        const req = httpMock.expectOne("https://api.exemple.com/taux");
        expect(req.request.headers.has("Authorization")).toBe(false);
        req.flush({});
    });

    it("should logout on a 401 response without a device session", () => {
        http.get("/api/products").subscribe({ error: () => {} });

        httpMock
            .expectOne("/api/products")
            .flush({ message: "Token invalide ou expiré." }, unauthorized);

        expect(auth.logout).toHaveBeenCalled();
    });

    it("should renew an expired token before sending the request", () => {
        auth.refreshToken = "session";
        auth.expired = true;

        http.get("/api/products").subscribe();

        const req = httpMock.expectOne("/api/products");
        expect(auth.refresh).toHaveBeenCalled();
        expect(req.request.headers.get("Authorization")).toBe("Bearer nouveau");
        req.flush([]);
    });

    it("should renew once and retry after a 401", () => {
        auth.refreshToken = "session";
        let result: unknown;

        http.get("/api/products").subscribe((value) => (result = value));

        httpMock.expectOne("/api/products").flush({}, unauthorized);
        const retry = httpMock.expectOne("/api/products");
        expect(retry.request.headers.get("Authorization")).toBe("Bearer nouveau");
        retry.flush(["ok"]);

        expect(result).toEqual(["ok"]);
        expect(auth.logout).not.toHaveBeenCalled();
    });

    it("should logout when the device session is refused", () => {
        auth.refreshToken = "session";
        auth.expired = true;
        auth.refresh.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

        http.get("/api/products").subscribe({ error: () => {} });

        httpMock.expectNone("/api/products");
        expect(auth.logout).toHaveBeenCalled();
    });

    it("should keep the session when the network is down during the renewal", () => {
        auth.refreshToken = "session";
        auth.expired = true;
        const refresh = new Subject<string>();
        auth.refresh.mockReturnValue(refresh);

        http.get("/api/products").subscribe({ error: () => {} });
        refresh.error(new HttpErrorResponse({ status: 0 }));

        expect(auth.logout).not.toHaveBeenCalled();
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

    it("should open the access ended page on a 402 ACCESS_ENDED", () => {
        http.get("/api/products").subscribe({ error: () => {} });

        httpMock
            .expectOne("/api/products")
            .flush(
                { code: "ACCESS_ENDED", message: "Votre période d'essai est terminée." },
                { status: 402, statusText: "Payment Required" },
            );

        expect(auth.markAccessEnded).toHaveBeenCalled();
        expect(auth.logout).not.toHaveBeenCalled();
    });
});
