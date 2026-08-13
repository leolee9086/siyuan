const DEFAULT_MAX_TIMELINE_ENTRIES = 64;

const nonEmptyString = (value) => typeof value === "string" && value.length > 0 ? value : null;

const errorMessage = (error) => error instanceof Error ? error.message : String(error);

const createMainNavigationDiagnostics = (webContents, {
    loadURL = (targetURL) => webContents.loadURL(targetURL),
    maxTimelineEntries = DEFAULT_MAX_TIMELINE_ENTRIES,
    now = () => new Date().toISOString(),
} = {}) => {
    if (!webContents || typeof webContents.on !== "function" || typeof webContents.removeListener !== "function") {
        throw new TypeError("Main navigation diagnostics require Electron webContents.");
    }
    if (typeof loadURL !== "function") {
        throw new TypeError("Main navigation diagnostics require a loadURL implementation.");
    }
    if (!Number.isInteger(maxTimelineEntries) || maxTimelineEntries < 1) {
        throw new TypeError("Main navigation diagnostics require a positive timeline limit.");
    }

    const state = {
        schemaVersion: 1,
        createdAt: now(),
        targetURL: null,
        targetPreparedAt: null,
        loadRequestedAt: null,
        mainDocumentCommittedAt: null,
        mainDocumentURL: null,
        domReadyAt: null,
        didFinishLoadAt: null,
        didStopLoadingAt: null,
        rendererReadyAt: null,
        readyTimeoutAt: null,
        firstConsoleError: null,
        lastLoadFailure: null,
        lastRendererExit: null,
        timelineDroppedCount: 0,
        timeline: [],
    };
    let sequence = 0;
    let disposed = false;
    const listeners = [];

    const appendTimeline = (type, details = {}, at = now()) => {
        const entry = {sequence: ++sequence, at, type};
        Object.entries(details).forEach(([key, value]) => {
            if (value !== undefined) {
                entry[key] = value;
            }
        });
        state.timeline.push(entry);
        if (state.timeline.length > maxTimelineEntries) {
            state.timeline.shift();
            state.timelineDroppedCount++;
        }
        return at;
    };

    const listen = (eventName, listener) => {
        webContents.on(eventName, listener);
        listeners.push([eventName, listener]);
    };

    const normalizeNavigationDetails = (details, url, isSameDocument, isMainFrame) => ({
        url: nonEmptyString(details?.url) || nonEmptyString(url),
        isSameDocument: typeof details?.isSameDocument === "boolean" ? details.isSameDocument : Boolean(isSameDocument),
        isMainFrame: typeof details?.isMainFrame === "boolean" ? details.isMainFrame : isMainFrame === true,
    });

    const recordLoadFailure = (phase, errorCode, description, validatedURL) => {
        const at = now();
        const failure = {
            at,
            phase,
            errorCode: Number.isInteger(errorCode) ? errorCode : null,
            errorDescription: nonEmptyString(description) || String(description),
            validatedURL: nonEmptyString(validatedURL),
        };
        state.lastLoadFailure = failure;
        appendTimeline(phase, {
            errorCode: failure.errorCode,
            errorDescription: failure.errorDescription,
            validatedURL: failure.validatedURL,
        }, at);
    };

    listen("did-start-navigation", (details, url, isSameDocument, isMainFrame) => {
        const navigation = normalizeNavigationDetails(details, url, isSameDocument, isMainFrame);
        if (!navigation.isMainFrame) {
            return;
        }
        appendTimeline("did-start-navigation", {
            url: navigation.url,
            isSameDocument: navigation.isSameDocument,
        });
    });
    listen("did-redirect-navigation", (details, url, isSameDocument, isMainFrame) => {
        const navigation = normalizeNavigationDetails(details, url, isSameDocument, isMainFrame);
        if (!navigation.isMainFrame) {
            return;
        }
        appendTimeline("did-redirect-navigation", {
            url: navigation.url,
            isSameDocument: navigation.isSameDocument,
        });
    });
    listen("did-frame-navigate", (_event, url, httpResponseCode, httpStatusText, isMainFrame) => {
        if (!isMainFrame) {
            return;
        }
        const at = now();
        state.mainDocumentCommittedAt = at;
        state.mainDocumentURL = nonEmptyString(url);
        appendTimeline("did-frame-navigate", {
            url: state.mainDocumentURL,
            httpResponseCode: Number.isInteger(httpResponseCode) ? httpResponseCode : null,
            httpStatusText: typeof httpStatusText === "string" ? httpStatusText : null,
        }, at);
    });
    listen("dom-ready", () => {
        const at = now();
        state.domReadyAt = at;
        appendTimeline("dom-ready", {}, at);
    });
    listen("did-finish-load", () => {
        const at = now();
        state.didFinishLoadAt = at;
        appendTimeline("did-finish-load", {}, at);
    });
    listen("did-stop-loading", () => {
        const at = now();
        state.didStopLoadingAt = at;
        appendTimeline("did-stop-loading", {}, at);
    });
    listen("did-fail-provisional-load", (_event, errorCode, description, validatedURL, isMainFrame) => {
        if (isMainFrame) {
            recordLoadFailure("did-fail-provisional-load", errorCode, description, validatedURL);
        }
    });
    listen("did-fail-load", (_event, errorCode, description, validatedURL, isMainFrame) => {
        if (isMainFrame) {
            recordLoadFailure("did-fail-load", errorCode, description, validatedURL);
        }
    });
    listen("console-message", (details) => {
        if (state.firstConsoleError || details?.level !== "error" || details.frame !== webContents.mainFrame) {
            return;
        }
        const at = now();
        state.firstConsoleError = {
            at,
            message: typeof details.message === "string" ? details.message : String(details.message),
            lineNumber: Number.isInteger(details.lineNumber) ? details.lineNumber : null,
            sourceId: nonEmptyString(details.sourceId),
        };
        appendTimeline("console-error", {
            message: state.firstConsoleError.message,
            lineNumber: state.firstConsoleError.lineNumber,
            sourceId: state.firstConsoleError.sourceId,
        }, at);
    });
    listen("render-process-gone", (_event, details = {}) => {
        const at = now();
        state.lastRendererExit = {
            at,
            reason: nonEmptyString(details.reason),
            exitCode: Number.isInteger(details.exitCode) ? details.exitCode : null,
        };
        appendTimeline("render-process-gone", {
            reason: state.lastRendererExit.reason,
            exitCode: state.lastRendererExit.exitCode,
        }, at);
    });

    const prepareTarget = (targetURL) => {
        const normalizedTarget = nonEmptyString(targetURL);
        if (!normalizedTarget) {
            throw new TypeError("Main navigation target URL must be a non-empty string.");
        }
        if (state.loadRequestedAt) {
            throw new Error("Main navigation target cannot change after loading started.");
        }
        if (state.targetURL && state.targetURL !== normalizedTarget) {
            throw new Error("Main navigation target is already prepared.");
        }
        if (!state.targetURL) {
            const at = now();
            state.targetURL = normalizedTarget;
            state.targetPreparedAt = at;
            appendTimeline("target-prepared", {url: normalizedTarget}, at);
        }
        return normalizedTarget;
    };

    const loadTarget = () => {
        if (!state.targetURL) {
            return Promise.reject(new Error("Main navigation target is not prepared."));
        }
        if (state.loadRequestedAt) {
            return Promise.reject(new Error("Main navigation load was already requested."));
        }
        const at = now();
        state.loadRequestedAt = at;
        appendTimeline("load-requested", {url: state.targetURL}, at);
        let loading;
        try {
            loading = loadURL(state.targetURL);
        } catch (error) {
            recordLoadFailure("load-url-rejected", null, errorMessage(error), null);
            return Promise.reject(error);
        }
        return Promise.resolve(loading).catch((error) => {
            recordLoadFailure("load-url-rejected", null, errorMessage(error), null);
            throw error;
        });
    };

    const recordRendererReady = () => {
        if (!state.rendererReadyAt) {
            const at = now();
            state.rendererReadyAt = at;
            appendTimeline("renderer-ready", {}, at);
        }
    };

    const recordReadyTimeout = () => {
        if (!state.readyTimeoutAt) {
            const at = now();
            state.readyTimeoutAt = at;
            appendTimeline("renderer-ready-timeout", {}, at);
        }
    };

    const dispose = () => {
        if (disposed) {
            return;
        }
        disposed = true;
        listeners.forEach(([eventName, listener]) => webContents.removeListener(eventName, listener));
    };

    return {
        state,
        dispose,
        loadTarget,
        prepareTarget,
        recordReadyTimeout,
        recordRendererReady,
    };
};

module.exports = {
    DEFAULT_MAX_TIMELINE_ENTRIES,
    createMainNavigationDiagnostics,
};
