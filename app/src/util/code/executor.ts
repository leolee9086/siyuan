import { parse } from 'es-module-lexer';
import MagicString from 'magic-string';
import { ConfigManager } from './configManager';
import type {
  UnauthorizedImportStrategy,
  ImportHandlingOptions,
  SecureModuleCreatorConfig,
  TemporaryModule,
  ImportSpec,
  ModuleRedirectConfig
} from './executor.types';

/**
 * 安全模块创建器类
 * 用于创建安全的临时 ESM 模块，排除白名单以外的包
 * 支持动态白名单更新
 */
export class SecureModuleCreator {
  private configManager: ConfigManager;
  private defaultOptions: ImportHandlingOptions;
  private initialized: boolean = false;

  constructor(config: SecureModuleCreatorConfig) {
    this.configManager = new ConfigManager(
      config.allowedPackages || [],
      config.packagePatterns || [],
      config.autoAllowScoped || false,
      config.moduleRedirectConfig || {
        defaultServer: 'https://esm.sh',
        packageRedirects: {},
        enabled: false,
        bareModulesOnly: true
      }
    );
    this.defaultOptions = config.defaultOptions || {
      onUnauthorizedImport: 'throw',
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
   * 初始化 esm-module-lexer
   */
  private async init(): Promise<void> {
    if (!this.initialized) {
      await parse;
      this.initialized = true;
    }
  }

  /**
   * 创建安全模块
   */
  async createSecureModule(
    code: string,
    options: Partial<ImportHandlingOptions> = {}
  ): Promise<TemporaryModule> {
    await this.init();
    
    const finalOptions: ImportHandlingOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    const imports = parse(code)[0] || [];
    const magicString = new MagicString(code);
    let hasUnauthorizedImports = false;
    const unauthorizedPackages: string[] = [];
    
    for (const importSpec of imports) {
      const importSource = code.substring(importSpec.s, importSpec.e);
      
      if (this.isExternalPackage(importSource)) {
        const packageName = this.extractPackageName(importSource);
        
        // 先进行安全检查，基于原始包名
        if (!this.isPackageAllowed(packageName)) {
          hasUnauthorizedImports = true;
          unauthorizedPackages.push(packageName);
          this.handleImportBasedOnStrategy(
            magicString,
            importSpec ,
            packageName,
            finalOptions.onUnauthorizedImport,
            finalOptions.customMocks
          );
          continue; // 如果包不被允许，跳过重定向处理
        }
        
        // 检查是否需要模块重定向
        const redirectConfig = this.configManager.getModuleRedirectConfig();
        if (redirectConfig.enabled) {
          // 检查是否为裸模块
          const isBareModule = this.configManager.isBareModule(importSource);
          
          // 如果配置了只重定向裸模块，则只处理裸模块
          if (!redirectConfig.bareModulesOnly || isBareModule) {
            // 先检查是否有特定的重定向规则
            let redirectUrl = this.configManager.getPackageRedirectUrl(packageName);
            
            // 如果没有特定规则，使用默认服务器生成URL
            if (!redirectUrl) {
              redirectUrl = this.configManager.generateRedirectUrl(packageName);
            }
            
            if (redirectUrl) {
              // 替换导入源为重定向URL
              magicString.overwrite(importSpec.s, importSpec.e, redirectUrl);
            }
          }
        }
      }
    }
    
    // 如果有未授权导入且策略是 throw，完全替换代码为错误抛出
    if (hasUnauthorizedImports && finalOptions.onUnauthorizedImport === 'throw') {
      const uniquePackages = [...new Set(unauthorizedPackages)];
      const errorMessage = `Package(s) "${uniquePackages.join(', ')}" are not allowed`;
      // 完全替换代码，只保留错误抛出语句，确保没有任何其他代码执行
      const secureCode = `(() => { throw new Error('${errorMessage}') })();`;
      console.warn('检测到未授权的导入并已完全阻止代码执行');
      return this.createTemporaryModule(secureCode);
    }
    
    const secureCode = magicString.toString();
    return this.createTemporaryModule(secureCode);
  }

  /**
   * 判断是否为外部包
   */
  private isExternalPackage(importSource: string): boolean {
    return !importSource.startsWith('.') &&
           !importSource.startsWith('/') &&
           !importSource.startsWith('http:') &&
           !importSource.startsWith('https:');
  }

  /**
   * 提取包名
   */
  private extractPackageName(importSource: string): string {
    // 移除查询参数和哈希
    const cleanSource = importSource.split('?')[0].split('#')[0];
    
    if (cleanSource.startsWith('@')) {
      const parts = cleanSource.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : cleanSource;
    }
    
    // 对于普通包名，返回完整的导入路径（包括子路径）
    // 这样可以正确处理如 'echarts/lib/util/graphic' 这样的导入
    return cleanSource;
  }

  /**
   * 判断包是否被允许
   */
  protected isPackageAllowed(packageName: string): boolean {
    return this.configManager.isPackageAllowed(packageName);
  }

  /**
   * 根据策略处理导入
   */
  private handleImportBasedOnStrategy(
    magicString: MagicString,
    importSpec: ImportSpec,
    packageName: string,
    strategy: UnauthorizedImportStrategy,
    customMocks: Record<string, string>
  ): void {
    const { s, e } = importSpec;
    
    switch (strategy) {
      case 'throw':
        // 对于 'throw' 策略，不替换导入语句，保留原导入语句
        // 错误将在代码开头统一添加
        break;
        
      case 'mock':
        const mockCode = customMocks[packageName] || this.createDefaultMock(packageName);
        magicString.overwrite(s, e, mockCode);
        break;
        
      case 'remove':
        // 移除整个导入语句
        const lineEnd = magicString.original.indexOf('\n', e);
        if (lineEnd !== -1) {
          magicString.remove(s, lineEnd + 1);
        } else {
          magicString.remove(s, e);
        }
        break;
        
      default:
        throw new Error(`未知策略: ${strategy}`);
    }
  }

  /**
   * 创建默认模拟对象
   */
  private createDefaultMock(packageName: string): string {
    return `/* Mock ${packageName} */ (() => {
      console.warn('Package ${packageName} was mocked for security reasons');
      return {};
    })()`;
  }

  /**
   * 创建临时模块
   */
  private async createTemporaryModule(code: string): Promise<TemporaryModule> {
    // 检查是否在 Node.js 环境中
    const isNodeJS = typeof window === 'undefined' && typeof process !== 'undefined';
    
    if (isNodeJS) {
      // Node.js 环境下的特殊处理
      ///#if !BROWSER
      return this.createNodeJSTemporaryModule(code);
      ///#endif
    } else {
      // 浏览器环境下的处理
      return this.createBrowserTemporaryModule(code);
    }
  }

  /**
   * 在浏览器环境中创建临时模块
   */
  private async createBrowserTemporaryModule(code: string): Promise<TemporaryModule> {
    // 创建 Blob URL
    const blob = new Blob([code], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);
    
    try {
      const moduleExport = await import(/* webpackIgnore: true */ moduleUrl);
      // 返回模块信息和清理函数
      console.log(moduleExport)
      return {
        moduleUrl,
        moduleExport: moduleExport,
        cleanup: () => {
          URL.revokeObjectURL(moduleUrl);
        },
        hasError: false
      };
    } catch (error) {
      // 如果导入失败，清理URL并返回包含错误信息的结果
      URL.revokeObjectURL(moduleUrl);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        moduleUrl,
        moduleExport: null,
        cleanup: () => {
          // 空清理函数，因为URL已经被清理
        },
        error: errorMessage,
        hasError: true
      };
    }
  }

  /**
   * 在 Node.js 环境中创建临时模块
   */
  ///#if !BROWSER
  private async createNodeJSTemporaryModule(code: string): Promise<TemporaryModule> {
    const { writeFileSync, mkdirSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    const { createHash } = await import('crypto');
    
    // 创建临时目录
    const tempDir = join(tmpdir(), 'secure-modules');
    try {
      mkdirSync(tempDir, { recursive: true });
    } catch (error) {
      // 目录可能已存在，忽略错误
    }
    
    // 从代码中提取包名，用于生成哈希
    const packageNames = this.extractPackageNamesFromCode(code);
    const packageHash = packageNames.length > 0
      ? createHash('md5').update(packageNames.join(',')).digest('hex').substring(0, 8)
      : createHash('md5').update(code).digest('hex').substring(0, 8);
    
    // 创建临时文件，使用包名相关的哈希
    const fileName = `module-${packageHash}-${Date.now()}.js`;
    const filePath = join(tempDir, fileName);
    
    try {
      // 写入代码到临时文件
      writeFileSync(filePath, code, 'utf8');
      console.log(filePath,code)
      // 使用动态 import 导入模块
      const moduleUrl = `${filePath}`;
      const moduleExport = await import(/* webpackIgnore: true */moduleUrl);
      
      // 返回模块信息和清理函数
      return {
        moduleUrl,
        moduleExport: moduleExport,
        cleanup: () => {
          // 不删除文件，让测试可以读取
        },
        hasError: false
      };
      
    } catch (error) {
      // 如果失败，清理文件并返回包含错误信息的结果
    
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        moduleUrl: filePath,
        moduleExport: null,
        cleanup: () => {
          // 不删除文件，让测试可以读取
        },
        error: errorMessage,
        hasError: true
      };
    }
  }
  ///#endif
  /**
   * 从代码中提取包名
   */
  private extractPackageNamesFromCode(code: string): string[] {
    const packageNames: string[] = [];
    const imports = parse(code)[0] || [];
    
    for (const importSpec of imports) {
      const importSource = code.substring(importSpec.s, importSpec.e);
      
      if (this.isExternalPackage(importSource)) {
        const packageName = this.extractPackageName(importSource);
        packageNames.push(packageName);
      }
    }
    
    return packageNames;
  }

}

/**
 * 安全错误类
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * 创建临时ESM模块（保持向后兼容）
 */
export async function createTemporaryModule(code: string): Promise<TemporaryModule> {
  // 创建默认的安全模块创建器
  const creator = new SecureModuleCreator({
    allowedPackages: [],
    packagePatterns: [],
    autoAllowScoped: false,
    defaultOptions: {
      onUnauthorizedImport: 'throw',
      customMocks: {}
    },
    moduleRedirectConfig: {
      defaultServer: 'https://esm.sh',
      packageRedirects: {},
      enabled: false,
      bareModulesOnly: true
    }
  });
  return creator.createSecureModule(code);
}

/**
 * 创建带有自定义安全配置的临时模块
 * @param code 要执行的代码
 * @param options 安全配置选项
 * @returns 安全的模块 URL
 */
export async function createSecureTemporaryModule(
  code: string,
  options: {
    allowedPackages?: string[];
    packagePatterns?: RegExp[];
    autoAllowScoped?: boolean;
    onUnauthorizedImport?: 'throw' | 'mock' | 'remove';
    customMocks?: Record<string, any>;
    moduleRedirectConfig?: {
      defaultServer?: string;
      packageRedirects?: Record<string, string>;
      enabled?: boolean;
      bareModulesOnly?: boolean;
    };
  } = {}
): Promise<TemporaryModule> {
  const creator = new SecureModuleCreator({
    allowedPackages: options.allowedPackages || [],
    packagePatterns: options.packagePatterns || [],
    autoAllowScoped: options.autoAllowScoped || false,
    defaultOptions: {
      onUnauthorizedImport: options.onUnauthorizedImport || 'throw',
      customMocks: options.customMocks || {}
    },
    moduleRedirectConfig: {
      defaultServer: options.moduleRedirectConfig?.defaultServer || 'https://esm.sh',
      packageRedirects: options.moduleRedirectConfig?.packageRedirects || {},
      enabled: options.moduleRedirectConfig?.enabled ?? false,
      bareModulesOnly: options.moduleRedirectConfig?.bareModulesOnly ?? true
    }
  });
  
  return await creator.createSecureModule(code);
}

/**
 * 创建带有动态白名单的临时模块
 * @param code 要执行的代码
 * @param options 动态安全配置选项
 * @returns 安全的模块 URL
 */
export async function createDynamicSecureTemporaryModule(
  code: string,
  options: {
    allowedPackages?: string[];
    packagePatterns?: RegExp[];
    autoAllowScoped?: boolean;
    onUnauthorizedImport?: 'throw' | 'mock' | 'remove';
    customMocks?: Record<string, any>;
  } = {}
): Promise<TemporaryModule> {
  const creator = new SecureModuleCreator({
    allowedPackages: options.allowedPackages || [],
    packagePatterns: options.packagePatterns || [],
    autoAllowScoped: options.autoAllowScoped || false,
    defaultOptions: {
      onUnauthorizedImport: options.onUnauthorizedImport || 'throw',
      customMocks: options.customMocks || {}
    },
    moduleRedirectConfig: {
      defaultServer: 'https://esm.sh',
      packageRedirects: {},
      enabled: false,
      bareModulesOnly: true
    }
  });
  
  return await creator.createSecureModule(code);
}
