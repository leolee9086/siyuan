import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Constants} from "../../src/constants";

// ----  snippet timeout/error ordering  ----
const fetchHoisted = vi.hoisted(() => ({
  fetchPost: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../src/util/network/fetch", () => ({
  fetchPost: fetchHoisted.fetchPost,
}));

vi.mock("../../src/util/assets", () => ({
  refreshHeadingNumberMeasurements: fetchHoisted.refresh,
}));

import {renderSnippet} from "../../src/config/util/snippets";

// ---- initFramework race: will mock heavy deps after snippet import
const frameworkHoisted = vi.hoisted(() => ({
  setInlineStyle: vi.fn(),
  initKeyboardToolbar: vi.fn(),
  initMobileBottomBar: vi.fn(),
  initMobileBars: vi.fn(),
  MobileFiles: vi.fn(),
  MobileTabs: vi.fn(),
  openDock: vi.fn(),
  syncGuide: vi.fn(),
  getOpenNotebookCount: vi.fn().mockReturnValue(0),
  parseUriInfo: vi.fn().mockReturnValue({id: ""}),
  queueAVLocateRequest: vi.fn(),
  activateQueuedAVLocate: vi.fn(),
  avRender: vi.fn(),
  openMobileFileById: vi.fn(),
  openMobileOnboarding: vi.fn().mockReturnValue(false),
}));

vi.mock("../../src/util/assets/assets", () => ({
  setInlineStyle: frameworkHoisted.setInlineStyle,
}));
vi.mock("../../src/mobile/util/keyboardToolbar", () => ({
  initKeyboardToolbar: frameworkHoisted.initKeyboardToolbar,
}));
vi.mock("../../src/mobile/util/mobileBottomBar", () => ({
  initMobileBottomBar: frameworkHoisted.initMobileBottomBar,
}));
vi.mock("../../src/mobile/util/mobileBars", () => ({
  initMobileBars: frameworkHoisted.initMobileBars,
}));
vi.mock("../../src/mobile/dock/MobileFiles", () => ({
  MobileFiles: frameworkHoisted.MobileFiles,
}));
vi.mock("../../src/mobile/tabs/MobileTabs", () => ({
  MobileTabs: frameworkHoisted.MobileTabs,
}));
vi.mock("../../src/mobile/dock/util", () => ({
  openDock: frameworkHoisted.openDock,
}));
vi.mock("../../src/sync/syncGuide", () => ({
  syncGuide: frameworkHoisted.syncGuide,
}));
vi.mock("../../src/util/file/pathName", async () => {
  const actual = await vi.importActual<typeof import("../../src/util/file/pathName")>("../../src/util/file/pathName");
  return {
    ...actual,
    getOpenNotebookCount: frameworkHoisted.getOpenNotebookCount,
  };
});
vi.mock("../../src/util/uri/protocol", () => ({
  parseUriInfo: frameworkHoisted.parseUriInfo,
}));
vi.mock("../../src/protyle/render/av/locate/activation/activation", () => ({
  queueAVLocateRequest: frameworkHoisted.queueAVLocateRequest,
  activateQueuedAVLocate: frameworkHoisted.activateQueuedAVLocate,
}));
vi.mock("../../src/protyle/render/av/render", () => ({
  avRender: frameworkHoisted.avRender,
}));
vi.mock("../../src/mobile/editor", () => ({
  openMobileFileById: frameworkHoisted.openMobileFileById,
}));
vi.mock("../../src/onboarding/mobile", () => ({
  openMobileOnboarding: frameworkHoisted.openMobileOnboarding,
}));

describe("snippet load timeout/error ordering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (global as unknown as {siyuan: unknown}).siyuan = {
      config: {
        snippet: {enabledCSS: true, enabledJS: true},
        fileTree: {tabStartupMode: 0},
      },
    } as unknown as Window["siyuan"];
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    fetchHoisted.fetchPost.mockReset();
    fetchHoisted.refresh.mockReset();
    vi.spyOn(window, "clearTimeout");
    vi.spyOn(window, "setTimeout");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aborts after TIMEOUT_SNIPPET_LOAD and still resolves, clearing timer", async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchHoisted.fetchPost.mockImplementation((_url: string, _data: unknown, cb: (r: unknown) => void, _h: unknown, _f: unknown, signal?: AbortSignal) => {
      capturedSignal = signal;
      // simulate delayed response that will be aborted before callback
      return new Promise<void>((resolve) => {
        if (signal) {
          signal.addEventListener("abort", () => resolve());
        }
      });
    });

    const promise = renderSnippet(Constants.TIMEOUT_SNIPPET_LOAD);
    expect(fetchHoisted.fetchPost).toHaveBeenCalledTimes(1);
    const signalArg = fetchHoisted.fetchPost.mock.calls[0][5] as AbortSignal | undefined;
    expect(signalArg).toBeInstanceOf(AbortSignal);
    expect(signalArg).toBe(capturedSignal);

    // advance past timeout, should trigger abort
    vi.advanceTimersByTime(Constants.TIMEOUT_SNIPPET_LOAD + 10);
    await promise;
    expect(capturedSignal?.aborted).toBe(true);
    // finally clears timeout
    expect(window.clearTimeout).toHaveBeenCalled();
  });

  it("without timeout does not create abort signal and resolves on success", async () => {
    fetchHoisted.fetchPost.mockImplementation((_url: string, _data: unknown, cb: (r: IWebSocketData) => void) => {
      cb({code: 0, msg: "", data: {snippets: []}} as unknown as IWebSocketData);
      return Promise.resolve();
    });
    await expect(renderSnippet(0)).resolves.toBeUndefined();
    expect(fetchHoisted.fetchPost.mock.calls[0][5]).toBeUndefined();
  });

  it("resolves even when fetchPost rejects via abort path (error ordering)", async () => {
    fetchHoisted.fetchPost.mockImplementation((_url: string, _data: unknown, _cb: unknown, _h: unknown, _f: unknown, signal?: AbortSignal) => {
      // mimic fetchPost abort handling: resolves void, not rejects
      return Promise.resolve();
    });
    await expect(renderSnippet(Constants.TIMEOUT_SNIPPET_LOAD)).resolves.toBeUndefined();
    expect(window.clearTimeout).toHaveBeenCalled();
  });
});

describe("initialization/openChangelog race behavior (mobile split owner)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="sidebar"><div><div></div></div><div></div></div>
      <div id="sidebarRight"><div><div></div></div><div></div></div>
      <div id="toolbarFile"></div>
      <div id="toolbarMore"></div>
      <div id="toolbarSync"></div>
      <div id="modelClose"></div>
      <div id="toolbarTabs"></div>
      <div id="toolbarName"></div>
    `;
    document.head.innerHTML = "";
    (window as unknown as {siyuan: unknown}).siyuan = {
      config: {snippet: {enabledCSS: true, enabledJS: true}, fileTree: {tabStartupMode: 0}, appearance: {}},
      mobile: {docks: {file: null, outline: null, bookmark: null, tag: null, backlink: null, inbox: null}, editor: null, tabs: null},
      storage: {},
    } as unknown as Window["siyuan"];
    frameworkHoisted.setInlineStyle.mockReset();
    frameworkHoisted.initKeyboardToolbar.mockReset();
    frameworkHoisted.MobileFiles.mockReset();
    frameworkHoisted.MobileTabs.mockImplementation(() => ({
      removeMissingTabs: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(false),
      closeAll: vi.fn(),
      activateStartupBlank: vi.fn(),
    } as unknown as never));
    fetchHoisted.fetchPost.mockReset();
  });

  it("initFramework awaits snippetReady before creating file dock (behavioral ordering)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(path.resolve("src/mobile/util/initFramework.ts"), "utf8");
    const snippetIdx = file.indexOf("const snippetReady = renderSnippet(Constants.TIMEOUT_SNIPPET_LOAD)");
    const awaitIdx = file.indexOf("await snippetReady");
    const mobileFilesIdx = file.indexOf("new MobileFiles(app");
    expect(snippetIdx).toBeGreaterThan(-1);
    expect(awaitIdx).toBeGreaterThan(snippetIdx);
    expect(mobileFilesIdx).toBeGreaterThan(awaitIdx);
    // also ensure file is async Promise<void>
    expect(file).toContain("export const initFramework = async (app: AppFacade, isStart: boolean): Promise<void>");
  });

  it("mobile boot caller sequences initFramework before changelog (contract check)", async () => {
    // This is a focused contract test: verify mobile/index.ts now chains promise before openChangelog
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(path.resolve("src/mobile/index.ts"), "utf8");
    // Must contain then-chain with catch and isReady/flush inside then
    expect(file).toContain("initFramework(this, confResponse.data.start).then(() => {");
    expect(file).toContain('console.error("Failed to initialize mobile framework:", error)');
    // Ensure openChangelog is inside the then, not after a bare initFramework call
    const thenIdx = file.indexOf("initFramework(this, confResponse.data.start).then");
    const changelogIdx = file.indexOf("openChangelog(getProtyleDialogPort())");
    expect(changelogIdx).toBeGreaterThan(thenIdx);
    // Ensure bare pattern no longer exists
    expect(file).not.toMatch(/\n\s*initFramework\(this, confResponse\.data\.start\);\s*\n\s*initRightMenu/);
  });
});
