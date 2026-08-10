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
const RESTART_POLICY_RELATIVE_PATH = "kernel/forge_restart_test_policy.json";

class CommandFailure extends Error {
    constructor(message, details) {
        super(message);
        this.name = "CommandFailure";
        this.details = details;
    }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const sanitizeIDPart = (value) => value.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);

const versionContext = (version) => version ? {
    id: version.id || null,
    revision: version.revision || null,
    kind: version.kind || null,
    state: version.state || null,
    binaryPath: version.binaryPath || null,
    sha256: version.sha256 || null,
} : null;

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

const normalizePolicyEntry = (entry, kind) => {
    if (typeof entry !== "string" || entry === "" || entry.includes("\\") ||
        entry.includes(":") || /[\u0000-\u001f]/.test(entry)) {
        throw new Error(`${kind} contains an invalid repository-relative path`);
    }
    const requiresTrailingSlash = kind === "protectedPrefixes";
    if (requiresTrailingSlash !== entry.endsWith("/")) {
        throw new Error(`${kind} entry has an invalid trailing slash: ${entry}`);
    }
    const pathPart = requiresTrailingSlash ? entry.slice(0, -1) : entry;
    const normalized = path.posix.normalize(pathPart);
    if (!pathPart || normalized !== pathPart || normalized === "." || normalized === ".." ||
        normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
        throw new Error(`${kind} entry escapes or is not normalized: ${entry}`);
    }
    return requiresTrailingSlash ? `${normalized}/` : normalized;
};

const validateOrderedPolicyEntries = (entries, kind) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error(`${kind} must be a non-empty array`);
    }
    const normalized = entries.map((entry) => normalizePolicyEntry(entry, kind));
    const folded = normalized.map((entry) => entry.toLowerCase());
    const sorted = [...folded].sort();
    if (new Set(folded).size !== folded.length || folded.some((entry, index) => entry !== sorted[index])) {
        throw new Error(`${kind} must be case-insensitively unique and sorted`);
    }
    return normalized;
};

const validateRestartPolicy = (policy) => {
    const expectedKeys = [
        "command",
        "coreDefinition",
        "protectedPaths",
        "protectedPrefixes",
        "schemaVersion",
        "scope",
    ];
    const actualKeys = policy && typeof policy === "object" && !Array.isArray(policy) ?
        Object.keys(policy).sort() : [];
    const commandMatches = Array.isArray(policy?.command) &&
        policy.command.length === REQUIRED_CORE_TEST_COMMAND.length &&
        policy.command.every((value, index) => value === REQUIRED_CORE_TEST_COMMAND[index]);
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index]) ||
        policy?.schemaVersion !== 2 || policy.scope !== "all-packages" || !commandMatches ||
        typeof policy.coreDefinition !== "string" || policy.coreDefinition.trim() === "") {
        throw new Error("core restart test policy was narrowed or is invalid");
    }
    return {
        schemaVersion: policy.schemaVersion,
        scope: policy.scope,
        command: [...policy.command],
        protectedPaths: validateOrderedPolicyEntries(policy.protectedPaths, "protectedPaths"),
        protectedPrefixes: validateOrderedPolicyEntries(policy.protectedPrefixes, "protectedPrefixes"),
        coreDefinition: policy.coreDefinition,
    };
};

const readRestartPolicy = (repoRoot, readFile = fs.readFileSync) => {
    const policyPath = path.join(repoRoot, ...RESTART_POLICY_RELATIVE_PATH.split("/"));
    try {
        return validateRestartPolicy(JSON.parse(readFile(policyPath, "utf8")));
    } catch (error) {
        throw new Error(`invalid Forge restart policy ${policyPath}: ${error.message}`);
    }
};

const policyProtectsPath = (policy, normalizedPath) => {
    const folded = normalizedPath.toLowerCase();
    return policy.protectedPaths.some((entry) => entry.toLowerCase() === folded) ||
        policy.protectedPrefixes.some((prefix) => folded.startsWith(prefix.toLowerCase()));
};

const isProtectedRestartPath = (filePath, policy) => {
    if (!policy) {
        throw new Error("Forge restart policy is required for protected-path classification");
    }
    const normalized = String(filePath).replace(/\\/g, "/");
    return normalized.toLowerCase() === RESTART_POLICY_RELATIVE_PATH ||
        (normalized.toLowerCase().startsWith("kernel/") && normalized.toLowerCase().endsWith("_test.go")) ||
        policyProtectsPath(policy, normalized);
};

const assertRestartPolicyNotNarrowed = (current, baseline) => {
    const missingPaths = baseline.protectedPaths.filter((entry) => !policyProtectsPath(current, entry));
    const missingPrefixes = baseline.protectedPrefixes.filter((entry) =>
        !current.protectedPrefixes.some((prefix) => entry.toLowerCase().startsWith(prefix.toLowerCase())));
    if (missingPaths.length > 0 || missingPrefixes.length > 0) {
        throw new Error(`Forge restart policy protection was narrowed; missing paths=[${missingPaths.join(", ")}] prefixes=[${missingPrefixes.join(", ")}]`);
    }
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
        stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
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
    if (options.input !== undefined) {
        child.stdin.end(options.input);
    }
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
        this.incidentsDir = path.join(this.runtimeDir, "incidents");
        this.statePath = path.join(this.runtimeDir, "state.json");
        this.ownershipPath = path.join(this.runtimeDir, "supervisor.json");
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
        this.cliToken = options.cliToken || crypto.randomBytes(32).toString("hex");
        this.activeVersion = undefined;
        this.kernelProcess = undefined;
        this.currentJob = undefined;
        this.latestIncident = undefined;
        this.controlServer = undefined;
        this.controlURL = "";
        this.switching = false;
        this.recovering = false;
        this.closing = false;
        this.expectedKernelExit = false;
        this.pendingProtectedApproval = undefined;
        this.ownsRuntime = false;
        this.lifecycle = "initializing";
        this.lifecycleError = "";
    }

    async initialize() {
        this.lifecycle = "initializing";
        this.lifecycleError = "";
        const restartPolicy = this.loadRestartPolicy();
        fs.mkdirSync(this.versionsDir, {recursive: true});
        fs.mkdirSync(this.jobsDir, {recursive: true});
        fs.mkdirSync(this.incidentsDir, {recursive: true});
        await this.startControlServer();
        try {
            this.claimRuntimeOwnership();
            const revision = await this.gitOutput(["rev-parse", "HEAD"]);
            const version = await this.buildVersion(revision, "initial", restartPolicy);
            await this.launchAndRequireHealthy(version, !this.noBrowser);
            this.markVersionState(version, "healthy");
            this.activeVersion = version;
            this.lifecycle = "ready";
            this.persistState();
            this.cleanupVersions();
            return this.status();
        } catch (error) {
            this.lifecycle = "failed";
            this.lifecycleError = this.describeError(error);
            if (this.ownsRuntime) {
                this.persistState();
            }
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
        if (this.lifecycle !== "failed") {
            this.lifecycle = "closing";
            this.lifecycleError = "";
        }
        if (this.controlServer) {
            await new Promise((resolve) => this.controlServer.close(resolve));
        }
        this.releaseRuntimeOwnership();
    }

    status() {
        const kernelRunning = Boolean(this.kernelProcess && this.kernelProcess.exitCode == null);
        return {
            mode: "forge-source-supervisor",
            lifecycle: this.lifecycle,
            ready: this.lifecycle === "ready" && Boolean(this.activeVersion) && kernelRunning,
            lifecycleError: this.lifecycleError || null,
            processId: process.pid,
            repoRoot: this.repoRoot,
            workspace: this.workspace,
            port: Number(this.port),
            activeVersion: this.activeVersion || null,
            job: this.currentJob || null,
            latestIncident: this.latestIncident || null,
            retainedVersions: this.listVersions(),
        };
    }

    claimRuntimeOwnership() {
        const ownership = {
            schemaVersion: 1,
            processId: process.pid,
            repoRoot: this.repoRoot,
            workspace: this.workspace,
            port: Number(this.port),
            controlURL: this.controlURL,
            cliToken: this.cliToken,
            startedAt: this.now().toISOString(),
        };
        let descriptor;
        try {
            descriptor = fs.openSync(this.ownershipPath, "wx", 0o600);
            fs.writeFileSync(descriptor, `${JSON.stringify(ownership, null, 2)}\n`, "utf8");
            this.ownsRuntime = true;
        } catch (error) {
            if (error.code === "EEXIST") {
                throw new Error(`Forge runtime ownership already exists at ${this.ownershipPath}`);
            }
            if (descriptor !== undefined) {
                fs.rmSync(this.ownershipPath, {force: true});
            }
            throw error;
        } finally {
            if (descriptor !== undefined) {
                fs.closeSync(descriptor);
            }
        }
    }

    releaseRuntimeOwnership() {
        if (!this.ownsRuntime) {
            return;
        }
        try {
            const ownership = JSON.parse(fs.readFileSync(this.ownershipPath, "utf8"));
            if (timingSafeTokenEqual(ownership.cliToken, this.cliToken)) {
                fs.rmSync(this.ownershipPath, {force: true});
            }
        } finally {
            this.ownsRuntime = false;
        }
    }

    async handleControlRequest(request, response) {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        const suppliedToken = request.headers[SUPERVISOR_TOKEN_HEADER];
        const hasSupervisorToken = timingSafeTokenEqual(suppliedToken, this.token);
        const hasCLIToken = timingSafeTokenEqual(suppliedToken, this.cliToken);
        if (!hasSupervisorToken && !hasCLIToken) {
            response.statusCode = 401;
            response.end(JSON.stringify({error: "invalid supervisor token"}));
            return;
        }
        const cliAllowed = (request.method === "GET" && request.url === "/status") ||
            (request.method === "POST" && request.url === "/restart");
        if (!hasSupervisorToken && !cliAllowed) {
            response.statusCode = 403;
            response.end(JSON.stringify({error: "CLI credential is not permitted for this Supervisor action"}));
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
        if (request.method === "POST" && request.url === "/reject-protected-tests") {
            try {
                const body = await readRequestJSON(request);
                const approval = this.rejectProtectedTests(body.jobId, body.revision);
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
            await this.requireGoFormat(source);
            this.updateJob(job, "running", "go_vet");
            await this.runLogged("go", ["vet", "-tags", "fts5", "./..."], this.kernelDir);
            this.updateJob(job, "running", "core_test_policy");
            const coreTestCommand = source.restartPolicy.command;
            this.updateJob(job, "running", "go_test_core");
            await this.runLogged(coreTestCommand[0], coreTestCommand.slice(1), this.kernelDir);
            this.updateJob(job, "running", "source_recheck");
            await this.requireStableCleanRevision(source.revision);
            this.updateJob(job, "running", "build_candidate");
            const candidate = await this.buildVersion(source.revision, "candidate", source.restartPolicy);
            this.updateJob(job, "running", "switch_kernel");
            await this.switchToCandidate(candidate, job);
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
        const restartPolicy = this.loadRestartPolicy();
        if (!this.activeVersion.restartPolicy) {
            throw new Error("active kernel version does not record its Forge restart policy");
        }
        const baselinePolicy = validateRestartPolicy(this.activeVersion.restartPolicy);
        assertRestartPolicyNotNarrowed(restartPolicy, baselinePolicy);
        const protectedChanges = changed.filter((filePath) => isProtectedRestartPath(filePath, restartPolicy));
        this.writeJobLog(`source revision ${revision}; kernel runtime changes: ${runtimeChanges.join(", ")}`);
        return {revision, changed, runtimeChanges, protectedChanges, restartPolicy};
    }

    async requireProtectedTestApproval(job, source) {
        if (source.protectedChanges.length === 0) {
            return;
        }
        const deadline = new Date(this.now().getTime() + this.protectedApprovalTimeout).toISOString();
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
                    job.protectedTestApproval.state = "expired";
                    job.protectedTestApproval.expiredAt = this.now().toISOString();
                    this.persistState();
                }
                reject(new Error("protected test approval timed out"));
            }, this.protectedApprovalTimeout);
            this.pendingProtectedApproval = {
                jobId: job.id,
                revision: source.revision,
                job,
                resolve: () => {
                    clearTimeout(timeout);
                    resolve();
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
            };
        });
        this.updateJob(job, "running", "protected_test_approved");
    }

    approveProtectedTests(jobId, revision) {
        const pending = this.requirePendingProtectedApproval(jobId, revision);
        this.pendingProtectedApproval = undefined;
        pending.job.protectedTestApproval.state = "approved";
        pending.job.protectedTestApproval.approvedAt = this.now().toISOString();
        this.persistState();
        pending.resolve();
        return {jobId, revision, state: "approved"};
    }

    rejectProtectedTests(jobId, revision) {
        const pending = this.requirePendingProtectedApproval(jobId, revision);
        this.pendingProtectedApproval = undefined;
        pending.job.protectedTestApproval.state = "rejected";
        pending.job.protectedTestApproval.rejectedAt = this.now().toISOString();
        this.persistState();
        pending.reject(new Error("protected test approval rejected by user"));
        return {jobId, revision, state: "rejected"};
    }

    requirePendingProtectedApproval(jobId, revision) {
        const pending = this.pendingProtectedApproval;
        const currentApproval = this.currentJob?.protectedTestApproval;
        if (!pending || pending.job !== this.currentJob || pending.jobId !== jobId || pending.revision !== revision ||
            this.currentJob?.state !== "awaiting_protected_test_approval" ||
            this.currentJob?.phase !== "protected_test_approval" || currentApproval?.state !== "pending" ||
            currentApproval?.revision !== revision) {
            throw new Error("no matching protected test approval is pending");
        }
        return pending;
    }

    loadRestartPolicy() {
        return readRestartPolicy(this.repoRoot);
    }

    async requireGoFormat(source) {
        const files = source.changed
            .map((filePath) => filePath.replace(/\\/g, "/"))
            .filter((filePath) => filePath.startsWith("kernel/") && filePath.endsWith(".go"))
            .filter((filePath) => fs.existsSync(path.join(this.repoRoot, filePath)));
        const unformatted = [];
        for (const filePath of files) {
            const sourcePath = path.join(this.repoRoot, filePath);
            const normalizedSource = fs.readFileSync(sourcePath, "utf8").replace(/\r\n?/g, "\n");
            let formatted;
            try {
                formatted = await this.command("gofmt", [], {cwd: this.repoRoot, input: normalizedSource});
            } catch (error) {
                throw new Error(`gofmt failed for ${filePath}: ${this.describeError(error)}`);
            }
            if (formatted.stdout !== normalizedSource) {
                unformatted.push(filePath);
            }
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

    async buildVersion(revision, kind, restartPolicy = this.loadRestartPolicy()) {
        const createdAt = this.now().toISOString();
        const id = sanitizeIDPart(`${createdAt}-${revision.slice(0, 12)}-${kind}`);
        const versionDir = path.join(this.versionsDir, id);
        fs.mkdirSync(versionDir, {recursive: true});
        const binaryPath = path.join(versionDir, executableName(this.platform));
        await this.runLogged("go", ["build", "-tags", "fts5", "-o", binaryPath, "."], this.kernelDir);
        await this.runLogged(binaryPath, ["--version"], this.kernelDir);
        const digest = crypto.createHash("sha256").update(fs.readFileSync(binaryPath)).digest("hex");
        const version = {
            id,
            revision,
            kind,
            state: "built",
            createdAt,
            binaryPath,
            sha256: digest,
            restartPolicy,
        };
        writeJSONAtomic(path.join(versionDir, "version.json"), version);
        return version;
    }

    async switchToCandidate(candidate, job) {
        const previous = this.activeVersion;
        if (!previous) {
            throw new Error("cannot switch without an active version");
        }
        this.switching = true;
        this.lifecycle = "restarting";
        this.lifecycleError = "";
        this.persistState();
        try {
            await this.requestGracefulKernelShutdown(job, candidate);
            await this.waitForKernelExit(30_000);
            try {
                await this.launchAndRequireHealthy(candidate, false);
                this.markVersionState(candidate, "healthy");
                this.activeVersion = candidate;
                this.lifecycle = "ready";
                this.persistState();
                this.writeJobLog(`candidate promoted: ${candidate.id}`);
            } catch (candidateError) {
                const error = this.describeError(candidateError);
                this.writeJobLog(`candidate health check failed: ${error}`);
                this.markVersionState(candidate, "failed", error);
                const delegatedCrash = this.latestIncident?.state === "delegated" &&
                    this.latestIncident.failedVersion?.id === candidate.id ? this.latestIncident : null;
                const incident = delegatedCrash || this.createIncident("candidate-health-failure", {
                    failedVersion: versionContext(candidate),
                    previousVersion: versionContext(previous),
                    error,
                    recoveryOwner: "candidate-switch",
                });
                if (delegatedCrash) {
                    this.updateIncident(incident, {
                        kind: "candidate-crash",
                        previousVersion: versionContext(previous),
                        error,
                    }, `candidate crash entered rollback: ${error}`);
                }
                await this.terminateKernelProcess();
                try {
                    await this.launchAndRequireHealthy(previous, false);
                    this.activeVersion = previous;
                    this.lifecycle = "ready";
                    this.persistState();
                    this.updateIncident(incident, {
                        state: "recovered",
                        outcome: "previous-version-restored",
                        restoredVersion: versionContext(previous),
                    }, `previous version restored: ${previous.id}`);
                } catch (recoveryError) {
                    const recoveryMessage = this.describeError(recoveryError);
                    this.lifecycle = "failed";
                    this.lifecycleError = recoveryMessage;
                    this.persistState();
                    this.updateIncident(incident, {
                        state: "unrecovered",
                        outcome: "previous-version-restore-failed",
                        recoveryError: recoveryMessage,
                    }, `previous version restore failed: ${recoveryMessage}`);
                    throw recoveryError;
                }
                this.updateJob(this.currentJob, "rolled_back", "rollback", error);
                throw new Error(`candidate failed health check; previous version restored: ${error}`);
            }
        } finally {
            this.switching = false;
            if (this.lifecycle === "restarting" && this.kernelProcess && this.kernelProcess.exitCode == null) {
                this.lifecycle = "ready";
                this.lifecycleError = "";
                this.persistState();
            }
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
            const crashed = !expected && !(code === 0 && signal === null);
            const incident = crashed ? this.createIncident("kernel-crash", {
                failedVersion: versionContext(version),
                processId: launchedProcess.pid || null,
                exitCode: code,
                signal: signal || null,
                recoveryOwner: this.switching ? "candidate-switch" : "active-version-recovery",
            }) : null;
            if (incident && this.switching) {
                this.updateIncident(incident, {state: "delegated"}, "recovery delegated to candidate switch");
            }
            if (!this.switching && !expected) {
                if (code === 0 && signal === null) {
                    this.lifecycle = "closing";
                    this.lifecycleError = "";
                    console.log("[forge] kernel exited normally; stopping Forge supervisor");
                    void this.close();
                    return;
                }
                this.lifecycle = this.activeVersion ? "recovering" : "failed";
                this.lifecycleError = `Kernel exited unexpectedly: code=${code}, signal=${signal || "none"}`;
                if (this.ownsRuntime) {
                    this.persistState();
                }
                console.error(`[forge] kernel exited unexpectedly: code=${code}, signal=${signal}`);
                void this.recoverActiveVersionAfterUnexpectedExit(version, incident);
            }
        });
        await this.waitForHealth(90_000, launchedProcess);
    }

    async recoverActiveVersionAfterUnexpectedExit(exitedVersion, incident) {
        if (this.closing || this.switching || this.recovering || this.kernelProcess ||
            !this.activeVersion || this.activeVersion.id !== exitedVersion.id) {
            return;
        }
        this.recovering = true;
        this.lifecycle = "recovering";
        this.lifecycleError = "";
        this.persistState();
        try {
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                if (this.closing || this.switching || this.kernelProcess) {
                    return;
                }
                try {
                    const attemptRecord = {
                        attempt,
                        startedAt: this.now().toISOString(),
                        result: "running",
                    };
                    incident?.recoveryAttempts.push(attemptRecord);
                    if (incident) {
                        this.updateIncident(incident, {}, `recovery attempt ${attemptRecord.attempt}/3 started`);
                    }
                    console.error(`[forge] restoring active kernel version ${this.activeVersion.id}, attempt ${attempt}/3`);
                    await this.launchAndRequireHealthy(this.activeVersion, false);
                    console.log(`[forge] active kernel version restored: ${this.activeVersion.id}`);
                    this.lifecycle = "ready";
                    this.lifecycleError = "";
                    this.persistState();
                    attemptRecord.result = "recovered";
                    attemptRecord.finishedAt = this.now().toISOString();
                    if (incident) {
                        this.updateIncident(incident, {
                            state: "recovered",
                            outcome: "active-version-restored",
                            restoredVersion: versionContext(this.activeVersion),
                        }, `active version restored on attempt ${attemptRecord.attempt}`);
                    }
                    return;
                } catch (error) {
                    const message = this.describeError(error);
                    const recoveryAttempt = incident?.recoveryAttempts.at(-1);
                    if (recoveryAttempt) {
                        recoveryAttempt.result = "failed";
                        recoveryAttempt.error = message;
                        recoveryAttempt.finishedAt = this.now().toISOString();
                        this.updateIncident(incident, {}, `recovery attempt ${recoveryAttempt.attempt} failed: ${message}`);
                    }
                    console.error(`[forge] active kernel restore attempt ${attempt} failed: ${message}`);
                    await this.terminateKernelProcess();
                    if (attempt < 3) {
                        await this.delay(attempt * 1_000);
                    }
                }
            }
            console.error(`[forge] active kernel version ${this.activeVersion.id} could not be restored after 3 attempts`);
            this.lifecycle = "failed";
            this.lifecycleError = "active Kernel recovery was exhausted after 3 attempts";
            this.persistState();
            if (incident) {
                this.updateIncident(incident, {
                    state: "unrecovered",
                    outcome: "active-version-restore-exhausted",
                }, "active version could not be restored after 3 attempts");
            }
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

    async requestGracefulKernelShutdown(job, candidate) {
        if (!job || !/^[a-zA-Z0-9_.-]{1,80}$/.test(job.id || "")) {
            throw new Error("cannot switch Kernel without a valid restart job identity");
        }
        if (!candidate || !/^[0-9a-f]{40}$/.test(candidate.revision || "")) {
            throw new Error("cannot switch Kernel without a valid candidate revision");
        }
        const response = await this.fetchImpl(`http://127.0.0.1:${this.port}/api/s-forge/forge/runtime/shutdown`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [SUPERVISOR_TOKEN_HEADER]: this.token,
            },
            body: JSON.stringify({jobId: job.id, targetRevision: candidate.revision}),
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
            env: this.kernelEnvironment(),
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

    createIncident(kind, details = {}) {
        const createdAt = this.now().toISOString();
        const id = sanitizeIDPart(`${createdAt}-${kind}-${crypto.randomBytes(4).toString("hex")}`);
        const incident = {
            schemaVersion: 1,
            id,
            kind,
            state: "open",
            createdAt,
            updatedAt: createdAt,
            repository: this.repoRoot,
            workspace: this.workspace,
            port: Number(this.port),
            supervisorProcessId: process.pid,
            job: this.currentJob ? {
                id: this.currentJob.id,
                state: this.currentJob.state,
                phase: this.currentJob.phase,
                reason: this.currentJob.reason,
                logPath: this.currentJob.logPath,
            } : null,
            activeVersion: versionContext(this.activeVersion),
            logPath: `incidents/${id}.log`,
            recoveryAttempts: [],
            ...details,
        };
        this.latestIncident = incident;
        this.writeIncident(incident, `incident opened: kind=${kind}`);
        return incident;
    }

    updateIncident(incident, updates, message) {
        Object.assign(incident, updates, {updatedAt: this.now().toISOString()});
        this.latestIncident = incident;
        this.writeIncident(incident, message);
    }

    writeIncident(incident, message) {
        fs.mkdirSync(this.incidentsDir, {recursive: true});
        writeJSONAtomic(path.join(this.incidentsDir, `${incident.id}.json`), incident);
        const line = `[${this.now().toISOString()}] ${message}\n`;
        fs.appendFileSync(path.join(this.incidentsDir, `${incident.id}.log`), line, "utf8");
        this.persistState();
        console.error(`[forge] incident ${incident.id}: ${message}`);
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
    assertRestartPolicyNotNarrowed,
    parseLines,
    readRestartPolicy,
    timingSafeTokenEqual,
    isProtectedRestartPath,
    validateRestartPolicy,
    writeJSONAtomic,
};
