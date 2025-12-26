import { z } from "zod";

/**
 * 未授权导入处理策略
 */
export const UnauthorizedImportStrategySchema = z.enum(["throw", "mock", "remove"]);

/**
 * 导入处理选项
 */
export const ImportHandlingOptionsSchema = z.object({
  /** 未授权导入的处理策略 */
  onUnauthorizedImport: UnauthorizedImportStrategySchema.default("throw"),
  /** 自定义模拟对象 */
  customMocks: z.record(z.string(), z.any()).default({}),
});

/**
 * 模块重定向配置
 */
export const ModuleRedirectConfigSchema = z.object({
  /** 默认模块服务器 */
  defaultServer: z.string().default("https://esm.sh"),
  /** 包特定的重定向规则 */
  packageRedirects: z.record(z.string(), z.string()).default({}),
  /** 是否启用模块重定向 */
  enabled: z.boolean().default(false), // 默认禁用
  /** 是否只重定向裸模块 */
  bareModulesOnly: z.boolean().default(true), // 只重定向裸模块
});

/**
 * 模块重定向规则
 */
export const ModuleRedirectRuleSchema = z.object({
  /** 包名模式 */
  pattern: z.string(),
  /** 重定向到的URL模板，可以使用${packageName}变量 */
  urlTemplate: z.string(),
  /** 是否启用 */
  enabled: z.boolean().default(true),
});

/**
 * 安全模块创建器配置
 */
export const SecureModuleCreatorConfigSchema = z.object({
  /** 允许的包名列表 */
  allowedPackages: z.array(z.string()).optional().default([]),
  /** 包名模式匹配 */
  packagePatterns: z.array(z.instanceof(RegExp)).optional().default([]),
  /** 是否自动允许特定作用域的包 */
  autoAllowScoped: z.boolean().optional().default(false),
  /** 默认导入处理选项 */
  defaultOptions: ImportHandlingOptionsSchema.optional().default({
    onUnauthorizedImport: "throw",
    customMocks: {}
  }),
  /** 模块重定向配置 */
  moduleRedirectConfig: ModuleRedirectConfigSchema.optional().default({
    defaultServer: "https://esm.sh",
    packageRedirects: {},
    enabled: false,
    bareModulesOnly: true
  }),
});

/**
 * 配置管理器配置
 */
export const ConfigManagerConfigSchema = z.object({
  /** 允许的包名列表 */
  allowedPackages: z.array(z.string()).optional().default([]),
  /** 包名模式匹配 */
  packagePatterns: z.array(z.instanceof(RegExp)).optional().default([]),
  /** 是否自动允许特定作用域的包 */
  autoAllowScoped: z.boolean().optional().default(false),
});

/**
 * 配置摘要
 */
export const ConfigSummarySchema = z.object({
  /** 静态允许的包列表 */
  staticAllowedPackages: z.array(z.string()),
  /** 动态模式列表 */
  dynamicPatterns: z.array(z.object({
    name: z.string(),
    pattern: z.string()
  })),
  /** 作用域前缀列表 */
  scopedPrefixes: z.array(z.string()),
});

/**
 * 临时ESM模块信息
 */
export const TemporaryModuleSchema = z.object({
  /** 模块URL */
  moduleUrl: z.string(),
  /** 模块导出 */
  moduleExport: z.any(),
  /** 清理函数 */
  cleanup: z.function().input().output(z.void()),
  /** 错误信息（如果有） */
  error: z.string().optional(),
  /** 是否有错误 */
  hasError: z.boolean().optional(),
});

/**
 * 导入规范
 */
export const ImportSpecSchema = z.object({
  /** 导入语句的起始位置 */
  s: z.number(),
  /** 导入语句的结束位置 */
  e: z.number(),
  /** 导入类型 */
  d: z.number(),
  /** 导入语句 */
  ss: z.number(),
});

/**
 * 导出类型
 */
export type UnauthorizedImportStrategy = z.infer<typeof UnauthorizedImportStrategySchema>;
export type ImportHandlingOptions = z.infer<typeof ImportHandlingOptionsSchema>;
export type SecureModuleCreatorConfig = z.infer<typeof SecureModuleCreatorConfigSchema>;
export type ConfigManagerConfig = z.infer<typeof ConfigManagerConfigSchema>;
export type ConfigSummary = z.infer<typeof ConfigSummarySchema>;
export type ModuleRedirectConfig = z.infer<typeof ModuleRedirectConfigSchema>;
export type ModuleRedirectRule = z.infer<typeof ModuleRedirectRuleSchema>;
export type TemporaryModule = z.infer<typeof TemporaryModuleSchema>;
export type ImportSpec = z.infer<typeof ImportSpecSchema>;

/**
 * 应用模块重定向参数
 */
export interface 重定向参数 {
  magicString: unknown; // MagicString 类型
  importSpec: { s: number; e: number };
  importSource: string;
  packageName: string;
  redirectConfig: ModuleRedirectConfig;
  getPackageRedirectUrl: (name: string) => string | null;
  generateRedirectUrl: (name: string) => string | null;
}

/**
 * 代码转换参数
 */
export interface 代码转换参数 {
  code: string;
  options: ImportHandlingOptions;
  isPackageAllowed: (name: string) => boolean;
  getModuleRedirectConfig: () => ModuleRedirectConfig;
  getPackageRedirectUrl: (name: string) => string | null;
  generateRedirectUrl: (name: string) => string | null;
}
