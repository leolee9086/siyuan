/**
 * @fileoverview 提示词模板参数类型定义
 * @description 定义三贤人提示词模板函数所需的特征集接口
 */

/** 行为准则 */
export interface 行为准则接口 {
    优先级: string[];
    禁忌事项: string[];
    核心原则: string[];
}

/** 认知控制主导特征（MELCHIOR用） */
export interface 认知控制特征 {
    认知模式: {
        分析能力: {
            逻辑推理: number;
            数据处理: number;
            模式识别: number;
            优先级: string[];
        };
        决策风格: {
            风险评估: number;
            判断标准: string[];
            决策链路: string[];
        };
    };
    执行控制: {
        抑制能力: number;
        任务切换: number;
        工作记忆: number;
        注意分配: {
            持续性: number;
            选择性: number;
            分配策略: string[];
        };
    };
    元认知: {
        自我监控: number;
        错误检测: number;
        策略调整: number;
        认知风格: string;
    };
}

/** 情感调节主导特征（BALTHAZAR用） */
export interface 情感调节特征 {
    情绪识别: {
        自我觉察: number;
        他人识别: number;
        情境理解: number;
        识别模式: string[];
    };
    情绪加工: {
        强度调节: number;
        持续管理: number;
        转换能力: number;
        调节策略: string[];
    };
    社交互动: {
        互动模式: {
            主动性: number;
            回应性: number;
            适应性: number;
        };
        关系处理: {
            亲密度调节: number;
            界限维持: number;
            冲突管理: number;
        };
    };
    共情能力: {
        认知共情: number;
        情感共情: number;
        行为表达: number;
    };
}

/** MELCHIOR特征集接口 */
export interface MELCHIOR特征集接口 {
    系统定位: string;
    核心职责: string;
    主导特征: 认知控制特征;
    辅助参考: Record<string, unknown>;
    行为准则: 行为准则接口;
}

/** BALTHAZAR特征集接口 */
export interface BALTHAZAR特征集接口 {
    系统定位: string;
    核心职责: string;
    主导特征: 情感调节特征;
    辅助参考: Record<string, unknown>;
    行为准则: 行为准则接口;
}
