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

package api

import (
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/cronjob"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// listCronjobs 列出所有任务
func listCronjobs(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	manager := cronjob.GetManager()
	tasks := manager.GetAllTasks()

	ret.Data = map[string]interface{}{
		"tasks": tasks,
	}
}

// getCronjob 获取任务详情
func getCronjob(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	manager := cronjob.GetManager()
	taskInfo := manager.GetTask(docId)

	if taskInfo == nil {
		ret.Code = -1
		ret.Msg = "任务不存在"
		return
	}

	ret.Data = taskInfo
}

// registerCronjob 注册扩展
func registerCronjob(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	extLang := arg["extLang"].(string)
	extType := arg["extType"].(string)

	manager := cronjob.GetManager()
	if err := manager.RegisterExtension(docId, extLang, extType); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}

// unregisterCronjob 注销扩展
func unregisterCronjob(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	manager := cronjob.GetManager()
	if err := manager.UnregisterExtension(docId); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}

// enableCronjob 启用任务
func enableCronjob(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	manager := cronjob.GetManager()
	if err := manager.CompileAndStartTask(docId); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}

// disableCronjob 禁用任务
func disableCronjob(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	manager := cronjob.GetManager()
	if err := manager.StopTask(docId); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}

// runCronjob 立即执行任务
func runCronjob(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	manager := cronjob.GetManager()
	if err := manager.RunNow(docId); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}

// compileCronjob 编译文档
func compileCronjob(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	extLang := "go"
	if lang, exists := arg["extLang"].(string); exists && lang != "" {
		extLang = lang
	}

	compiler := cronjob.NewDocumentCompiler()
	code, err := compiler.Compile(docId, extLang)
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	// 保存编译结果
	if err := cronjob.SaveCompileResult(docId, code); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	ret.Data = map[string]interface{}{
		"code":   code,
		"docId":  docId,
		"output": cronjob.GetCompileOutputDir() + "/" + docId + ".go",
	}
}

// getCronjobLogs 获取执行日志
func getCronjobLogs(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	docId := arg["docId"].(string)
	count := 20
	if n, exists := arg["count"].(float64); exists {
		count = int(n)
	}

	logs := cronjob.GetExecutionRecords(docId, count)
	ret.Data = map[string]interface{}{
		"logs": logs,
	}
}
