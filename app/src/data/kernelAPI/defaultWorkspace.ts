import mimes from "./mimeDb";
import * as path from "path";
import type { KernelClientType } from "../kernelSDK";
import { kernelClient } from "../kernelSDK";
import { createClient, fileApiDefs, type SyncRawResponse } from "@leolee9086/siyuan-kernel-sdk";
import type { LsFile } from "./defaultWorkspace.types";

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

function isText(mime: string | null): boolean {
  if (mime && mime.startsWith("text")) {
    return true;
  }
  if (mime == "application/json") {
    return true;
  }
  if (mime == "application/x-javascript") {
    return true;
  } else {
return false;
}
}

export class Workspace {
  private kernel: KernelClientType;
  private mimetype: { [key: string]: string } = {};

  constructor(kernel: KernelClientType) {
    this.kernel = kernel;
    Object.getOwnPropertyNames(mimes).forEach((type) => {
      const item = mimes[type];
      if(!item){
        throw new Error("mimeDb数据错误");
      }
      const extensions =item["extensions"];
      if (extensions) {
        extensions.forEach((extension: string) => {
          this.mimetype[extension] = type;
        });
      }
    });
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
  async readFile(file: string, bin?: boolean): Promise<string | Uint8Array | undefined> {
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
    if (isText(mime) && !bin) {
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
  readFileSync(file: string): string | ArrayBuffer | undefined {
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
    if (isText(mime)) {
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

  async writeFile(path: string, content: string | Blob | File | Uint8Array, flag?: boolean) {
    if (!flag) {
      const extension = path.split(".").pop() || "";
      let blob: Blob;
      
      if (content instanceof Uint8Array) {
        // 对于Uint8Array，创建一个新的ArrayBuffer来避免SharedArrayBuffer问题
        const arrayBuffer = new ArrayBuffer(content.length);
        const view = new Uint8Array(arrayBuffer);
        view.set(content);
        blob = new Blob([arrayBuffer], {
          type: this.mimetype[extension] || "text/plain",
        });
      } else {
        // 对于其他类型，直接使用
        blob = new Blob([content], {
          type: this.mimetype[extension] || "text/plain",
        });
      }
      
      const file = new File([blob], path.split("/").pop() || "", {
        lastModified: Date.now(),
      });
      return await this.writeFileDirectly(path, file);
    } else {
      if(content instanceof String){
          return await this.writeFileDirectly(path, content+"");
      }
    }
  }

  async writeFileDirectly(path: string, file: File | string){
    const data = new FormData();
    data.append("path", path);
    data.append("file", file);
    data.append("isDir", "false");
    data.append("modTime", Date.now().toString());
    const res = await this.kernel.putFile(data);
    return  res;
  }

  async readDir(path: string): Promise<LsFile[]> {
    const result = await this.kernel.readDir({ path });
    return result.data;
  }

  async exists(name: string): Promise<LsFile | undefined> {
    try {
      const parentDir = path.dirname(name);
      if (parentDir !== "" && parentDir !== ".") {
        const files = await this.readDir(parentDir);
        const result = files.find((file) => {
          return path.join(parentDir, file.name) == name || path.join(parentDir, file.name) + "/" == name;
        });
        return result || undefined;
      } else if (parentDir === ".") {
        const files = await this.readDir("/");
        const result = files.find((file) => {
          return file.name === name;
        });
        return result || undefined;
      } else {
        console.warn(`无效的路径: ${name}`);
        return undefined;
      }
    } catch (e) {
      console.warn(`工作空间内容读取错误: ${e}`);
      return undefined;
    }
  }

  async mkdir(path: string) {

    const data = new FormData();
    data.append("path", path);
    data.append("file", "");
    data.append("isDir", "true");
    data.append("modTime", Date.now().toString());

    const res = await this.kernel.putFile(data);
    return await res.data;
  }

  async removeFile(path: string): Promise<void> {
    await this.kernel.removeFile({ path: path });
  }

  async copyFile(path1: string, path2: string): Promise<void> {
    const content = await this.readFile(path1);
    if (content) {
      await this.writeFile(path2, content);
    }
  }

  async initFile(path: string, data?: string): Promise<void> {
    if (!(await this.exists(path))) {
      if (data === undefined) {
        await this.writeFile(path, "");
      } else {
        await this.writeFile(path, data);
      }
    }
  }
}
export const localWorkerSpace =new Workspace(kernelClient);