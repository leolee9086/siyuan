/**
 * defaultWorkspace 模块的类型定义
 *
 * @module data/kernelAPI/defaultWorkspace.types
 */

/**
 * 文件系统条目信息
 *
 * 用途：表示工作空间中的文件或目录信息
 * 使用场景：readDir 返回的目录内容列表、exists 检查文件是否存在
 * 关联类型：Workspace 类的方法返回值
 */
export interface LsFile {
  /** 文件或目录名称 */
  name: string;
  /** 是否为目录 */
  isDir: boolean;
  /** 最后更新时间戳，null 表示未知 */
  updated: number | null;
  /** 文件大小（字节），目录或未知时为 null */
  size?: number | null;
}
