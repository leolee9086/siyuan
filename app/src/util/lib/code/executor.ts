/** 用途：ESM 模块解析器。使用范围：executor 解析模块导入语句。解耦评估：第三方依赖，通过 imports.ts 转发。 */
import { parse } from "es-module-lexer";
/** 用途：源码字符串操作工具。使用范围：executor 转换导入路径。解耦评估：第三方依赖，通过 imports.ts 转发。 */
import MagicString from "magic-string";
import { ConfigManager, isBareModule } from "./configManager";
import type {
  ImportHandlingOptions,
  SecureModuleCreatorConfig,
  TemporaryModule,
} from "./executor.types";
import {
  判断是否为外部包,
  提取包名,
  根据策略处理导入,
  创建临时模块,
} from "./executor.helpers";

/**
 * 安全模块创建器类
 * 用于创建安全的临时 ESM 模块，排除白名单以外的包
 * 支持动态白名单更新
 */
export class SecureModuleCreator {
  /** 配置管理器实例 */
  readonly configManager: ConfigManager;
  /** 默认导入处理选项 */
  readonly defaultOptions: ImportHandlingOptions;
  /** 是否已初始化 */
  initialized = false;

  constructor(config: SecureModuleCreatorConfig) {
    this.configManager = new ConfigManager(
      config.allowedPackages ?? [],
      config.packagePatterns ?? [],
      config.autoAllowScoped ?? false,
      config.moduleRedirectConfig ?? {
        defaultServer: "https://esm.sh",
        packageRedirects: {},
        enabled: false,
        bareModulesOnly: true
      }
    );
    this.defaultOptions = config.defaultOptions ?? {
      onUnauthorizedImport: "throw",
      customMocks: {}
    };
  }

  /**
   * 获取配置管理器实例
   */
  get config(): ConfigManager {
    return this.configManager;
  }

  /**
   * 确保 es-module-lexer 已初始化
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await parse;
    this.initialized = true;
  }

  /**
   * 创建安全模块
   */
  async createSecureModule(
    code: string,
    options: Partial<ImportHandlingOptions> = {}
  ): Promise<TemporaryModule> {
    await this.ensureInitialized();

    const finalOptions: ImportHandlingOptions = {
      ...this.defaultOptions,
      ...options
    };

    const secureCode = this.transformCode(code, finalOptions);
    return 创建临时模块(secureCode);
  }

  /**
   * 判断包是否被允许
   */
  isPackageAllowed(packageName: string): boolean {
    return this.configManager.isPackageAllowed(packageName);
  }

  /**
   * 转换代码，处理不安全的导入
   */
  transformCode(code: string, options: ImportHandlingOptions): string {
    const imports = parse(code)[0] ?? [];
    const magicString = new MagicString(code);
    let hasUnauthorizedImports = false;
    const unauthorizedPackages: string[] = [];

    for (const importSpec of imports) {
      const importSource = code.substring(importSpec.s, importSpec.e);

      if (!判断是否为外部包(importSource)) {
        continue;
      }

      const packageName = 提取包名(importSource);

      // 先进行安全检查，基于原始包名
      if (!this.isPackageAllowed(packageName)) {
        hasUnauthorizedImports = true;
        unauthorizedPackages.push(packageName);
        根据策略处理导入(
          magicString,
          importSpec,
          packageName,
          options.onUnauthorizedImport,
          options.customMocks
        );
        continue; // 如果包不被允许，跳过重定向处理
      }

      // 检查是否需要模块重定向
      this.applyRedirectIfNeeded(magicString, importSpec, importSource, packageName);
    }

    // 如果有未授权导入且策略是 throw，在代码开头添加错误抛出
    if (hasUnauthorizedImports && options.onUnauthorizedImport === "throw") {
      const uniquePackages = Array.from(new Set(unauthorizedPackages));
      const errorMessage = `Package(s) "${uniquePackages.join(", ")}" are not allowed`;
      // 在代码开头添加错误抛出语句，确保没有任何其他代码执行
      console.warn("检测到未授权的导入并已完全阻止代码执行");
      const errorCode = `// Generated secure module\n(() => { throw new SecurityError('${errorMessage}') })();\n`;
      return errorCode + magicString.toString();
    }

    return magicString.toString();
  }

  /**
   * 应用模块重定向（如果需要）
   */
  applyRedirectIfNeeded(
    magicString: MagicString,
    importSpec: { s: number; e: number },
    importSource: string,
    packageName: string
  ): void {
    const redirectConfig = this.configManager.getModuleRedirectConfig();
    if (!redirectConfig.enabled) {
      return;
    }

    // 检查是否为裸模块
    const bareModuleCheck = isBareModule(importSource);

    // 如果配置了只重定向裸模块，则只处理裸模块
    if (redirectConfig.bareModulesOnly && !bareModuleCheck) {
      return;
    }

    // 先检查是否有特定的重定向规则
    let redirectUrl = this.configManager.getPackageRedirectUrl(packageName);

    // 如果没有特定规则，使用默认服务器生成URL
    if (!redirectUrl) {
      redirectUrl = this.configManager.generateRedirectUrl(packageName);
    }

    if (!redirectUrl) {
      return;
    }

    // 替换导入源为重定向URL
    magicString.overwrite(importSpec.s, importSpec.e, redirectUrl);
  }
}

/**
 * 安全错误类
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

// 从工厂模块重新导出便捷函数（保持向后兼容）
import { createTemporaryModule, createSecureTemporaryModule, createDynamicSecureTemporaryModule } from "./executor.factory";
export { createTemporaryModule, createSecureTemporaryModule, createDynamicSecureTemporaryModule };
