const assert = require("node:assert/strict");
const test = require("node:test");
const {presentMainWindow} = require("../electron/main-window-presentation");

const createWindow = () => {
    const calls = [];
    return {
        calls,
        show: () => calls.push("show"),
        minimize: () => calls.push("minimize"),
        maximize: () => calls.push("maximize"),
        unmaximize: () => calls.push("unmaximize"),
    };
};

test("main window presentation shows the normal App window", () => {
    const browserWindow = createWindow();

    assert.equal(presentMainWindow(browserWindow, {
        openAsHidden: false,
        maximized: false,
    }), "visible");
    assert.deepEqual(browserWindow.calls, ["show", "unmaximize"]);
});

test("main window presentation restores the persisted maximized state", () => {
    const browserWindow = createWindow();

    assert.equal(presentMainWindow(browserWindow, {
        openAsHidden: false,
        maximized: true,
    }), "maximized");
    assert.deepEqual(browserWindow.calls, ["show", "maximize"]);
});

test("hidden startup minimizes only the App main window", () => {
    const browserWindow = createWindow();

    assert.equal(presentMainWindow(browserWindow, {
        openAsHidden: true,
        maximized: true,
    }), "hidden");
    assert.deepEqual(browserWindow.calls, ["minimize"]);
});

test("main window presentation rejects an incomplete BrowserWindow contract", () => {
    assert.throws(() => presentMainWindow({show() {}}, {
        openAsHidden: false,
        maximized: false,
    }), /presentation controls/u);
});
