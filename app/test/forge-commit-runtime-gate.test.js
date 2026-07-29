const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const test = require("node:test");
const {
    COMMIT_RUNTIME_HOOKS,
    installCommitRuntimeHooks,
    isFrontendRuntimePath,
    readGateState,
    runFrontendUpdate,
    runPostCommitGate,
    runPreCommitGate,
    validateCommitRuntimeHooks,
} = require("../scripts/forge-commit-runtime-gate");

const git = (root, args) => execFileSync("git", args, {cwd: root, encoding: "utf8"}).trim();

const createRepository = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "s-forge-commit-gate-"));
    git(root, ["init", "--initial-branch=main"]);
    git(root, ["config", "user.name", "Test Author"]);
    git(root, ["config", "user.email", "test@example.com"]);
    fs.mkdirSync(path.join(root, "kernel"), {recursive: true});
    fs.writeFileSync(path.join(root, "kernel", "main.go"), "package main\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "base"]);
    const base = git(root, ["rev-parse", "HEAD"]);
    fs.mkdirSync(path.join(root, "app", "src"), {recursive: true});
    fs.writeFileSync(path.join(root, "kernel", "main.go"), "package main\n\nfunc main() {}\n");
    fs.writeFileSync(path.join(root, "app", "src", "index.ts"), "export const ready = true;\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "runtime update"]);
    return {root, base, head: git(root, ["rev-parse", "HEAD"])};
};

const runtimeMocks = ({base, head, failRestart = false}) => {
    let supervisorCalls = 0;
    return {
        fetchImpl: async () => ({ok: true}),
        readOwnership: () => ({port: 6806}),
        probeSupervisor: async () => {
            supervisorCalls += 1;
            return {
                activeVersion: supervisorCalls === 1 ?
                    {id: "old", revision: base, sha256: "old-sha"} :
                    {id: "new", revision: head, sha256: "new-sha"},
                job: {id: "restart-job"},
            };
        },
        inspectKernelUpdate: async () => ({revision: head, runtimeChanges: ["kernel/main.go"]}),
        synchronizeExistingSupervisor: async ({report}) => {
            report("hot replacement phase: go_test_core");
            if (failRestart) {
                throw new Error("candidate failed health check");
            }
            return {kind: "restarted", job: {id: "restart-job"}};
        },
        probeKernel: async () => true,
        probePages: async () => [{path: "/", status: 200}],
    };
};

test("Frontend runtime path classification excludes tooling-only changes", () => {
    assert.equal(isFrontendRuntimePath("app/src/index.ts"), true);
    assert.equal(isFrontendRuntimePath("app/appearance/langs/en_US.json"), true);
    assert.equal(isFrontendRuntimePath("app/webpack.config.js"), true);
    assert.equal(isFrontendRuntimePath("app/scripts/forge-start.js"), false);
    assert.equal(isFrontendRuntimePath("docs/README.md"), false);
});

test("Frontend runtime update uses a terminating development build", () => {
    const calls = [];
    const result = runFrontendUpdate("D:/repo", (executable, args, options) => {
        calls.push({executable, args, cwd: options.cwd});
    });

    assert.deepEqual(calls.map((call) => call.args), [
        ["run", "test"],
        ["run", "dev:once"],
    ]);
    assert.equal(calls.every((call) => call.cwd === path.join("D:/repo", "app")), true);
    assert.deepEqual(result, {tests: "pnpm test", build: "pnpm dev:once"});
});

test("Post-commit gate updates frontend and hot-switches every backend commit", async (context) => {
    const repository = createRepository();
    context.after(() => fs.rmSync(repository.root, {recursive: true, force: true}));
    let frontendUpdates = 0;
    const operation = await runPostCommitGate(repository.root, {
        ...runtimeMocks(repository),
        runFrontendUpdate: async (_root, paths) => {
            frontendUpdates += 1;
            assert.deepEqual(paths, ["app/src/index.ts"]);
            return {tests: "passed", build: "updated"};
        },
    });

    assert.equal(frontendUpdates, 1);
    assert.equal(operation.status, "completed");
    assert.equal(operation.kernel.result, "restarted");
    assert.equal(operation.kernel.activeRevision, repository.head);
    assert.equal(operation.kernel.activeBinarySha256, "new-sha");
    assert.equal(operation.kernel.supervisorJob, "restart-job");
    assert.equal(operation.frontend.result, "updated");
    assert.equal(readGateState(repository.root).commit, repository.head);
});

test("Post-commit gate persists a blocking failure when hot replacement fails", async (context) => {
    const repository = createRepository();
    context.after(() => fs.rmSync(repository.root, {recursive: true, force: true}));
    await assert.rejects(runPostCommitGate(repository.root, {
        ...runtimeMocks({...repository, failRestart: true}),
        runFrontendUpdate: async () => ({tests: "passed", build: "updated"}),
    }), /candidate failed health check/);

    const state = readGateState(repository.root);
    assert.equal(state.status, "failed");
    assert.equal(state.commit, repository.head);
    assert.match(state.error, /candidate failed health check/);
    assert.equal(fs.existsSync(path.join(repository.root, ".forge-runtime", state.logPath)), true);
});

test("Frontend-only commits retain freshness without advancing the Kernel revision", async (context) => {
    const repository = createRepository();
    context.after(() => fs.rmSync(repository.root, {recursive: true, force: true}));
    const kernelRevision = repository.head;
    fs.writeFileSync(path.join(repository.root, "app", "src", "index.ts"), "export const ready = 'frontend-only';\n");
    git(repository.root, ["add", "app/src/index.ts"]);
    git(repository.root, ["commit", "-m", "frontend only"]);
    const frontendRevision = git(repository.root, ["rev-parse", "HEAD"]);
    let frontendUpdates = 0;
    const runtime = {
        fetchImpl: async () => ({ok: true}),
        readOwnership: () => ({port: 6806}),
        probeSupervisor: async () => ({activeVersion: {id: "kernel", revision: kernelRevision, sha256: "kernel-sha"}}),
        inspectKernelUpdate: async () => ({revision: frontendRevision, runtimeChanges: []}),
        synchronizeExistingSupervisor: async () => ({kind: "current", revision: frontendRevision}),
        probeKernel: async () => true,
        probePages: async () => [{path: "/", status: 200}],
        runFrontendUpdate: async () => {
            frontendUpdates += 1;
            return {tests: "passed", build: "updated"};
        },
    };

    const operation = await runPostCommitGate(repository.root, runtime);
    assert.equal(frontendUpdates, 1);
    assert.equal(operation.frontend.previousRevision, kernelRevision);
    assert.equal(operation.frontend.activeRevision, frontendRevision);
    assert.equal(operation.kernel.activeRevision, kernelRevision);

    const preCommit = await runPreCommitGate(repository.root, runtime);
    assert.equal(preCommit.head, frontendRevision);
    assert.equal(preCommit.activeRevision, kernelRevision);
});

test("Pre-commit gate blocks runtime drift from the previous commit", async (context) => {
    const repository = createRepository();
    context.after(() => fs.rmSync(repository.root, {recursive: true, force: true}));
    await assert.rejects(runPreCommitGate(repository.root, {
        readOwnership: () => ({port: 6806}),
        probeSupervisor: async () => ({activeVersion: {revision: repository.base}}),
        probeKernel: async () => true,
        fetchImpl: async () => ({ok: true}),
    }), /previous commit Kernel runtime is not active/);
});

test("Pre-commit gate permits staged backend changes when the previous HEAD is active", async (context) => {
    const repository = createRepository();
    context.after(() => fs.rmSync(repository.root, {recursive: true, force: true}));
    fs.writeFileSync(path.join(repository.root, "kernel", "main.go"), "package main\n\nfunc main() { println(1) }\n");
    git(repository.root, ["add", "kernel/main.go"]);

    const result = await runPreCommitGate(repository.root, {
        readOwnership: () => ({port: 6806}),
        probeSupervisor: async () => ({activeVersion: {revision: repository.head}}),
        probeKernel: async () => true,
        fetchImpl: async () => ({ok: true}),
    });

    assert.equal(result.head, repository.head);
});

test("Pre-commit gate blocks unstaged backend source beside a commit", async (context) => {
    const repository = createRepository();
    context.after(() => fs.rmSync(repository.root, {recursive: true, force: true}));
    fs.writeFileSync(path.join(repository.root, "kernel", "main.go"), "package main\n\nfunc main() { println(1) }\n");

    await assert.rejects(runPreCommitGate(repository.root, {
        readOwnership: () => ({port: 6806}),
        probeSupervisor: async () => ({activeVersion: {revision: repository.head}}),
        probeKernel: async () => true,
        fetchImpl: async () => ({ok: true}),
    }), /unstaged or untracked Kernel runtime changes/);
});

test("Hook installation is idempotent and never replaces another hook owner", () => {
    const calls = [];
    const installRun = (_root, args) => {
        calls.push(args);
        return args.includes("--get") ? "" : "";
    };
    assert.equal(installCommitRuntimeHooks("D:/repo", installRun, () => undefined), ".githooks");
    assert.deepEqual(calls.at(-1), ["config", "--local", "core.hooksPath", ".githooks"]);
    assert.throws(() => installCommitRuntimeHooks("D:/repo", () => "custom-hooks", () => undefined), /refusing to replace/);
});

test("Versioned hooks cover ordinary and automatic merge commits", () => {
    const root = path.resolve(__dirname, "../..");
    validateCommitRuntimeHooks(root);
    assert.deepEqual(COMMIT_RUNTIME_HOOKS, {
        "pre-commit": "pre-commit",
        "post-commit": "post-commit",
        "pre-merge-commit": "pre-commit",
        "post-merge": "post-commit",
    });
});

test("Git executes the runtime gate around automatic merge commits", (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "s-forge-hook-integration-"));
    context.after(() => fs.rmSync(root, {recursive: true, force: true}));
    git(root, ["init", "--initial-branch=main"]);
    git(root, ["config", "user.name", "Test Author"]);
    git(root, ["config", "user.email", "test@example.com"]);
    fs.writeFileSync(path.join(root, "base.txt"), "base\n");
    git(root, ["add", "base.txt"]);
    git(root, ["commit", "-m", "base"]);

    const sourceRoot = path.resolve(__dirname, "../..");
    fs.mkdirSync(path.join(root, ".githooks"), {recursive: true});
    for (const hook of Object.keys(COMMIT_RUNTIME_HOOKS)) {
        const target = path.join(root, ".githooks", hook);
        fs.copyFileSync(path.join(sourceRoot, ".githooks", hook), target);
        fs.chmodSync(target, 0o755);
    }
    fs.mkdirSync(path.join(root, "app", "scripts"), {recursive: true});
    fs.writeFileSync(
        path.join(root, "app", "scripts", "forge-commit-runtime-gate.js"),
        "require('node:fs').appendFileSync('hook-events.log', `${process.argv[2]}\\n`);\n",
    );
    git(root, ["config", "core.hooksPath", ".githooks"]);

    git(root, ["switch", "-c", "feature"]);
    fs.writeFileSync(path.join(root, "feature.txt"), "feature\n");
    git(root, ["add", "feature.txt"]);
    git(root, ["commit", "-m", "feature"]);
    git(root, ["switch", "main"]);
    fs.writeFileSync(path.join(root, "main.txt"), "main\n");
    git(root, ["add", "main.txt"]);
    git(root, ["commit", "-m", "main"]);
    fs.writeFileSync(path.join(root, "hook-events.log"), "");

    git(root, ["merge", "--no-ff", "feature", "-m", "merge feature"]);
    assert.deepEqual(
        fs.readFileSync(path.join(root, "hook-events.log"), "utf8").trim().split(/\r?\n/u),
        ["pre-commit", "post-commit"],
    );
});
