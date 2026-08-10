#!/usr/bin/env node
const net = require("net");
const fs = require("fs");
const path = require("path");
const {execFile, execFileSync} = require("child_process");
const {ForgeRuntimeSupervisor, SUPERVISOR_TOKEN_HEADER, isKernelRuntimePath, parseLines} = require("./forge-runtime-supervisor");
const {openForgeInterface} = require("./forge-electron-launcher");
const repoRoot = path.resolve(__dirname, "../..");
const SUPERVISOR_UNREACHABLE_ERROR = "FORGE_SUPERVISOR_UNREACHABLE";
const DEFAULT_SUPERVISOR_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_SUPERVISOR_READY_TIMEOUT_MS = 3 * 60 * 1_000;
const DEFAULT_RESTART_WAIT_TIMEOUT_MS = 15 * 60 * 1_000;

const runCommitRuntimeHookInstaller = (root, run = execFileSync) => run(
    process.execPath,
    [path.join(root, "app", "scripts", "forge-commit-runtime-gate.js"), "install"],
    {cwd: root, stdio: "inherit", windowsHide: true},
);

const isValidPort = (port) => Number.isInteger(port) && port > 0 && port <= 65535;

const isPortAvailable = (port) => new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
});

const selectPort = async (port, portAvailable = isPortAvailable) => {
    let selected = port;
    while (!(await portAvailable(selected))) {
        console.error(`[forge] port ${selected} is occupied`);
        selected += 1;
        if (!isValidPort(selected)) {
            throw new Error("no valid Forge port remains");
        }
    }
    return selected;
};

const createForgeRuntimeOptions = (root, port, noBrowser) => ({
    repoRoot: root,
    port,
    workspace: path.resolve(root, ".dev-workspace"),
    noBrowser,
});

const resolveForgeInterfaceMode = (argv = process.argv) => {
    const browser = argv.includes("--browser");
    const disabled = argv.includes("--no-browser");
    if (browser && disabled) {
        throw new Error("--browser and --no-browser are mutually exclusive");
    }
    return browser ? "browser" : disabled ? "none" : "electron";
};

const execFileOutput = (executable, args) => new Promise((resolve, reject) => {
    execFile(executable, args, {encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024}, (error, stdout, stderr) => {
        if (error) {
            reject(new Error(`${executable} process discovery failed: ${stderr.trim() || error.message}`));
            return;
        }
        resolve(stdout);
    });
});

const readRepositoryStatus = (root, run = execFileOutput) => run("git", [
    "-C",
    root,
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
]);

const assertForgeStartRepositoryClean = async (root, run = execFileOutput) => {
    const status = await readRepositoryStatus(root, run);
    if (status.trim()) {
        throw new Error(`Forge startup requires a clean Git working tree and index:\n${status.trimEnd()}`);
    }
};

const commandArgument = (commandLine, name) => {
    const match = String(commandLine || "").match(new RegExp(`--${name}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`));
    return match ? match[1] || match[2] || match[3] || "" : "";
};

const porcelainPaths = (statusLine) => {
    const value = String(statusLine || "").slice(3).trim();
    return value.split(" -> ").map((item) => item.trim()).filter(Boolean);
};

const samePath = (left, right, platform = process.platform) => {
    const normalize = (value) => {
        const resolved = path.resolve(value);
        return platform === "win32" ? resolved.toLowerCase() : resolved;
    };
    return Boolean(left && right) && normalize(left) === normalize(right);
};

const discoverWindowsKernelProcesses = async (run = execFileOutput) => {
    const script = [
        "$ErrorActionPreference='Stop'",
        "$kernels=Get-CimInstance Win32_Process -Filter \"Name='SiYuan-Kernel.exe'\"",
        "$result=@($kernels | ForEach-Object {",
        "  $parent=Get-CimInstance Win32_Process -Filter \"ProcessId=$($_.ParentProcessId)\" -ErrorAction SilentlyContinue",
        "  [pscustomobject]@{processId=$_.ProcessId;parentProcessId=$_.ParentProcessId;commandLine=$_.CommandLine;parentCommandLine=$parent.CommandLine}",
        "})",
        "ConvertTo-Json -InputObject $result -Compress",
    ].join("; ");
    const output = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
    const parsed = JSON.parse(output || "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
};

const discoverPosixKernelProcesses = async (run = execFileOutput) => {
    const output = await run("ps", ["-eo", "pid=,ppid=,args="]);
    const processes = output.split(/\r?\n/).map((line) => {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
        return match ? {processId: Number(match[1]), parentProcessId: Number(match[2]), commandLine: match[3]} : null;
    }).filter(Boolean);
    const commandByPID = new Map(processes.map((processInfo) => [processInfo.processId, processInfo.commandLine]));
    return processes.filter((processInfo) => /(?:^|[\\/])SiYuan-Kernel(?:\s|$)/.test(processInfo.commandLine)).map((processInfo) => ({
        ...processInfo,
        parentCommandLine: commandByPID.get(processInfo.parentProcessId) || "",
    }));
};

const discoverForgeKernels = async (workspace, platform = process.platform, run = execFileOutput) => {
    const processes = platform === "win32" ?
        await discoverWindowsKernelProcesses(run) :
        await discoverPosixKernelProcesses(run);
    return processes.map((processInfo) => ({
        ...processInfo,
        workspace: commandArgument(processInfo.commandLine, "workspace"),
        port: Number(commandArgument(processInfo.commandLine, "port")),
        managedByForge: /(?:^|[\\/])forge-start\.js(?:\s|$)/i.test(processInfo.parentCommandLine || ""),
    })).filter((processInfo) => samePath(processInfo.workspace, workspace, platform));
};

const readOwnership = (runtimeDir) => {
    const ownershipPath = path.join(runtimeDir, "supervisor.json");
    if (!fs.existsSync(ownershipPath)) {
        return undefined;
    }
    try {
        return JSON.parse(fs.readFileSync(ownershipPath, "utf8"));
    } catch (error) {
        throw new Error(`invalid Forge runtime ownership descriptor ${ownershipPath}: ${error.message}`);
    }
};

const isProcessAlive = (processId) => {
    if (!Number.isInteger(processId) || processId <= 0) {
        return false;
    }
    try {
        process.kill(processId, 0);
        return true;
    } catch (error) {
        return error.code === "EPERM";
    }
};

const quarantineStaleOwnership = (runtimeDir, expectedToken) => {
    const ownershipPath = path.join(runtimeDir, "supervisor.json");
    const current = JSON.parse(fs.readFileSync(ownershipPath, "utf8"));
    if (current.cliToken !== expectedToken) {
        throw new Error("Forge runtime ownership changed while stale state was being recovered");
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.renameSync(ownershipPath, path.join(runtimeDir, `supervisor.stale-${timestamp}.json`));
};

const probeSupervisor = async (ownership, fetchImpl, platform = process.platform) => {
    if (ownership?.schemaVersion !== 1 || !ownership.controlURL || !ownership.cliToken) {
        throw new Error("Forge runtime ownership descriptor is incomplete");
    }
    let response;
    try {
        response = await fetchImpl(`${ownership.controlURL}/status`, {
            headers: {[SUPERVISOR_TOKEN_HEADER]: ownership.cliToken},
            signal: AbortSignal.timeout(3_000),
        });
    } catch (error) {
        const cause = error?.cause;
        const causeMessage = cause ? `; cause=${cause.code ? `${cause.code}: ` : ""}${cause.message || String(cause)}` : "";
        const unreachable = new Error(`Forge runtime ownership is stale or unreachable: ${error.message}${causeMessage}`, {cause: error});
        unreachable.code = SUPERVISOR_UNREACHABLE_ERROR;
        throw unreachable;
    }
    if (!response.ok) {
        throw new Error(`Forge Supervisor authentication failed with HTTP ${response.status}`);
    }
    const status = await response.json();
    const matches = status.mode === "forge-source-supervisor" &&
        status.processId === ownership.processId &&
        typeof status.repoRoot === "string" &&
        samePath(status.repoRoot, ownership.repoRoot, platform) &&
        typeof status.workspace === "string" &&
        samePath(status.workspace, ownership.workspace, platform) &&
        Number(status.port) === Number(ownership.port);
    if (!matches) {
        throw new Error("Forge Supervisor descriptor does not match the responding process");
    }
    return status;
};

const isSupervisorUnreachableError = (error) => error?.code === SUPERVISOR_UNREACHABLE_ERROR;

const callSupervisor = async (ownership, route, fetchImpl, init = {}) => {
    const {timeoutMs = DEFAULT_SUPERVISOR_REQUEST_TIMEOUT_MS, ...requestInit} = init;
    const response = await fetchImpl(`${ownership.controlURL}${route}`, {
        ...requestInit,
        headers: {
            "Content-Type": "application/json",
            [SUPERVISOR_TOKEN_HEADER]: ownership.cliToken,
            ...requestInit.headers,
        },
        signal: requestInit.signal || AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json();
    if (!response.ok) {
        const error = new Error(payload.error || `Supervisor request ${route} failed with HTTP ${response.status}`);
        error.statusCode = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
};

const isSupervisorReady = (status) => {
    if (!status || !status.activeVersion?.revision) {
        return false;
    }
    if (typeof status.lifecycle === "string") {
        return status.lifecycle === "ready" && status.ready !== false;
    }
    return true;
};

const waitForSupervisorReady = async ({
    ownership,
    status,
    fetchImpl = globalThis.fetch.bind(globalThis),
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = Date.now,
    timeoutMs = DEFAULT_SUPERVISOR_READY_TIMEOUT_MS,
    probeKernelImpl = probeKernel,
}) => {
    const deadline = now() + timeoutMs;
    let current = status;
    while (true) {
        if (isSupervisorReady(current)) {
            await probeKernelImpl(Number(ownership.port), fetchImpl);
            return current;
        }
        if (["failed", "closing"].includes(current?.lifecycle)) {
            throw new Error(`Forge Supervisor entered ${current.lifecycle}: ${current.lifecycleError || "no detail reported"}`);
        }
        if (now() >= deadline) {
            throw new Error(`Forge Supervisor did not become ready within ${timeoutMs}ms (lifecycle=${current?.lifecycle || "legacy-unknown"})`);
        }
        await wait(500);
        current = await callSupervisor(ownership, "/status", fetchImpl);
    }
};

const inspectCommittedKernelUpdate = async (root, activeRevision, run = execFileOutput) => {
    if (!activeRevision) {
        throw new Error("running Supervisor does not report an active Kernel revision");
    }
    const revision = (await run("git", ["-C", root, "rev-parse", "HEAD"])).trim();
    if (revision === activeRevision) {
        return {revision, runtimeChanges: []};
    }
    const changed = parseLines(await run("git", ["-C", root, "diff", "--name-only", `${activeRevision}..${revision}`, "--"]));
    return {revision, runtimeChanges: changed.filter(isKernelRuntimePath)};
};

const inspectKernelUpdate = async (root, activeRevision, run = execFileOutput) => {
    const status = (await readRepositoryStatus(root, run)).split(/\r?\n/).filter(Boolean);
    const uncommittedRuntimeChanges = status.flatMap(porcelainPaths).filter(isKernelRuntimePath);
    if (uncommittedRuntimeChanges.length > 0) {
        throw new Error(`Kernel source has uncommitted changes; create a verified commit before hot replacement: ${uncommittedRuntimeChanges.join(", ")}`);
    }
    return inspectCommittedKernelUpdate(root, activeRevision, run);
};

const synchronizeExistingSupervisor = async ({
    root,
    ownership,
    status,
    fetchImpl = globalThis.fetch.bind(globalThis),
    run = execFileOutput,
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = Date.now,
    timeoutMs = DEFAULT_RESTART_WAIT_TIMEOUT_MS,
    probeKernelImpl = probeKernel,
    report = console.log,
}) => {
    const update = await inspectKernelUpdate(root, status.activeVersion?.revision, run);
    if (update.runtimeChanges.length === 0) {
        report(`[forge] running Kernel already matches revision ${update.revision}, or later commits contain no Kernel runtime changes`);
        return {kind: "current", revision: update.revision};
    }
    report(`[forge] ${update.runtimeChanges.length} Kernel runtime file(s) changed; requesting verified hot replacement`);
    let jobID;
    try {
        const accepted = await callSupervisor(ownership, "/restart", fetchImpl, {
            method: "POST",
            body: JSON.stringify({reason: `pnpm forge requested revision ${update.revision}`}),
        });
        jobID = accepted.job?.id;
    } catch (error) {
        if (error.statusCode === 409 && error.payload?.job?.id) {
            jobID = error.payload.job.id;
            report(`[forge] attaching to existing hot replacement job ${jobID}`);
        } else {
            throw error;
        }
    }
    if (!jobID) {
        throw new Error("Supervisor accepted restart without returning a job identifier");
    }
    let lastPhase = "";
    const deadline = now() + timeoutMs;
    while (true) {
        if (now() >= deadline) {
            throw new Error(`Kernel hot replacement did not finish within ${timeoutMs}ms (job=${jobID}, phase=${lastPhase || "unknown"})`);
        }
        const current = await callSupervisor(ownership, "/status", fetchImpl);
        const job = current.job;
        if (!job || job.id !== jobID) {
            throw new Error(`Supervisor lost restart job ${jobID}`);
        }
        if (job.phase !== lastPhase) {
            report(`[forge] hot replacement phase: ${job.phase}`);
            lastPhase = job.phase;
        }
        if (job.state === "completed") {
            if (current.activeVersion?.revision !== update.revision) {
                throw new Error(`Kernel hot replacement completed at unexpected revision ${current.activeVersion?.revision || "unknown"}`);
            }
            if (!isSupervisorReady(current)) {
                throw new Error(`Kernel hot replacement completed while Supervisor lifecycle is ${current.lifecycle || "not-ready"}`);
            }
            await probeKernelImpl(Number(ownership.port), fetchImpl);
            report(`[forge] Kernel hot replacement completed at revision ${update.revision}`);
            return {kind: "restarted", revision: update.revision, job};
        }
        if (job.state === "failed" || job.state === "rolled_back") {
            throw new Error(`Kernel hot replacement ${job.state}: ${job.error || "Supervisor reported no error detail"}`);
        }
        await wait(500);
    }
};

const probeKernel = async (port, fetchImpl) => {
    try {
        const response = await fetchImpl(`http://127.0.0.1:${port}/api/system/version`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: "{}",
            signal: AbortSignal.timeout(3_000),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (payload?.code !== 0 || typeof payload.data !== "string") {
            throw new Error("version endpoint returned an invalid payload");
        }
        return true;
    } catch (error) {
        throw new Error(`Kernel health probe failed on port ${port}: ${error.message}`);
    }
};

const resolveForgeStartup = async ({
    root,
    requestedPort,
    fetchImpl = globalThis.fetch.bind(globalThis),
    portAvailable = isPortAvailable,
    runtimeDir = path.join(root, ".forge-runtime"),
    ownership = readOwnership(runtimeDir),
    processAlive = isProcessAlive,
    quarantineOwnership = quarantineStaleOwnership,
    discoverKernels = discoverForgeKernels,
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = Date.now,
    supervisorReadyTimeoutMs = DEFAULT_SUPERVISOR_READY_TIMEOUT_MS,
    platform = process.platform,
    probeKernelImpl = probeKernel,
}) => {
    const workspace = path.resolve(root, ".dev-workspace");
    const activeRuntimeDir = runtimeDir;
    const activeOwnership = ownership;
    if (activeOwnership) {
        if (!samePath(activeOwnership.repoRoot, root, platform) ||
            !samePath(activeOwnership.workspace, workspace, platform)) {
            throw new Error("Forge runtime ownership points to a different repository or workspace");
        }
        try {
            const status = await probeSupervisor(activeOwnership, fetchImpl, platform);
            const readyStatus = await waitForSupervisorReady({
                ownership: activeOwnership,
                status,
                fetchImpl,
                wait,
                now,
                timeoutMs: supervisorReadyTimeoutMs,
                probeKernelImpl,
            });
            return {kind: "reuse", port: Number(activeOwnership.port), ownership: activeOwnership, status: readyStatus};
        } catch (error) {
            if (processAlive(activeOwnership.processId)) {
                throw new Error(`${error.message}; owner process ${activeOwnership.processId} is still running`);
            }
            quarantineOwnership(activeRuntimeDir, activeOwnership.cliToken);
        }
    }

    const matchingKernels = await discoverKernels(workspace);
    if (matchingKernels.length > 1) {
        throw new Error(`multiple Kernel processes use Forge workspace ${workspace}; refusing to create another instance`);
    }
    if (matchingKernels.length === 1) {
        const [kernel] = matchingKernels;
        if (!Number.isInteger(kernel.port) || !isValidPort(kernel.port)) {
            throw new Error(`Kernel process ${kernel.processId} uses Forge workspace ${workspace} without a valid port argument`);
        }
        await probeKernel(kernel.port, fetchImpl);
        if (!kernel.managedByForge) {
            throw new Error(`healthy Kernel process ${kernel.processId} uses Forge workspace ${workspace} without a live Forge Supervisor`);
        }
        return {kind: "reuse-legacy", port: kernel.port};
    }

    return {kind: "start", port: await selectPort(requestedPort, portAvailable)};
};

const main = async () => {
    await assertForgeStartRepositoryClean(repoRoot);
    runCommitRuntimeHookInstaller(repoRoot);
    const requestedPortArg = process.argv.find((argument) => argument.startsWith("--port="));
    const requestedPort = Number(requestedPortArg ? requestedPortArg.split("=")[1] : "6806");
    const interfaceMode = resolveForgeInterfaceMode(process.argv);
    if (!isValidPort(requestedPort)) {
        throw new Error(`invalid --port value: ${requestedPortArg || requestedPort}`);
    }
    const startup = await resolveForgeStartup({root: repoRoot, requestedPort});
    if (startup.kind === "reuse") {
        console.log(`[forge] using existing Forge Supervisor on http://127.0.0.1:${startup.port}`);
        await synchronizeExistingSupervisor({
            root: repoRoot,
            ownership: startup.ownership,
            status: startup.status,
        });
        await openForgeInterface({root: repoRoot, port: startup.port, mode: interfaceMode});
        return;
    }
    if (startup.kind === "reuse-legacy") {
        throw new Error(`Kernel on port ${startup.port} belongs to a legacy Forge Supervisor without an authenticated control lease; stop that runtime through its existing UI, then run pnpm forge once to migrate`);
    }
    const port = startup.port;
    if (port !== requestedPort) {
        console.log(`[forge] selected available port ${port}`);
    }
    // forge-start owns desktop presentation so the Kernel never races it by opening a browser.
    const supervisor = new ForgeRuntimeSupervisor(createForgeRuntimeOptions(repoRoot, port, true));
    await supervisor.initialize();
    console.log(`[forge] supervisor ready on port ${port}`);

    let stopping = false;
    const stop = async () => {
        if (stopping) {
            return;
        }
        stopping = true;
        try {
            await supervisor.requestGracefulKernelShutdown();
        } catch (error) {
            console.error(`[forge] graceful shutdown request failed: ${error.message}`);
            await supervisor.terminateKernelProcess();
        }
        await supervisor.close();
    };
    process.once("SIGINT", () => void stop());
    process.once("SIGTERM", () => void stop());
    await openForgeInterface({root: repoRoot, port, mode: interfaceMode});
};

if (require.main === module) {
    main().catch((error) => {
        console.error(`[forge] startup failed: ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    assertForgeStartRepositoryClean,
    createForgeRuntimeOptions,
    callSupervisor,
    commandArgument,
    discoverForgeKernels,
    discoverPosixKernelProcesses,
    discoverWindowsKernelProcesses,
    isProcessAlive,
    inspectCommittedKernelUpdate,
    inspectKernelUpdate,
    isSupervisorUnreachableError,
    probeKernel,
    probeSupervisor,
    porcelainPaths,
    quarantineStaleOwnership,
    readOwnership,
    resolveForgeStartup,
    runCommitRuntimeHookInstaller,
    resolveForgeInterfaceMode,
    synchronizeExistingSupervisor,
    waitForSupervisorReady,
};
