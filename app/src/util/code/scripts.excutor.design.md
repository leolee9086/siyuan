我来为您介绍如何利用 `esm-module-lexer` 和 `magic-string` 来创建安全的临时 ESM 模块，排除白名单以外的包。

## 核心实现方案

```javascript
import { parse } from 'esm-module-lexer';
import MagicString from 'magic-string';

// 定义允许导入的白名单
const ALLOWED_PACKAGES = new Set([
  'react',
  'react-dom',
  'lodash',
  'axios',
  // 添加其他允许的包名
]);

async function createSecureESMModule(code, blobURL) {
  // 初始化 esm-module-lexer
  await parse;
  
  // 解析模块的导入语句
  const imports = parse(code)[0];
  const magicString = new MagicString(code);
  
  // 检查每个导入语句
  for (const importSpec of imports) {
    const importSource = code.substring(importSpec.s, importSpec.e);
    
    // 检查是否是外部包导入（非相对路径）
    if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
      // 提取包名（处理子路径导入如 'lodash/get'）
      const packageName = extractPackageName(importSource);
      
      // 如果包不在白名单中，将其替换为安全版本或抛出错误
      if (!ALLOWED_PACKAGES.has(packageName)) {
        handleUnauthorizedImport(magicString, importSpec, packageName);
      }
    }
  }
  
  // 生成安全的代码
  const secureCode = magicString.toString();
  
  // 创建 Blob URL
  const blob = new Blob([secureCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

function extractPackageName(importSource) {
  // 处理 @scope/package 格式
  if (importSource.startsWith('@')) {
    const parts = importSource.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importSource;
  }
  
  // 处理普通包名，提取主包名（忽略子路径）
  return importSource.split('/')[0];
}

function handleUnauthorizedImport(magicString, importSpec, packageName) {
  const { s, e } = importSpec;
  
  // 方案1: 替换为错误抛出
  magicString.overwrite(
    s, 
    e, 
    `(() => { throw new Error('Package ${packageName} is not allowed') })()`
  );
  
  // 方案2: 替换为空对象（静默失败）
  // magicString.overwrite(s, e, '{}');
  
  // 方案3: 替换为模拟的安全版本
  // magicString.overwrite(s, e, createSafeMock(packageName));
}
```

## 完整的安全模块创建器

```javascript
class SecureModuleCreator {
  constructor(allowedPackages = []) {
    this.allowedPackages = new Set(allowedPackages);
    this.initialized = false;
  }
  
  async init() {
    if (!this.initialized) {
      await parse;
      this.initialized = true;
    }
  }
  
  async createSecureModule(code, options = {}) {
    await this.init();
    
    const {
      onUnauthorizedImport = 'throw', // 'throw', 'mock', 'remove'
      customMocks = {}
    } = options;
    
    const imports = parse(code)[0];
    const magicString = new MagicString(code);
    let hasUnauthorizedImports = false;
    
    for (const importSpec of imports) {
      const importSource = code.substring(importSpec.s, importSpec.e);
      
      if (this.isExternalPackage(importSource)) {
        const packageName = this.extractPackageName(importSource);
        
        if (!this.isPackageAllowed(packageName)) {
          hasUnauthorizedImports = true;
          this.handleImportBasedOnStrategy(
            magicString, 
            importSpec, 
            packageName, 
            onUnauthorizedImport,
            customMocks
          );
        }
      }
    }
    
    if (hasUnauthorizedImports && onUnauthorizedImport === 'throw') {
      console.warn('Unauthorized imports detected and handled');
    }
    
    const secureCode = magicString.toString();
    return this.createBlobURL(secureCode);
  }
  
  isExternalPackage(importSource) {
    return !importSource.startsWith('.') && 
           !importSource.startsWith('/') &&
           !importSource.startsWith('http:') &&
           !importSource.startsWith('https:');
  }
  
  extractPackageName(importSource) {
    // 移除查询参数和哈希
    const cleanSource = importSource.split('?')[0].split('#')[0];
    
    if (cleanSource.startsWith('@')) {
      const parts = cleanSource.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : cleanSource;
    }
    
    return cleanSource.split('/')[0];
  }
  
  isPackageAllowed(packageName) {
    return this.allowedPackages.has(packageName);
  }
  
  handleImportBasedOnStrategy(magicString, importSpec, packageName, strategy, customMocks) {
    const { s, e } = importSpec;
    
    switch (strategy) {
      case 'throw':
        magicString.overwrite(
          s, 
          e, 
          `(() => { throw new SecurityError('Import of package "${packageName}" is not permitted') })()`
        );
        break;
        
      case 'mock':
        const mockCode = customMocks[packageName] || this.createDefaultMock(packageName);
        magicString.overwrite(s, e, mockCode);
        break;
        
      case 'remove':
        // 移除整个导入语句
        const lineEnd = code.indexOf('\n', e);
        if (lineEnd !== -1) {
          magicString.remove(s, lineEnd + 1);
        } else {
          magicString.remove(s, e);
        }
        break;
        
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }
  
  createDefaultMock(packageName) {
    return `/* mocked ${packageName} */ (() => {
      console.warn('Package ${packageName} is mocked for security reasons');
      return {};
    })()`;
  }
  
  createBlobURL(code) {
    const blob = new Blob([code], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }
  
  addAllowedPackage(packageName) {
    this.allowedPackages.add(packageName);
  }
  
  removeAllowedPackage(packageName) {
    this.allowedPackages.delete(packageName);
  }
}
```

## 使用示例

```javascript
// 创建安全模块创建器实例
const moduleCreator = new SecureModuleCreator([
  'react', 
  'react-dom', 
  'lodash',
  'axios'
]);

// 示例1: 处理包含未授权导入的代码
const unsafeCode = `
import React from 'react';
import Vue from 'vue'; // 未授权的包
import _ from 'lodash';
import moment from 'moment'; // 未授权的包

export function myComponent() {
  return React.createElement('div', null, 'Hello World');
}
`;

// 创建安全模块
const secureBlobURL = await moduleCreator.createSecureModule(unsafeCode, {
  onUnauthorizedImport: 'throw' // 对未授权导入抛出错误
});

// 动态导入安全模块
try {
  const secureModule = await import(secureBlobURL);
  console.log('模块加载成功');
} catch (error) {
  console.error('模块加载失败:', error);
}

// 示例2: 使用模拟策略
const secureBlobURLWithMocks = await moduleCreator.createSecureModule(unsafeCode, {
  onUnauthorizedImport: 'mock',
  customMocks: {
    'vue': `/* safe vue mock */ ({ version: '3.0.0', isMock: true })`,
    'moment': `/* safe moment mock */ (() => {
      const mock = (date) => ({ format: () => 'mock date', isMock: true });
      mock.isMock = true;
      return mock;
    })()`
  }
});
```

## 高级功能扩展

```javascript
// 支持动态白名单更新
class DynamicSecureModuleCreator extends SecureModuleCreator {
  constructor(allowedPackages = [], options = {}) {
    super(allowedPackages);
    this.packagePatterns = options.packagePatterns || [];
    this.autoAllowScoped = options.autoAllowScoped || false;
  }
  
  isPackageAllowed(packageName) {
    // 检查精确匹配
    if (this.allowedPackages.has(packageName)) {
      return true;
    }
    
    // 检查模式匹配
    if (this.packagePatterns.some(pattern => packageName.match(pattern))) {
      return true;
    }
    
    // 自动允许特定作用域的包
    if (this.autoAllowScoped && packageName.startsWith('@company/')) {
      return true;
    }
    
    return false;
  }
}

// 使用动态白名单
const dynamicCreator = new DynamicSecureModuleCreator(
  ['react', 'lodash'],
  {
    packagePatterns: [/^@company\/.*$/, /^utils-/],
    autoAllowScoped: true
  }
);
```

## 关键要点

1. **安全性**: 通过静态分析确保只有白名单中的包可以被导入
2. **灵活性**: 提供多种处理策略（抛出错误、模拟、移除）
3. **性能**: 使用 `esm-module-lexer` 进行快速解析
4. **精确性**: `magic-string` 确保代码修改的准确性

这种方案可以有效防止恶意代码通过动态导入执行未授权的操作，确保临时 ESM 模块的安全性。