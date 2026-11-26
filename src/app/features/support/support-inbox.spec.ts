import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { of } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { HelpService } from "../../core/help/help.service";
import { SupportThread, SupportThreadDetail } from "../../core/support/support.model";
import { SupportService } from "../../core/support/support.service";
import { SupportInbox } from "./support-inbox";

const thread = (overrides: Partial<SupportThread> = {}): SupportThread => ({
    id: 1,
    subject: "Problème de caisse",
    status: "OPEN",
    owner_unread: true,
    user_unread: false,
    created_at: "2026-11-16T09:00:00.000Z",
    updated_at: "2026-11-16T09:00:00.000Z",
    last_message: "Bonjour, la caisse ne s'ouvre pas",
    shop_name: "Chez Fatou",
    user_name: "Fatou Ouédraogo",
    user_email: "fatou@exemple.com",
    ...overrides,
});

const detail: SupportThreadDetail = {
    ...thread(),
    messages: [
        {
            id: 1,
            sender: "user",
            body: "Bonjour, la caisse ne s'ouvre pas",
            created_at: "2026-11-16T09:00:00.000Z",
        },
        {
            id: 2,
            sender: "owner",
            body: "Essayez de recharger la page",
            created_at: "2026-11-16T09:05:00.000Z",
        },
    ],
};

describe("SupportInbox", () => {
    let service: Record<string, ReturnType<typeof vi.fn>>;

    const render = async (
        data: Record<string, unknown>,
        id: string | null = null,
        tab: string | null = null,
    ) => {
        service = {
            getThreads: vi.fn(() =>
                of([thread(), thread({ id: 2, status: "CLOSED", subject: "Ancienne question" })]),
            ),
            getThread: vi.fn(() => of(detail)),
            createThread: vi.fn(() => of(thread({ id: 9 }))),
            sendMessage: vi.fn(() => of({})),
            setStatus: vi.fn(() => of({})),
            refreshUnread: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [SupportInbox],
            providers: [
                provideRouter([]),
                { provide: SupportService, useValue: service },
                {
                    provide: HelpService,
                    useValue: {
                        open: () => 2,
                        refreshOpen: vi.fn(),
                        getRequests: () => of([]),
                    },
                },
                {
                    provide: AuthService,
                    useValue: {
                        user: () => ({ id: 1, name: "Fatou", role: "admin", firstName: "Fatou" }),
                        isOwner: () => false,
                        isAdmin: () => true,
                        roleLabel: () => "Administrateur",
                    },
                },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            data,
                            paramMap: { get: () => id },
                            queryParamMap: { get: () => tab },
                        },
                        paramMap: of({ get: () => id }),
                    },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(SupportInbox);
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
    };

    it("liste seulement les conversations en cours au départ", async () => {
        const fixture = await render({ side: "user" });
        const text = fixture.nativeElement.textContent;

        expect(text).toContain("Problème de caisse");
        expect(text).not.toContain("Ancienne question");
    });

    it("l'utilisateur voit le bouton Nouveau message, pas le propriétaire", async () => {
        const user = await render({ side: "user" });
        expect(user.nativeElement.textContent).toContain("Nouveau message");
        TestBed.resetTestingModule();

        const owner = await render({ side: "owner" });
        expect(owner.nativeElement.textContent).not.toContain("Nouveau message");
        expect(owner.nativeElement.textContent).toContain("Chez Fatou");
    });

    it("affiche les messages de la conversation ouverte", async () => {
        const fixture = await render({ side: "user" }, "1");
        const text = fixture.nativeElement.textContent;

        expect(service["getThread"]).toHaveBeenCalledWith("user", 1);
        expect(text).toContain("Essayez de recharger la page");
        expect(text).toContain("Support");
    });

    it("envoie une réponse puis vide le champ", async () => {
        const fixture = await render({ side: "owner" }, "1");
        const inbox = fixture.componentInstance as unknown as {
            reply: { set: (v: string) => void; (): string };
            sendReply: () => void;
        };

        inbox.reply.set("  Merci, c'est réglé  ");
        inbox.sendReply();

        expect(service["sendMessage"]).toHaveBeenCalledWith("owner", 1, "Merci, c'est réglé");
        expect(inbox.reply()).toBe("");
    });

    it("ne crée pas de conversation sans sujet ni message", async () => {
        const fixture = await render({ side: "user", compose: true });
        const inbox = fixture.componentInstance as unknown as { createThread: () => void };

        inbox.createThread();

        expect(service["createThread"]).not.toHaveBeenCalled();
    });

    it("crée la conversation puis l'ouvre", async () => {
        const fixture = await render({ side: "user", compose: true });
        const router = TestBed.inject(Router);
        const navigate = vi.spyOn(router, "navigate").mockResolvedValue(true);
        const inbox = fixture.componentInstance as unknown as {
            subject: { set: (v: string) => void };
            newMessage: { set: (v: string) => void };
            createThread: () => void;
        };

        inbox.subject.set("Question");
        inbox.newMessage.set("Bonjour");
        inbox.createThread();

        expect(service["createThread"]).toHaveBeenCalledWith("Question", "Bonjour");
        expect(navigate).toHaveBeenCalledWith(["/support", 9], { replaceUrl: true });
    });

    it("le propriétaire peut terminer une conversation", async () => {
        const fixture = await render({ side: "owner" }, "1");
        const button = Array.from(fixture.nativeElement.querySelectorAll("button")).find((b) =>
            (b as HTMLElement).textContent?.includes("Terminer"),
        ) as HTMLButtonElement;

        button.click();

        expect(service["setStatus"]).toHaveBeenCalledWith(1, "CLOSED");
    });

    it("le propriétaire a un onglet Sans compte avec le nombre de demandes", async () => {
        const fixture = await render({ side: "owner" });
        const text = fixture.nativeElement.textContent;

        expect(text).toContain("Sans compte");
        expect(text).toContain("2");
    });

    it("l'adresse ?onglet=sans-compte ouvre les demandes sans compte", async () => {
        const fixture = await render({ side: "owner" }, null, "sans-compte");

        expect(fixture.nativeElement.querySelector("app-help-requests")).not.toBeNull();
        expect(fixture.nativeElement.textContent).not.toContain("Problème de caisse");
    });

    it("l'administrateur d'une boutique n'a pas l'onglet Sans compte", async () => {
        const fixture = await render({ side: "user" });

        expect(fixture.nativeElement.textContent).not.toContain("Sans compte");
    });
});
