import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { NavigationEnd } from "@angular/router";

import { AuthService } from "../auth/auth.service";
import { PageViewService } from "./page-view.service";

describe("PageViewService", () => {
    let events: Subject<unknown>;
    let http: HttpTestingController;
    let loggedIn: boolean;
    let owner: boolean;

    beforeEach(() => {
        events = new Subject();
        loggedIn = true;
        owner = false;

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: Router, useValue: { events } },
                {
                    provide: AuthService,
                    useValue: { isLoggedIn: () => loggedIn, isOwner: () => owner },
                },
            ],
        });

        http = TestBed.inject(HttpTestingController);
        TestBed.inject(PageViewService).start();
    });

    afterEach(() => http.verify());

    const go = (url: string) => events.next(new NavigationEnd(1, url, url));

    it("should send the page that was opened, without the address parameters", () => {
        go("/customers?search=Adam&phone=0612");

        const request = http.expectOne((r) => r.url.endsWith("/usage/page"));
        expect(request.request.body).toEqual({ page: "/customers" });
        request.flush(null);
    });

    it("should not count the same page twice in a row, but count it again after another page", () => {
        go("/sales");
        http.expectOne((r) => r.url.endsWith("/usage/page")).flush(null);
        go("/sales?page=2");
        http.expectNone((r) => r.url.endsWith("/usage/page"));

        go("/products");
        http.expectOne((r) => r.url.endsWith("/usage/page")).flush(null);
        go("/sales");
        http.expectOne((r) => r.url.endsWith("/usage/page")).flush(null);
    });

    it("should count nothing when nobody is signed in, nor for the software owner", () => {
        loggedIn = false;
        go("/sales");
        loggedIn = true;
        owner = true;
        go("/owner/shops");

        http.expectNone((r) => r.url.endsWith("/usage/page"));
    });

    it("should ignore a failure of the counting request", () => {
        go("/cash");

        http.expectOne((r) => r.url.endsWith("/usage/page")).flush(null, {
            status: 500,
            statusText: "Erreur",
        });
    });
});
