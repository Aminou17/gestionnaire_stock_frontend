import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { SwUpdate, VersionEvent } from "@angular/service-worker";
import { Subject } from "rxjs";

import { AppUpdateService } from "./app-update.service";

describe("AppUpdateService", () => {
    let versionUpdates: Subject<VersionEvent>;
    let sw: {
        isEnabled: boolean;
        versionUpdates: Subject<VersionEvent>;
        unrecoverable: Subject<unknown>;
        checkForUpdate: ReturnType<typeof vi.fn>;
        activateUpdate: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        versionUpdates = new Subject();
        sw = {
            isEnabled: true,
            versionUpdates,
            unrecoverable: new Subject(),
            checkForUpdate: vi.fn(() => Promise.resolve(false)),
            activateUpdate: vi.fn(() => new Promise<boolean>(() => {})),
        };
        TestBed.configureTestingModule({
            providers: [provideRouter([]), { provide: SwUpdate, useValue: sw }],
        });
    });

    it("should look for a new version at start", () => {
        TestBed.inject(AppUpdateService).start();
        expect(sw.checkForUpdate).toHaveBeenCalled();
    });

    it("should switch to the new version at the next page change only", async () => {
        TestBed.inject(AppUpdateService).start();
        const router = TestBed.inject(Router);

        await router.navigateByUrl("/");
        expect(sw.activateUpdate).not.toHaveBeenCalled();

        versionUpdates.next({
            type: "VERSION_READY",
            currentVersion: { hash: "a" },
            latestVersion: { hash: "b" },
        });
        router.navigateByUrl("/autre").catch(() => {});

        expect(sw.activateUpdate).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when the service worker is off", () => {
        sw.isEnabled = false;
        TestBed.inject(AppUpdateService).start();
        expect(sw.checkForUpdate).not.toHaveBeenCalled();
    });
});
