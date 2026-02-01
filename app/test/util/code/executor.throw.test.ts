import { describe, it, expect, beforeEach } from "vitest";
import { SecureModuleCreator, SecurityError } from "../../../src/util/code/executor";

describe("SecureModuleCreator - throw策略测试", () => {
  let creator: SecureModuleCreator;

  beforeEach(() => {
    creator = new SecureModuleCreator({
      allowedPackages: ["lodash"], // 只允许lodash
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
  });

  it("应该在没有未授权导入时正常工作", async () => {
    const code = `
      import { map } from 'lodash';
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const result = await creator.createSecureModule(code);
    expect(result.moduleUrl).toBeDefined();
    expect(result.cleanup).toBeInstanceOf(Function);
    
    // 读取生成的代码内容而不是执行它
    const fs = await import("fs");
    const normalizedPath = result.moduleUrl.replace(/\\/g, "/");
    const secureCode = fs.readFileSync(normalizedPath, "utf8");
    
    // 验证代码被正确处理（lodash应该被重定向到esm.sh）
    expect(secureCode).toContain("import { map } from 'https://esm.sh/lodash';");
    expect(secureCode).toContain("export function test(data)");
    
    result.cleanup();
  });

  it("应该在有单个未授权导入时在代码开头添加错误语句", async () => {
    const code = `
      import { map } from 'lodash';
      import { useState } from 'react'; // 未授权
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const result = await creator.createSecureModule(code);
    expect(result.moduleUrl).toBeDefined();
    expect(result.cleanup).toBeInstanceOf(Function);
    
    // 读取生成的代码内容
    const fs = await import("fs");
    const normalizedPath = result.moduleUrl.replace(/\\/g, "/");
    const secureCode = fs.readFileSync(normalizedPath, "utf8");
    
    // 验证错误语句在开头
    expect(secureCode).toMatch(/^\/\/ Generated secure module\n\(\(\) => \{ throw new SecurityError\('Package\(s\) "react" are not allowed'\) \}\)\(\);\n/);
    
    // 验证原始导入语句被保留（lodash被重定向到esm.sh）
    expect(secureCode).toContain("import { useState } from 'react';");
    expect(secureCode).toContain("import { map } from 'https://esm.sh/lodash';");
    
    result.cleanup();
  });

  it("应该在有多个未授权导入时在代码开头添加错误语句", async () => {
    const code = `
      import { map } from 'lodash';
      import { useState } from 'react'; // 未授权
      import axios from 'axios'; // 未授权
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const result = await creator.createSecureModule(code);
    expect(result.moduleUrl).toBeDefined();
    expect(result.cleanup).toBeInstanceOf(Function);
    
    // 读取生成的代码内容
    const fs = await import("fs");
    const normalizedPath = result.moduleUrl.replace(/\\/g, "/");
    const secureCode = fs.readFileSync(normalizedPath, "utf8");
    
    // 验证错误语句在开头
    expect(secureCode).toMatch(/^\/\/ Generated secure module\n\(\(\) => \{ throw new SecurityError\('Package\(s\) "react, axios" are not allowed'\) \}\)\(\);\n/);
    
    // 验证原始导入语句被保留（lodash被重定向到esm.sh）
    expect(secureCode).toContain("import { useState } from 'react';");
    expect(secureCode).toContain("import axios from 'axios';");
    expect(secureCode).toContain("import { map } from 'https://esm.sh/lodash';");
    
    result.cleanup();
  });

  it("应该保留原始导入语句而不是替换它们", async () => {
    const code = `
      import { map } from 'lodash';
      import { useState } from 'react'; // 未授权
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    // 直接检查生成的代码内容
    const tempModule = await creator.createSecureModule(code);
    
    // 读取临时文件内容
    const fs = await import("fs");
    const path = await import("path");
    const fileContent = fs.readFileSync(tempModule.moduleUrl, "utf8");
    
    // 验证错误语句在开头
    expect(fileContent).toMatch(/^\/\/ Generated secure module\n\(\(\) => \{ throw new SecurityError\('Package\(s\) "react" are not allowed'\) \}\)\(\);\n/);
    
    // 验证原始导入语句被保留
    expect(fileContent).toContain("import { useState } from 'react';");
    
    tempModule.cleanup();
  });
});