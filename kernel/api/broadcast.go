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
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/olahol/melody"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type Channel struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

var (
	BroadcastChannels = sync.Map{}
)

/*
broadcast create a broadcast channel WebSocket connection

@param

	query.channel: channel name

@example

	ws://localhost:6806/ws/broadcast?channel=test
*/
func broadcast(c *gin.Context) {
	var (
		channel          string = c.Query("channel")
		broadcastChannel *melody.Melody
	)

	if _broadcastChannel, exist := BroadcastChannels.Load(channel); exist {
		// channel exists, use it
		broadcastChannel = _broadcastChannel.(*melody.Melody)
		subscribe(c, broadcastChannel, channel)
	} else {
		// channel not found, create a new one
		broadcastChannel := melody.New()
		broadcastChannel.Config.MaxMessageSize = 1024 * 1024 * 128 // 128 MiB
		BroadcastChannels.Store(channel, broadcastChannel)
		subscribe(c, broadcastChannel, channel)

		// broadcast string message to other session
		broadcastChannel.HandleMessage(func(s *melody.Session, msg []byte) {
			broadcastChannel.BroadcastOthers(msg, s)
		})

		// broadcast binary message to other session
		broadcastChannel.HandleMessageBinary(func(s *melody.Session, msg []byte) {
			broadcastChannel.BroadcastBinaryOthers(msg, s)
		})

		// recycling
		broadcastChannel.HandleClose(func(s *melody.Session, status int, reason string) error {
			channel := s.Keys["channel"].(string)
			logging.LogInfof("close broadcast session in channel [%s] with status code %d: %s", channel, status, reason)

			count := broadcastChannel.Len()
			if count == 0 {
				BroadcastChannels.Delete(channel)
				logging.LogInfof("dispose broadcast channel [%s]", channel)
			}
			return nil
		})
	}
}

// subscribe creates a new websocket session to a channel
func subscribe(c *gin.Context, broadcastChannel *melody.Melody, channel string) {
	if err := broadcastChannel.HandleRequestWithKeys(
		c.Writer,
		c.Request,
		map[string]interface{}{
			"channel": channel,
		},
	); nil != err {
		logging.LogErrorf("create broadcast channel failed: %s", err)
		return
	}
}

/*
postMessage send string message to a broadcast channel

@param

	body.channel: channel name
	body.message: message payload

@returns

	body.data.channel.name: channel name
	body.data.channel.count: indicate how many websocket session received the message
*/
func postMessage(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	channel := arg["channel"].(string)
	message := arg["message"].(string)

	if _broadcastChannel, ok := BroadcastChannels.Load(channel); !ok {
		err := fmt.Errorf("broadcast channel [%s] not found", channel)
		logging.LogWarnf(err.Error())

		ret.Code = -1
		ret.Msg = err.Error()
		return
	} else {
		var broadcastChannel = _broadcastChannel.(*melody.Melody)
		if err := broadcastChannel.Broadcast([]byte(message)); nil != err {
			logging.LogErrorf("broadcast message failed: %s", err)

			ret.Code = -2
			ret.Msg = err.Error()
			return
		}

		count := broadcastChannel.Len()
		ret.Data = map[string]interface{}{
			"channel": &Channel{
				Name:  channel,
				Count: count,
			},
		}
	}
}

/*
getChannelInfo gets the information of a broadcast channel

@param

	body.name: channel name

@returns

	body.data.channel: the channel information
*/
func getChannelInfo(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	name := arg["name"].(string)

	if _broadcastChannel, ok := BroadcastChannels.Load(name); !ok {
		err := fmt.Errorf("broadcast channel [%s] not found", name)
		logging.LogWarnf(err.Error())

		ret.Code = -1
		ret.Msg = err.Error()
		return
	} else {
		var broadcastChannel = _broadcastChannel.(*melody.Melody)

		count := broadcastChannel.Len()
		ret.Data = map[string]interface{}{
			"channel": &Channel{
				Name:  name,
				Count: count,
			},
		}
	}
}

/*
getChannels gets the channel name and lintener number of all broadcast chanel

@returns

	body.data.channels: {
		name: channel name
		count: listener count
	}[]
*/
func getChannels(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	channels := []*Channel{}
	BroadcastChannels.Range(func(key, value any) bool {
		broadcastChannel := value.(*melody.Melody)
		channels = append(channels, &Channel{
			Name:  key.(string),
			Count: broadcastChannel.Len(),
		})
		return true
	})
	ret.Data = map[string]interface{}{
		"channels": channels,
	}
}

func handleExternalRequest(c *gin.Context) {
	channel := c.Param("channel")  // 获取 channel 参数
	requestPath := c.Param("path") // 获取 path 参数，包含所有子路由

	if channel == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel is required"})
		return
	}

	// 封装完整的HTTP请求信息
	requestDetails := map[string]interface{}{
		"method":  c.Request.Method,
		"headers": c.Request.Header,
		"path":    requestPath,
		"query":   c.Request.URL.Query(),
	}

	var message []byte
	var err error

	// 根据请求方法获取消息体
	if c.Request.Method == "POST" {
		body, err := c.GetRawData() // 从请求体中获取消息
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read request body"})
			return
		}
		requestDetails["body"] = body
	}

	// 序列化请求详情为JSON，以便发送到WebSocket
	message, err = json.Marshal(requestDetails)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize request details"})
		return
	}

	// 检查channel是否存在
	if broadcastChannel, ok := BroadcastChannels.Load(channel); ok {
		melodyChannel := broadcastChannel.(*melody.Melody)

		// 创建一个channel以接收第一个响应
		responseCh := make(chan []byte, 1)

		// 设置一个临时的消息处理器来捕获第一个响应
		melodyChannel.HandleMessage(func(s *melody.Session, msg []byte) {
			select {
			case responseCh <- msg:
			default:
			}
		})

		// 广播消息
		if err := melodyChannel.Broadcast(message); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to broadcast message"})
			return
		}

		// 等待响应或超时
		select {
		case response := <-responseCh:
			// 解析响应 JSON
			var respDetails map[string]interface{}
			if err := json.Unmarshal(response, &respDetails); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response details"})
				return
			}
			// 设置响应头
			if headers, ok := respDetails["headers"].(map[string]interface{}); ok {
				for key, value := range headers {
					c.Header(key, value.(string))
				}
			}
			// 解码 base64 数据
			if body, ok := respDetails["body"].(string); ok {
				decodedData, err := base64.StdEncoding.DecodeString(body)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode base64 data"})
					return
				}
				// 设置状态码和响应体
				statusCode := http.StatusOK
				if code, ok := respDetails["statusCode"].(float64); ok {
					statusCode = int(code)
				}
				c.Data(statusCode, c.GetHeader("Content-Type"), decodedData)
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "No body found in response"})
			}
		case <-time.After(10 * time.Second): // 10秒超时
			c.String(http.StatusGatewayTimeout, "Request timed out")
		}

		// 清理临时的消息处理器
		melodyChannel.HandleMessage(nil)
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
	}
}
