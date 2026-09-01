/** 用途：MIME 类型数据。使用范围：defaultWorkspace 文件类型判断。解耦评估：同目录模块，直接同层导入。 */
import mimes from "./mimeDb";
/** 用途：POSIX 路径模块。使用范围：defaultWorkspace 协议路径处理。解耦评估：通过 imports.ts 转发。 */
import {pathPosix} from "./imports";
/** 用途：内核客户端类型。使用范围：defaultWorkspace 类型约束。解耦评估：通过 imports.ts 转发。 */
import type { KernelClientType } from "./imports";
/** 用途：内核客户端实例。使用范围：defaultWorkspace API 调用。解耦评估：通过 imports.ts 转发。 */
import { kernelClient } from "./imports";
/** 用途：内核 SDK 工厂函数。使用范围：defaultWorkspace 创建客户端。解耦评估：通过 imports.ts 转发。 */
import { createClient } from "./imports";
/** 用途：文件 API 定义。使用范围：defaultWorkspace 文件操作。解耦评估：通过 imports.ts 转发。 */
import { fileApiDefs } from "./imports";
/** 用途：文件列表结果类型。使用范围：defaultWorkspace 类型约束。解耦评估：同目录类型文件，直接同层导入。 */
import type { LsFile } from "./defaultWorkspace.types";
/** 用途：MIME 类型工具。使用范围：defaultWorkspace 文本文件判断。解耦评估：同目录模块，直接同层导入。 */
import { isTextMime } from "./mimeUtils";

// 重新导出类型供外部使用
export type { LsFile } from "./defaultWorkspace.types";

/**
 * 用于获取原始响应的客户端实例
 * 配置 responseHandler: 'raw' 以获取原始 Response 对象
 * 复用 kernelClient 的配置（baseUrl 和 apiToken）
 */
const rawFileClient = createClient(fileApiDefs, {
  baseUrl: kernelClient.baseUrl,
  apiToken: kernelClient.apiToken,
  responseHandler: "raw",
});

/** 导出 Workspace 类，提供文件系统操作能力 */
export class Workspace {
  private kernel: KernelClientType;
  private mimetype: { [key: string]: string } = {};

  constructor(kernel: KernelClientType) {
    this.kernel = kernel;
    // 使用 for...of 替代 forEach 以提高可读性和支持提前中断
    for (const type of Object.getOwnPropertyNames(mimes)) {
      const item = mimes[type];
      if (!item) {
        throw new Error("mimeDb数据错误");
      }
      const extensions = item["extensions"];
      if (extensions) {
        // 使用 for...of 替代 forEach
        for (const extension of extensions) {
          this.mimetype[extension] = type;
        }
      }
    }
  }
  /**
   * 读取文件内容
   *
   * 使用 SDK 的 getFile API 获取文件内容，配置 responseHandler: 'raw' 以获取原始 Response 对象。
   * 根据文件类型（文本或二进制）和 bin 参数决定返回格式。
   *
   * @param file - 文件路径（相对于工作空间根目录）
   * @param bin - 是否强制返回二进制格式，默认为 false（文本文件返回 string，二进制返回 Uint8Array）
   * @returns 文件内容（string 或 Uint8Array），如果文件不存在则返回 undefined
   */
  async readFile(file: string, bin?: boolean) {
    // 使用配置了 responseHandler: 'raw' 的客户端获取原始 Response
    // rawFileClient 配置了 responseHandler: 'raw'，返回原始 Response 对象
    const res = await rawFileClient.getFile({ path: file });
    
    // 检查 res 是否为 Response 对象（配置了 responseHandler: 'raw' 时应该是）
    if (!(res instanceof Response)) {
      console.error(`${file}读取错误: 意外的响应类型`);
      return;
    }
    
    // 处理非成功状态码（200 或 202 表示成功，202 表示资源未就绪/不存在）
    if (res.status !== 200 && res.status !== 202) {
      console.error(`${file}读取错误`);
    }
    
    // 202 状态码表示文件不存在或资源未就绪
    if (res.status === 202) {
      console.error(`${file}不存在,内容为undefined`);
      return;
    }
    
    const mime = res.headers.get("Content-Type");
    
    // 文本文件且未强制二进制模式时返回文本
    if (isTextMime(mime) && !bin) {
      return await res.text();
    }
    
    // 二进制文件或强制二进制模式时返回 Uint8Array
    if (!res.body) {
      return;
    }
    
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }
    
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  /**
   * 同步读取文件内容
   *
   * 使用 SDK 的 $sync.getFile 方法同步获取文件内容，通过请求级配置 { responseHandler: 'raw' } 获取原始响应。
   * 根据文件的 Content-Type 决定返回文本还是二进制格式。
   *
   * @param file - 文件路径（相对于工作空间根目录）
   * @returns 文件内容（string 或 ArrayBuffer），如果文件不存在或读取失败则返回 undefined
   *
   * 注意：同步请求会阻塞主线程，仅在必要时使用（如初始化阶段）
   */
  readFileSync(file: string) {
    // 使用 SDK 的同步方法获取文件，通过请求级配置获取原始响应
    const res = kernelClient.$sync.getFile(
      { path: file },
      { responseHandler: "raw" }
    );
    // 处理非成功状态码（200 或 202 表示成功，202 表示资源未就绪/不存在）
    if (res.status !== 200 && res.status !== 202) {
      console.error(`${file}读取错误`);
      return;
    }

    // 202 状态码表示文件不存在或资源未就绪
    if (res.status === 202) {
      console.error(`${file}不存在,内容为undefined`);
      return;
    }

    // 从响应头中获取 Content-Type
    const mime = res.headers.get("Content-Type") ?? null;

    // 文本文件直接返回文本内容
    if (isTextMime(mime)) {
      return res.text();
    }
    
    // 对于二进制文件，将文本转换为 ArrayBuffer
    const text = res.text();
    const buffer = new ArrayBuffer(text.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < text.length; i++) {
      view[i] = text.charCodeAt(i) & 0xff;
    }
    return buffer;
  }

  /**
   * 写入文件内容
   *
   * 作用：将字符串、Blob、File 或 Uint8Array 内容写入指定路径的文件
   * 意图：封装文件写入逻辑，自动处理不同类型内容的转换和 MIME 类型推断
   * 调用时机：当需要保存数据到工作空间文件系统时调用
   *
   * @param path - 目标文件路径（相对于工作空间根目录）
   * @param content - 要写入的内容，支持 string、Blob、File 或 Uint8Array
   * @param flag - 特殊标志，为 true 时执行简化写入（仅处理 String 对象）
   * @returns Promise<void>
   *
   * 注意：当 flag 为 true 且 content 不是 String 对象时，操作会被静默忽略
   */
  async writeFile(path: string, content: string | Blob | File | Uint8Array, flag?: boolean) {
    // flag 为 true 时仅处理 String 对象（简化写入），否则直接返回
    if (flag) {
      return content instanceof String
        ? await this.writeFileDirectly(path, content + "")
        : undefined;
    }

    // flag 为 false 或未指定时，执行标准写入流程
    const extension = path.split(".").pop() || "";
    let blob: Blob;

    // 根据内容类型创建对应的 Blob
    // 对于 Uint8Array，创建新的 ArrayBuffer 避免 SharedArrayBuffer 问题
    if (content instanceof Uint8Array) {
      const arrayBuffer = new ArrayBuffer(content.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(content);
      blob = new Blob([arrayBuffer], {
        type: this.mimetype[extension] || "text/plain",
      });
      const file = new File([blob], path.split("/").pop() || "", {
        lastModified: Date.now(),
      });
      return await this.writeFileDirectly(path, file);
    }

    // 对于其他类型（string、Blob、File），直接使用内容创建 Blob
    blob = new Blob([content], {
      type: this.mimetype[extension] || "text/plain",
    });
    const file = new File([blob], path.split("/").pop() || "", {
      lastModified: Date.now(),
    });
    return await this.writeFileDirectly(path, file);
  }

  /**
   * 直接通过 FormData 上传文件
   *
   * 作用：使用 kernel API 的 putFile 方法直接上传文件
   * 意图：作为 writeFile 的底层实现，绕过内容转换直接上传已准备好的文件数据
   * 调用时机：当文件内容已经准备好（File 对象或字符串）需要直接上传时调用
   *
   * @param path - 目标文件路径
   * @param file - File 对象或字符串内容
   * @returns API 响应结果
   */
  async writeFileDirectly(path: string, file: File | string) {
    const data = new FormData();
    data.append("path", path);
    data.append("file", file);
    data.append("isDir", "false");
    data.append("modTime", Date.now().toString());
    const res = await this.kernel.putFile(data);
    return res;
  }

  /**
   * 读取目录内容
   *
   * 作用：获取指定目录下的文件和子目录列表
   * 意图：封装目录读取操作，返回标准化的文件信息数组
   * 调用时机：需要浏览目录内容或检查文件是否存在时调用
   *
   * @param path - 目录路径（相对于工作空间根目录）
   * @returns 目录项数组，包含文件名、大小、修改时间等信息
   */
  async readDir(path: string) {
    const result = await this.kernel.readDir({ path });
    return result.data;
  }

  /**
   * 检查文件或目录是否存在
   *
   * 作用：判断指定路径的文件或目录是否存在于工作空间中
   * 意图：提供便捷的存在性检查，同时返回匹配的文件信息以便后续操作
   * 调用时机：在执行写操作前检查文件是否存在，或在需要获取文件元数据时使用
   *
   * @param name - 文件或目录路径
   * @returns 如果存在返回文件信息对象，否则返回 undefined
   */
  async exists(name: string) {
    try {
      const parentDir = pathPosix().dirname(name);

      // 处理根目录下的文件（父目录为 "." 表示当前目录，对应根目录）
      if (parentDir === ".") {
        const files = await this.readDir("/");
        const result = files.find((file) => file.name === name);
        return result || undefined;
      }

      // 处理无效路径（dirname 返回空字符串表示无效路径）
      if (parentDir === "") {
        console.warn(`无效的路径: ${name}`);
        return undefined;
      }

      // 处理子目录中的文件
      const files = await this.readDir(parentDir);
      const result = files.find((file) => {
        return pathPosix().join(parentDir, file.name) === name ||
               pathPosix().join(parentDir, file.name) + "/" === name;
      });
      return result || undefined;
    } catch (e) {
      console.warn(`工作空间内容读取错误: ${e}`);
      return undefined;
    }
  }

  /**
   * 创建目录
   *
   * 作用：在工作空间中创建指定路径的目录
   * 意图：封装目录创建操作，通过 putFile API 发送目录创建请求
   * 调用时机：需要在文件系统中创建新目录时调用
   *
   * @param path - 要创建的目录路径
   * @returns API 响应结果
   */
  async mkdir(path: string) {
    const data = new FormData();
    data.append("path", path);
    data.append("file", "");
    data.append("isDir", "true");
    data.append("modTime", Date.now().toString());

    const res = await this.kernel.putFile(data);
    return await res.data;
  }

  /**
   * 删除文件或目录
   *
   * 作用：删除工作空间中指定路径的文件或目录
   * 意图：提供文件/目录删除功能，使用 kernel API 执行删除操作
   * 调用时机：需要清理不再需要的文件或目录时调用
   *
   * @param path - 要删除的文件或目录路径
   */
  async removeFile(path: string) {
    await this.kernel.removeFile({ path: path });
  }

  /**
   * 复制文件
   *
   * 作用：将源路径的文件内容复制到目标路径
   * 意图：通过读取后写入的方式实现文件复制
   * 调用时机：需要复制文件到新位置时调用
   *
   * @param path1 - 源文件路径
   * @param path2 - 目标文件路径
   */
  async copyFile(path1: string, path2: string) {
    const content = await this.readFile(path1);
    if (!content) {
      return;
    }
    await this.writeFile(path2, content);
  }

  /**
   * 初始化文件
   *
   * 作用：如果文件不存在，则创建该文件并可选地写入初始内容
   * 意图：用于确保配置文件或默认文件存在，避免重复创建
   * 调用时机：应用启动或模块初始化时，确保必要的文件存在
   *
   * @param path - 要初始化的文件路径
   * @param data - 可选的初始内容，默认为空字符串
   */
  async initFile(path: string, data?: string) {
    // 检查文件是否已存在，存在则跳过初始化
    const fileExists = await this.exists(path);
    if (fileExists) {
      return;
    }
    // 文件不存在，写入初始内容
    await this.writeFile(path, data ?? "");
  }
}
/** 导出默认工作空间实例，供全局使用 */
export const localWorkerSpace = new Workspace(kernelClient);