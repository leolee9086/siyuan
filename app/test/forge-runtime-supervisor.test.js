const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {EventEmitter} = require("node:events");
const {createForgeRuntimeOptions} = require("../scripts/forge-start");
const {
    ForgeRuntimeSupervisor,
    SUPERVISOR_TOKEN_HEADER,
    isKernelRuntimePath,
    isProtectedRestartPath,
    timingSafeTokenEqual,
} = require("../scripts/forge-runtime-supervisor");

const temporaryRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "s-forge-supervisor-"));

test("Forge startup keeps the default workspace inside the repository root", () => {
    const root = path.resolve(__dirname, "../..");
    const options = createForgeRuntimeOptions(root, 6806, false);

    assert.equal(options.repoRoot, root);
    assert.equal(options.workspace, path.join(root, ".dev-workspace"));
    assert.equal(options.port, 6806);
    assert.equal(options.noBrowser, false);
});

const createSupervisor = (overrides = {}) => {
    const repoRoot = temporaryRoot();
    fs.mkdirSync(path.join(repoRoot, "kernel"), {recursive: true});
    fs.mkdirSync(path.join(repoRoot, "app", "kernel"), {recursive: true});
    fs.writeFileSync(path.join(repoRoot, "kernel", "forge_restart_test_policy.json"), JSON.stringify({
        schemaVersion: 1,
        scope: "all-packages",
        command: ["go", "test", "-short", "-tags", "fts5", "./..."],
    }));
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

test("Kernel runtime path classification excludes documentation and test-only changes", () => {
    assert.equal(isKernelRuntimePath("kernel/main.go"), true);
    assert.equal(isKernelRuntimePath("kernel/go.mod"), true);
    assert.equal(isKernelRuntimePath("kernel/native/bridge.c"), true);
    assert.equal(isKernelRuntimePath("kernel/main_test.go"), false);
    assert.equal(isKernelRuntimePath("kernel/README.md"), false);
    assert.equal(isKernelRuntimePath("app/src/index.ts"), false);
});

test("Restart protection covers every Kernel test and the gate implementation", () => {
    assert.equal(isProtectedRestartPath("kernel/api/agent_test.go"), true);
    assert.equal(isProtectedRestartPath("kernel/agent/command_review.go"), true);
    assert.equal(isProtectedRestartPath("kernel/conf/ai.go"), true);
    assert.equal(isProtectedRestartPath("kernel/forge_restart_test_policy.json"), true);
    assert.equal(isProtectedRestartPath("app/scripts/forge-runtime-supervisor.js"), true);
    assert.equal(isProtectedRestartPath("kernel/api/agent.go"), false);
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

test("Restart source validation rejects a dirty worktree", async () => {
    const command = async (name, args) => {
        assert.equal(name, "git");
        if (args[0] === "status") {
            return {stdout: " M kernel/main.go\n", stderr: ""};
        }
        throw new Error(`unexpected command: ${args.join(" ")}`);
    };
    const supervisor = createSupervisor({command});
    supervisor.activeVersion = {revision: "old-revision"};
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
    supervisor.activeVersion = {revision: "old-revision"};
    await assert.rejects(supervisor.validateRestartSource(), /no Kernel runtime source changes/);
});

test("Candidate health failure restores the previous immutable version", async () => {
    const supervisor = createSupervisor();
    const previous = {id: "previous", revision: "old", binaryPath: "previous.exe"};
    const candidate = {id: "candidate", revision: "new", binaryPath: "candidate.exe"};
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

    await assert.rejects(supervisor.switchToCandidate(candidate), /previous version restored/);
    assert.deepEqual(launched, ["candidate", "previous"]);
    assert.equal(supervisor.activeVersion.id, "previous");
    assert.equal(supervisor.currentJob.state, "rolled_back");
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
    const active = {id: "verified", revision: "old", binaryPath: "immutable-verified.exe"};
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
    supervisor.validateRestartSource = async () => ({revision: "new-revision", protectedChanges: []});
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
});

test("Protected test approval expires and fails closed", async () => {
    const supervisor = createSupervisor({protectedApprovalTimeout: 20});
    const job = supervisor.createJob("approval timeout");
    await assert.rejects(supervisor.requireProtectedTestApproval(job, {
        revision: "new-revision",
        protectedChanges: ["kernel/agent/forge_test.go"],
    }), /approval timed out/);
    assert.equal(supervisor.pendingProtectedApproval, undefined);
});

test("Core test policy rejects package allowlists and command narrowing", () => {
    const supervisor = createSupervisor();
    assert.deepEqual(supervisor.loadCoreTestPolicy(), ["go", "test", "-short", "-tags", "fts5", "./..."]);
    fs.writeFileSync(path.join(supervisor.kernelDir, "forge_restart_test_policy.json"), JSON.stringify({
        schemaVersion: 1,
        scope: "selected-packages",
        command: ["go", "test", "-short", "-tags", "fts5", "./api"],
    }));
    assert.throws(() => supervisor.loadCoreTestPolicy(), /narrowed or is invalid/);
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
