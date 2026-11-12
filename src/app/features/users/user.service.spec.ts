import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { UserService } from "./user.service";

describe("UserService", () => {
    let httpMock: HttpTestingController;
    let service: UserService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        httpMock = TestBed.inject(HttpTestingController);
        service = TestBed.inject(UserService);
    });

    afterEach(() => httpMock.verify());

    it("should load the users of a status", () => {
        service.getUsers("all").subscribe();
        httpMock.expectOne("/api/users?status=all").flush([]);
    });

    it("should create a user with POST", () => {
        const input = {
            name: "Moussa",
            email: "moussa@test.com",
            role: "manager" as const,
            password: "motdepasse",
        };
        service.createUser(input).subscribe();

        const req = httpMock.expectOne("/api/users");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual(input);
        req.flush({ message: "ok", user: { id: 3 } });
    });

    it("should update a user with PUT", () => {
        service.updateUser(3, { name: "Moussa", email: "m@test.com", role: "admin" }).subscribe();

        const req = httpMock.expectOne("/api/users/3");
        expect(req.request.method).toBe("PUT");
        req.flush({ message: "ok", user: { id: 3 } });
    });

    it("should send the new password to /users/:id/password", () => {
        service.resetPassword(3, "nouveau-mdp").subscribe();

        const req = httpMock.expectOne("/api/users/3/password");
        expect(req.request.method).toBe("PUT");
        expect(req.request.body).toEqual({ password: "nouveau-mdp" });
        req.flush({ message: "ok", user: { id: 3 } });
    });

    it("should delete and restore a user", () => {
        service.deleteUser(3).subscribe();
        expect(httpMock.expectOne("/api/users/3").request.method).toBe("DELETE");

        service.restoreUser(3).subscribe();
        expect(httpMock.expectOne("/api/users/3/restore").request.method).toBe("PATCH");
    });

    it("should read the activity of a user in the audit log", () => {
        let actions: string[] = [];
        service.getActivity(3).subscribe((rows) => (actions = rows.map((row) => row.action)));

        httpMock
            .expectOne("/api/audit-logs?userId=3&limit=5")
            .flush({ data: [{ id: 1, action: "SALE_CREATED" }], pagination: {} });

        expect(actions).toEqual(["SALE_CREATED"]);
    });
});
