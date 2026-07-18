import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const adapterMocks = vi.hoisted(() => ({
    Custom: vi.fn(),
    getAllModels: vi.fn(),
    getSiyuanWebSocket: vi.fn(),
    mountIdentityAccess: vi.fn(),
    openFile: vi.fn(),
    tabRegistry: {register: vi.fn()},
}));

vi.mock("../../src/magi/identity-access/adapters/imports", () => adapterMocks);

function createElement() {
    const classes = new Set<string>();
    const element = Object.create(HTMLElement.prototype) as HTMLElement;
    Object.defineProperty(element, "classList", {
        value: {
            add: (...names: string[]) => names.forEach((name) => classes.add(name)),
            contains: (name: string) => classes.has(name),
        },
    });
    return {classes, element};
}

describe("Identity Access host adapters", () => {
    beforeEach(() => {
        vi.stubGlobal("HTMLElement", function FakeHTMLElement() {});
        adapterMocks.Custom.mockReset();
        adapterMocks.getAllModels.mockReset();
        adapterMocks.getSiyuanWebSocket.mockReset();
        adapterMocks.mountIdentityAccess.mockReset();
        adapterMocks.openFile.mockReset();
        adapterMocks.mountIdentityAccess.mockReturnValue({unmount: vi.fn()});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("binds the Tab model destroy hook to the shared unmount lifecycle", async () => {
        const {initIdentityAccessTab} = await import("../../src/magi/identity-access/adapters/tab");
        const {element} = createElement();
        const unmount = vi.fn();
        adapterMocks.mountIdentityAccess.mockReturnValue({unmount});
        const model = {element, destroy: undefined};

        initIdentityAccessTab(model as never);

        expect(adapterMocks.mountIdentityAccess.mock.calls[0]?.[0] === element).toBe(true);
        expect(adapterMocks.mountIdentityAccess.mock.calls[0]?.[1]).toEqual({hostKind: "tab"});
        expect(model.destroy).toBe(unmount);
    });

    it("creates a Dock model with Dock layout classes and shared cleanup", async () => {
        const {createIdentityAccessDockModel} = await import("../../src/magi/identity-access/adapters/dock.factory");
        const {classes, element} = createElement();
        const unmount = vi.fn();
        adapterMocks.mountIdentityAccess.mockReturnValue({unmount});
        adapterMocks.Custom.mockImplementation(function MockCustom(options) {
            const custom = {element, destroy: undefined};
            options.init(custom);
            return custom;
        });

        const model = createIdentityAccessDockModel({} as never, {} as never) as unknown as {destroy?: () => void};

        expect(adapterMocks.Custom).toHaveBeenCalledWith(expect.objectContaining({
            type: "magi-identity-access",
            data: {},
        }));
        expect(classes).toEqual(new Set(["fn__flex-column", "magi-identity-access-dock"]));
        expect(adapterMocks.mountIdentityAccess.mock.calls[0]?.[0] === element).toBe(true);
        expect(adapterMocks.mountIdentityAccess.mock.calls[0]?.[1]).toEqual({hostKind: "dock"});
        expect(model.destroy).toBe(unmount);
    });

    it("reuses and activates an existing Identity Access Tab", async () => {
        const {openIdentityAccessTab} = await import("../../src/magi/identity-access/adapters/open");
        const switchTab = vi.fn();
        const showHeading = vi.fn();
        const headElement = {};
        const stack = {switchTab, showHeading};
        const {element: dockElement} = createElement();
        const {element: tabElement} = createElement();
        dockElement.classList.add("identity-access-container--dock");
        tabElement.classList.add("identity-access-container--tab");
        adapterMocks.getAllModels.mockReturnValue({
            custom: [
                {
                    element: dockElement,
                    type: "magi-identity-access",
                    parent: {headElement: {}, parent: stack},
                },
                {
                    element: tabElement,
                    type: "magi-identity-access",
                    parent: {headElement, parent: stack},
                },
            ],
        });

        await openIdentityAccessTab({app: {} as never});

        expect(switchTab).toHaveBeenCalledWith(headElement);
        expect(showHeading).toHaveBeenCalledOnce();
        expect(adapterMocks.openFile).not.toHaveBeenCalled();
    });

    it("opens a new Tab when the matching Custom Model is only a Dock", async () => {
        const {openIdentityAccessTab} = await import("../../src/magi/identity-access/adapters/open");
        const {element} = createElement();
        const app = {};
        element.classList.add("identity-access-container--dock");
        adapterMocks.getAllModels.mockReturnValue({
            custom: [{element, type: "magi-identity-access"}],
        });

        await openIdentityAccessTab({app: app as never});

        expect(adapterMocks.openFile).toHaveBeenCalledWith({
            app,
            custom: {
                title: "Identity Access",
                icon: "iconLock",
                id: "magi-identity-access",
                data: {hostKind: "tab"},
            },
        });
    });

    it("opens the standalone page when no SiYuan App context is available", async () => {
        const {openIdentityAccessTab} = await import("../../src/magi/identity-access/adapters/open");
        const focus = vi.fn();
        const open = vi.fn(() => ({focus}));
        vi.stubGlobal("window", {open});
        adapterMocks.getSiyuanWebSocket.mockReturnValue(undefined);

        await openIdentityAccessTab();

        expect(open).toHaveBeenCalledWith("/stage/build/magi-identity/", "magi-identity-access");
        expect(focus).toHaveBeenCalledOnce();
        expect(adapterMocks.openFile).not.toHaveBeenCalled();
    });
});
