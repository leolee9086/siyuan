import { describe, it, expect, beforeEach } from "vitest";
import { SecureModuleCreator } from "../../../src/util/lib/code/executor";

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

  it("应该在没有未授权导入时正常工作", () => {
    const code = `
      import { map } from 'lodash';
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const secureCode = creator.transformCode(code, creator.defaultOptions);
    
    // 验证代码被正确处理（lodash应该被重定向到esm.sh）
    expect(secureCode).toContain("import { map } from 'https://esm.sh/lodash';");
    expect(secureCode).toContain("export function test(data)");
    
  });

  it("应该在有单个未授权导入时在代码开头添加错误语句", () => {
    const code = `
      import { map } from 'lodash';
      import { useState } from 'react'; // 未授权
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const secureCode = creator.transformCode(code, creator.defaultOptions);
    
    // 验证错误语句在开头
    expect(secureCode).toMatch(/^\/\/ Generated secure module\n\(\(\) => \{ throw new SecurityError\('Package\(s\) "react" are not allowed'\) \}\)\(\);\n/);
    
    // 验证原始导入语句被保留（lodash被重定向到esm.sh）
    expect(secureCode).toContain("import { useState } from 'react';");
    expect(secureCode).toContain("import { map } from 'https://esm.sh/lodash';");
    
  });

  it("应该在有多个未授权导入时在代码开头添加错误语句", () => {
    const code = `
      import { map } from 'lodash';
      import { useState } from 'react'; // 未授权
      import axios from 'axios'; // 未授权
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const secureCode = creator.transformCode(code, creator.defaultOptions);
    
    // 验证错误语句在开头
    expect(secureCode).toMatch(/^\/\/ Generated secure module\n\(\(\) => \{ throw new SecurityError\('Package\(s\) "react, axios" are not allowed'\) \}\)\(\);\n/);
    
    // 验证原始导入语句被保留（lodash被重定向到esm.sh）
    expect(secureCode).toContain("import { useState } from 'react';");
    expect(secureCode).toContain("import axios from 'axios';");
    expect(secureCode).toContain("import { map } from 'https://esm.sh/lodash';");
    
  });

  it("应该保留原始导入语句而不是替换它们", () => {
    const code = `
      import { map } from 'lodash';
      import { useState } from 'react'; // 未授权
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const fileContent = creator.transformCode(code, creator.defaultOptions);
    
    // 验证错误语句在开头
    expect(fileContent).toMatch(/^\/\/ Generated secure module\n\(\(\) => \{ throw new SecurityError\('Package\(s\) "react" are not allowed'\) \}\)\(\);\n/);
    
    // 验证原始导入语句被保留
    expect(fileContent).toContain("import { useState } from 'react';");
    
  });
});
