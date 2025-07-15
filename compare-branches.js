#!/usr/bin/env node
/**
 * @织: Node.js 分支比较工具
 * 用法: node compare-branches.js [help|files|diff|stats|sync]
 * 默认比较 siyuan-naive 和 upstream/master
 */
const { execSync, spawnSync } = require('child_process');
const path = require('path');

const ACTIONS = ['help', 'files', 'diff', 'stats', 'sync'];
const Branch1 = 'siyuan-naive';
const Branch2 = 'upstream/master';
const action = process.argv[2] ? process.argv[2].toLowerCase() : 'help';

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

function color(str, c) {
  const map = { red:31, green:32, yellow:33, blue:34, cyan:36, white:37 };
  return `\x1b[${map[c]||37}m${str}\x1b[0m`;
}

function showHelp() {
  console.log(color('=== 分支比较工具 (Node.js) ===', 'green'));
  console.log(color('用法:', 'yellow'));
  console.log(color('  node compare-branches.js help          - 显示帮助', 'white'));
  console.log(color('  node compare-branches.js files         - 显示修改的文件列表', 'white'));
  console.log(color('  node compare-branches.js diff          - 显示详细差异', 'white'));
  console.log(color('  node compare-branches.js stats         - 显示统计信息', 'white'));
  console.log(color('  node compare-branches.js sync          - 显示需要同步的文件', 'white'));
  console.log('');
  console.log(color(`默认比较: ${Branch1} vs ${Branch2}`, 'cyan'));
}

function showFiles() {
  console.log(color('=== 修改的文件列表 ===', 'green'));
  const files = run(`git diff ${Branch2} --name-only`);
  if (files) {
    files.split('\n').forEach(f => console.log(color('  ' + f, 'yellow')));
  } else {
    console.log(color('  没有发现差异', 'green'));
  }
}

function showDiff() {
  console.log(color('=== 详细差异 ===', 'green'));
  const diff = run(`git diff ${Branch2}`);
  if (diff) {
    console.log(diff);
  } else {
    console.log(color('  没有差异', 'green'));
  }
}

function showStats() {
  console.log(color('=== 统计信息 ===', 'green'));
  const stats = run(`git diff ${Branch2} --stat`);
  if (stats) {
    console.log(stats);
  } else {
    console.log(color('  没有差异', 'green'));
  }
}

function showSync() {
  console.log(color('=== 需要同步的文件 ===', 'green'));
  const upstreamLatest = run('git rev-parse upstream/master');
  const currentCommit = run('git rev-parse HEAD');
  if (upstreamLatest === currentCommit) {
    console.log(color('  当前分支与原版同步，无需更新', 'green'));
  } else {
    const files = run(`git diff ${upstreamLatest} --name-only`);
    if (files) {
      console.log(color('  原版有更新，需要同步以下文件:', 'yellow'));
      files.split('\n').forEach(f => console.log(color('    ' + f, 'red')));
    } else {
      console.log(color('  原版有更新，但没有文件差异', 'yellow'));
    }
  }
}

function checkGit() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    console.error(color('未检测到 git，请先安装 git！', 'red'));
    process.exit(1);
  }
}

// 主逻辑
if (!checkGit()) process.exit(1);

switch (action) {
  case 'help':
    showHelp();
    break;
  case 'files':
    showFiles();
    break;
  case 'diff':
    showDiff();
    break;
  case 'stats':
    showStats();
    break;
  case 'sync':
    showSync();
    break;
  default:
    showHelp();
    break;
} 