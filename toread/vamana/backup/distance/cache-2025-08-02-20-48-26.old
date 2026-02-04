/**
 * 距离缓存实现
 * 提供高性能的距离计算缓存功能
 */

import { LRUNode } from './types';

/**
 * 高性能距离缓存 - 使用数字键和LRU淘汰策略
 */
export class DistanceCache {
  private cache = new Map<number, LRUNode>();
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;
  private maxSize: number;
  
  // 统计信息
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private distanceFunctionStats = new Map<string, { hits: number; misses: number }>();

  /**
   * 创建距离缓存实例
   * 
   * @param maxSize 最大缓存大小，默认10000
   */
  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }
//@织:这里的数字范围过小,需要优化
  /**
   * 生成数字键 - 将两个32位整数编码为一个数字
   * 使用位运算确保键的唯一性和一致性
   * 
   * @param id1 第一个ID
   * @param id2 第二个ID
   * @returns 生成的数字键
   */
  private generateKey(id1: number, id2: number): number {
    // 确保id1 <= id2，保持键的一致性
    const minId = Math.min(id1, id2);
    const maxId = Math.max(id1, id2);
    
    // 使用位运算将两个32位整数编码为一个数字
    // 假设ID不会超过2^16，这样可以用32位存储两个ID
    if (minId < 0 || maxId >= 65536) {
      // 如果ID超出范围，回退到字符串键的哈希值
      const strKey = `${minId}-${maxId}`;
      return this.hashString(strKey);
    }
    
    // 将minId放在高16位，maxId放在低16位
    return (minId << 16) | maxId;
  }

  /**
   * 简单的字符串哈希函数
   * 
   * @param str 需要哈希的字符串
   * @returns 哈希值
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash;
  }

  /**
   * 将节点移到链表头部（最近使用）
   * 
   * @param node LRU节点
   */
  private moveToHead(node: LRUNode): void {
    if (node === this.head) return;
    
    // 从当前位置移除
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;
    
    // 移到头部
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  /**
   * 移除链表尾部节点（最近最少使用）
   * 
   * @returns 移除的尾部节点，如果链表为空则返回null
   */
  private removeTail(): LRUNode | null {
    if (!this.tail) return null;
    
    const node = this.tail;
    this.cache.delete(node.key);
    this.evictions++;
    
    if (this.head === this.tail) {
      this.head = null;
      this.tail = null;
    } else {
      this.tail = node.prev;
      if (this.tail) this.tail.next = null;
    }
    
    return node;
  }

  /**
   * 添加新节点到链表头部
   * 
   * @param key 缓存键
   * @param value 缓存值
   * @returns 添加的节点
   */
  private addToHead(key: number, value: number): LRUNode {
    const node: LRUNode = { key, value, prev: null, next: this.head };
    
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    
    this.cache.set(key, node);
    return node;
  }

  /**
   * 获取缓存的距离，如果不存在则计算并缓存
   * 
   * @param id1 第一个节点ID
   * @param id2 第二个节点ID
   * @param computeFn 计算函数，用于缓存未命中时计算距离
   * @param distanceFunction 可选，距离函数名称，用于统计
   * @returns 两个节点间的距离
   */
  getCachedDistance(
    id1: number, 
    id2: number, 
    computeFn: (id1: number, id2: number) => number,
    distanceFunction?: string
  ): number {
    const key = this.generateKey(id1, id2);
    
    // 检查缓存
    const node = this.cache.get(key);
    if (node) {
      this.hits++;
      if (distanceFunction) {
        const stats = this.distanceFunctionStats.get(distanceFunction) || { hits: 0, misses: 0 };
        stats.hits++;
        this.distanceFunctionStats.set(distanceFunction, stats);
      }
      this.moveToHead(node);
      return node.value;
    }
    
    // 缓存未命中，计算距离
    this.misses++;
    if (distanceFunction) {
      const stats = this.distanceFunctionStats.get(distanceFunction) || { hits: 0, misses: 0 };
      stats.misses++;
      this.distanceFunctionStats.set(distanceFunction, stats);
    }
    
    const distance = computeFn(id1, id2);
    
    // 检查缓存大小，如果超出限制则移除最久未使用的项
    if (this.cache.size >= this.maxSize) {
      this.removeTail();
    }
    
    // 添加到缓存
    this.addToHead(key, distance);
    
    return distance;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.distanceFunctionStats.clear();
  }

  /**
   * 获取缓存统计信息
   * 
   * @returns 缓存统计信息对象
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    // 按距离函数统计命中率
    const distanceFunctionHitRates: Record<string, number> = {};
    for (const [func, stats] of this.distanceFunctionStats) {
      const total = stats.hits + stats.misses;
      distanceFunctionHitRates[func] = total > 0 ? stats.hits / total : 0;
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate,
      distanceFunctionHitRates,
      memoryUsage: this.cache.size * 8 // 估算内存使用（每个条目约8字节）
    };
  }

  /**
   * 设置最大缓存大小
   * 
   * @param maxSize 新的最大缓存大小
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
    
    // 如果当前大小超过新的最大大小，移除多余的项
    while (this.cache.size > this.maxSize) {
      this.removeTail();
    }
  }

  /**
   * 获取缓存大小
   * 
   * @returns 当前缓存大小
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * 检查缓存是否包含指定键
   * 
   * @param id1 第一个节点ID
   * @param id2 第二个节点ID
   * @returns 是否存在于缓存中
   */
  has(id1: number, id2: number): boolean {
    const key = this.generateKey(id1, id2);
    return this.cache.has(key);
  }

  /**
   * 手动设置缓存项
   * 
   * @param id1 第一个节点ID
   * @param id2 第二个节点ID
   * @param distance 两节点间的距离
   */
  set(id1: number, id2: number, distance: number): void {
    const key = this.generateKey(id1, id2);
    
    const existingNode = this.cache.get(key);
    if (existingNode) {
      existingNode.value = distance;
      this.moveToHead(existingNode);
    } else {
      if (this.cache.size >= this.maxSize) {
        this.removeTail();
      }
      this.addToHead(key, distance);
    }
  }
}