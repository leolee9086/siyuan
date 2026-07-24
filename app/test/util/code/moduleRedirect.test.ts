import { describe,it,expect,beforeEach } from "vitest";
import { ConfigManager } from "../../../src/util/lib/code/configManager";
import { SecureModuleCreator } from "../../../src/util/lib/code/executor";
import type { ModuleRedirectConfig } from "../../../src/util/lib/code/executor.types";

describe("模块重定向功能测试", () => {
  let configManager: ConfigManager;
  let secureModuleCreator: SecureModuleCreator;

  beforeEach(() => {
    configManager = new ConfigManager();
    secureModuleCreator = new SecureModuleCreator({
      allowedPackages: ["lodash", "axios"], // 添加axios到允许列表
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

  describe("ConfigManager 模块重定向配置管理", () => {
    it("应该能够获取默认的模块重定向配置", () => {
      const config = configManager.getModuleRedirectConfig();
      
      expect(config).toEqual({
        defaultServer: "https://esm.sh",
        packageRedirects: {},
        enabled: false,
        bareModulesOnly: true
      });
    });

    it("应该能够设置模块重定向配置", () => {
      const newConfig: ModuleRedirectConfig = {
        defaultServer: "https://cdn.skypack.dev",
        packageRedirects: {
          "lodash": "https://cdn.skypack.dev/lodash"
        },
        enabled: true,
        bareModulesOnly: false
      };

      configManager.setModuleRedirectConfig(newConfig);
      const config = configManager.getModuleRedirectConfig();
      
      expect(config.defaultServer).toBe("https://cdn.skypack.dev");
      expect(config.packageRedirects).toEqual({
        "lodash": "https://cdn.skypack.dev/lodash"
      });
      expect(config.enabled).toBe(true);
      expect(config.bareModulesOnly).toBe(false);
    });

    it("应该能够启用/禁用模块重定向", () => {
      configManager.setModuleRedirectEnabled(true);
      expect(configManager.getModuleRedirectConfig().enabled).toBe(true);
      
      configManager.setModuleRedirectEnabled(false);
      expect(configManager.getModuleRedirectConfig().enabled).toBe(false);
    });

    it("应该能够设置默认模块服务器", () => {
      configManager.setDefaultModuleServer("https://cdn.skypack.dev");
      expect(configManager.getModuleRedirectConfig().defaultServer).toBe("https://cdn.skypack.dev");
    });

    it("应该能够添加和移除包重定向规则", () => {
      configManager.addPackageRedirect("lodash", "https://cdn.skypack.dev/lodash");
      expect(configManager.getPackageRedirectUrl("lodash")).toBe("https://cdn.skypack.dev/lodash");
      
      configManager.removePackageRedirect("lodash");
      expect(configManager.getPackageRedirectUrl("lodash")).toBe(null);
    });

    it("应该能够判断裸模块", () => {
      expect(configManager.isBareModule("lodash")).toBe(true);
      expect(configManager.isBareModule("./local-module")).toBe(false);
      expect(configManager.isBareModule("/absolute/path")).toBe(false);
      expect(configManager.isBareModule("https://example.com/module")).toBe(false);
      expect(configManager.isBareModule("http://example.com/module")).toBe(false);
    });

    it("应该能够生成重定向URL", () => {
      configManager.setDefaultModuleServer("https://esm.sh");
      configManager.setModuleRedirectEnabled(true); // 启用模块重定向
      
      // 测试默认服务器URL生成
      const defaultUrl = configManager.generateRedirectUrl("lodash");
      expect(defaultUrl).toBe("https://esm.sh/lodash");
      
      // 测试特定包重定向URL
      configManager.addPackageRedirect("axios", "https://cdn.skypack.dev/axios");
      const specificUrl = configManager.generateRedirectUrl("axios");
      expect(specificUrl).toBe("https://cdn.skypack.dev/axios");
    });
  });

  describe("SecureModuleCreator 模块重定向处理", () => {
    it("应该重定向裸模块导入", () => {
      const code = `
        import _ from 'lodash';
        import axios from 'axios';
        
        export function test() {
          return _.add(1, 2);
        }
      `;
      
      // 添加axios重定向规则
      secureModuleCreator.config.addPackageRedirect("axios", "https://cdn.skypack.dev/axios");
      secureModuleCreator.config.setModuleRedirectEnabled(true);
      
      const secureCode = secureModuleCreator.transformCode(code, secureModuleCreator.defaultOptions);
      
      // 检查axios是否被重定向
      expect(secureCode).toContain("https://cdn.skypack.dev/axios");
      // lodash应该被重定向到默认服务器
      expect(secureCode).toContain("https://esm.sh/lodash");
      
    });

    it("应该只重定向裸模块（当bareModulesOnly为true时）", () => {
      const code = `
        import _ from 'lodash';
        import local from './local-module';
        import remote from 'https://example.com/module';
        
        export function test() {
          return _.add(1, 2);
        }
      `;
      
      secureModuleCreator.config.addPackageRedirect("lodash", "https://cdn.skypack.dev/lodash");
      secureModuleCreator.config.setModuleRedirectEnabled(true);
      secureModuleCreator.config.setModuleRedirectConfig({
        ...secureModuleCreator.config.getModuleRedirectConfig(),
        bareModulesOnly: true
      });
      
      const secureCode = secureModuleCreator.transformCode(code, secureModuleCreator.defaultOptions);
      
      // 只有裸模块lodash应该被重定向
      expect(secureCode).toContain("https://cdn.skypack.dev/lodash");
      // 相对路径和绝对URL不应该被重定向
      expect(secureCode).toContain("./local-module");
      expect(secureCode).toContain("https://example.com/module");
      
    });

    it("应该在模块重定向禁用时不重定向", () => {
      const code = `
        import _ from 'lodash';
        
        export function test() {
          return _.add(1, 2);
        }
      `;
      
      secureModuleCreator.config.addPackageRedirect("lodash", "https://cdn.skypack.dev/lodash");
      secureModuleCreator.config.setModuleRedirectEnabled(false);
      
      const secureCode = secureModuleCreator.transformCode(code, secureModuleCreator.defaultOptions);
      
      // 模块重定向禁用时，应该保持原始导入
      expect(secureCode).toContain("'lodash'");
      expect(secureCode).not.toContain("https://cdn.skypack.dev/lodash");
      
    });

    it("应该先进行安全检查再重定向", () => {
      const code = `
        import _ from 'lodash';
        import unauthorized from 'unauthorized-package';
        
        export function test() {
          return _.add(1, 2);
        }
      `;
      
      secureModuleCreator.config.addPackageRedirect("unauthorized-package", "https://cdn.skypack.dev/unauthorized-package");
      secureModuleCreator.config.setModuleRedirectEnabled(true);
      
      const secureCode = secureModuleCreator.transformCode(code, secureModuleCreator.defaultOptions);

      // 检查生成的代码内容 - 未授权包不应被重定向
      expect(secureCode).not.toContain("https://cdn.skypack.dev/unauthorized-package");
      // 代码应该包含 SecurityError
      expect(secureCode).toContain("SecurityError");
      expect(secureCode).toContain('Package(s) "unauthorized-package" are not allowed');
      // 代码应该以注释开头
      expect(secureCode).toMatch(/^\/\/ Generated secure module/);
      
    });
  });
});
