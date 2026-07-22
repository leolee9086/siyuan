#!/usr/bin/env node
const net = require("net");
const path = require("path");
const {ForgeRuntimeSupervisor} = require("./forge-runtime-supervisor");

const repoRoot = path.resolve(__dirname, "../..");

const isValidPort = (port) => Number.isInteger(port) && port > 0 && port <= 65535;

const isPortAvailable = (port) => new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
});

const selectPort = async (port) => {
    let selected = port;
    while (!(await isPortAvailable(selected))) {
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

const main = async () => {
    const requestedPortArg = process.argv.find((argument) => argument.startsWith("--port="));
    const requestedPort = Number(requestedPortArg ? requestedPortArg.split("=")[1] : "6806");
    const noBrowser = process.argv.includes("--no-browser");
    if (!isValidPort(requestedPort)) {
        throw new Error(`invalid --port value: ${requestedPortArg || requestedPort}`);
    }
    const port = await selectPort(requestedPort);
    if (port !== requestedPort) {
        console.log(`[forge] selected available port ${port}`);
    }
    const supervisor = new ForgeRuntimeSupervisor(createForgeRuntimeOptions(repoRoot, port, noBrowser));
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
};

if (require.main === module) {
    main().catch((error) => {
        console.error(`[forge] startup failed: ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {createForgeRuntimeOptions};
