import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  build: {
    lib: {
      // 入口文件
      entry: resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/index.ts'),
      // 库名称
      name: 'SiyuanKernelSDK',
      // 输出格式，只生成 ESM
      formats: ['es'],
      // 输出文件名
      fileName: (format: string) => `index.js`
    },
    // 输出目录
    outDir: 'dist',
    // 保留目录结构
    rollupOptions: {
      // 确保外部依赖不被打包
      external: ['zod'],
      output: {
        // 保留模块结构，不打包成单文件
        preserveModules: true,
        // 保留模块目录结构
        preserveModulesRoot: 'src',
        // 确保 ESM 导入使用 .js 扩展名
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    // 生成 source map
    sourcemap: true,
    // 不自动清空输出目录，避免 Windows 文件锁定问题
    emptyOutDir: false
  },
  // 解析配置
  resolve: {
    alias: {
      '@': resolve(fileURLToPath(new URL('.', import.meta.url)), 'src')
    }
  }
});