/**
 * @fileoverview MAGI系统主模块
 * @description 三位一体决策系统的核心编排器，管理三贤人(SEEL)的创建、投票和同步监控
 */

import type {
    WISEApi,
    WISEApiResponse,
    WISEFullInstance,
    SEELInstance,
    MAGISystemStatus,
    VoteRecord,
    MAGISystemCallbacks,
    MardukValidatedConfig,
    ConfigLoaderDeps,
} from "./core.types";
import { getSEELConfig, generateResponse, generateConsensus } from "./marduk";
import { loadAIConfigFromWorkspace } from "./configLoader";
import { isNonNullString } from "./magiSystem.guard";
import { createMelchior } from "./wise/melchior";
import { createBalthazar } from "./wise/balthazar";
import { createCasper } from "./wise/casper";

/** 默认领导者标识 */
const DEFAULT_LEADER = "BALTHASAR-02";

/** 同步监控间隔（毫秒） */
const SYNC_MONITOR_INTERVAL = 5000;

/**
 * 提取API响应中的文本内容
 * @description 安全地从WISE API响应中获取第一个choice的文本，避免隐式上下文切换
 * @param response - WISE API响应，可能为null
 * @returns 文本内容或null
 */
function extractResponseContent(response: WISEApiResponse | null): string | null {
    if (!response) {
        return null;
    }
    const firstChoice = response.choices[0];
    if (!firstChoice) {
        return null;
    }
    return firstChoice.message.content;
}

/**
 * 从SEEL名称中提取类型标识（如 "BALTHASAR-02" → "balthasar"）
 * @description 安全地分割名称字符串并转为小写，避免隐式上下文切换
 * @param seelName - SEEL完整名称
 * @returns 小写的类型标识
 */
function extractSeelType(seelName: string): string {
    const parts = seelName.split("-");
    const first = parts[0];
    return first ? first.toLowerCase() : "unknown";
}

/**
 * 构建WISE API适配器，将Marduk响应包装为标准API格式
 * @description 创建一个符合WISEApi接口的适配器，内部调用Marduk的generateResponse
 *   并将string[]结果合并为单个content字符串
 * @param leader - 当前领导者标识（用于提取SEEL类型）
 * @param currentConfig - 当前Marduk配置
 * @returns WISE API接口实例
 */
function buildApiAdapter(leader: string, currentConfig: MardukValidatedConfig): WISEApi {
    return {
        /** 将Marduk响应转换为标准WISEApiResponse格式 */
        post: async () => {
            const seelType = extractSeelType(leader);
            const responseParts = await generateResponse(seelType, currentConfig);
            return { choices: [{ message: { content: responseParts.join(" ") } }] };
        },
    };
}

/**
 * 根据SEEL类型创建对应的WISE处理器实例
 * @description 根据类型名称分派到对应的工厂函数（melchior/balthazar/casper），
 *   未知类型回退到melchior
 * @param seelType - SEEL类型（melchior/balthasar/caspar）
 * @param api - WISE API适配器
 * @param config - Marduk配置
 */
async function createProcessorByType(
    seelType: string,
    api: WISEApi,
    config: MardukValidatedConfig
): Promise<WISEFullInstance> {
    if (seelType === "balthasar") {
        return createBalthazar(api, config, "");
    }
    if (seelType === "caspar") {
        return createCasper(api, config);
    }
    // 默认及melchior类型
    return createMelchior(api, config);
}

/**
 * 创建单个SEEL运行时实例
 * @description 获取SEEL配置、创建API适配器和处理器，组装为完整的SEELInstance
 * @param seelType - SEEL类型名称
 * @param leader - 当前领导者标识
 * @param config - Marduk配置
 */
async function createSEEL(
    seelType: string,
    leader: string,
    config: MardukValidatedConfig
): Promise<SEELInstance> {
    const baseConfig = await getSEELConfig(seelType);
    const api = buildApiAdapter(leader, config);
    const processor = await createProcessorByType(seelType, api, config);
    return {
        ...baseConfig,
        processor,
        messages: [],
        status: "standby",
        lastActive: Date.now(),
    };
}

/**
 * 处理单个SEEL的投票错误，返回null以便过滤
 * @description 在trinityVote中用于catch回调，记录错误但不中断整体投票流程
 * @param seel - 出错的SEEL实例
 * @param callbacks - 系统事件回调
 * @param error - 捕获的错误
 */
function handleVoteError(
    seel: SEELInstance,
    callbacks: MAGISystemCallbacks,
    error: unknown
): null {
    console.error(`${seel.name}决策失效:`, error);
    // 回调存在且error为标准Error时，通知上层SEEL错误事件
    if (callbacks.onSeelError && error instanceof Error) {
        callbacks.onSeelError({ seel, error });
    }
    return null;
}

/**
 * 从有效投票对中计算各SEEL类型的权重分布
 * @description 遍历投票对，按SEEL类型名称累加计数
 * @param pairs - 有效的SEEL-内容配对列表
 * @returns SEEL类型到权重的映射
 */
function calculateWeightsFromPairs(
    pairs: ReadonlyArray<{ seel: SEELInstance; content: string }>
): Record<string, number> {
    const weights: Record<string, number> = {};
    for (const p of pairs) {
        const seelType = extractSeelType(p.seel.name);
        const current = weights[seelType];
        weights[seelType] = (current ?? 0) + 1;
    }
    return weights;
}

/**
 * 记录投票结果到历史记录
 * @description 将有效响应、共识结果和权重分布记录到voteHistory数组
 * @param voteHistory - 投票历史数组（就地修改）
 * @param seels - 参与投票的SEEL实例列表
 * @param responses - 各SEEL的API响应（可能含null）
 * @param consensus - 共识结果文本
 */
function recordVoteResult(
    voteHistory: VoteRecord[],
    seels: SEELInstance[],
    responses: Array<WISEApiResponse | null>,
    consensus: string
): void {
    const validPairs: Array<{ seel: SEELInstance; content: string }> = [];
    for (let i = 0; i < seels.length; i++) {
        const seel = seels[i];
        const resp = responses[i];
        if (!seel || !resp) {
            continue;
        }
        const content = extractResponseContent(resp);
        // 仅记录有有效内容的响应
        if (content) {
            validPairs.push({ seel, content });
        }
    }

    voteHistory.push({
        timestamp: Date.now(),
        responses: validPairs.map((p) => ({ seel: p.seel.name, content: p.content })),
        consensus,
        weights: calculateWeightsFromPairs(validPairs),
    });
}

/**
 * 执行三位一体投票决策流程
 * @description 并行调用三贤人的reply方法，收集有效响应后通过Marduk生成共识，
 *   并将投票结果记录到历史。任何单个SEEL的失败不会中断整体流程。
 * @param seels - 三贤人SEEL实例列表
 * @param callbacks - 系统事件回调
 * @param voteHistory - 投票历史数组（就地追加）
 * @param input - 用户输入文本
 */
async function executeTrinityVote(
    seels: SEELInstance[],
    callbacks: MAGISystemCallbacks,
    voteHistory: VoteRecord[],
    input: string
): Promise<string> {
    const responses = await Promise.all(
        seels.map((seel) =>
            seel.processor.reply(input)
                .catch((err: unknown) => handleVoteError(seel, callbacks, err))
        )
    );

    const validContents = responses
        .map((r) => extractResponseContent(r))
        .filter(isNonNullString);

    // 所有SEEL决策均失效时抛出错误
    if (validContents.length === 0) {
        throw new Error("所有SEEL决策失效");
    }

    const consensus = await generateConsensus(validContents);
    recordVoteResult(voteHistory, seels, responses, consensus);
    return consensus;
}

/**
 * 创建MAGI系统实例
 * @description 初始化三位一体决策系统：加载Marduk配置、创建三贤人SEEL实例、
 *   启动同步率监控。返回的对象提供trinityVote决策、状态查询和配置重载能力。
 * @param configDeps - 配置加载器依赖（文件系统适配器和数据存储路径）
 * @param callbacks - 可选的系统事件回调
 */
export async function createMAGISystem(
    configDeps: ConfigLoaderDeps,
    callbacks: MAGISystemCallbacks = {}
): Promise<{
    trinityVote: (input: string) => Promise<string>;
    getSystemStatus: () => MAGISystemStatus;
    reloadConfig: () => Promise<MardukValidatedConfig>;
    stopSyncMonitor: () => void;
}> {
    let currentConfig = await loadAIConfigFromWorkspace(configDeps);
    const voteHistory: VoteRecord[] = [];
    const syncRatios = new Map<string, number>();

    // 创建三贤人SEEL实例
    const seels = await Promise.all([
        createSEEL("melchior", DEFAULT_LEADER, currentConfig),
        createSEEL("balthasar", DEFAULT_LEADER, currentConfig),
        createSEEL("caspar", DEFAULT_LEADER, currentConfig),
    ]);

    // 启动同步率监控定时器
    const syncInterval = setInterval(() => {
        for (const seel of seels) {
            const ratio = seel.status === "active" ? 1 : 0.8;
            syncRatios.set(seel.name, ratio);
        }
    }, SYNC_MONITOR_INTERVAL);

    // 通知系统就绪回调
    if (callbacks.onSystemReady) {
        callbacks.onSystemReady();
    }

    return {
        /** 三位一体决策：并行调用三贤人reply，汇总共识 */
        trinityVote: (input: string) => executeTrinityVote(seels, callbacks, voteHistory, input),

        /** 获取当前系统状态快照 */
        getSystemStatus: (): MAGISystemStatus => ({
            online: seels.length > 0,
            leader: DEFAULT_LEADER,
            syncRatios: Object.fromEntries(syncRatios),
            lastVote: voteHistory[voteHistory.length - 1],
        }),

        /** 重新加载AI配置 */
        reloadConfig: async () => {
            currentConfig = await loadAIConfigFromWorkspace(configDeps);
            return currentConfig;
        },

        /** 停止同步率监控定时器 */
        stopSyncMonitor: () => {
            clearInterval(syncInterval);
        },
    };
}
