import { z } from "zod";

const networkProxySchema = z.object({
    host: z.string(),
    port: z.string(),
    scheme: z.enum(["", "http", "https", "socks5"])
});

export const schema = z.object({
    appDir: z.string(),
    autoLaunch2: z.number(),
    confDir: z.string(),
    container: z.enum(["docker", "android", "ios", "harmony", "std"]),
    dataDir: z.string(),
    downloadInstallPkg: z.boolean(),
    homeDir: z.string(),
    id: z.string(),
    isInsider: z.boolean(),
    isMicrosoftStore: z.boolean(),
    kernelVersion: z.string(),
    lockScreenMode: z.number(),
    name: z.string(),
    networkProxy: networkProxySchema,
    networkServe: z.boolean(),
    os: z.enum(["android", "darwin", "ios", "linux", "windows"]),
    osPlatform: z.string(),
    workspaceDir: z.string(),
    disabledFeatures: z.array(z.string())
});


export const parseAsSystemConfig = (rawConf: object): Config.IConf["system"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`系统配置解析失败: ${result.error.message}`);
    }

    return result.data;
};