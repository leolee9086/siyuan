import { describe, it, expect, beforeEach } from 'vitest';
import { SecureModuleCreator, SecurityError } from '../../../src/util/code/executor';

describe('SecureModuleCreator - throw策略测试', () => {
  let creator: SecureModuleCreator;

  beforeEach(() => {
    creator = new SecureModuleCreator({
      allowedPackages: ['lodash'], // 只允许lodash
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
  });

  it('应该在没有未授权导入时正常工作', async () => {
    const code = `
      import { map } from 'lodash';
      export function test(data) {
        return map(data, x => x * 2);
      }
    `;

    const result = await creator.createSecureModule(code);
    expect(result.moduleUrl).toBeDefined();
    expect(result.cleanup).toBeInstanceOf(Function);
    
    // 验证代码没有被修改
    const secureCode = await import(result.moduleUrl);
    expect(secureCode.test).toBeDefined();
    expect(secureCode.test([1, 2, 3])).toEqual([2, 4, 6]);
    
    result.cleanup();
  });

  it('应该在有单个未授权导入时在代码开头添加错误语句', async () => {
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
    
    // Error
    try {
      await import(result.moduleUrl);
      expect.fail('应该抛出SecurityError');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Package(s) "react" are not allowed');
    }
    
    result.cleanup();
  });

  it('应该在有多个未授权导入时在代码开头添加错误语句', async () => {
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
    
    // 验证代码会抛出Error
    try {
      await import(result.moduleUrl);
      expect.fail('应该抛出Error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Package(s) "react, axios" are not allowed');
    }
    
    result.cleanup();
  });

  it('应该保留原始导入语句而不是替换它们', async () => {
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
    const fs = await import('fs');
    const path = await import('path');
    const fileContent = fs.readFileSync(tempModule.moduleUrl, 'utf8');
    
    // 验证错误语句在开头
    expect(fileContent).toMatch(/^\/\/ Generated secure module\n\(\(\) => \{ throw new SecurityError\('Package\(s\) "react" are not allowed'\) \}\)\(\);\n/);
    
    // 验证原始导入语句被保留
    expect(fileContent).toContain("import { useState } from 'react';");
    
    tempModule.cleanup();
  });
});