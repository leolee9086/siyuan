import { describe, it, expect, beforeEach } from "vitest";

import { SecureModuleCreator } from "../../../src/util/lib/code/executor";

// 模拟 Node.js 环境

describe("SecureModuleCreator Node.js 环境测试", () => {

  it("应该能够在 Node.js 环境下创建临时模块", async () => {
    const secureModuleCreator = new SecureModuleCreator({
      allowedPackages: [],
      packagePatterns: [],
      autoAllowScoped: false,
      defaultOptions: {
        onUnauthorizedImport: "throw",
        customMocks: {}
      },
      moduleRedirectConfig: {
        defaultServer: "https://esm.sh",
        packageRedirects: {},
        enabled: true,
        bareModulesOnly: true
      }
    });

    // 测试简单的模块代码
    const moduleCode = `
      export const value = 123;
      export function getValue() {
        return value;
      }
    `;
    
    // 这应该能够在 Node.js 环境下正常工作
    const result = await secureModuleCreator.createSecureModule(moduleCode);
    expect(result.moduleUrl).toBeDefined();
    expect(result.cleanup).toBeDefined();
    expect(result.moduleExport).toBeDefined();
    
    // 验证模块导出
    if (result.moduleExport && typeof result.moduleExport === "object") {
      expect(result.moduleExport.value).toBe(123);
      expect(typeof result.moduleExport.getValue).toBe("function");
    }
    
    result.cleanup();
  });

  it("应该能够处理没有导入的代码", async () => {
    const secureModuleCreator = new SecureModuleCreator({
      allowedPackages: [],
      packagePatterns: [],
      autoAllowScoped: false,
      defaultOptions: {
        onUnauthorizedImport: "throw",
        customMocks: {}
      },
      moduleRedirectConfig: {
        defaultServer: "https://esm.sh",
        packageRedirects: {},
        enabled: true,
        bareModulesOnly: true
      }
    });

    // 测试没有导入的代码
    const codeWithoutImports = `
      export function test() {
        return 42;
      }
    `;
    
    // 这应该不会抛出 "imports is not iterable" 错误
    const result = await secureModuleCreator.createSecureModule(codeWithoutImports);
    expect(result.moduleUrl).toBeDefined();
    expect(result.cleanup).toBeDefined();
    expect(result.moduleExport).toBeDefined();
    
    result.cleanup();
  });
});
