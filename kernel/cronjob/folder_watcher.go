// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package cronjob

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/siyuan-note/logging"
)

// 文件夹监听器 监听文件夹变化
type 文件夹监听器 struct {
	监听目录  string
	监听器   *fsnotify.Watcher
	停止信号  chan struct{}
	事件处理器 func(事件类型 string, 文件路径 string)
	运行中   bool
	锁     sync.Mutex
}

// 创建文件夹监听器 创建新的文件夹监听器
func 创建文件夹监听器(目录 string, 事件处理器 func(string, string)) (*文件夹监听器, error) {
	监听器, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &文件夹监听器{
		监听目录:  目录,
		监听器:   监听器,
		停止信号:  make(chan struct{}),
		事件处理器: 事件处理器,
	}, nil
}

// 开始监听 开始监听文件夹变化
func (w *文件夹监听器) 开始监听() error {
	w.锁.Lock()
	if w.运行中 {
		w.锁.Unlock()
		return nil
	}
	w.运行中 = true
	w.锁.Unlock()

	// 添加监听目录
	if err := w.添加目录递归(w.监听目录); err != nil {
		return err
	}

	// 启动事件处理循环
	go w.事件处理循环()

	logging.LogInfof("开始监听文件夹: %s", w.监听目录)
	return nil
}

// 添加目录递归 递归添加目录及其子目录到监听器
func (w *文件夹监听器) 添加目录递归(目录 string) error {
	return filepath.Walk(目录, func(路径 string, 信息 os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if 信息.IsDir() {
			if err := w.监听器.Add(路径); err != nil {
				logging.LogWarnf("添加监听目录失败 [%s]: %s", 路径, err)
			}
		}
		return nil
	})
}

// 事件处理循环 处理文件系统事件
func (w *文件夹监听器) 事件处理循环() {
	// 事件防抖：避免短时间内重复触发
	防抖计时器 := make(map[string]*time.Timer)
	防抖锁 := sync.Mutex{}
	防抖延迟 := 500 * time.Millisecond

	for {
		select {
		case <-w.停止信号:
			logging.LogInfof("停止监听文件夹: %s", w.监听目录)
			return

		case 事件, ok := <-w.监听器.Events:
			if !ok {
				return
			}

			// 确定事件类型
			var 事件类型 string
			switch {
			case 事件.Op&fsnotify.Create == fsnotify.Create:
				事件类型 = "create"
				// 如果创建的是目录，添加到监听
				if 信息, err := os.Stat(事件.Name); err == nil && 信息.IsDir() {
					w.监听器.Add(事件.Name)
				}
			case 事件.Op&fsnotify.Write == fsnotify.Write:
				事件类型 = "write"
			case 事件.Op&fsnotify.Remove == fsnotify.Remove:
				事件类型 = "remove"
			case 事件.Op&fsnotify.Rename == fsnotify.Rename:
				事件类型 = "rename"
			default:
				continue
			}

			// 防抖处理
			防抖锁.Lock()
			if 计时器, 存在 := 防抖计时器[事件.Name]; 存在 {
				计时器.Stop()
			}
			防抖计时器[事件.Name] = time.AfterFunc(防抖延迟, func() {
				w.事件处理器(事件类型, 事件.Name)
				防抖锁.Lock()
				delete(防抖计时器, 事件.Name)
				防抖锁.Unlock()
			})
			防抖锁.Unlock()

		case err, ok := <-w.监听器.Errors:
			if !ok {
				return
			}
			logging.LogErrorf("文件监听错误: %s", err)
		}
	}
}

// 停止监听 停止监听文件夹
func (w *文件夹监听器) 停止监听() {
	w.锁.Lock()
	defer w.锁.Unlock()

	if !w.运行中 {
		return
	}

	close(w.停止信号)
	w.监听器.Close()
	w.运行中 = false
}

// 图片水印监听器 监听文件夹并自动添加水印的专用监听器
type 图片水印监听器 struct {
	文件夹监听器 *文件夹监听器
	已处理文件  map[string]bool
	水印配置   *图片水印配置
	锁      sync.Mutex
}

// 创建图片水印监听器 创建自动添加水印的文件夹监听器
func 创建图片水印监听器(目录 string) (*图片水印监听器, error) {
	监听器 := &图片水印监听器{
		已处理文件: make(map[string]bool),
	}

	// 获取水印配置
	监听器.水印配置 = 获取当前图片水印配置()

	// 创建文件夹监听器
	文件夹监听器, err := 创建文件夹监听器(目录, 监听器.处理文件事件)
	if err != nil {
		return nil, err
	}
	监听器.文件夹监听器 = 文件夹监听器

	return 监听器, nil
}

// 处理文件事件 处理文件变化事件
func (w *图片水印监听器) 处理文件事件(事件类型 string, 文件路径 string) {
	// 只处理创建和写入事件
	if 事件类型 != "create" && 事件类型 != "write" {
		return
	}

	// 检查是否为图片文件
	if !是否为图片文件(文件路径) {
		return
	}

	// 跳过已处理的水印文件
	if 是否为水印文件(文件路径) {
		return
	}

	w.锁.Lock()
	// 检查是否已处理
	if w.已处理文件[文件路径] {
		w.锁.Unlock()
		return
	}
	w.锁.Unlock()

	// 刷新配置
	配置 := 获取当前图片水印配置()
	if 配置 == nil || 配置.水印文本 == "" {
		logging.LogWarnf("水印配置为空，跳过处理: %s", 文件路径)
		return
	}

	// 处理图片
	logging.LogInfof("检测到新图片，添加水印: %s", 文件路径)
	if err := 处理单个图片(文件路径, 配置); err != nil {
		logging.LogErrorf("添加水印失败 [%s]: %s", 文件路径, err)
		return
	}

	// 记录已处理
	w.锁.Lock()
	w.已处理文件[文件路径] = true
	w.锁.Unlock()

	logging.LogInfof("水印添加完成: %s", 文件路径)
}

// 是否为水印文件 检查文件是否为已添加水印的文件
func 是否为水印文件(路径 string) bool {
	return filepath.Base(路径) != "" &&
		(filepath.Base(路径)[0] == '.' || // 隐藏文件
			len(路径) > 12 && 路径[len(路径)-15:len(路径)-4] == "_watermarked")
}

// 开始 开始监听
func (w *图片水印监听器) 开始() error {
	return w.文件夹监听器.开始监听()
}

// 停止 停止监听
func (w *图片水印监听器) 停止() {
	w.文件夹监听器.停止监听()
}

// 重新扫描 重新扫描目录并处理未处理的图片
func (w *图片水印监听器) 重新扫描() error {
	配置 := 获取当前图片水印配置()
	if 配置 == nil {
		return nil
	}

	w.锁.Lock()
	已处理 := w.已处理文件
	w.锁.Unlock()

	return 批量处理目录中的图片(w.文件夹监听器.监听目录, 配置, 已处理)
}
