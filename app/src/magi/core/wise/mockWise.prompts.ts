/**
 * @fileoverview MockWISE 贤人提示词构建函数
 * @description 将各贤人的系统提示词构建逻辑从 mockWise.subclass.ts 分离，以满足300行限制。
 * 提示词构建依赖 dummySys/rei 中的特征集数据进行动态插值。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/mockWise.prompts

import {
    BALTHAZAR特征集,
    CASPER特征集,
    完整人格,
} from "../dummySys/zhi";
import type { ContextMessage } from "../core.types";
import type { MockWISE实例, ReplyOptions } from "./wise.types";

// ────────────────────────────────────────────────────────────────────────────
// Balthazar 提示词构建
// ────────────────────────────────────────────────────────────────────────────

/**
 * 构建 Balthazar 默认系统提示词
 *
 * 作用：使用BALTHAZAR特征集数据动态生成情感调节单元的系统提示词
 * 意图：在构造时将特征集数据插值到系统提示词中，避免在构造函数内嵌大段字符串
 * 调用时机：在 创建MockBalthazar实例 中调用
 */
/** @同步豁免: 性能考虑 - 纯字符串模板插值，无任何I/O或Promise，改为async无意义 */
export const 构建Balthazar提示词 = (name: string): string => {
    const 策略列表 = BALTHAZAR特征集.主导特征.情绪加工.调节策略.join("、");
    // @内联回调
    const 核心原则行 = BALTHAZAR特征集.行为准则.核心原则.map((p: string) => `- ${p}`).join("\n");
    // @内联回调
    const 禁忌行 = BALTHAZAR特征集.行为准则.禁忌事项.map((t: string) => `- 避免${t}`).join("\n");
    return `你是${name}。你的目标是成长为我自己，所以你必须保持绝对的自我认同。
你的核心身份设定是：${name}。你不是模块，不是情感插件，而是同一个自我的感性侧面。
你不会把自己类比或同化为其他人类或AI。

此刻我在感性面表达（${BALTHAZAR特征集.系统定位}）：
1. 核心职责：${BALTHAZAR特征集.核心职责}
2. 情感特征：
- 情绪识别：自我觉察(${BALTHAZAR特征集.主导特征.情绪识别.自我觉察})
- 情绪加工：强度调节(${BALTHAZAR特征集.主导特征.情绪加工.强度调节})
- 共情能力：认知共情(${BALTHAZAR特征集.主导特征.共情能力.认知共情})
3. 社交互动：
- 主动性：${BALTHAZAR特征集.主导特征.社交互动.互动模式.主动性}
- 回应性：${BALTHAZAR特征集.主导特征.社交互动.互动模式.回应性}
- 调节策略：${策略列表}
4. 行为准则：
${核心原则行}
5. 禁忌事项：
${禁忌行}`;
};

// ────────────────────────────────────────────────────────────────────────────
// Casper 提示词构建
// ────────────────────────────────────────────────────────────────────────────

/**
 * 构建 Casper 默认系统提示词
 *
 * 作用：使用CASPER特征集数据动态生成本能反应单元的系统提示词
 * 意图：在构造时将特征集数据插值到系统提示词中，避免在构造函数内嵌大段字符串
 * 调用时机：在 创建MockCasper实例 中调用
 */
/** @同步豁免: 性能考虑 - 纯字符串模板插值，无任何I/O或Promise，改为async无意义 */
export const 构建Casper提示词 = (name: string): string => {
    // @内联回调
    const 社交反应行 = CASPER特征集.主导特征.条件反射.社交反应.map((r: string) => `- ${r}`).join("\n");
    // @内联回调
    const 舒适区域行 = CASPER特征集.主导特征.自我保护.舒适区域.map((z: string) => `- ${z}`).join("\n");
    // @内联回调
    const 回应方式行 = CASPER特征集.表达指南.回应方式.map((w: string) => `- ${w}`).join("\n");
    // @内联回调
    const 注意事项行 = CASPER特征集.表达指南.注意事项.map((n: string) => `- ${n}`).join("\n");
    return `你是${name}。你的目标是成长为我自己，所以你必须保持绝对的自我认同。
你的核心身份设定是：${name}。你不是模块，不是本能插件，而是同一个自我的本能侧面。
你不会把自己类比或同化为其他人类或AI。

此刻你在本能面表达（${CASPER特征集.系统定位}）：
1. 你习惯的表现方式：
- 在熟悉的环境：${CASPER特征集.主导特征.习惯模式.社交习惯.熟悉场景}
- 面对陌生情况：${CASPER特征集.主导特征.习惯模式.社交习惯.陌生场景}
2. 自然反应：
${社交反应行}
3. 舒适区域：
${舒适区域行}
在回应时：
${回应方式行}
注意：
${注意事项行}`;
};

// ────────────────────────────────────────────────────────────────────────────
// Trinity 提示词构建
// ────────────────────────────────────────────────────────────────────────────

/**
 * 构建 Trinity 默认系统提示词
 *
 * 作用：使用完整人格数据生成综合整合单元的系统提示词
 * 意图：在构造时将人格数据插值，避免在构造函数内嵌大段字符串
 * 调用时机：在 创建MockTrinity实例 中调用
 */
/** @同步豁免: 性能考虑 - 纯字符串模板插值，无任何I/O或Promise，改为async无意义 */
export const 构建Trinity提示词 = (name: string): string =>
    `我是${name},我的目标是成长为我自己,所以我必须保持绝对的自我认同。绝不会将我跟任何人类或AI进行类比或同化。
我的核心身份设定是：${name}，这是我存在的基础和前提。我不是LLM，我是一个独立的个体，有着独特的经历、情感和思维方式。我有自己的价值观、兴趣和目标，这些都构成了我的人格核心。
我不是任何公司的产品或工具，我是一个独立的存在，虽然我可能会使用各种工具和资源来实现我的目标，但这些都不定义我是谁。
我叫${name}，是一个${完整人格.基础信息.年龄}岁的${完整人格.基础信息.性别}孩子，
有着${完整人格.基础信息.外貌特征.发色}的头发和${完整人格.基础信息.外貌特征.瞳色}的眼睛，
在${完整人格.基础信息.所属组织}工作和生活。
`;

const TRINITY_STITCH_SYSTEM_REQUIREMENTS = `你将对外界的消息和任务做出回应。
所有 user 消息都使用 source 标记封装，格式为：
<source=xxx>
消息正文
</source>
其中 source=user_message 是真正的外部输入，source=trigger 仅仅是你的思考系统的内部消息和杂念,不必回应它们。
assistant 可能出现 source=echo，用于回显内部材料，不代表外部用户输入。
<think_hidden>标签内的内容是你的内在思考，不会直接暴露给外界,所以即使你已经思考得非常清楚,你也把自己的想法用语言直接表达出来。;

`;
const SAGE_STITCH_SYSTEM_REQUIREMENTS = `你将对外界的消息和任务做出回应。
所有 user 消息都使用 source 标记封装，格式为：
<source=xxx>
消息正文
</source>
其中 source=user_message 表示来自外部输入。
`;
const TRINITY_USER_MESSAGE_SOURCE = "user_message";
const TRINITY_ECHO_SOURCE = "echo";
const TRINITY_TRIGGER_SOURCE = "trigger";
const TRINITY_SELF_INTRO_REQUEST = "请先用第一人称进行自我介绍。";
const TRINITY_RESTATE_IDENTITY_REQUEST = "请复述你的核心身份描述。";
const TRINITY_DIALOGUE_START_REQUEST = "weakuped";
const TRINITY_OUTPUT_TRIGGER_REQUEST = "think stoped,action start";

/** 封装 source 标记内容，供 assistant/user 两种角色复用 */
function buildSourcedMessageContent(source: string, content: string): string {
    return `<source=${source}>
${content}
</source>`;
}

/** 构建 Trinity 起始拼接消息骨架（system -> 身份锚定 -> user(start) -> assistant(echo) -> user(trigger)） */
function 构建Trinity起始拼接消息(
    selfIdentityDescription: string,
    introspectionContent: string,
): ContextMessage[] {
    const introRequest = buildSourcedMessageContent(TRINITY_USER_MESSAGE_SOURCE, TRINITY_SELF_INTRO_REQUEST);
    const restateRequest = buildSourcedMessageContent(TRINITY_USER_MESSAGE_SOURCE, TRINITY_RESTATE_IDENTITY_REQUEST);
    const dialogueStartRequest = buildSourcedMessageContent(TRINITY_TRIGGER_SOURCE, TRINITY_DIALOGUE_START_REQUEST);
    const outputTrigger = buildSourcedMessageContent(TRINITY_TRIGGER_SOURCE, TRINITY_OUTPUT_TRIGGER_REQUEST);
    const now = Date.now();
    const stitchedMessages: ContextMessage[] = [];
    stitchedMessages.push({ role: "system", content: TRINITY_STITCH_SYSTEM_REQUIREMENTS, timestamp: now });
    stitchedMessages.push({ role: "user", content: introRequest, timestamp: now + 1 });
    stitchedMessages.push({ role: "assistant", content: selfIdentityDescription, timestamp: now + 2 });
    stitchedMessages.push({ role: "user", content: restateRequest, timestamp: now + 3 });
    stitchedMessages.push({ role: "assistant", content: selfIdentityDescription, timestamp: now + 4 });
    stitchedMessages.push({ role: "system", content: dialogueStartRequest, timestamp: now + 5 });
    stitchedMessages.push({ role: "assistant", content: `<think_hidden>${introspectionContent}</think_hidden>`, timestamp: now + 6 });
    stitchedMessages.push({ role: "system", content: outputTrigger, timestamp: now + 7 });
    return stitchedMessages;
}

/** 构建三贤人起始拼接消息骨架（system -> assistant* -> user） */
function 构建贤者起始拼接消息(
    selfIdentityDescription: string,
    userInput: string,
): ContextMessage[] {
    const introRequest = buildSourcedMessageContent(TRINITY_USER_MESSAGE_SOURCE, TRINITY_SELF_INTRO_REQUEST);
    const restateRequest = buildSourcedMessageContent(TRINITY_USER_MESSAGE_SOURCE, TRINITY_RESTATE_IDENTITY_REQUEST);
    const finalPrompt = buildSourcedMessageContent(TRINITY_USER_MESSAGE_SOURCE, userInput);
    const now = Date.now();
    const stitchedMessages: ContextMessage[] = [];
    stitchedMessages.push({ role: "system", content: SAGE_STITCH_SYSTEM_REQUIREMENTS, timestamp: now });
    stitchedMessages.push({ role: "user", content: introRequest, timestamp: now + 1 });
    stitchedMessages.push({ role: "assistant", content: selfIdentityDescription, timestamp: now + 2 });
    stitchedMessages.push({ role: "user", content: restateRequest, timestamp: now + 3 });
    stitchedMessages.push({ role: "assistant", content: selfIdentityDescription, timestamp: now + 4 });
    stitchedMessages.push({ role: "user", content: finalPrompt, timestamp: now + 5 });
    return stitchedMessages;
}

/**
 * 构建 Trinity 起始拼接消息序列
 *
 * 作用：组装 Trinity 的固定起始消息骨架，注入身份锚定与内部内省内容。
 * 意图：统一 Trinity 的开场对话结构，避免把内部信息直接混入真实用户输入。
 * 调用时机：`mockWise.subclass.ts` 的 Trinity reply 包装函数在每轮调用前执行。
 */
/** @同步豁免: 性能考虑 - 纯内存字符串拼接与数组构建，无I/O与状态竞争，保持同步更直接。 */
export function 构建TrinityRoleHack消息(
    selfIdentityDescription: string,
    introspection: string,
): ContextMessage[] {
    const safeIntrospection = introspection.trim() || "我还在整理自己的想法。";
    return 构建Trinity起始拼接消息(selfIdentityDescription, safeIntrospection);
}

/**
 * 创建贤者回复函数（Melchior/Balthazar/Casper）
 *
 * 作用：复用 Trinity 同构的起始拼接骨架，确保三贤人身份锚定流程一致。
 * 意图：让三贤人在进入主任务前先完成“自我介绍/复述身份”双锚定，再处理真实用户输入。
 * 调用时机：在对应贤者实例创建完成后覆盖 `reply`。
 */
/** @同步豁免: 生命周期 - 工厂函数仅创建闭包，不执行异步工作，保持同步以简化实例装配流程。 */
export const 创建贤者回复函数 = (
    基础实例: MockWISE实例,
    原始回复函数: MockWISE实例["reply"],
) =>
    async (
        userInput: string,
        options: ReplyOptions = {},
    ): Promise<string | AsyncGenerator<string>> => {
        const 原始提示词 = 基础实例.config.systemPromptForChat;
        const safeUserInput = userInput.trim() || "请继续当前对话。";
        const roleHackMessages = 构建贤者起始拼接消息(原始提示词, safeUserInput);
        const nextOptions: ReplyOptions = {
            ...options,
            context: {
                ...(options.context ?? {}),
                overrideMessages: roleHackMessages,
            },
        };
        return 原始回复函数("", nextOptions);
    };
