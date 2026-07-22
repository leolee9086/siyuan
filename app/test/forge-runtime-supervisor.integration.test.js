const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {ForgeRuntimeSupervisor} = require("../scripts/forge-runtime-supervisor");

const reserveAvailablePort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
            server.close();
            reject(new Error("test listener did not expose a TCP port"));
            return;
        }
        server.close(() => resolve(address.port));
    });
});

test("real Forge Supervisor builds, boots, probes, and gracefully stops a Kernel", {
    skip: process.env.S_FORGE_RUN_SUPERVISOR_INTEGRATION !== "1",
    timeout: 180_000,
}, async (t) => {
    const repoRoot = path.resolve(__dirname, "../..");
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s-forge-runtime-integration-"));
    const port = await reserveAvailablePort();
    const supervisor = new ForgeRuntimeSupervisor({
        repoRoot,
        runtimeDir: path.join(temporaryRoot, "runtime"),
        workspace: path.join(temporaryRoot, "workspace"),
        port,
        noBrowser: true,
    });
    t.after(async () => {
        await supervisor.terminateKernelProcess();
        await supervisor.close();
        fs.rmSync(temporaryRoot, {recursive: true, force: true});
    });

    const status = await supervisor.initialize();
    assert.equal(status.mode, "forge-source-supervisor");
    assert.equal(status.activeVersion.state, "healthy");
    assert.equal(status.retainedVersions.length, 1);

    await supervisor.requestGracefulKernelShutdown();
    await supervisor.waitForKernelExit(30_000);
    assert.equal(supervisor.kernelProcess, undefined);
});
