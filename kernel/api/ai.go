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
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func chatGPT(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	arg, ok := util.JsonArg(c, ret)
	if !ok {
		c.JSON(http.StatusOK, ret)
		return
	}

	msg := arg["msg"].(string)

	// 设置 SSE Headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	c.Writer.Header().Set("Access-Control-Allow-Headers", "Cache-Control")

	// 调用模型层的流式函数
	stream, err := model.ChatGPTContinueWriteStream(msg, model.CachedContextMsg, false)
	if err != nil {
		// 发送错误事件
		errorData, _ := json.Marshal(map[string]interface{}{
			"error": err.Error(),
		})
		c.Writer.WriteString("data: " + string(errorData) + "\n\n")
		c.Writer.Flush()
		return
	}

	if stream == nil {
		// 处理流为空的情况
		errorData, _ := json.Marshal(map[string]interface{}{
			"error": "No response from AI service",
		})
		c.Writer.WriteString("data: " + string(errorData) + "\n\n")
		c.Writer.Flush()
		return
	}
	defer stream.Close()

	// 监听客户端断开连接
	clientDisconnected := c.Writer.CloseNotify()

	// 发送开始事件
	startData, _ := json.Marshal(map[string]interface{}{
		"status":  "started",
		"message": "开始生成回复...",
	})
	c.Writer.WriteString("data: " + string(startData) + "\n\n")
	c.Writer.Flush()

	for {
		select {
		case <-clientDisconnected:
			// 客户端断开连接，停止处理
			return
		default:
			response, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				// 流结束，发送完成事件
				doneData, _ := json.Marshal(map[string]interface{}{
					"status":  "completed",
					"message": "生成完成",
				})
				c.Writer.WriteString("data: " + string(doneData) + "\n\n")
				c.Writer.Flush()
				return
			}
			if err != nil {
				// 发送错误事件
				errorData, _ := json.Marshal(map[string]interface{}{
					"error": err.Error(),
				})
				c.Writer.WriteString("data: " + string(errorData) + "\n\n")
				c.Writer.Flush()
				return
			}

			// 检查响应是否有效
			if len(response.Choices) == 0 {
				continue
			}

			// 发送内容事件
			content := response.Choices[0].Delta.Content
			if content != "" {
				data, _ := json.Marshal(map[string]interface{}{
					"content": content,
					"status":  "streaming",
				})
				c.Writer.WriteString("data: " + string(data) + "\n\n")
				c.Writer.Flush()
			}
		}
	}
}

func chatGPTWithAction(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	idsArg := arg["ids"].([]interface{})
	var ids []string
	for _, id := range idsArg {
		ids = append(ids, id.(string))
	}
	action := arg["action"].(string)
	ret.Data = model.ChatGPTWithAction(ids, action)
}
