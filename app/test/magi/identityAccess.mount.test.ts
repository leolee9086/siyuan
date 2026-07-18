import {beforeEach, describe, expect, it, vi} from "vitest";

const vueApp = vi.hoisted(() => ({
    mount: vi.fn(),
    unmount: vi.fn(),
}));
const createApp = vi.hoisted(() => vi.fn(() => vueApp));

vi.mock("../../src/magi/identity-access/components/imports", () => ({
    createApp,
}));

vi.mock("../../src/magi/identity-access/components/IdentityAccessHost.vue", () => ({
    default: {name: "IdentityAccessHost"},
}));

function createContainer() {
    const classes = new Set<string>();
    return {
        container: {
            classList: {
                add: (...names: string[]) => names.forEach((name) => classes.add(name)),
                remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
                contains: (name: string) => classes.has(name),
            },
        } as unknown as HTMLElement,
        classes,
    };
}

describe("Identity Access shared mount lifecycle", () => {
    beforeEach(() => {
        createApp.mockClear();
        vueApp.mount.mockClear();
        vueApp.unmount.mockClear();
    });

    it("applies the host class and removes it when unmounted", async () => {
        const {mountIdentityAccess} = await import("../../src/magi/identity-access/components/mount");
        const {container, classes} = createContainer();

        const mounted = mountIdentityAccess(container, {hostKind: "dock"});

        expect(createApp).toHaveBeenCalledWith(
            expect.objectContaining({name: "IdentityAccessHost"}),
            {hostKind: "dock"},
        );
        expect(vueApp.mount).toHaveBeenCalledWith(container);
        expect(classes).toEqual(new Set(["identity-access-container", "identity-access-container--dock"]));

        mounted.unmount();

        expect(vueApp.unmount).toHaveBeenCalledOnce();
        expect(classes).toEqual(new Set());
    });
});
