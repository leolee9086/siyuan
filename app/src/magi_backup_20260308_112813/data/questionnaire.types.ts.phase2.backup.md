/**
 * 问卷系统类型定义
 *
 * 定义MAGI人格评估问卷的数据结构，包括问题类型、章节结构和评分函数签名。
 */

/** 复合评分子问题 */
export interface QuestionnaireSubQuestion {
    readonly text: string;
    readonly type: "single";
    readonly options: readonly string[];
    readonly weight?: number;
    readonly path: string;
    readonly hint?: string;
}

/** 评分回调的答案条目 */
export interface ScoreAnswer {
    readonly selectedOptionIndex: number;
    readonly weight?: number;
}

/** 单选问题 */
export interface SingleQuestion {
    readonly text: string;
    readonly type: "single";
    readonly options: readonly string[];
    selectedOption?: string;
    readonly path: string;
    readonly hint?: string;
    readonly onChange?: (value: string, questions: QuestionnaireQuestion[]) => void;
}

/** 文本输入问题 */
export interface TextQuestion {
    readonly text: string;
    readonly type: "text";
    value?: string;
    placeholder?: string;
    readonly path: string;
    readonly hint?: string;
}

/** 多文本输入问题 */
export interface MultipleTextQuestion {
    readonly text: string;
    readonly type: "multiple_text";
    values: string[];
    readonly placeholder?: string;
    readonly path: string;
    readonly hint?: string;
    readonly validation?: {
        readonly pattern: RegExp;
        readonly message: string;
    };
}

/** 复合评分问题 */
export interface CompositeRatingQuestion {
    readonly text: string;
    readonly type: "composite_rating";
    readonly subQuestions: readonly QuestionnaireSubQuestion[];
    readonly calculateScore?: (answers: readonly ScoreAnswer[]) => Promise<number> | number;
    readonly hint?: string;
}

/** 问卷问题联合类型 */
export type QuestionnaireQuestion =
    | SingleQuestion
    | TextQuestion
    | MultipleTextQuestion
    | CompositeRatingQuestion;

/** 问卷章节 */
export interface QuestionnaireSection {
    readonly title: string;
    readonly systemTitle: string;
    readonly description: string;
    readonly questions: readonly QuestionnaireQuestion[];
}

/** Trinity总结提示词数据 */
export interface TrinitySummaryData {
    readonly 姓名?: string;
    readonly 年龄?: string;
    readonly 性别?: string;
    readonly 所属组织?: string;
    readonly 职责定位?: string;
    readonly 关键经历?: readonly string[];
    readonly 决策模式得分?: number;
    readonly 思维倾向特征?: string;
    readonly 处理倾向特征?: string;
    readonly 认知情感得分?: number;
    readonly 互动倾向特征?: string;
    readonly 本能理性得分?: number;
    readonly 应急倾向特征?: string;
    readonly 压力应对特征?: string;
    readonly 适应性得分?: number;
    readonly 环境适应特征?: string;
    readonly 角色转换特征?: string;
    readonly 发展整合得分?: number;
    readonly 方向选择特征?: string;
    readonly 学习方式特征?: string;
}

/** Melchior总结提示词数据 */
export interface MelchiorSummaryData {
    readonly 姓名?: string;
    readonly 年龄?: string;
    readonly 性别?: string;
    readonly 所属组织?: string;
    readonly 职责定位?: string;
    readonly 逻辑分析得分?: number;
    readonly 逻辑推理表现?: string;
    readonly 数据处理表现?: string;
    readonly 模式识别表现?: string;
    readonly 决策执行得分?: number;
    readonly 风险评估表现?: string;
    readonly 抑制能力表现?: string;
    readonly 任务切换表现?: string;
    readonly 认知资源得分?: number;
    readonly 工作记忆表现?: string;
    readonly 自我监控表现?: string;
    readonly 错误检测表现?: string;
    readonly 思维结构化倾向?: string;
    readonly 逻辑一致性特征?: string;
    readonly 决策优先级模式?: string;
    readonly 风险应对风格?: string;
    readonly 元认知特征?: string;
    readonly 专业决策表现?: string;
    readonly 时间压力应对?: string;
    readonly 团队协作特征?: string;
    readonly 成本效益意识?: string;
}

/** Balthazar总结提示词数据 */
export interface BalthazarSummaryData {
    readonly 姓名?: string;
    readonly 年龄?: string;
    readonly 性别?: string;
    readonly 所属组织?: string;
    readonly 职责定位?: string;
    readonly 情绪识别倾向得分?: number;
    readonly 自我觉察特征?: string;
    readonly 他人关注特征?: string;
    readonly 氛围感知特征?: string;
    readonly 情感调节倾向得分?: number;
    readonly 强度管理特征?: string;
    readonly 持续应对特征?: string;
    readonly 转换适应特征?: string;
    readonly 伦理决策倾向得分?: number;
    readonly 思考模式特征?: string;
    readonly 价值权衡特征?: string;
    readonly 人际互动倾向得分?: number;
    readonly 互动模式特征?: string;
    readonly 关系维护特征?: string;
    readonly 情感共鸣倾向得分?: number;
    readonly 共情深度特征?: string;
    readonly 复杂情感处理?: string;
    readonly 专业伦理倾向得分?: number;
    readonly 伦理决策模式?: string;
    readonly 价值观稳定性?: string;
    readonly 团队情感管理得分?: number;
    readonly 氛围营造特征?: string;
    readonly 冲突调解特征?: string;
}

/** Casper总结提示词数据 */
export interface CasperSummaryData {
    readonly 姓名?: string;
    readonly 年龄?: string;
    readonly 性别?: string;
    readonly 所属组织?: string;
    readonly 职责定位?: string;
    readonly 警觉性得分?: number;
    readonly 应激反应得分?: number;
    readonly 生存本能得分?: number;
    readonly 动机系统得分?: number;
    readonly 直觉判断得分?: number;
    readonly 社会本能得分?: number;
    readonly 竞争本能得分?: number;
    readonly 预警系统得分?: number;
    readonly 环境意识表现?: string;
    readonly 变化感知表现?: string;
    readonly 情绪敏感表现?: string;
    readonly 紧急处理表现?: string;
    readonly 压力决策表现?: string;
    readonly 风险防范表现?: string;
    readonly 自我维护表现?: string;
    readonly 目标导向表现?: string;
    readonly 韧性表现?: string;
    readonly 直觉决策特征?: string;
    readonly 复杂应对特征?: string;
    readonly 群体互动特征?: string;
    readonly 边界意识特征?: string;
    readonly 资源获取特征?: string;
    readonly 合作倾向特征?: string;
    readonly 威胁感知特征?: string;
    readonly 不确定性应对?: string;
}

/** 总结提示词生成函数签名 */
export type SummaryPromptGenerator<T> = (data: T) => string;

/** 决策模板上下文 */
export interface DecisionContext {
    readonly situation: string;
    readonly background: string;
    readonly constraints: readonly string[];
    readonly resources: Readonly<Record<string, string>>;
    readonly previousDecisions: readonly string[];
}

/** 决策模板参数 */
export interface DecisionParameters {
    readonly priority: "high" | "medium" | "low";
    readonly timeFrame: string;
    readonly riskTolerance: number;
}

/** 决策模板输入数据 */
export interface DecisionPromptData {
    readonly context: DecisionContext;
    readonly parameters: DecisionParameters;
}
