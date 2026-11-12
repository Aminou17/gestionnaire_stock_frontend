import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { throwError, of } from "rxjs";

import { AuthService } from "../auth/auth.service";
import { AuditLogService } from "./audit-log.service";
import { SecurityAlertService } from "./security-alert.service";

describe("SecurityAlertService", () => {
    function setup(isAdmin: boolean, fails = false) {
        const getLogs = vi.fn(() =>
            fails
                ? throwError(() => new Error("boom"))
                : of({ data: [], pagination: { page: 1, limit: 3, total: 4, totalPages: 2 } }),
        );

        TestBed.configureTestingModule({
            providers: [
                { provide: AuditLogService, useValue: { getLogs } },
                {
                    provide: AuthService,
                    useValue: { isAdmin: signal(isAdmin), user: signal({ id: 1 }) },
                },
            ],
        });

        return { service: TestBed.inject(SecurityAlertService), getLogs };
    }

    it("should count today's failures for the admin", async () => {
        const { service, getLogs } = setup(true);
        TestBed.tick();
        await Promise.resolve();

        expect(getLogs).toHaveBeenCalledWith(
            expect.objectContaining({ result: "FAILURE", page: 1, limit: 3 }),
        );
        expect(service.count()).toBe(4);
    });

    it("should load nothing for a manager", () => {
        const { service, getLogs } = setup(false);
        TestBed.tick();

        expect(getLogs).not.toHaveBeenCalled();
        expect(service.count()).toBe(0);
    });

    it("should tell that it failed instead of counting zero", async () => {
        const { service } = setup(true, true);
        TestBed.tick();
        await Promise.resolve();

        expect(service.failed()).toBe(true);
    });
});
