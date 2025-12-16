import mimes from "./mimeDb";
import * as path from "path";
import KernelApiClient from "./kernelApiClient";
import { localKernel } from "./defaultClient";

export interface LsFile {
  name: string;
  isDir: boolean;
  updated: number|null;
  size?: number | null;
}

function isText(mime: string | null): boolean {
  if (mime && mime.startsWith("text")) {
    return true;
  }
  if (mime == "application/json") {
    return true;
  }
  if (mime == "application/x-javascript") {
    return true;
  } else return false;
}

export class Workspace {
  private kernel: KernelApiClient;
  private mimetype: { [key: string]: string } = {};

  constructor(kernel: KernelApiClient) {
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
   * 这个函数特殊处理,以避免问题
   * @param file 
   * @param bin 
   * @returns 
   */
  async readFile(file: string, bin?: boolean): Promise<string | Uint8Array | undefined> {
    const baseUrl = this.kernel.baseUrl;
    const apiToken = this.kernel.apiToken;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiToken) {
      headers["Authorization"] = `Token ${apiToken}`;
    }

    const res = await fetch(`${baseUrl}/api/file/getFile`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: file,
      }),
    });
    if (res.status !== 200 && res.status !== 202) {
      console.error(`${file}读取错误`);
    }
    if (res.status === 202) {
      console.error(`${file}不存在,内容为undefined`);
      return;
    }
    const mime = await res.headers.get("Content-Type");
    if (isText(mime) && !bin) {
      return await res.text();
    } else {
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
  }

  readFileSync(file: string): string | ArrayBuffer | undefined {
    const baseUrl = this.kernel.baseUrl;
    const apiToken = this.kernel.apiToken;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/api/file/getFile`, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (apiToken) {
      xhr.setRequestHeader("Authorization", `Token ${apiToken}`);
    }
    xhr.send(JSON.stringify({ path: file }));
    if (xhr.status !== 200 && xhr.status !== 202) {
      console.error(`${file}读取错误`);
      return;
    }
    if (xhr.status === 202) {
      console.error(`${file}不存在,内容为undefined`);
      return;
    }

    const mime = xhr.getResponseHeader("Content-Type");
    if (isText(mime)) {
      return xhr.responseText;
    } else {
      return xhr.response;
    }
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
      }
      else {
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
export const localWorkerSpace =new Workspace(localKernel);