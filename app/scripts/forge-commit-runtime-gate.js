#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");
const {isKernelRuntimePath, parseLines, writeJSONAtomic} = require("./forge-runtime-supervisor");

const repoRoot = path.resolve(__dirname, "../..");
const HOOKS_PATH = ".githooks";
const COMMIT_RUNTIME_HOOKS = Object.freeze({
    "pre-commit": "pre-commit",
    "post-commit": "post-commit",
    "pre-merge-commit": "pre-commit",
    "post-merge": "post-commit",
});
const PAGE_PATHS = [
    "/",
    "/stage/build/agent-app/",
    "/stage/build/magi-desktop/",
    "/stage/build/magi-mobile/",
    "/stage/build/magi-identity/",
    "/stage/build/protyle-app/",
];

const gitOutput = (root, args) => execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
}).trim();

const isFrontendRuntimePath = (filePath) => {
    const normalized = filePath.replace(/\\/g, "/");
    return normalized.startsWith("app/src/") ||
        normalized.startsWith("app/appearance/") ||
        normalized === "app/build.targets.json" ||
        normalized === "app/package.json" ||
        normalized === "app/pnpm-lock.yaml" ||
        /^app\/webpack(?:\.|\/)/u.test(normalized);
};

const gatePaths = (root) => {
    const runtimeDir = path.join(root, ".forge-runtime");
    return {
        runtimeDir,
        statePath: path.join(runtimeDir, "commit-runtime-gate.json"),
        operationsDir: path.join(runtimeDir, "operations"),
    };
};

const readGateState = (root) => {
    const {statePath} = gatePaths(root);
    if (!fs.existsSync(statePath)) {
        return undefined;
    }
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
};

const changedPaths = (root, fromRevision, toRevision) => parseLines(gitOutput(root, [
    "diff", "--name-only", `${fromRevision}..${toRevision}`, "--",
]));

const uncommittedRuntimePaths = (root) => [...new Set([
    ...parseLines(gitOutput(root, ["diff", "--name-only", "--"])),
    ...parseLines(gitOutput(root, ["ls-files", "--others", "--exclude-standard", "--", "kernel"])),
].filter(isKernelRuntimePath))].sort();

const validateCommitRuntimeHooks = (root) => {
    for (const [hook, mode] of Object.entries(COMMIT_RUNTIME_HOOKS)) {
        const hookPath = path.join(root, HOOKS_PATH, hook);
        if (!fs.existsSync(hookPath)) {
            throw new Error(`required Forge Git hook is missing: ${hookPath}`);
        }
        const expected = `exec node app/scripts/forge-commit-runtime-gate.js ${mode}`;
        if (!fs.readFileSync(hookPath, "utf8").includes(expected)) {
            throw new Error(`required Forge Git hook has invalid content: ${hookPath}`);
        }
    }
};

const installCommitRuntimeHooks = (root, run = gitOutput, validateHooks = validateCommitRuntimeHooks) => {
    validateHooks(root);
    let configured = "";
    try {
        configured = run(root, ["config", "--local", "--get", "core.hooksPath"]);
    } catch (error) {
        if (error.status !== 1) {
            throw error;
        }
    }
    if (configured && configured !== HOOKS_PATH) {
        throw new Error(`core.hooksPath is already configured as ${configured}; refusing to replace it`);
    }
    if (!configured) {
        run(root, ["config", "--local", "core.hooksPath", HOOKS_PATH]);
    }
    return HOOKS_PATH;
};

const createOperation = (root, commit, trigger) => {
    const startedAt = new Date().toISOString();
    const id = `${startedAt.replace(/[:.]/g, "-")}-${commit.slice(0, 12)}-${crypto.randomBytes(4).toString("hex")}`;
    const paths = gatePaths(root);
    fs.mkdirSync(paths.operationsDir, {recursive: true});
    return {
        schemaVersion: 1,
        id,
        trigger,
        status: "running",
        commit,
        startedAt,
        updatedAt: startedAt,
        logPath: `operations/${id}.log`,
        kernel: null,
        frontend: null,
        health: null,
        error: "",
    };
};

const persistOperation = (root, operation, message) => {
    const paths = gatePaths(root);
    operation.updatedAt = new Date().toISOString();
    writeJSONAtomic(paths.statePath, operation);
    const logPath = path.join(paths.runtimeDir, operation.logPath);
    fs.appendFileSync(logPath, `[${operation.updatedAt}] ${message}\n`, "utf8");
};

const runFrontendUpdate = (root, _changedPaths, run = execFileSync) => {
    const options = {cwd: path.join(root, "app"), stdio: "inherit", windowsHide: true};
    for (const script of ["test", "dev:once"]) {
        if (process.platform === "win32") {
            run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", "run", script], options);
        } else {
            run("pnpm", ["run", script], options);
        }
    }
    return {tests: "pnpm test", build: "pnpm dev:once"};
};

const probePages = async (port, fetchImpl) => {
    const results = [];
    for (const pagePath of PAGE_PATHS) {
        const response = await fetchImpl(`http://127.0.0.1:${port}${pagePath}`, {
            signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) {
            throw new Error(`Forge page probe ${pagePath} returned HTTP ${response.status}`);
        }
        results.push({path: pagePath, status: response.status});
    }
    return results;
};

const waitForSupervisorReadiness = async ({
    ownership,
    probeSupervisor,
    fetchImpl,
    isRetryableError,
    report = () => undefined,
    timeoutMs = 20_000,
    intervalMs = 250,
    requiredConsecutiveSuccesses = 2,
    now = Date.now,
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) => {
    const startedAt = now();
    let attempts = 0;
    let consecutiveSuccesses = 0;
    let transientFailures = 0;
    let lastError;
    while (now() - startedAt <= timeoutMs) {
        attempts += 1;
        try {
            const status = await probeSupervisor(ownership, fetchImpl);
            consecutiveSuccesses += 1;
            if (consecutiveSuccesses >= requiredConsecutiveSuccesses) {
                return {
                    status,
                    attempts,
                    transientFailures,
                    elapsedMs: now() - startedAt,
                };
            }
        } catch (error) {
            if (!isRetryableError(error)) {
                throw error;
            }
            lastError = error;
            consecutiveSuccesses = 0;
            transientFailures += 1;
            report(`Supervisor readiness attempt ${attempts} failed: ${error.message}`);
        }
        const remainingMs = timeoutMs - (now() - startedAt);
        if (remainingMs <= 0) {
            break;
        }
        await wait(Math.min(intervalMs, remainingMs));
    }
    throw new Error(
        `Forge Supervisor did not become stably reachable within ${timeoutMs}ms after ${attempts} attempts: ${lastError?.message || "no successful readiness sample"}`,
        {cause: lastError},
    );
};

const runtimeDependencies = () => {
    const forgeStart = require("./forge-start");
    return {
        readOwnership: forgeStart.readOwnership,
        probeSupervisor: forgeStart.probeSupervisor,
        synchronizeExistingSupervisor: forgeStart.synchronizeExistingSupervisor,
        inspectCommittedKernelUpdate: forgeStart.inspectCommittedKernelUpdate,
        isSupervisorUnreachableError: forgeStart.isSupervisorUnreachableError,
        probeKernel: forgeStart.probeKernel,
    };
};

const runPreCommitGate = async (root = repoRoot, dependencies = {}) => {
    const runtime = {...runtimeDependencies(), ...dependencies};
    const ownership = runtime.readOwnership(path.join(root, ".forge-runtime"));
    if (!ownership) {
        throw new Error("Forge Supervisor is not running; start pnpm forge before committing");
    }
    const supervisor = await runtime.probeSupervisor(ownership, dependencies.fetchImpl || globalThis.fetch.bind(globalThis));
    const head = gitOutput(root, ["rev-parse", "HEAD"]);
    const paths = changedPaths(root, supervisor.activeVersion.revision, head);
    const runtimeChanges = paths.filter(isKernelRuntimePath);
    const dirtyRuntimePaths = uncommittedRuntimePaths(root);
    const state = readGateState(root);
    if (state?.status === "failed") {
        throw new Error(`previous commit runtime gate failed: ${state.error || state.id}`);
    }
    if (runtimeChanges.length > 0) {
        throw new Error(`previous commit Kernel runtime is not active: ${runtimeChanges.join(", ")}`);
    }
    if (state && (state.status !== "completed" || state.commit !== head)) {
        throw new Error(`previous commit frontend runtime gate is not complete for ${head}`);
    }
    if (!state && supervisor.activeVersion.revision !== head) {
        throw new Error(`commit runtime gate has no freshness evidence for ${head}`);
    }
    if (dirtyRuntimePaths.length > 0) {
        throw new Error(`unstaged or untracked Kernel runtime changes must be resolved before commit: ${dirtyRuntimePaths.join(", ")}`);
    }
    await runtime.probeKernel(Number(ownership.port), dependencies.fetchImpl || globalThis.fetch.bind(globalThis));
    return {head, activeRevision: supervisor.activeVersion.revision};
};

const runPostCommitGate = async (root = repoRoot, dependencies = {}, trigger = "post-commit") => {
    const runtime = {...runtimeDependencies(), ...dependencies};
    const fetchImpl = dependencies.fetchImpl || globalThis.fetch.bind(globalThis);
    const head = gitOutput(root, ["rev-parse", "HEAD"]);
    const previousState = readGateState(root);
    const operation = createOperation(root, head, trigger);
    persistOperation(root, operation, "commit runtime gate started");
    try {
        const ownership = runtime.readOwnership(path.join(root, ".forge-runtime"));
        if (!ownership) {
            throw new Error("Forge Supervisor is not running");
        }
        const before = await runtime.probeSupervisor(ownership, fetchImpl);
        const activeRevision = before.activeVersion?.revision;
        if (!activeRevision) {
            throw new Error("Forge Supervisor does not report an active Kernel revision");
        }
        const frontendBaseRevision = previousState?.status === "completed" &&
            previousState.frontend?.activeRevision ? previousState.frontend.activeRevision : activeRevision;
        const frontendChanges = changedPaths(root, frontendBaseRevision, head).filter(isFrontendRuntimePath);
        const update = await runtime.inspectCommittedKernelUpdate(root, activeRevision);
        operation.kernel = {
            previousRevision: activeRevision,
            runtimeChanges: update.runtimeChanges,
            result: "pending",
        };
        operation.frontend = {
            previousRevision: frontendBaseRevision,
            changedPaths: frontendChanges,
            result: frontendChanges.length > 0 ? "pending" : "not-required",
        };
        persistOperation(root, operation, `detected ${update.runtimeChanges.length} Kernel and ${frontendChanges.length} frontend runtime changes`);
        if (frontendChanges.length > 0) {
            operation.frontend = {
                ...operation.frontend,
                ...(await (dependencies.runFrontendUpdate || runFrontendUpdate)(root, frontendChanges)),
                result: "updated",
            };
            persistOperation(root, operation, "frontend tests and development build completed");
        }
        operation.frontend.activeRevision = head;
        let kernelResult;
        if (update.runtimeChanges.length > 0) {
            kernelResult = await runtime.synchronizeExistingSupervisor({
                root,
                ownership,
                status: before,
                fetchImpl,
                report: (message) => persistOperation(root, operation, message),
            });
        } else {
            kernelResult = {kind: "current", revision: update.revision};
            persistOperation(root, operation, "committed range contains no Kernel runtime changes; existing Kernel retained");
        }
        const readiness = await (dependencies.waitForSupervisorReadiness || waitForSupervisorReadiness)({
            ownership,
            probeSupervisor: runtime.probeSupervisor,
            fetchImpl,
            isRetryableError: runtime.isSupervisorUnreachableError,
            report: (message) => persistOperation(root, operation, message),
        });
        const after = readiness.status;
        if (update.runtimeChanges.length > 0 && after.activeVersion?.revision !== head) {
            throw new Error(`Kernel hot replacement ended at ${after.activeVersion?.revision || "unknown"}, expected ${head}`);
        }
        operation.kernel = {
            ...operation.kernel,
            result: kernelResult.kind,
            activeRevision: after.activeVersion?.revision || null,
            activeVersionId: after.activeVersion?.id || null,
            activeBinarySha256: after.activeVersion?.sha256 || null,
            supervisorJob: kernelResult.job?.id || after.job?.id || null,
        };
        await runtime.probeKernel(Number(ownership.port), fetchImpl);
        const pages = await (dependencies.probePages || probePages)(Number(ownership.port), fetchImpl);
        operation.health = {
            supervisor: {
                status: "passed",
                attempts: readiness.attempts,
                transientFailures: readiness.transientFailures,
                elapsedMs: readiness.elapsedMs,
            },
            kernel: "passed",
            pages,
        };
        operation.status = "completed";
        operation.finishedAt = new Date().toISOString();
        persistOperation(root, operation, "commit runtime gate completed");
        return operation;
    } catch (error) {
        operation.status = "failed";
        operation.error = error instanceof Error ? error.message : String(error);
        operation.finishedAt = new Date().toISOString();
        persistOperation(root, operation, `commit runtime gate failed: ${operation.error}`);
        throw error;
    }
};

const retryFailedPostCommitGate = async (root = repoRoot, dependencies = {}) => {
    const head = gitOutput(root, ["rev-parse", "HEAD"]);
    const state = readGateState(root);
    if (!state || state.status !== "failed" || state.commit !== head) {
        throw new Error(`No failed commit runtime gate exists for current HEAD ${head}`);
    }
    return runPostCommitGate(root, dependencies, "retry-post-commit");
};

const main = async () => {
    const mode = process.argv[2];
    if (mode === "install") {
        console.log(`[forge] Git hooks path: ${installCommitRuntimeHooks(repoRoot)}`);
        return;
    }
    if (mode === "pre-commit") {
        await runPreCommitGate();
        return;
    }
    if (mode === "post-commit") {
        await runPostCommitGate();
        return;
    }
    if (mode === "retry-post-commit") {
        await retryFailedPostCommitGate();
        return;
    }
    throw new Error("Expected install, pre-commit, post-commit or retry-post-commit");
};

if (require.main === module) {
    main().catch((error) => {
        console.error(`[forge] commit runtime gate failed: ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    COMMIT_RUNTIME_HOOKS,
    changedPaths,
    installCommitRuntimeHooks,
    isFrontendRuntimePath,
    probePages,
    readGateState,
    retryFailedPostCommitGate,
    runFrontendUpdate,
    runPostCommitGate,
    runPreCommitGate,
    uncommittedRuntimePaths,
    validateCommitRuntimeHooks,
    waitForSupervisorReadiness,
};
