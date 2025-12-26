import type { ConfigSummary, ModuleRedirectConfig } from "./executor.types";

/**
 * 判断是否为裸模块
 * 裸模块是指不以 './', '../', '/', 'http://', 'https://' 开头的模块
 */
export function isBareModule(importSource: string): boolean {
  // 移除查询参数和哈希
  const cleanSource = (importSource.split("?")[0] ?? "").split("#")[0] ?? "";

  return !cleanSource.startsWith("./") &&
    !cleanSource.startsWith("../") &&
    !cleanSource.startsWith("/") &&
    !cleanSource.startsWith("http://") &&
    !cleanSource.startsWith("https://");
}

/**
 * 配置管理器类
 * 负责管理安全模块创建器的配置，包括允许的包、模式等
 */
export class ConfigManager {
  private allowedPackages: Set<string>;
  private packagePatterns: RegExp[];
  private autoAllowScoped: boolean;
  private dynamicPatterns: Map<string, RegExp>;
  private scopedPrefixes: Set<string>;
  private moduleRedirectConfig: ModuleRedirectConfig;

  constructor(
    allowedPackages: string[] = [],
    packagePatterns: RegExp[] = [],
    autoAllowScoped: boolean = false,
    moduleRedirectConfig: ModuleRedirectConfig = {
      defaultServer: "https://esm.sh",
      packageRedirects: {},
      enabled: false,
      bareModulesOnly: true
    }
  ) {
    this.allowedPackages = new Set(allowedPackages);
    this.packagePatterns = [...packagePatterns];
    this.autoAllowScoped = autoAllowScoped;
    this.dynamicPatterns = new Map();
    this.scopedPrefixes = new Set();
    this.moduleRedirectConfig = moduleRedirectConfig;
  }

  /**
   * 添加允许的包
   */
  addAllowedPackage(packageName: string): void {
    this.allowedPackages.add(packageName);
  }

  /**
   * 移除允许的包
   */
  removeAllowedPackage(packageName: string): boolean {
    return this.allowedPackages.delete(packageName);
  }

  /**
   * 添加包名模式
   */
  addPackagePattern(pattern: RegExp): void {
    this.packagePatterns.push(pattern);
  }

  /**
   * 设置自动允许作用域
   */
  setAutoAllowScoped(autoAllow: boolean): void {
    this.autoAllowScoped = autoAllow;
  }

  /**
   * 添加动态包名模式
   */
  addDynamicPattern(name: string, pattern: RegExp): void {
    this.dynamicPatterns.set(name, pattern);
  }

  /**
   * 移除动态包名模式
   */
  removeDynamicPattern(name: string): boolean {
    return this.dynamicPatterns.delete(name);
  }

  /**
   * 添加作用域前缀
   */
  addScopedPrefix(prefix: string): void {
    this.scopedPrefixes.add(prefix);
  }

  /**
   * 移除作用域前缀
   */
  removeScopedPrefix(prefix: string): boolean {
    return this.scopedPrefixes.delete(prefix);
  }

  /**
   * 获取所有动态模式
   */
  getDynamicPatterns(): Map<string, RegExp> {
    return new Map(this.dynamicPatterns);
  }

  /**
   * 获取所有作用域前缀
   */
  getScopedPrefixes(): Set<string> {
    return new Set(this.scopedPrefixes);
  }

  /**
   * 批量添加允许的包
   */
  addAllowedPackages(packageNames: string[]): void {
    for (const packageName of packageNames) {
      this.addAllowedPackage(packageName);
    }
  }

  /**
   * 批量移除允许的包
   */
  removeAllowedPackages(packageNames: string[]): void {
    for (const packageName of packageNames) {
      this.removeAllowedPackage(packageName);
    }
  }

  /**
   * 清空所有动态配置
   */
  clearDynamicConfig(): void {
    this.dynamicPatterns.clear();
    this.scopedPrefixes.clear();
  }

  /**
   * 获取模块重定向配置
   */
  getModuleRedirectConfig(): ModuleRedirectConfig {
    return { ...this.moduleRedirectConfig };
  }

  /**
   * 设置模块重定向配置
   */
  setModuleRedirectConfig(config: Partial<ModuleRedirectConfig>): void {
    this.moduleRedirectConfig = {
      ...this.moduleRedirectConfig,
      ...config
    };
  }

  /**
   * 启用/禁用模块重定向
   */
  setModuleRedirectEnabled(enabled: boolean): void {
    this.moduleRedirectConfig.enabled = enabled;
  }

  /**
   * 设置默认模块服务器
   */
  setDefaultModuleServer(server: string): void {
    this.moduleRedirectConfig.defaultServer = server;
  }

  /**
   * 添加包重定向规则
   */
  addPackageRedirect(packageName: string, redirectUrl: string): void {
    this.moduleRedirectConfig.packageRedirects[packageName] = redirectUrl;
  }

  /**
   * 移除包重定向规则
   */
  removePackageRedirect(packageName: string): boolean {
    if (packageName in this.moduleRedirectConfig.packageRedirects) {
      delete this.moduleRedirectConfig.packageRedirects[packageName];
      return true;
    }
    return false;
  }

  /**
   * 获取包的重定向URL
   */
  getPackageRedirectUrl(packageName: string): string | null {
    return this.moduleRedirectConfig.packageRedirects[packageName] || null;
  }



  /**
   * 生成重定向后的模块URL
   */
  generateRedirectUrl(packageName: string): string | null {
    if (!this.moduleRedirectConfig.enabled) {
      return null;
    }

    // 如果有特定的重定向规则，优先使用
    if (this.moduleRedirectConfig.packageRedirects[packageName]) {
      return this.moduleRedirectConfig.packageRedirects[packageName];
    }

    // 如果只重定向裸模块，检查是否为裸模块
    if (this.moduleRedirectConfig.bareModulesOnly && !isBareModule(packageName)) {
      return null;
    }

    // 使用默认服务器生成URL，保留完整的包路径（包括子路径）
    return `${this.moduleRedirectConfig.defaultServer}/${packageName}`;
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary(): ConfigSummary {
    return {
      staticAllowedPackages: Array.from(this.allowedPackages),
      dynamicPatterns: Array.from(this.dynamicPatterns.entries()).map(([name, pattern]) => ({
        name,
        pattern: pattern.source
      })),
      scopedPrefixes: Array.from(this.scopedPrefixes)
    };
  }

  /**
   * 判断包是否被允许
   */
  isPackageAllowed(packageName: string): boolean {
    // 检查精确匹配
    if (this.allowedPackages.has(packageName)) {
      return true;
    }

    // 检查模式匹配
    if (this.packagePatterns.some(pattern => packageName.match(pattern))) {
      return true;
    }

    // 自动允许特定作用域的包
    if (this.autoAllowScoped && packageName.startsWith("@company/")) {
      return true;
    }

    // 检查动态模式
    for (const [name, pattern] of this.dynamicPatterns) {
      if (packageName.match(pattern)) {
        return true;
      }
    }

    // 检查作用域前缀
    for (const prefix of this.scopedPrefixes) {
      if (packageName.startsWith(prefix)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取当前配置的副本
   */
  getConfigSnapshot(): {
    allowedPackages: Set<string>;
    packagePatterns: RegExp[];
    autoAllowScoped: boolean;
    dynamicPatterns: Map<string, RegExp>;
    scopedPrefixes: Set<string>;
    moduleRedirectConfig: ModuleRedirectConfig;
  } {
    return {
      allowedPackages: new Set(this.allowedPackages),
      packagePatterns: [...this.packagePatterns],
      autoAllowScoped: this.autoAllowScoped,
      dynamicPatterns: new Map(this.dynamicPatterns),
      scopedPrefixes: new Set(this.scopedPrefixes),
      moduleRedirectConfig: { ...this.moduleRedirectConfig }
    };
  }
}