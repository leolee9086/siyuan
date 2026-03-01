/**
 * @fileoverview 马杜克机关 - SEEL核心管理系统
 * @description Marduk协议实现：管理三贤人SEEL配置、配置加载验证、响应生成和共识决策
 */

import type {
    SEELConfiguration,
    SEELConfigWithProtocol,
    MardukValidatedConfig,
    ConfigMeta,
    FileSystemAdapter,
} from "./core.types";

// [TASK] T2.1 迁移MAGI核心系统 - marduk

/** 配置文件目录（相对于插件数据存储路径） */
const CONFIG_DIR = "petal/SACKeyManager";

/** 配置文件名前缀 */
const CONFIG_PREFIX = "_";

/** SEEL基础配置：三贤人的静态属性 */
const SEEL_CONFIGURATIONS: Record<string, SEELConfiguration> = {
    melchior: {
        name: "MELCHIOR-01",
        color: "#ff3366",
        icon: "✝",
        responseType: "theological",
        baseWeight: 0.4,
    },
    balthasar: {
        name: "BALTHASAR-02",
        color: "#33ccff",
        icon: "☪",
        responseType: "scientific",
        baseWeight: 0.3,
    },
    caspar: {
        name: "CASPAR-03",
        color: "#ffcc00",
        icon: "🔥",
        responseType: "humanistic",
        baseWeight: 0.3,
    },
};

/** 默认配置（当无法加载外部配置时使用） */
const DEFAULT_CONFIG: MardukValidatedConfig = {
    apiKey: "marduk-default",
    baseURL: "http://localhost:11434/v1",
    model: "lilith-7b",
    timeout: 60000,
    maxTokens: 2048,
    temperature: 1.0,
    _meta: { isDefault: true },
};

/** SEEL类型响应映射：各思考模式的预设响应文本 */
const RESPONSE_MAP: Record<string, string[]> = {
    theological: [
        "同步率突破400%...模式VERMILLION",
        "S²机关临界值达成",
        "AT力场中和进度：▮▮▮▮▮▮▯▯▯ 78%",
        "LCL净化系统：完全同步",
    ],
    scientific: [
        "量子演算完成度：▮▮▮▮▯▯▯▯ 62%",
        "预测模型精度：92.4% (±0.5%)",
        "逆相位波动检测中...",
        "第5代思考模式已激活",
    ],
    humanistic: [
        "核心温度：3,200K (稳定)",
        "插入栓深度：安全阈值内",
        "使徒DNA匹配率：87.3%",
        "第3加护已展开",
    ],
};

/** 模式修饰符：控制响应选取范围 [min, max] */
const MODE_MODIFIERS: Record<string, [number, number]> = {
    standard: [0, 3],
    safety: [1, 2],
    combat: [3, 3],
};

/** 配置验证必需字段 */
const REQUIRED_FIELDS = ["apiKey", "apiModel", "apiBaseURL"] as const;

/**
 * 验证原始配置数据并转换为标准化格式
 * @description 检查必需字段、验证URL格式，将原始配置映射为MardukValidatedConfig
 * @param config - 从文件读取的原始配置对象
 */
function validateConfig(config: Record<string, unknown>): MardukValidatedConfig {
    for (const field of REQUIRED_FIELDS) {
        if (!config[field]) {
            throw new Error(`缺少必要字段: ${field}`);
        }
    }
    const baseURL = String(config.apiBaseURL);
    new URL(baseURL);
    const rawTimeout = typeof config.apiTimeout === "number" ? config.apiTimeout : 60;
    const rawTemp = typeof config.apiTemperature === "number" ? config.apiTemperature : 1;
    return {
        apiKey: String(config.apiKey),
        baseURL,
        model: String(config.apiModel),
        timeout: rawTimeout * 1000,
        maxTokens: typeof config.apiMaxTokens === "number" ? config.apiMaxTokens : 2048,
        temperature: Math.min(Math.max(rawTemp, 0), 2),
    };
}

/**
 * 从文件系统加载最新配置
 * @description 扫描配置目录，按文件名倒序取最新配置文件，验证后返回
 * @param fs - 文件系统适配器
 * @param dataStoragePath - 插件数据存储根路径
 */
async function loadLatestConfig(
    fs: FileSystemAdapter,
    dataStoragePath: string
): Promise<MardukValidatedConfig> {
    try {
        const configPath = `${dataStoragePath}/${CONFIG_DIR}`;
        const files = await fs.readDir(configPath);
        const configFiles = files
            .filter((file) => file.name.startsWith(CONFIG_PREFIX))
            .sort((a, b) => b.name.localeCompare(a.name));
        // 配置目录为空时回退到默认配置，避免系统无法启动
        if (configFiles.length === 0) {
            console.warn("使用默认SEEL配置");
            return { ...DEFAULT_CONFIG };
        }
        const latestFile = configFiles[0];
        if (!latestFile) {
            return { ...DEFAULT_CONFIG };
        }
        const rawData = await fs.readFile(`${configPath}/${latestFile.name}`);
        const validated = validateConfig(JSON.parse(rawData));
        const meta: ConfigMeta = { source: latestFile.name, loadedAt: new Date() };
        return { ...validated, _meta: meta };
    } catch (error) {
        console.error("配置加载失败:", error);
        return { ...DEFAULT_CONFIG };
    }
}

/**
 * 获取指定SEEL类型的配置（含协议标记）
 * @description 从静态配置表中查找SEEL配置，附加Marduk协议标识
 * @param seelType - SEEL类型名称（不区分大小写）
 */
export async function getSEELConfig(seelType: string): Promise<SEELConfigWithProtocol> {
    const config = SEEL_CONFIGURATIONS[seelType.toLowerCase()];
    if (!config) {
        throw new Error(`SEEL-${seelType}未注册于马杜克系统`);
    }
    return { ...config, protocol: "Marduk-α" };
}

/**
 * 验证SEEL同步率是否达标
 * @description 基于SEEL基准权重和当前配置的maxTokens计算同步阈值
 * @param seelType - SEEL类型名称
 * @param syncRatio - 当前同步率
 * @param currentConfig - 当前Marduk配置
 */
export async function validateSynchronization(
    seelType: string,
    syncRatio: number,
    currentConfig: MardukValidatedConfig
): Promise<boolean> {
    const baseConfig = SEEL_CONFIGURATIONS[seelType];
    if (!baseConfig) {
        return false;
    }
    return syncRatio >= baseConfig.baseWeight * (currentConfig.maxTokens / 2048);
}

/**
 * 生成SEEL类型的主题响应（马杜克决策协议）
 * @description 根据SEEL类型和运行模式，从预设响应池中选取响应并附加模型信息
 * @param seelType - SEEL思考模式类型（theological/scientific/humanistic）
 * @param currentConfig - 当前Marduk配置
 * @param mode - 运行模式（standard/safety/combat）
 */
export async function generateResponse(
    seelType: string,
    currentConfig: MardukValidatedConfig,
    mode: string = "standard"
): Promise<string[]> {
    const responses = RESPONSE_MAP[seelType] || [];
    const modeEntry = MODE_MODIFIERS[mode];
    const min = modeEntry ? modeEntry[0] : 0;
    const max = modeEntry ? modeEntry[1] : 3;
    const index = Math.min(
        min + Math.floor(Math.random() * (max - min + 1)),
        responses.length - 1
    );
    const selectedResponse = responses[index] || "";
    const modelTag = `[${currentConfig.model}@${currentConfig.temperature}]`;
    return [selectedResponse, `${modelTag} ${selectedResponse.replace(/[:%]/g, "")}`];
}

/**
 * 生成三位一体共识（马杜克主协议）
 * @description 对多个响应进行频率分析，选出出现次数最多的响应作为共识结论
 * @param responses - 三贤人的响应文本列表
 */
export async function generateConsensus(responses: string[]): Promise<string> {
    const decisionMatrix: Record<string, number> = {};
    for (const res of responses) {
        const key = res.replace(/[:%]/g, "").substring(0, 20);
        decisionMatrix[key] = (decisionMatrix[key] || 0) + 1;
    }
    const counts = Object.values(decisionMatrix);
    const maxCount = Math.max(...counts);
    const candidates = Object.entries(decisionMatrix)
        .filter(([, count]) => count === maxCount)
        .map(([k]) => k);
    // 多个候选说明存在分歧，用特殊格式标记
    if (candidates.length > 1) {
        return `多重真理检测：${candidates.join(" ◇ ")}`;
    }
    return `主协议通过：${candidates[0] || ""}`;
}

/**
 * 创建Marduk配置管理器实例
 * @description 工厂函数，初始化配置加载并返回Marduk操作接口
 * @param fs - 文件系统适配器
 * @param dataStoragePath - 插件数据存储根路径
 */
export async function createMarduk(
    fs: FileSystemAdapter,
    dataStoragePath: string
): Promise<{ config: MardukValidatedConfig; reload: () => Promise<MardukValidatedConfig> }> {
    const config = await loadLatestConfig(fs, dataStoragePath);
    return {
        config,
        /** 重新加载最新配置 */
        reload: () => loadLatestConfig(fs, dataStoragePath),
    };
}
