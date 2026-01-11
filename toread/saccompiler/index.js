const clientApi = require("siyuan")
const { Plugin } = clientApi
globalThis[Symbol.for(`clientApi`)] = globalThis[Symbol.for(`clientApi`)] || clientApi
function 获取文件名(moduleURL) {
  // 替换所有的 '\\' 为 '/'
  moduleURL = moduleURL.replace(/\\/g, '/');
  // 移除路径中的 '//'，除非它在 'http://' 或 'https://' 中
  moduleURL = moduleURL.replace(/([^:])\/\//g, '$1/');
  // 从路径中获取文件名
  let fileName = moduleURL.substring(moduleURL.lastIndexOf('/') + 1);
  // 如果文件名是 'index.js'，获取文件夹名
  if (fileName === 'index.js') {
    let parts = moduleURL.split('/');
    // 移除最后两个部分（'index.js' 和 文件夹名）
    parts.pop();
    // 添加文件夹名作为新的文件名
    fileName = parts.pop();
  } else {
    // 移除扩展名
    fileName = fileName.substring(0, fileName.lastIndexOf('.'));
  }
  return fileName;
}
class ccPlugin extends Plugin {
  初始化环境变量() {
    this.selfURL = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/plugins/${this.name}/`;
    this.dataPath = `/data/storage/petal/${this.name}`
    this.tempPath = `/temp/ccTemp/${this.name}/`
    this.publicPath = `/data/public`
    this.selfPath = `/data/plugins/${this.name}`
    if (window.require) {
      this.localPath = window.require('path').join(window.siyuan.config.system.workspaceDir, 'data', 'plugins', this.name)
    }
  }
  resolve(路径) {
    if (路径.startsWith('/') || 路径.startsWith('http://') || 路径.startsWith('https://')) {
      // 如果路径是绝对路径或者外部路径，直接返回原始值
      return 路径;
    } else {
      // 如果路径是相对路径，从this.selfURL开始解析
      console.log(this, 路径)
      return decodeURIComponent(new URL(路径, this.selfURL).toString());
    }
  }
  //这个是白魔法不是黑魔法
  从esm模块(moduleURL) {
    moduleURL = this.resolve(moduleURL)
    console.log(moduleURL)
    const 定义属性 = async (obj, name, value, options = {}) => {
      if (obj.hasOwnProperty(name)) {
        throw new Error(`属性${name}已经存在，不要覆盖它`);
      }
      const { 只读 = true, 别名 = name } = options;
      Object.defineProperty(obj, 别名, {
        value: value,
        writable: true,
        configurable: true
      });
    };
    return {
      合并子模块: async (name) => {
        console.log(name)
        try {
          const module = await import(`${moduleURL}?date=${Date.now()}`);
          let fileName = 获取文件名(moduleURL);
          await 定义属性(this, fileName, module);
          name ? await 定义属性(this, name, module) : null
          //this.监听模块修改(moduleURL,name)
          return module
        } catch (error) {
          //this.监听模块修改(moduleURL,name)
          console.error(`导入模块${moduleURL}失败:`, error);
          throw error;
        }
      },
    }
  }
  监听模块修改(moduleURL, 子模块名称) {
    if (window.require) {
      let fs = window.require('fs');
      let path = window.require('path');
      let modulePath = path.join(window.siyuan.config.system.workspaceDir + this.selfPath, moduleURL.split('SiyuanAssistantCollection').pop());
      let folderPath = path.dirname(modulePath);
      console.log('开始监听:', folderPath)
      fs.watch(folderPath, { recursive: true }, async (eventType, filename) => {
        if (filename && eventType === 'change') {
          console.log(`${filename} file Changed`);
          this[子模块名称] = undefined;
          let updatedModule = await import(`${moduleURL}?date=${Date.now()}`);;
          // 更新子模块引用
          this[子模块名称] = updatedModule;
        }
      });
    }
  }
  设置别名(别名字典) {
    for (let 原名 in 别名字典) {
      let 别名列表 = 别名字典[原名];
      if (!Array.isArray(别名列表)) {
        别名列表 = [别名列表];
      }
      for (let 别名 of 别名列表) {
        if (this.hasOwnProperty(别名)) {
          throw new Error(`别名${别名}已经存在，不要覆盖它`);
        }
        Object.defineProperty(this, 别名, {
          get: () => this[原名],
          set: (value) => { this[原名] = value; },
          enumerable: true,
          configurable: true
        });
      }
    }
  }
}
module.exports = class SACCompiler extends ccPlugin {
  onload() {
    console.log('代码工具箱已经加载')
    this.初始化环境变量()
    this.初始化插件异步状态()
  }
  async 初始化插件异步状态() {
    this.自定义菜单 = await this.从esm模块('./source/UI/menu/index.js').合并子模块('菜单管理器')
    await this.从esm模块('./source/langDefine/index.js').合并子模块()
  }
};
