const path = require("path");

const commandArgument = (argv, name) => {
    const prefix = `${name}=`;
    const argument = argv.find((value) => typeof value === "string" && value.startsWith(prefix));
    return argument === undefined ? undefined : argument.slice(prefix.length);
};

const resolveAttachKernelArgument = (argv) => {
    const value = commandArgument(argv, "--attach-kernel");
    if (value === undefined || value === "false") {
        return {enabled: false};
    }
    if (value === "true") {
        return {enabled: true};
    }
    return {
        enabled: false,
        error: "The --attach-kernel argument must be either true or false.",
    };
};

const isValidKernelPort = (port) => {
    const value = String(port ?? "");
    if (!/^[0-9]+$/.test(value)) {
        return false;
    }
    const numericPort = Number(value);
    return Number.isInteger(numericPort) && numericPort > 0 && numericPort <= 65535;
};

const assertAttachedKernelOptions = ({attachKernel, workspace, port}) => {
    if (!attachKernel) {
        return;
    }
    if (typeof workspace !== "string" || !path.isAbsolute(workspace)) {
        throw new Error("An attached Kernel requires an absolute workspace path.");
    }
    if (!isValidKernelPort(port)) {
        throw new Error("An attached Kernel requires a port between 1 and 65535.");
    }
};

const shouldSpawnKernel = ({attachKernel, isDevEnv, workspaceCount}) =>
    !attachKernel && (!isDevEnv || workspaceCount > 0);

const canReuseWorkspaceWindow = ({attachKernel, requestedPort, currentPort}) =>
    !attachKernel || String(requestedPort) === String(currentPort);

module.exports = {
    assertAttachedKernelOptions,
    canReuseWorkspaceWindow,
    commandArgument,
    isValidKernelPort,
    resolveAttachKernelArgument,
    shouldSpawnKernel,
};
