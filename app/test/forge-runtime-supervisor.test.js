const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {EventEmitter} = require("node:events");
const {
    assertForgeStartRepositoryClean,
    createForgeRuntimeOptions,
    inspectKernelUpdate,
    isSupervisorUnreachableError,
    probeSupervisor,
    resolveForgeInterfaceMode,
    resolveForgeStartup,
    runCommitRuntimeHookInstaller,
    synchronizeExistingSupervisor,
    waitForSupervisorReady,
} = require("../scripts/forge-start");
const {
    ForgeRuntimeSupervisor,
    SUPERVISOR_TOKEN_HEADER,
    assertRestartPolicyNotNarrowed,
    isKernelRuntimePath,
    isProtectedRestartPath,
    readRestartPolicy,
    timingSafeTokenEqual,
    validateRestartPolicy,
} = require("../scripts/forge-runtime-supervisor");

const temporaryRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "s-forge-supervisor-"));
const productionRestartPolicyPath = path.resolve(__dirname, "../../kernel/forge_restart_test_policy.json");
const restartPolicyFixture = () => JSON.parse(fs.readFileSync(productionRestartPolicyPath, "utf8"));

test("Forge startup keeps the default workspace inside the repository root", () => {
    const root = path.resolve(__dirname, "../..");
    const options = createForgeRuntimeOptions(root, 6806, false);

    assert.equal(options.repoRoot, root);
    assert.equal(options.workspace, path.join(root, ".dev-workspace"));
    assert.equal(options.port, 6806);
    assert.equal(options.noBrowser, false);
});

test("Forge startup requires the entire Git working tree and index to be clean", async () => {
    const calls = [];
    await assertForgeStartRepositoryClean("D:/repo", async (executable, args) => {
        calls.push({executable, args});
        return "";
    });
    assert.deepEqual(calls, [{
        executable: "git",
        args: ["-C", "D:/repo", "status", "--porcelain=v1", "--untracked-files=all"],
    }]);

    for (const status of [
        " M app/src/index.ts\n",
        "M  kernel/api/system.go\n",
        "?? docs/draft.md\n",
    ]) {
        await assert.rejects(
            assertForgeStartRepositoryClean("D:/repo", async () => status),
            /Forge startup requires a clean Git working tree and index/,
        );
    }
});

test("Forge startup installs runtime hooks through the standalone gate command", () => {
    const calls = [];
    runCommitRuntimeHookInstaller("D:/repo", (executable, args, options) => {
        calls.push({executable, args, options});
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].executable, process.execPath);
    assert.deepEqual(calls[0].args, [
        path.join("D:/repo", "app", "scripts", "forge-commit-runtime-gate.js"),
        "install",
    ]);
    assert.equal(calls[0].options.cwd, "D:/repo");
    assert.equal(calls[0].options.stdio, "inherit");
    assert.equal(calls[0].options.windowsHide, true);
});

test("Existing Supervisor update inspection identifies committed Kernel runtime changes", async () => {
    const outputs = ["", "new-revision\n", "kernel/api/agent.go\napp/src/index.ts\nkernel/api/agent_test.go\n"];
    const update = await inspectKernelUpdate("D:/repo", "old-revision", async (executable, args) => {
        assert.equal(executable, "git");
        assert.equal(args[0], "-C");
        return outputs.shift();
    });

    assert.equal(update.revision, "new-revision");
    assert.deepEqual(update.runtimeChanges, ["kernel/api/agent.go"]);
});

test("Existing Supervisor performs a verified hot replacement for Kernel changes", async () => {
    const ownership = {controlURL: "http://127.0.0.1:19785", cliToken: "owned-cli-token"};
    let statusCalls = 0;
    const fetchImpl = async (url, options) => {
        assert.equal(options.headers[SUPERVISOR_TOKEN_HEADER], ownership.cliToken);
        if (url.endsWith("/restart")) {
            assert.equal(options.method, "POST");
            return {ok: true, json: async () => ({job: {id: "restart-1"}})};
        }
        statusCalls += 1;
        return {
            ok: true,
            json: async () => ({
                lifecycle: "ready",
                ready: true,
                activeVersion: {revision: "new-revision"},
                job: statusCalls === 1 ?
                    {id: "restart-1", state: "running", phase: "go_test_core"} :
                    {id: "restart-1", state: "completed", phase: "completed"},
            }),
        };
    };
    const reports = [];
    const result = await synchronizeExistingSupervisor({
        root: "D:/repo",
        ownership,
        status: {activeVersion: {revision: "old-revision"}},
        fetchImpl,
        run: async (_executable, args) => args.includes("status") ? "" : args.includes("rev-parse") ?
            "new-revision\n" : "kernel/api/agent.go\n",
        wait: async () => undefined,
        probeKernelImpl: async () => true,
        report: (message) => reports.push(message),
    });

    assert.equal(result.kind, "restarted");
    assert.equal(statusCalls, 2);
    assert.equal(reports.some((message) => message.includes("go_test_core")), true);
    assert.equal(reports.some((message) => message.includes("completed at revision new-revision")), true);
});

test("Existing Supervisor client attaches to an already-running hot replacement job", async () => {
    const ownership = {controlURL: "http://127.0.0.1:19785", cliToken: "owned-cli-token"};
    let restartCalls = 0;
    const reports = [];
    const result = await synchronizeExistingSupervisor({
        root: "D:/repo",
        ownership,
        status: {activeVersion: {revision: "old-revision"}},
        fetchImpl: async (url) => {
            if (url.endsWith("/restart")) {
                restartCalls += 1;
                return {
                    ok: false,
                    status: 409,
                    json: async () => ({error: "a restart job is already running", job: {id: "restart-existing"}}),
                };
            }
            return {
                ok: true,
                json: async () => ({
                    lifecycle: "ready",
                    ready: true,
                    activeVersion: {revision: "new-revision"},
                    job: {id: "restart-existing", state: "completed", phase: "completed"},
                }),
            };
        },
        run: async (_executable, args) => args.includes("status") ? "" : args.includes("rev-parse") ?
            "new-revision\n" : "kernel/api/agent.go\n",
        wait: async () => undefined,
        probeKernelImpl: async () => true,
        report: (message) => reports.push(message),
    });

    assert.equal(restartCalls, 1);
    assert.equal(result.kind, "restarted");
    assert.equal(reports.some((message) => message.includes("attaching to existing")), true);
});

test("Existing Supervisor remains active when later commits have no Kernel runtime changes", async () => {
    const result = await synchronizeExistingSupervisor({
        root: "D:/repo",
        ownership: {controlURL: "http://127.0.0.1:19785", cliToken: "owned-cli-token"},
        status: {activeVersion: {revision: "old-revision"}},
        fetchImpl: async () => assert.fail("frontend-only changes must not request a Kernel restart"),
        run: async (_executable, args) => args.includes("status") ? "" : args.includes("rev-parse") ?
            "new-revision\n" : "app/src/index.ts\nkernel/api/agent_test.go\n",
        report: () => undefined,
    });

    assert.deepEqual(result, {kind: "current", revision: "new-revision"});
});

test("Existing Supervisor refuses uncommitted Kernel source changes before requesting a restart", async () => {
    await assert.rejects(inspectKernelUpdate("D:/repo", "old-revision", async (_executable, args) => {
        if (args.includes("status")) {
            return " M kernel/api/agent.go\n";
        }
        assert.fail("dirty Kernel source must stop before revision inspection");
    }), /Kernel source has uncommitted changes.*kernel\/api\/agent.go/);
});

test("Forge startup reuses an authenticated Supervisor for the same workspace", async () => {
    const root = temporaryRoot();
    const workspace = path.join(root, ".dev-workspace");
    const ownership = {
        schemaVersion: 1,
        processId: 1234,
        repoRoot: root,
        workspace,
        port: 6806,
        controlURL: "http://127.0.0.1:19785",
        cliToken: "owned-cli-token",
    };
    const fetchImpl = async (url, options) => {
        assert.equal(url, `${ownership.controlURL}/status`);
        assert.equal(options.headers[SUPERVISOR_TOKEN_HEADER], ownership.cliToken);
        return {
            ok: true,
            json: async () => ({
                mode: "forge-source-supervisor",
                lifecycle: "ready",
                ready: true,
                processId: ownership.processId,
                repoRoot: root,
                workspace,
                port: ownership.port,
                activeVersion: {revision: "active-revision"},
            }),
        };
    };
    const startup = await resolveForgeStartup({
        root,
        requestedPort: 6806,
        ownership,
        fetchImpl,
        discoverKernels: async () => assert.fail("authenticated reuse must not scan Kernel processes"),
        portAvailable: async () => assert.fail("authenticated reuse must not scan ports"),
        probeKernelImpl: async (port) => {
            assert.equal(port, 6806);
            return true;
        },
    });

    assert.equal(startup.kind, "reuse");
    assert.equal(startup.port, 6806);
});

test("Forge interface selection keeps Electron and browser modes independent", () => {
    assert.equal(resolveForgeInterfaceMode(["node", "forge-start.js"]), "electron");
    assert.equal(resolveForgeInterfaceMode(["node", "forge-start.js", "--browser"]), "browser");
    assert.equal(resolveForgeInterfaceMode(["node", "forge-start.js", "--no-browser"]), "none");
    assert.throws(() => resolveForgeInterfaceMode(["--browser", "--no-browser"]), /mutually exclusive/);
});

test("Forge startup waits for Supervisor and Kernel readiness instead of accepting a listening control port", async () => {
    const ownership = {controlURL: "http://127.0.0.1:19785", cliToken: "owned-cli-token", port: 6806};
    let statusCalls = 0;
    let clock = 0;
    let kernelProbes = 0;
    const ready = await waitForSupervisorReady({
        ownership,
        status: {lifecycle: "initializing", ready: false, activeVersion: null},
        fetchImpl: async () => {
            statusCalls += 1;
            return {
                ok: true,
                json: async () => statusCalls === 1 ?
                    {lifecycle: "recovering", ready: false, activeVersion: null} :
                    {lifecycle: "ready", ready: true, activeVersion: {revision: "active-revision"}},
            };
        },
        wait: async (milliseconds) => {
            clock += milliseconds;
        },
        now: () => clock,
        timeoutMs: 2_000,
        probeKernelImpl: async (port) => {
            kernelProbes += 1;
            assert.equal(port, 6806);
        },
    });

    assert.equal(ready.lifecycle, "ready");
    assert.equal(statusCalls, 2);
    assert.equal(kernelProbes, 1);
});

test("Forge startup stops waiting when Supervisor readiness reaches its deadline", async () => {
    let clock = 0;
    await assert.rejects(waitForSupervisorReady({
        ownership: {controlURL: "http://127.0.0.1:19785", cliToken: "owned-cli-token", port: 6806},
        status: {lifecycle: "initializing", ready: false, activeVersion: null},
        fetchImpl: async () => ({
            ok: true,
            json: async () => ({lifecycle: "initializing", ready: false, activeVersion: null}),
        }),
        wait: async (milliseconds) => {
            clock += milliseconds;
        },
        now: () => clock,
        timeoutMs: 1_000,
    }), /did not become ready within 1000ms/);
});

test("Supervisor probe preserves the network cause for readiness diagnostics", async () => {
    const root = temporaryRoot();
    const ownership = {
        schemaVersion: 1,
        processId: 1234,
        repoRoot: root,
        workspace: path.join(root, ".dev-workspace"),
        port: 6806,
        controlURL: "http://127.0.0.1:19785",
        cliToken: "owned-cli-token",
    };
    const networkCause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:19785"), {code: "ECONNREFUSED"});
    await assert.rejects(probeSupervisor(ownership, async () => {
        throw new TypeError("fetch failed", {cause: networkCause});
    }), (error) => {
        assert.equal(isSupervisorUnreachableError(error), true);
        assert.match(error.message, /fetch failed/);
        assert.match(error.message, /ECONNREFUSED/);
        assert.equal(error.cause.cause, networkCause);
        return true;
    });
});

test("Forge startup recognizes a healthy legacy Kernel holding the default workspace", async () => {
    const root = temporaryRoot();
    const startup = await resolveForgeStartup({
        root,
        requestedPort: 6806,
        ownership: undefined,
        discoverKernels: async (discoveredWorkspace) => {
            assert.equal(discoveredWorkspace, path.join(root, ".dev-workspace"));
            return [{processId: 321, port: 6806, managedByForge: true}];
        },
        fetchImpl: async (url) => {
            assert.equal(url, "http://127.0.0.1:6806/api/system/version");
            return {ok: true, json: async () => ({code: 0, data: "3.7.3"})};
        },
    });

    assert.equal(startup.kind, "reuse-legacy");
    assert.equal(startup.port, 6806);
});

test("Forge startup rejects a matching Kernel that does not pass its health probe", async () => {
    const root = temporaryRoot();
    await assert.rejects(resolveForgeStartup({
        root,
        requestedPort: 6806,
        ownership: undefined,
        discoverKernels: async () => [{processId: 321, port: 6806, managedByForge: true}],
        fetchImpl: async () => {
            throw new Error("connection refused");
        },
    }), /Kernel health probe failed on port 6806: connection refused/);
});

test("Forge startup selects the next port only when the workspace is unlocked", async () => {
    const root = temporaryRoot();
    const checked = [];
    const startup = await resolveForgeStartup({
        root,
        requestedPort: 6806,
        ownership: undefined,
        discoverKernels: async () => [],
        portAvailable: async (port) => {
            checked.push(port);
            return port === 6807;
        },
    });

    assert.deepEqual(checked, [6806, 6807]);
    assert.deepEqual(startup, {kind: "start", port: 6807});
});

test("Forge startup reports an unreachable ownership descriptor while its owner is alive", async () => {
    const root = temporaryRoot();
    await assert.rejects(resolveForgeStartup({
        root,
        requestedPort: 6806,
        ownership: {
            schemaVersion: 1,
            processId: 1234,
            repoRoot: root,
            workspace: path.join(root, ".dev-workspace"),
            port: 6806,
            controlURL: "http://127.0.0.1:19785",
            cliToken: "stale-cli-token",
        },
        processAlive: () => true,
        fetchImpl: async () => {
            throw new Error("connection refused");
        },
    }), /ownership is stale or unreachable: connection refused; owner process 1234 is still running/);
});

test("Forge startup quarantines dead ownership before starting a replacement Supervisor", async () => {
    const root = temporaryRoot();
    let quarantinedToken = "";
    const startup = await resolveForgeStartup({
        root,
        requestedPort: 6806,
        ownership: {
            schemaVersion: 1,
            processId: 1234,
            repoRoot: root,
            workspace: path.join(root, ".dev-workspace"),
            port: 6806,
            controlURL: "http://127.0.0.1:19785",
            cliToken: "stale-cli-token",
        },
        processAlive: () => false,
        quarantineOwnership: (_runtimeDir, token) => {
            quarantinedToken = token;
        },
        discoverKernels: async () => [],
        portAvailable: async () => true,
        fetchImpl: async () => {
            throw new Error("connection refused");
        },
    });

    assert.equal(quarantinedToken, "stale-cli-token");
    assert.deepEqual(startup, {kind: "start", port: 6806});
});

const createSupervisor = (overrides = {}) => {
    const repoRoot = temporaryRoot();
    fs.mkdirSync(path.join(repoRoot, "kernel"), {recursive: true});
    fs.mkdirSync(path.join(repoRoot, "app", "kernel"), {recursive: true});
    fs.writeFileSync(
        path.join(repoRoot, "kernel", "forge_restart_test_policy.json"),
        JSON.stringify(restartPolicyFixture()),
    );
    const supervisor = new ForgeRuntimeSupervisor({
        repoRoot,
        port: 6806,
        workspace: path.join(repoRoot, "workspace"),
        token: "test-supervisor-token",
        ...overrides,
    });
    fs.mkdirSync(supervisor.versionsDir, {recursive: true});
    fs.mkdirSync(supervisor.jobsDir, {recursive: true});
    return supervisor;
};

test("Supervisor status distinguishes a listening control plane from a ready Kernel", () => {
    const supervisor = createSupervisor();
    const initializing = supervisor.status();
    assert.equal(initializing.lifecycle, "initializing");
    assert.equal(initializing.ready, false);

    supervisor.activeVersion = {id: "active", revision: "a".repeat(40)};
    supervisor.kernelProcess = {exitCode: null};
    supervisor.lifecycle = "ready";
    const ready = supervisor.status();
    assert.equal(ready.lifecycle, "ready");
    assert.equal(ready.ready, true);
});

test("Supervisor runtime ownership is exclusive and released only by its owner", () => {
    const supervisor = createSupervisor();
    supervisor.controlURL = "http://127.0.0.1:19785";
    supervisor.claimRuntimeOwnership();
    const ownership = JSON.parse(fs.readFileSync(supervisor.ownershipPath, "utf8"));

    assert.equal(ownership.workspace, supervisor.workspace);
    assert.equal(ownership.cliToken, supervisor.cliToken);
    assert.equal("token" in ownership, false);
    assert.throws(() => supervisor.claimRuntimeOwnership(), /ownership already exists/);

    supervisor.releaseRuntimeOwnership();
    assert.equal(fs.existsSync(supervisor.ownershipPath), false);
});

test("Kernel runtime path classification excludes documentation and test-only changes", () => {
    assert.equal(isKernelRuntimePath("kernel/main.go"), true);
    assert.equal(isKernelRuntimePath("kernel/go.mod"), true);
    assert.equal(isKernelRuntimePath("kernel/native/bridge.c"), true);
    assert.equal(isKernelRuntimePath("kernel/main_test.go"), false);
    assert.equal(isKernelRuntimePath("kernel/README.md"), false);
    assert.equal(isKernelRuntimePath("app/src/index.ts"), false);
});

test("Go format gate checks changed files and ignores Windows working-tree line endings", async () => {
    const calls = [];
    const supervisor = createSupervisor({
        command: async (command, args, options) => {
            calls.push({command, args, input: options.input});
            return {stdout: options.input, stderr: ""};
        },
    });
    fs.mkdirSync(path.join(supervisor.repoRoot, "kernel", "api"), {recursive: true});
    fs.writeFileSync(path.join(supervisor.repoRoot, "kernel", "api", "changed.go"), "package api\r\n", "utf8");
    fs.writeFileSync(path.join(supervisor.repoRoot, "kernel", "api", "unchanged.go"), "package  api\r\n", "utf8");

    await supervisor.requireGoFormat({
        changed: ["kernel/api/changed.go", "kernel/api/removed.go", "app/src/index.ts"],
    });

    assert.deepEqual(calls, [{command: "gofmt", args: [], input: "package api\n"}]);
});

test("Go format gate reports a changed Go file whose normalized source differs", async () => {
    const supervisor = createSupervisor({
        command: async () => ({stdout: "package api\n", stderr: ""}),
    });
    fs.mkdirSync(path.join(supervisor.repoRoot, "kernel", "api"), {recursive: true});
    fs.writeFileSync(path.join(supervisor.repoRoot, "kernel", "api", "changed.go"), "package  api\r\n", "utf8");

    await assert.rejects(
        supervisor.requireGoFormat({changed: ["kernel/api/changed.go"]}),
        /gofmt check failed:\nkernel\/api\/changed\.go/,
    );
});

test("Restart protection covers every Kernel test and the gate implementation", () => {
    const policy = validateRestartPolicy(restartPolicyFixture());
    assert.deepEqual(readRestartPolicy(path.resolve(__dirname, "../..")), policy);
    assert.equal(isProtectedRestartPath("kernel/api/agent_test.go", policy), true);
    assert.equal(isProtectedRestartPath("kernel/agent/command_review.go", policy), true);
    assert.equal(isProtectedRestartPath("kernel/conf/ai.go", policy), true);
    assert.equal(isProtectedRestartPath("kernel/forge_restart_test_policy.json", policy), true);
    assert.equal(isProtectedRestartPath("app/scripts/forge-runtime-supervisor.js", policy), true);
    assert.equal(isProtectedRestartPath("app/scripts/forge-commit-runtime-gate.js", policy), true);
    assert.equal(isProtectedRestartPath("app/test/forge-commit-runtime-gate.test.js", policy), true);
    assert.equal(isProtectedRestartPath("app/webpack.config.js", policy), true);
    assert.equal(isProtectedRestartPath("app/test/webpack-config.test.js", policy), true);
    assert.equal(isProtectedRestartPath(".githooks/pre-commit", policy), true);
    assert.equal(isProtectedRestartPath(".githooks/post-commit", policy), true);
    assert.equal(isProtectedRestartPath(".githooks/pre-merge-commit", policy), true);
    assert.equal(isProtectedRestartPath(".githooks/post-merge", policy), true);
    assert.equal(isProtectedRestartPath(".forge-runtime/incidents/crash.json", policy), true);
    assert.equal(isProtectedRestartPath("kernel/api/agent.go", policy), false);
});

test("Restart policy rejects malformed path sets and protection narrowing", () => {
    const valid = validateRestartPolicy(restartPolicyFixture());
    for (const mutate of [
        (policy) => policy.protectedPaths.reverse(),
        (policy) => policy.protectedPaths.splice(1, 0, policy.protectedPaths[0]),
        (policy) => policy.protectedPaths.splice(1, 0, "../outside"),
        (policy) => policy.protectedPrefixes.push(".forge-runtime\\jobs\\"),
    ]) {
        const invalid = restartPolicyFixture();
        mutate(invalid);
        assert.throws(() => validateRestartPolicy(invalid), /invalid|sorted|escapes|normalized/);
    }

    const narrowed = restartPolicyFixture();
    narrowed.protectedPaths = narrowed.protectedPaths.filter((entry) => entry !== "kernel/agent/command_review.go");
    assert.throws(
        () => assertRestartPolicyNotNarrowed(validateRestartPolicy(narrowed), valid),
        /protection was narrowed.*kernel\/agent\/command_review\.go/,
    );
});

test("Supervisor token comparison requires an exact token", () => {
    assert.equal(timingSafeTokenEqual("token", "token"), true);
    assert.equal(timingSafeTokenEqual("token", "Token"), false);
    assert.equal(timingSafeTokenEqual("short", "longer"), false);
});

test("Control server rejects unauthenticated and concurrent restart requests", async (t) => {
    const supervisor = createSupervisor();
    await supervisor.startControlServer();
    t.after(async () => supervisor.close());

    const unauthenticated = await fetch(`${supervisor.controlURL}/status`);
    assert.equal(unauthenticated.status, 401);

    supervisor.currentJob = {id: "running", state: "running", phase: "go_test_all"};
    const response = await fetch(`${supervisor.controlURL}/restart`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [SUPERVISOR_TOKEN_HEADER]: supervisor.token,
        },
        body: JSON.stringify({reason: "test"}),
    });
    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.equal(payload.job.id, "running");
});

test("CLI control credential cannot approve protected tests or invoke shutdown-only actions", async (t) => {
    const supervisor = createSupervisor({cliToken: "test-cli-token"});
    await supervisor.startControlServer();
    t.after(async () => supervisor.close());

    const status = await fetch(`${supervisor.controlURL}/status`, {
        headers: {[SUPERVISOR_TOKEN_HEADER]: supervisor.cliToken},
    });
    assert.equal(status.status, 200);

    const approval = await fetch(`${supervisor.controlURL}/approve-protected-tests`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [SUPERVISOR_TOKEN_HEADER]: supervisor.cliToken,
        },
        body: JSON.stringify({jobId: "job", revision: "revision"}),
    });
    assert.equal(approval.status, 403);

    const rejection = await fetch(`${supervisor.controlURL}/reject-protected-tests`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [SUPERVISOR_TOKEN_HEADER]: supervisor.cliToken,
        },
        body: JSON.stringify({jobId: "job", revision: "revision"}),
    });
    assert.equal(rejection.status, 403);
});

test("Restart source validation rejects a dirty worktree", async () => {
    const command = async (name, args) => {
        assert.equal(name, "git");
        if (args[0] === "status") {
            return {stdout: " M kernel/main.go\n", stderr: ""};
        }
        throw new Error(`unexpected command: ${args.join(" ")}`);
    };
    const supervisor = createSupervisor({command});
    supervisor.activeVersion = {revision: "old-revision", restartPolicy: supervisor.loadRestartPolicy()};
    await assert.rejects(supervisor.validateRestartSource(), /worktree is not clean/);
});

test("Restart source validation requires runtime code changes, not test-only changes", async () => {
    const command = async (name, args) => {
        assert.equal(name, "git");
        if (args[0] === "status") {
            return {stdout: "", stderr: ""};
        }
        if (args[0] === "rev-parse") {
            return {stdout: "new-revision\n", stderr: ""};
        }
        if (args[0] === "diff") {
            return {stdout: "kernel/feature_test.go\nkernel/README.md\n", stderr: ""};
        }
        throw new Error(`unexpected command: ${args.join(" ")}`);
    };
    const supervisor = createSupervisor({command});
    supervisor.activeVersion = {revision: "old-revision", restartPolicy: supervisor.loadRestartPolicy()};
    await assert.rejects(supervisor.validateRestartSource(), /no Kernel runtime source changes/);
});

test("Restart source validation rejects a policy narrowed since the active Kernel", async () => {
    const supervisor = createSupervisor({
        command: async (name, args) => {
            assert.equal(name, "git");
            if (args[0] === "status") {
                return {stdout: "", stderr: ""};
            }
            if (args[0] === "rev-parse") {
                return {stdout: "new-revision\n", stderr: ""};
            }
            if (args[0] === "diff") {
                return {stdout: "kernel/api/agent.go\nkernel/forge_restart_test_policy.json\n", stderr: ""};
            }
            throw new Error(`unexpected command: ${args.join(" ")}`);
        },
    });
    const baseline = supervisor.loadRestartPolicy();
    supervisor.activeVersion = {revision: "old-revision", restartPolicy: baseline};
    const narrowed = restartPolicyFixture();
    narrowed.protectedPaths = narrowed.protectedPaths.filter((entry) => entry !== "kernel/agent/command_review.go");
    fs.writeFileSync(path.join(supervisor.kernelDir, "forge_restart_test_policy.json"), JSON.stringify(narrowed));

    await assert.rejects(
        supervisor.validateRestartSource(),
        /protection was narrowed.*kernel\/agent\/command_review\.go/,
    );
});

test("Restart source validation rejects active versions without a recorded policy", async () => {
    const supervisor = createSupervisor({
        command: async (name, args) => {
            assert.equal(name, "git");
            if (args[0] === "status") {
                return {stdout: "", stderr: ""};
            }
            if (args[0] === "rev-parse") {
                return {stdout: "new-revision\n", stderr: ""};
            }
            if (args[0] === "diff") {
                return {stdout: "kernel/api/agent.go\n", stderr: ""};
            }
            throw new Error(`unexpected command: ${args.join(" ")}`);
        },
    });
    supervisor.activeVersion = {revision: "old-revision"};

    await assert.rejects(supervisor.validateRestartSource(), /does not record its Forge restart policy/);
});

test("Candidate health failure restores the previous immutable version", async () => {
    const supervisor = createSupervisor();
    const previous = {id: "previous", revision: "b".repeat(40), binaryPath: "previous.exe", sha256: "old-sha"};
    const candidate = {id: "candidate", revision: "a".repeat(40), binaryPath: "candidate.exe", sha256: "new-sha"};
    supervisor.activeVersion = previous;
    supervisor.currentJob = supervisor.createJob("switch test");
    assert.equal(supervisor.currentJob.logPath, `jobs/${supervisor.currentJob.id}.log`);
    supervisor.requestGracefulKernelShutdown = async () => {};
    supervisor.waitForKernelExit = async () => {};
    supervisor.terminateKernelProcess = async () => {};
    supervisor.markVersionState = () => {};
    const launched = [];
    supervisor.launchAndRequireHealthy = async (version) => {
        launched.push(version.id);
        if (version.id === "candidate") {
            throw new Error("candidate unhealthy");
        }
    };

    await assert.rejects(supervisor.switchToCandidate(candidate, supervisor.currentJob), /previous version restored/);
    assert.deepEqual(launched, ["candidate", "previous"]);
    assert.equal(supervisor.activeVersion.id, "previous");
    assert.equal(supervisor.currentJob.state, "rolled_back");
    assert.equal(supervisor.latestIncident.kind, "candidate-health-failure");
    assert.equal(supervisor.latestIncident.state, "recovered");
    assert.equal(supervisor.latestIncident.failedVersion.sha256, "new-sha");
    assert.equal(supervisor.latestIncident.restoredVersion.sha256, "old-sha");
    assert.equal(fs.existsSync(path.join(supervisor.incidentsDir, `${supervisor.latestIncident.id}.json`)), true);
});

test("Unexpected Kernel exit restores only the recorded active immutable version", async () => {
    const processes = [];
    const spawnedPaths = [];
    const spawnKernel = (binaryPath) => {
        const child = new EventEmitter();
        child.exitCode = null;
        child.kill = () => {
            child.exitCode = 0;
            child.emit("exit", 0, null);
        };
        processes.push(child);
        spawnedPaths.push(binaryPath);
        return child;
    };
    const supervisor = createSupervisor({spawnKernel});
    const active = {
        id: "verified",
        revision: "old",
        binaryPath: "immutable-verified.exe",
        sha256: "verified-sha",
    };
    supervisor.activeVersion = active;
    supervisor.waitForHealth = async () => {};

    await supervisor.launchAndRequireHealthy(active, false);
    processes[0].exitCode = 1;
    processes[0].emit("exit", 1, null);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(spawnedPaths, [active.binaryPath, active.binaryPath]);
    assert.equal(supervisor.kernelProcess, processes[1]);
    assert.equal(supervisor.recovering, false);
    assert.equal(supervisor.latestIncident.kind, "kernel-crash");
    assert.equal(supervisor.latestIncident.state, "recovered");
    assert.equal(supervisor.latestIncident.exitCode, 1);
    assert.equal(supervisor.latestIncident.failedVersion.sha256, "verified-sha");
    assert.equal(supervisor.latestIncident.recoveryAttempts.length, 1);
    const incidentJSON = fs.readFileSync(
        path.join(supervisor.incidentsDir, `${supervisor.latestIncident.id}.json`),
        "utf8",
    );
    assert.equal(incidentJSON.includes(supervisor.token), false);
    assert.equal(incidentJSON.includes(supervisor.cliToken), false);
});

test("A normal UI-requested Kernel exit stops the Supervisor instead of restoring the Kernel", async () => {
    const child = new EventEmitter();
    child.exitCode = null;
    const supervisor = createSupervisor({spawnKernel: () => child});
    const active = {id: "verified", revision: "old", binaryPath: "immutable-verified.exe"};
    supervisor.activeVersion = active;
    supervisor.waitForHealth = async () => {};
    let recoveries = 0;
    supervisor.recoverActiveVersionAfterUnexpectedExit = async () => {
        recoveries += 1;
    };
    let closes = 0;
    supervisor.close = async () => {
        supervisor.closing = true;
        closes += 1;
    };

    await supervisor.launchAndRequireHealthy(active, false);
    child.exitCode = 0;
    child.emit("exit", 0, null);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(closes, 1);
    assert.equal(recoveries, 0);
    assert.equal(supervisor.kernelProcess, undefined);
});

test("Restart runner preserves rolled_back as the terminal state", async () => {
    const supervisor = createSupervisor();
    const job = supervisor.createJob("rollback state test");
    supervisor.validateRestartSource = async () => ({
        revision: "new-revision",
        protectedChanges: [],
        restartPolicy: supervisor.loadRestartPolicy(),
    });
    supervisor.requireGoFormat = async () => {};
    supervisor.runLogged = async () => ({stdout: "", stderr: ""});
    supervisor.requireStableCleanRevision = async () => {};
    supervisor.buildVersion = async () => ({id: "candidate"});
    supervisor.switchToCandidate = async () => {
        supervisor.updateJob(job, "rolled_back", "rollback", "candidate unhealthy");
        throw new Error("candidate unhealthy; previous version restored");
    };

    await supervisor.runRestart(job);
    assert.equal(job.state, "rolled_back");
    assert.equal(job.phase, "rollback");
    assert.match(job.error, /previous version restored/);
});

test("Protected test diff pauses restart until a matching human approval arrives", async () => {
    const supervisor = createSupervisor({protectedApprovalTimeout: 1_000});
    const job = supervisor.createJob("protected test approval");
    const source = {
        revision: "new-revision",
        protectedChanges: ["kernel/api/forge_runtime_test.go"],
    };

    const waiting = supervisor.requireProtectedTestApproval(job, source);
    assert.equal(job.state, "awaiting_protected_test_approval");
    assert.deepEqual(job.protectedTestApproval.paths, source.protectedChanges);
    assert.throws(() => supervisor.approveProtectedTests(job.id, "wrong-revision"), /no matching/);
    const approval = supervisor.approveProtectedTests(job.id, source.revision);
    await waiting;

    assert.equal(approval.state, "approved");
    assert.equal(job.protectedTestApproval.state, "approved");
    assert.equal(job.state, "running");
    assert.throws(() => supervisor.approveProtectedTests(job.id, source.revision), /no matching/);
});

test("Graceful Kernel shutdown carries the exact restart job and candidate revision", async () => {
    const requests = [];
    const supervisor = createSupervisor({
        fetchImpl: async (url, options) => {
            requests.push({url, options});
            return {ok: true, status: 202};
        },
    });
    const job = {id: "restart-job-1"};
    const candidate = {revision: "a".repeat(40)};

    await supervisor.requestGracefulKernelShutdown(job, candidate);

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://127.0.0.1:6806/api/s-forge/forge/runtime/shutdown");
    assert.equal(requests[0].options.method, "POST");
    assert.deepEqual(requests[0].options.headers, {
        "Content-Type": "application/json",
        [SUPERVISOR_TOKEN_HEADER]: "test-supervisor-token",
    });
    assert.deepEqual(JSON.parse(requests[0].options.body), {
        jobId: "restart-job-1",
        targetRevision: "a".repeat(40),
    });
});

test("Protected test rejection is exact, persisted and fails the waiting restart", async (t) => {
    const supervisor = createSupervisor({protectedApprovalTimeout: 1_000});
    await supervisor.startControlServer();
    t.after(async () => supervisor.close());
    const job = supervisor.createJob("protected test rejection");
    const source = {
        revision: "new-revision",
        protectedChanges: ["kernel/api/forge_runtime_test.go"],
    };

    const waiting = supervisor.requireProtectedTestApproval(job, source);
    const rejectionObserved = assert.rejects(waiting, /rejected by user/);
    assert.throws(() => supervisor.rejectProtectedTests(job.id, "wrong-revision"), /no matching/);
    const response = await fetch(`${supervisor.controlURL}/reject-protected-tests`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [SUPERVISOR_TOKEN_HEADER]: supervisor.token,
        },
        body: JSON.stringify({jobId: job.id, revision: source.revision}),
    });
    assert.equal(response.status, 200);
    const {approval: rejection} = await response.json();
    await rejectionObserved;

    assert.equal(rejection.state, "rejected");
    assert.equal(job.protectedTestApproval.state, "rejected");
    assert.equal(typeof job.protectedTestApproval.rejectedAt, "string");
    assert.equal(supervisor.pendingProtectedApproval, undefined);
    assert.throws(() => supervisor.rejectProtectedTests(job.id, source.revision), /no matching/);

    const persisted = JSON.parse(fs.readFileSync(supervisor.statePath, "utf8"));
    assert.equal(persisted.job.protectedTestApproval.state, "rejected");
});

test("Protected test approval rejects a stale pending object after the current job changes", async () => {
    const supervisor = createSupervisor({protectedApprovalTimeout: 1_000});
    const job = supervisor.createJob("stale approval");
    const source = {
        revision: "new-revision",
        protectedChanges: ["kernel/api/forge_runtime_test.go"],
    };
    const waiting = supervisor.requireProtectedTestApproval(job, source);
    const rejectionObserved = assert.rejects(waiting, /rejected by user/);
    supervisor.currentJob = {...job};

    assert.throws(() => supervisor.approveProtectedTests(job.id, source.revision), /no matching/);
    supervisor.currentJob = job;
    supervisor.rejectProtectedTests(job.id, source.revision);
    await rejectionObserved;
});

test("Protected test approval expires and fails closed", async () => {
    const supervisor = createSupervisor({protectedApprovalTimeout: 20});
    const job = supervisor.createJob("approval timeout");
    await assert.rejects(supervisor.requireProtectedTestApproval(job, {
        revision: "new-revision",
        protectedChanges: ["kernel/agent/forge_test.go"],
    }), /approval timed out/);
    assert.equal(supervisor.pendingProtectedApproval, undefined);
    assert.equal(job.protectedTestApproval.state, "expired");
    assert.equal(typeof job.protectedTestApproval.expiredAt, "string");
});

test("Core test policy rejects package allowlists and command narrowing", () => {
    const supervisor = createSupervisor();
    assert.deepEqual(supervisor.loadRestartPolicy().command, ["go", "test", "-short", "-tags", "fts5", "./..."]);
    const narrowed = restartPolicyFixture();
    narrowed.scope = "selected-packages";
    narrowed.command = ["go", "test", "-short", "-tags", "fts5", "./api"];
    fs.writeFileSync(path.join(supervisor.kernelDir, "forge_restart_test_policy.json"), JSON.stringify(narrowed));
    assert.throws(() => supervisor.loadRestartPolicy(), /narrowed or is invalid/);
});

test("Version cleanup retains healthy rollback versions and removes failed candidates", () => {
    const supervisor = createSupervisor({maxVersions: 3});
    const versions = [
        {id: "active", state: "healthy", createdAt: "2026-07-22T05:00:00.000Z"},
        {id: "failed", state: "failed", createdAt: "2026-07-22T04:00:00.000Z"},
        {id: "healthy-2", state: "healthy", createdAt: "2026-07-22T03:00:00.000Z"},
        {id: "healthy-1", state: "healthy", createdAt: "2026-07-22T02:00:00.000Z"},
        {id: "stale", state: "healthy", createdAt: "2026-07-22T01:00:00.000Z"},
    ];
    for (const version of versions) {
        const versionDir = path.join(supervisor.versionsDir, version.id);
        fs.mkdirSync(versionDir, {recursive: true});
        fs.writeFileSync(path.join(versionDir, "version.json"), JSON.stringify(version));
    }
    supervisor.activeVersion = versions[0];

    supervisor.cleanupVersions();

    assert.deepEqual(supervisor.listVersions().map((version) => version.id), ["active", "healthy-2", "healthy-1"]);
    assert.equal(fs.existsSync(path.join(supervisor.versionsDir, "failed")), false);
    assert.equal(fs.existsSync(path.join(supervisor.versionsDir, "stale")), false);
});

test("Health check waits for completed boot progress before accepting the version endpoint", async () => {
    const responses = [
        {ok: true, json: async () => ({code: 0, data: {progress: 50}})},
        {ok: true, json: async () => ({code: 0, data: {progress: 100}})},
        {ok: true, json: async () => ({code: 0, data: "3.7.1-alpha.1"})},
    ];
    const requestedURLs = [];
    const supervisor = createSupervisor({
        delay: async () => {},
        fetchImpl: async (url) => {
            requestedURLs.push(url);
            return responses.shift();
        },
    });

    await supervisor.waitForHealth(1_000, {exitCode: null});

    assert.match(requestedURLs[0], /bootProgress$/);
    assert.match(requestedURLs[1], /bootProgress$/);
    assert.match(requestedURLs[2], /version$/);
});
