import * as jieba from '../../../static/jieba_rs_wasm.js'
import { 创建token对象 } from "../DOMTokenizer.js";
import { 校验分词是否连续, 校验是否包含 } from './utils.js';
import fs from '../../polyfills/fs.js';
//结巴的初始化会造成问题
await jieba.default(import.meta.resolve('../../../static/jieba_rs_wasm_bg.wasm'))
let dict

// 添加 Trie 树实现
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.word = null;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    if (!word) return;
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    node.isEndOfWord = true;
    node.word = word;
  }

  findWordsWithPrefix(prefix, limit = 5) {
    const result = [];
    if (!prefix) return result;

    // 找到前缀对应的节点
    let node = this.root;
    for (const char of prefix) {
      if (!node.children.has(char)) {
        return result;
      }
      node = node.children.get(char);
    }

    // 使用BFS而不是DFS，确保返回最短的匹配优先
    const queue = [node];
    while (queue.length > 0 && result.length < limit) {
      const currentNode = queue.shift();
      
      if (currentNode.isEndOfWord) {
        // 确保完全匹配前缀
        if (currentNode.word.startsWith(prefix)) {
          result.push(currentNode.word);
        }
      }

      // 按字典序添加子节点
      const sortedChildren = Array.from(currentNode.children.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      for (const [_, childNode] of sortedChildren) {
        queue.push(childNode);
      }
    }

    return result;
  }

  // 用于调试
  debug(prefix) {
    const node = this.findNode(prefix);
    if (!node) return null;
    return this.getAllWordsFromNode(node);
  }

  findNode(prefix) {
    let node = this.root;
    for (const char of prefix) {
      if (!node.children.has(char)) return null;
      node = node.children.get(char);
    }
    return node;
  }

  getAllWordsFromNode(node) {
    const words = [];
    if (node.isEndOfWord) words.push(node.word);
    for (const childNode of node.children.values()) {
      words.push(...this.getAllWordsFromNode(childNode));
    }
    return words;
  }
}

// 创建并初始化 Trie
const dictTrie = new Trie();

try {
  dict = await fs.readFile('/data/public/sac-tokenizer/dict.txt')
  dict = dict.split('\n')
  dict.forEach(word => {
    if (word) {
      jieba.add_word(word);
      dictTrie.insert(word.trim());
    }
  })
} catch (e) {
  console.warn(e)
}

jieba.add_word('思源笔记')
jieba.add_word('链滴')
export { jieba as jieba }
export { jieba as 结巴 }
export { dict as dict }
let tokenize = jieba.tokenize
export { tokenize as tokenize }
export async function 使用结巴拆分块元素(element) {
  //首先用结巴进行全分词
  let 分词结果数组 = await tokenize(element.textContent, "search")
  //然后对分词产生的每一个结果创建range
  let tokens = []
  for (let 分词结果 of 分词结果数组) {
    let token = await 创建token对象(element, 分词结果)
    tokens.push(token)
  }
  //创建token之间的父子关系和前后关系
  await 处理分词对象(tokens)
  return tokens
}
function 处理分词对象(分词对象序列) {
  分词对象序列.forEach((当前分词对象, i) => {
    let foundNext = false;
    for (let j = i + 1; j < 分词对象序列.length; j++) {
      const 下一个分词对象 = 分词对象序列[j];
      if (!foundNext && 校验分词是否连续(当前分词对象, 下一个分词对象)) {
        当前分词对象.next = 下一个分词对象.id;
        下一个分词对象.pre = 当前分词对象.id;
        foundNext = true;
      }
      if (校验是否包含(当前分词对象, 下一个分词对象)) {
        当前分词对象.children = 当前分词对象.children || [];
        当前分词对象.children.push(下一个分词对象);
      }
    }
  });
}

// 导出 Trie 实例
export { dictTrie };