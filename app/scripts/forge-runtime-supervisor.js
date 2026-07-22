#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const {spawn} = require("child_process");

const SUPERVISOR_TOKEN_HEADER = "x-s-forge-supervisor-token";
const DEFAULT_RETAINED_VERSIONS = 4;
const MAX_REQUEST_BYTES = 64 * 1024;
const REQUIRED_CORE_TEST_COMMAND = ["go", "test", "-short", "-tags", "fts5", "./..."];
const DEFAULT_PROTECTED_APPROVAL_TIMEOUT = 5 * 60 * 1000;

class CommandFailure extends Error {
    constructor(message, details) {
        super(message);
        this.name = "CommandFailure";
        this.details = details;
    }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const sanitizeIDPart = (value) => value.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);

const executableName = (platform) => platform === "win32" ? "SiYuan-Kernel.exe" : "SiYuan-Kernel";

const isKernelRuntimePath = (filePath) => {
    const normalized = filePath.replace(/\\/g, "/");
    if (!normalized.startsWith("kernel/")) {
        return false;
    }
    if (normalized.endsWith("/go.mod") || normalized.endsWith("/go.sum")) {
        return true;
    }
    if (normalized.endsWith("_test.go")) {
        return false;
    }
    return /\.(go|c|cc|cpp|h|s)$/i.test(normalized);
};

const protectedInfrastructurePaths = new Set([
    "app/package.json",
    "app/scripts/forge-start.js",
    "app/scripts/forge-runtime-supervisor.js",
    "kernel/forge_restart_test_policy.json",
    "kernel/agent/agent.go",
    "kernel/agent/command_review.go",
    "kernel/agent/tools.go",
    "kernel/api/forge_runtime.go",
    "kernel/conf/ai.go",
    "kernel/mcp/tools/forge.go",
    "kernel/mcp/tools/forge_protection.go",
    "kernel/mcp/tools/forge_runtime.go",
    "kernel/util/forge_supervisor.go",
]);

const isProtectedRestartPath = (filePath) => {
    const normalized = filePath.replace(/\\/g, "/").toLowerCase();
    return protectedInfrastructurePaths.has(normalized) ||
        (normalized.startsWith("kernel/") && normalized.endsWith("_test.go"));
};

const parseLines = (value) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

const timingSafeTokenEqual = (actual, expected) => {
    const actualBuffer = Buffer.from(String(actual || ""));
    const expectedBuffer = Buffer.from(String(expected || ""));
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
        options.onOutput?.(chunk.toString(), false);
    });
    child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
        options.onOutput?.(chunk.toString(), true);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
        if (code === 0) {
            resolve({stdout, stderr});
            return;
        }
        reject(new CommandFailure(`${command} exited with code ${code ?? "null"}`, {
            command,
            args,
            code,
            signal,
            stdout,
            stderr,
        }));
    });
});

const writeJSONAtomic = (filePath, value) => {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, filePath);
};

const readRequestJSON = (request) => new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
        body += chunk;
        if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) {
            reject(new Error("request body is too large"));
            request.destroy();
        }
    });
    request.once("end", () => {
        if (!body.trim()) {
            resolve({});
            return;
        }
        try {
            resolve(JSON.parse(body));
        } catch (error) {
            reject(new Error(`invalid JSON: ${error.message}`));
        }
    });
    request.once("error", reject);
});

class ForgeRuntimeSupervisor {
    constructor(options) {
        this.repoRoot = options.repoRoot;
        this.kernelDir = path.join(this.repoRoot, "kernel");
        this.appKernelDir = path.join(this.repoRoot, "app", "kernel");
        this.runtimeDir = options.runtimeDir || path.join(this.repoRoot, ".forge-runtime");
        this.versionsDir = path.join(this.runtimeDir, "versions");
        this.jobsDir = path.join(this.runtimeDir, "jobs");
        this.statePath = path.join(this.runtimeDir, "state.json");
        this.port = String(options.port);
        this.workspace = options.workspace;
        this.noBrowser = Boolean(options.noBrowser);
        this.platform = options.platform || process.platform;
        this.maxVersions = options.maxVersions || DEFAULT_RETAINED_VERSIONS;
        this.protectedApprovalTimeout = options.protectedApprovalTimeout || DEFAULT_PROTECTED_APPROVAL_TIMEOUT;
        this.command = options.command || runCommand;
        this.spawnKernel = options.spawnKernel || this.defaultSpawnKernel.bind(this);
        this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
        this.delay = options.delay || delay;
        this.now = options.now || (() => new Date());
        this.token = options.token || crypto.randomBytes(32).toString("hex");
        this.activeVersion = undefined;
        this.kernelProcess = undefined;
        this.currentJob = undefined;
        this.controlServer = undefined;
        this.controlURL = "";
        this.switching = false;
        this.recovering = false;
        this.closing = false;
        this.expectedKernelExit = false;
        this.pendingProtectedApproval = undefined;
    }

    async initialize() {
        fs.mkdirSync(this.versionsDir, {recursive: true});
        fs.mkdirSync(this.jobsDir, {recursive: true});
        await this.startControlServer();
        try {
            const revision = await this.gitOutput(["rev-parse", "HEAD"]);
            const version = await this.buildVersion(revision, "initial");
            await this.launchAndRequireHealthy(version, !this.noBrowser);
            this.markVersionState(version, "healthy");
            this.activeVersion = version;
            this.persistState();
            this.cleanupVersions();
            return this.status();
        } catch (error) {
            await this.terminateKernelProcess();
            await this.close();
            throw error;
        }
    }

    async startControlServer() {
        this.controlServer = http.createServer((request, response) => {
            void this.handleControlRequest(request, response);
        });
        await new Promise((resolve, reject) => {
            this.controlServer.once("error", reject);
            this.controlServer.listen(0, "127.0.0.1", resolve);
        });
        const address = this.controlServer.address();
        if (!address || typeof address === "string") {
            throw new Error("supervisor control server did not expose a TCP address");
        }
        this.controlURL = `http://127.0.0.1:${address.port}`;
    }

    async close() {
        this.closing = true;
        if (this.controlServer) {
            await new Promise((resolve) => this.controlServer.close(resolve));
        }
    }

    status() {
        return {
            mode: "forge-source-supervisor",
            activeVersion: this.activeVersion || null,
            job: this.currentJob || null,
            retainedVersions: this.listVersions(),
        };
    }

    async handleControlRequest(request, response) {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        if (!timingSafeTokenEqual(request.headers[SUPERVISOR_TOKEN_HEADER], this.token)) {
            response.statusCode = 401;
            response.end(JSON.stringify({error: "invalid supervisor token"}));
            return;
        }
        if (request.method === "GET" && request.url === "/status") {
            response.end(JSON.stringify(this.status()));
            return;
        }
        if (request.method === "POST" && request.url === "/approve-protected-tests") {
            try {
                const body = await readRequestJSON(request);
                const approval = this.approveProtectedTests(body.jobId, body.revision);
                response.end(JSON.stringify({approval}));
            } catch (error) {
                response.statusCode = 409;
                response.end(JSON.stringify({error: error.message}));
            }
            return;
        }
        if (request.method !== "POST" || request.url !== "/restart") {
            response.statusCode = 404;
            response.end(JSON.stringify({error: "unknown supervisor endpoint"}));
            return;
        }
        if (this.currentJob && !["failed", "completed", "rolled_back"].includes(this.currentJob.state)) {
            response.statusCode = 409;
            response.end(JSON.stringify({error: "a restart job is already running", job: this.currentJob}));
            return;
        }
        try {
            const body = await readRequestJSON(request);
            const job = this.createJob(typeof body.reason === "string" ? body.reason : "");
            response.statusCode = 202;
            response.end(JSON.stringify({job}));
            setImmediate(() => void this.runRestart(job));
        } catch (error) {
            response.statusCode = 400;
            response.end(JSON.stringify({error: error.message}));
        }
    }

    createJob(reason) {
        const createdAt = this.now().toISOString();
        const id = sanitizeIDPart(`${createdAt}-${crypto.randomBytes(4).toString("hex")}`);
        this.currentJob = {
            id,
            state: "queued",
            phase: "queued",
            reason: reason.trim().slice(0, 1000),
            createdAt,
            updatedAt: createdAt,
            error: "",
            logPath: `jobs/${id}.log`,
        };
        this.writeJobLog(`restart queued: ${this.currentJob.reason || "no reason supplied"}`);
        this.persistState();
        return this.currentJob;
    }

    async runRestart(job) {
        try {
            this.updateJob(job, "running", "git_preflight");
            const source = await this.validateRestartSource();
            await this.requireProtectedTestApproval(job, source);
            this.updateJob(job, "running", "gofmt");
            await this.requireGoFormat();
            this.updateJob(job, "running", "go_vet");
            await this.runLogged("go", ["vet", "-tags", "fts5", "./..."], this.kernelDir);
            this.updateJob(job, "running", "core_test_policy");
            const coreTestCommand = this.loadCoreTestPolicy();
            this.updateJob(job, "running", "go_test_core");
            await this.runLogged(coreTestCommand[0], coreTestCommand.slice(1), this.kernelDir);
            this.updateJob(job, "running", "source_recheck");
            await this.requireStableCleanRevision(source.revision);
            this.updateJob(job, "running", "build_candidate");
            const candidate = await this.buildVersion(source.revision, "candidate");
            this.updateJob(job, "running", "switch_kernel");
            await this.switchToCandidate(candidate);
            this.updateJob(job, "completed", "completed");
            this.cleanupVersions();
        } catch (error) {
            const message = this.describeError(error);
            this.writeJobLog(`restart failed: ${message}`);
            if (job.state === "rolled_back") {
                this.updateJob(job, "rolled_back", "rollback", message);
                this.cleanupVersions();
                return;
            }
            this.updateJob(job, "failed", job.phase, message);
            this.cleanupVersions();
        }
    }

    async validateRestartSource() {
        if (!this.activeVersion) {
            throw new Error("active kernel version is not recorded");
        }
        const status = await this.gitOutput(["status", "--porcelain", "--untracked-files=all"]);
        if (status) {
            throw new Error(`Git worktree is not clean:\n${status}`);
        }
        const revision = await this.gitOutput(["rev-parse", "HEAD"]);
        if (revision === this.activeVersion.revision) {
            throw new Error("current HEAD is already running; create a verified commit before restarting");
        }
        const changed = parseLines(await this.gitOutput(["diff", "--name-only", `${this.activeVersion.revision}..${revision}`, "--"]));
        const runtimeChanges = changed.filter(isKernelRuntimePath);
        if (runtimeChanges.length === 0) {
            throw new Error("commits since the running version contain no Kernel runtime source changes");
        }
        const protectedChanges = changed.filter(isProtectedRestartPath);
        this.writeJobLog(`source revision ${revision}; kernel runtime changes: ${runtimeChanges.join(", ")}`);
        return {revision, changed, runtimeChanges, protectedChanges};
    }

    async requireProtectedTestApproval(job, source) {
        if (source.protectedChanges.length === 0) {
            return;
        }
        const deadline = new Date(Date.now() + this.protectedApprovalTimeout).toISOString();
        job.protectedTestApproval = {
            state: "pending",
            revision: source.revision,
            paths: source.protectedChanges,
            deadline,
        };
        this.updateJob(job, "awaiting_protected_test_approval", "protected_test_approval");
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pendingProtectedApproval?.jobId === job.id) {
                    this.pendingProtectedApproval = undefined;
                }
                reject(new Error("protected test approval timed out"));
            }, this.protectedApprovalTimeout);
            this.pendingProtectedApproval = {
                jobId: job.id,
                revision: source.revision,
                resolve: () => {
                    clearTimeout(timeout);
                    resolve();
                },
            };
        });
        job.protectedTestApproval.state = "approved";
        job.protectedTestApproval.approvedAt = this.now().toISOString();
        this.updateJob(job, "running", "protected_test_approved");
    }

    approveProtectedTests(jobId, revision) {
        const pending = this.pendingProtectedApproval;
        if (!pending || pending.jobId !== jobId || pending.revision !== revision) {
            throw new Error("no matching protected test approval is pending");
        }
        this.pendingProtectedApproval = undefined;
        pending.resolve();
        return {jobId, revision, state: "approved"};
    }

    loadCoreTestPolicy() {
        const policyPath = path.join(this.kernelDir, "forge_restart_test_policy.json");
        const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
        const commandMatches = Array.isArray(policy.command) &&
            policy.command.length === REQUIRED_CORE_TEST_COMMAND.length &&
            policy.command.every((value, index) => value === REQUIRED_CORE_TEST_COMMAND[index]);
        if (policy.schemaVersion !== 1 || policy.scope !== "all-packages" || !commandMatches) {
            throw new Error("core restart test policy was narrowed or is invalid");
        }
        return [...policy.command];
    }

    async requireGoFormat() {
        const files = parseLines(await this.gitOutput(["ls-files", "--", "kernel/*.go", "kernel/**/*.go"]));
        const batchSize = 100;
        const unformatted = [];
        for (let index = 0; index < files.length; index += batchSize) {
            const batch = files.slice(index, index + batchSize).map((file) => path.join(this.repoRoot, file));
            if (batch.length === 0) {
                continue;
            }
            const result = await this.command("gofmt", ["-l", ...batch], {cwd: this.repoRoot});
            unformatted.push(...parseLines(result.stdout));
        }
        if (unformatted.length > 0) {
            throw new Error(`gofmt check failed:\n${unformatted.join("\n")}`);
        }
    }

    async requireStableCleanRevision(expectedRevision) {
        const actualRevision = await this.gitOutput(["rev-parse", "HEAD"]);
        if (actualRevision !== expectedRevision) {
            throw new Error(`HEAD changed during validation: expected ${expectedRevision}, got ${actualRevision}`);
        }
        const status = await this.gitOutput(["status", "--porcelain", "--untracked-files=all"]);
        if (status) {
            throw new Error(`Git worktree changed during validation:\n${status}`);
        }
    }

    async buildVersion(revision, kind) {
        const createdAt = this.now().toISOString();
        const id = sanitizeIDPart(`${createdAt}-${revision.slice(0, 12)}-${kind}`);
        const versionDir = path.join(this.versionsDir, id);
        fs.mkdirSync(versionDir, {recursive: true});
        const binaryPath = path.join(versionDir, executableName(this.platform));
        await this.runLogged("go", ["build", "-tags", "fts5", "-o", binaryPath, "."], this.kernelDir);
        await this.runLogged(binaryPath, ["--version"], this.kernelDir);
        const digest = crypto.createHash("sha256").update(fs.readFileSync(binaryPath)).digest("hex");
        const version = {id, revision, kind, state: "built", createdAt, binaryPath, sha256: digest};
        writeJSONAtomic(path.join(versionDir, "version.json"), version);
        return version;
    }

    async switchToCandidate(candidate) {
        const previous = this.activeVersion;
        if (!previous) {
            throw new Error("cannot switch without an active version");
        }
        this.switching = true;
        try {
            await this.requestGracefulKernelShutdown();
            await this.waitForKernelExit(30_000);
            try {
                await this.launchAndRequireHealthy(candidate, false);
                this.markVersionState(candidate, "healthy");
                this.activeVersion = candidate;
                this.persistState();
                this.writeJobLog(`candidate promoted: ${candidate.id}`);
            } catch (candidateError) {
                this.writeJobLog(`candidate health check failed: ${this.describeError(candidateError)}`);
                this.markVersionState(candidate, "failed", this.describeError(candidateError));
                await this.terminateKernelProcess();
                await this.launchAndRequireHealthy(previous, false);
                this.activeVersion = previous;
                this.persistState();
                this.updateJob(this.currentJob, "rolled_back", "rollback", this.describeError(candidateError));
                throw new Error(`candidate failed health check; previous version restored: ${this.describeError(candidateError)}`);
            }
        } finally {
            this.switching = false;
        }
    }

    async launchAndRequireHealthy(version, openBrowser) {
        this.kernelProcess = this.spawnKernel(version.binaryPath, this.kernelArguments(openBrowser), this.kernelEnvironment());
        const launchedProcess = this.kernelProcess;
        launchedProcess.once("exit", (code, signal) => {
            if (this.kernelProcess === launchedProcess) {
                this.kernelProcess = undefined;
            }
            const expected = this.expectedKernelExit;
            this.expectedKernelExit = false;
            if (!this.switching && !expected) {
                if (code === 0 && signal === null) {
                    console.log("[forge] kernel exited normally; stopping Forge supervisor");
                    void this.close();
                    return;
                }
                console.error(`[forge] kernel exited unexpectedly: code=${code}, signal=${signal}`);
                void this.recoverActiveVersionAfterUnexpectedExit(version);
            }
        });
        await this.waitForHealth(90_000, launchedProcess);
    }

    async recoverActiveVersionAfterUnexpectedExit(exitedVersion) {
        if (this.closing || this.switching || this.recovering || this.kernelProcess ||
            !this.activeVersion || this.activeVersion.id !== exitedVersion.id) {
            return;
        }
        this.recovering = true;
        try {
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                if (this.closing || this.switching || this.kernelProcess) {
                    return;
                }
                try {
                    console.error(`[forge] restoring active kernel version ${this.activeVersion.id}, attempt ${attempt}/3`);
                    await this.launchAndRequireHealthy(this.activeVersion, false);
                    console.log(`[forge] active kernel version restored: ${this.activeVersion.id}`);
                    return;
                } catch (error) {
                    console.error(`[forge] active kernel restore attempt ${attempt} failed: ${this.describeError(error)}`);
                    await this.terminateKernelProcess();
                    if (attempt < 3) {
                        await this.delay(attempt * 1_000);
                    }
                }
            }
            console.error(`[forge] active kernel version ${this.activeVersion.id} could not be restored after 3 attempts`);
        } finally {
            this.recovering = false;
        }
    }

    defaultSpawnKernel(binaryPath, args, env) {
        return spawn(binaryPath, args, {
            cwd: this.appKernelDir,
            env,
            stdio: "inherit",
            windowsHide: false,
        });
    }

    kernelArguments(openBrowser) {
        const args = [
            "serve",
            "--wd=..",
            "--mode=forge",
            `--port=${this.port}`,
            `--workspace=${this.workspace}`,
        ];
        if (!openBrowser) {
            args.push("--no-browser");
        }
        return args;
    }

    kernelEnvironment() {
        return {
            ...process.env,
            S_FORGE_SUPERVISOR_URL: this.controlURL,
            S_FORGE_SUPERVISOR_TOKEN: this.token,
            S_FORGE_SOURCE_ROOT: this.repoRoot,
        };
    }

    async requestGracefulKernelShutdown() {
        const response = await this.fetchImpl(`http://127.0.0.1:${this.port}/api/s-forge/forge/runtime/shutdown`, {
            method: "POST",
            headers: {[SUPERVISOR_TOKEN_HEADER]: this.token},
        });
        if (!response.ok) {
            throw new Error(`kernel rejected graceful shutdown with HTTP ${response.status}`);
        }
        this.expectedKernelExit = true;
    }

    async waitForKernelExit(timeoutMilliseconds) {
        const child = this.kernelProcess;
        if (!child || child.exitCode !== null) {
            return;
        }
        await Promise.race([
            new Promise((resolve) => child.once("exit", resolve)),
            this.delay(timeoutMilliseconds).then(() => {
                throw new Error(`kernel did not exit within ${timeoutMilliseconds}ms`);
            }),
        ]);
    }

    async terminateKernelProcess() {
        const child = this.kernelProcess;
        if (!child || child.exitCode !== null) {
            return;
        }
        this.expectedKernelExit = true;
        child.kill();
        await Promise.race([
            new Promise((resolve) => child.once("exit", resolve)),
            this.delay(5_000),
        ]);
    }

    async waitForHealth(timeoutMilliseconds, child) {
        const deadline = Date.now() + timeoutMilliseconds;
        let lastError = "health endpoint did not respond";
        while (Date.now() < deadline) {
            if (child.exitCode !== null) {
                throw new Error(`kernel exited before becoming healthy with code ${child.exitCode}`);
            }
            try {
                const bootResponse = await this.fetchImpl(`http://127.0.0.1:${this.port}/api/system/bootProgress`, {
                    signal: AbortSignal.timeout(2_000),
                });
                if (!bootResponse.ok) {
                    lastError = `boot progress endpoint returned HTTP ${bootResponse.status}`;
                    await this.delay(500);
                    continue;
                }
                const bootPayload = await bootResponse.json();
                if (!bootPayload || bootPayload.code !== 0 || Number(bootPayload.data?.progress) < 100) {
                    lastError = `kernel boot progress is ${bootPayload?.data?.progress ?? "unknown"}`;
                    await this.delay(500);
                    continue;
                }
                const versionResponse = await this.fetchImpl(`http://127.0.0.1:${this.port}/api/system/version`, {
                    signal: AbortSignal.timeout(2_000),
                });
                if (!versionResponse.ok) {
                    lastError = `version endpoint returned HTTP ${versionResponse.status}`;
                    await this.delay(500);
                    continue;
                }
                const versionPayload = await versionResponse.json();
                if (versionPayload && versionPayload.code === 0 && typeof versionPayload.data === "string" && versionPayload.data) {
                    return;
                }
                lastError = "version endpoint returned an invalid payload";
            } catch (error) {
                lastError = error.message;
            }
            await this.delay(500);
        }
        throw new Error(`kernel health check timed out: ${lastError}`);
    }

    async gitOutput(args) {
        const result = await this.command("git", args, {cwd: this.repoRoot});
        return result.stdout.trim();
    }

    async runLogged(command, args, cwd) {
        this.writeJobLog(`run: ${command} ${args.join(" ")}`);
        return this.command(command, args, {
            cwd,
            onOutput: (output, isError) => this.writeJobLog(`${isError ? "stderr" : "stdout"}: ${output.trimEnd()}`),
        });
    }

    updateJob(job, state, phase, error = "") {
        if (!job) {
            return;
        }
        job.state = state;
        job.phase = phase;
        job.error = error;
        job.updatedAt = this.now().toISOString();
        this.writeJobLog(`state=${state} phase=${phase}${error ? ` error=${error}` : ""}`);
        this.persistState();
    }

    writeJobLog(message) {
        if (!this.currentJob) {
            console.log(`[forge] ${message}`);
            return;
        }
        const line = `[${this.now().toISOString()}] ${message}\n`;
        fs.appendFileSync(path.join(this.jobsDir, `${this.currentJob.id}.log`), line, "utf8");
        if (/^(restart queued|state=|restart failed|candidate)/.test(message)) {
            console.log(`[forge] ${message}`);
        }
    }

    persistState() {
        writeJSONAtomic(this.statePath, this.status());
    }

    markVersionState(version, state, error = "") {
        version.state = state;
        version.error = error;
        writeJSONAtomic(path.join(this.versionsDir, version.id, "version.json"), version);
    }

    listVersions() {
        if (!fs.existsSync(this.versionsDir)) {
            return [];
        }
        return fs.readdirSync(this.versionsDir, {withFileTypes: true})
            .filter((entry) => entry.isDirectory())
            .map((entry) => {
                try {
                    return JSON.parse(fs.readFileSync(path.join(this.versionsDir, entry.name, "version.json"), "utf8"));
                } catch (error) {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    cleanupVersions() {
        const versions = this.listVersions();
        const protectedIDs = new Set([this.activeVersion?.id].filter(Boolean));
        const kept = [];
        for (const version of versions) {
            const isHealthy = version.state === "healthy" || version.state === undefined;
            if (protectedIDs.has(version.id) || (isHealthy && kept.length < this.maxVersions)) {
                kept.push(version);
                continue;
            }
            fs.rmSync(path.join(this.versionsDir, version.id), {recursive: true, force: true});
        }
    }

    describeError(error) {
        if (error instanceof CommandFailure) {
            const stderr = error.details?.stderr?.trim();
            const stdout = error.details?.stdout?.trim();
            return [error.message, stderr, stdout].filter(Boolean).join("\n");
        }
        return error instanceof Error ? error.message : String(error);
    }
}

module.exports = {
    CommandFailure,
    ForgeRuntimeSupervisor,
    SUPERVISOR_TOKEN_HEADER,
    executableName,
    isKernelRuntimePath,
    parseLines,
    timingSafeTokenEqual,
    isProtectedRestartPath,
};
