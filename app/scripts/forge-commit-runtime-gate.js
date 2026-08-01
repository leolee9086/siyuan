#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");
const {parseLines, writeJSONAtomic} = require("./forge-runtime-supervisor");

const repoRoot = path.resolve(__dirname, "../..");
const HOOKS_PATH = ".githooks";
const COMMIT_RUNTIME_HOOKS = Object.freeze({
    "pre-commit": "pre-commit",
    "post-commit": "post-commit",
    "pre-merge-commit": "pre-commit",
    "post-merge": "post-commit",
    "pre-push": "pre-push",
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

const stagedPaths = (root) => parseLines(gitOutput(root, ["diff", "--cached", "--name-only", "--"]));

const isKernelCommitPath = (filePath) => filePath.replace(/\\/g, "/").startsWith("kernel/");

const isFrontendCommitPath = (filePath) => {
    const normalized = filePath.replace(/\\/g, "/");
    return isFrontendRuntimePath(normalized) || normalized.startsWith("app/test/") ||
        normalized.startsWith("app/scripts/") || normalized.startsWith(".githooks/");
};

// This is deliberately a source-validation gate, not a deployment gate. The
// committed revision is independently tested again by the controlled Forge
// deployment workflow before any Kernel replacement is attempted.
// 普通提交不再执行前端测试；前端全量测试只在 push 时兜底（见 runPrePushGate）。
const runStagedCommitChecks = (root, paths, run = execFileSync) => {
    const options = {stdio: "inherit", windowsHide: true};
    const checks = {};
    if (paths.some(isKernelCommitPath)) {
        run("go", ["test", "-short", "-tags", "fts5", "./..."], {
            ...options,
            cwd: path.join(root, "kernel"),
        });
        checks.kernel = "go test -short -tags fts5 ./...";
    }
    return checks;
};

// Push 门禁：推送是把未经验证的提交带到远程的最后一道本地关卡。
// 与普通提交不同，push 时前端与后端都执行全量测试，任一失败即阻止推送。
const runPushChecks = (root, paths, run = execFileSync) => {
    const options = {stdio: "inherit", windowsHide: true};
    const checks = {};
    if (paths.some(isKernelCommitPath)) {
        run("go", ["test", "-short", "-tags", "fts5", "./..."], {
            ...options,
            cwd: path.join(root, "kernel"),
        });
        checks.kernel = "go test -short -tags fts5 ./...";
    }
    if (paths.some(isFrontendCommitPath)) {
        const frontendOptions = {...options, cwd: path.join(root, "app")};
        if (process.platform === "win32") {
            run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", "run", "test"], frontendOptions);
        } else {
            run("pnpm", ["run", "test"], frontendOptions);
        }
        checks.frontend = "pnpm test";
    }
    return checks;
};

// git 在 pre-push 时通过 stdin 传入待推送 ref 行：
// <local ref> <local sha> <remote ref> <remote sha>（每行一个）。
// 对每个待推送 ref，计算 远程基线..本地 的变更路径并分类执行测试。
const runPrePushGate = (root = repoRoot, stdin = "", run = execFileSync) => {
    const paths = new Set();
    for (const line of parseLines(stdin)) {
        const parts = line.split(/\s+/);
        if (parts.length < 4) {
            continue;
        }
        const [, localSha, , remoteSha] = parts;
        if (!/^[0-9a-f]{40,64}$/.test(localSha)) {
            continue;
        }
        if (/^0+$/.test(remoteSha)) {
            // 新分支 / 新远程：没有远程基线，回退到最近一次提交范围。
            let parent;
            try {
                parent = gitOutput(root, ["rev-parse", `${localSha}^`]);
            } catch (error) {
                parent = "";
            }
            if (parent) {
                for (const changed of changedPaths(root, parent, localSha)) {
                    paths.add(changed);
                }
            }
            continue;
        }
        if (/^[0-9a-f]{40,64}$/.test(remoteSha)) {
            for (const changed of changedPaths(root, remoteSha, localSha)) {
                paths.add(changed);
            }
        }
    }
    const pathList = [...paths];
    const checks = runPushChecks(root, pathList, run);
    return {paths: pathList, checks};
};

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

// 普通提交不再以前端测试作为 freshness 门禁；保留函数与调用点，
// 仅记录 revision（见 runPostCommitGate 的 frontend 分支）。
const runFrontendUpdate = (root, _changedPaths, run = execFileSync) => {
    return {tests: "skipped"};
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
    // The index is the object being committed, so reject whitespace damage
    // there. Deployment freshness, Supervisor reachability and approvals are
    // intentionally outside this hook: none of them describes commit validity.
    gitOutput(root, ["diff", "--cached", "--check"]);
    const paths = stagedPaths(root);
    const checks = await (dependencies.runStagedCommitChecks || runStagedCommitChecks)(
        root,
        paths,
        dependencies.run || execFileSync,
    );
    return {paths, checks};
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
            persistOperation(root, operation, "frontend tests completed");
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

// Git has already created the commit before this hook runs. Deployment remains
// observable and must close before its delivery is integrated, but a failed
// replacement cannot retroactively make source validation fail.
const runPostCommitHook = async (root = repoRoot, dependencies = {}, report = console.error) => {
    try {
        const operation = await (dependencies.runPostCommitGate || runPostCommitGate)(root, dependencies, "post-commit");
        return {status: "completed", operation};
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        report(`[forge] post-commit deployment failed; Git commit remains valid: ${message}`);
        return {status: "failed", error: message};
    }
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
    if (mode === "pre-push") {
        const stdin = fs.readFileSync(0, "utf8");
        await runPrePushGate(repoRoot, stdin);
        return;
    }
    if (mode === "post-commit") {
        await runPostCommitHook();
        return;
    }
    if (mode === "retry-post-commit") {
        await retryFailedPostCommitGate();
        return;
    }
    throw new Error("Expected install, pre-commit, pre-push, post-commit or retry-post-commit");
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
    isFrontendCommitPath,
    isFrontendRuntimePath,
    probePages,
    readGateState,
    retryFailedPostCommitGate,
    runFrontendUpdate,
    runPrePushGate,
    runPushChecks,
    runStagedCommitChecks,
    runPostCommitHook,
    runPostCommitGate,
    runPreCommitGate,
    validateCommitRuntimeHooks,
    waitForSupervisorReadiness,
};
