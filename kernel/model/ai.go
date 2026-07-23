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

package model

import (
	"bytes"
	"errors"
	"strings"

	"github.com/88250/lute/ast"
	"github.com/88250/lute/parse"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/treenode"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func ChatGPT(msg string) (ret string) {
	if !isOpenAIAPIEnabled() {
		return
	}

	return chatGPT(msg, false)
}

func ChatGPTWithAction(ids []string, action string) (ret string) {
	if !isOpenAIAPIEnabled() {
		return
	}

	if "Clear context" == action {
		// AI clear context action https://github.com/siyuan-note/siyuan/issues/10255
		cachedContextMsg = nil
		return
	}

	msg := getBlocksContent(ids)
	ret = chatGPTWithAction(msg, action, false)
	return
}

var cachedContextMsg []string

func chatGPT(msg string, cloud bool) (ret string) {
	if "Clear context" == msg {
		// AI clear context action https://github.com/siyuan-note/siyuan/issues/10255
		cachedContextMsg = nil
		return
	}

	ret, retCtxMsgs, err := chatGPTComplete(msg, cachedContextMsg, cloud)
	if err != nil {
		return
	}
	cachedContextMsg = append(cachedContextMsg, retCtxMsgs...)
	return
}

func chatGPTWithAction(msg string, action string, cloud bool) (ret string) {
	action = strings.TrimSpace(action)
	if "" != action {
		msg = action + ":\n\n" + msg
	}
	ret, _, err := chatGPTComplete(msg, nil, cloud)
	if err != nil {
		return
	}
	return
}

func chatGPTComplete(msg string, contextMsgs []string, cloud bool) (ret string, retContextMsgs []string, err error) {
	util.PushEndlessProgress("Requesting...")
	defer util.ClearPushProgress(100)

	var gpt GPT
	maxHistoryMessages := getEditingMaxHistoryMessages()
	if cloud {
		gpt = &CloudGPT{}
	} else {
		var cfgErr error
		gpt, maxHistoryMessages, cfgErr = newOpenAIGPT()
		if nil != cfgErr {
			err = cfgErr
			return
		}
	}

	if maxHistoryMessages < len(contextMsgs) {
		contextMsgs = contextMsgs[len(contextMsgs)-maxHistoryMessages:]
	}

	part, stop, chatErr := gpt.chat(msg, contextMsgs)
	if nil != chatErr {
		err = chatErr
		return
	}

	// stop==false means finish_reason=length: the output was truncated at
	// MaxCompletionTokens. Retrying the same prompt would almost certainly hit
	// the same limit again, so we return whatever was produced and notify the
	// user instead of silently looping. See https://github.com/siyuan-note/siyuan/issues/17797
	if !stop {
		util.PushMsg(Conf.Language(297), 5000)
	}

	ret = strings.TrimSpace(part)
	if "" != ret {
		retContextMsgs = append(retContextMsgs, msg, ret)
	}
	return
}

func isOpenAIAPIEnabled() bool {
	if Conf == nil || Conf.AI == nil || (!Conf.AI.HasAnyProvider() && (Conf.AI.OpenAI == nil || Conf.AI.OpenAI.APIKey == "")) {
		pushAINotConfigured()
		return false
	}
	return true
}

func pushAINotConfigured() {
	if Conf != nil {
		util.PushMsg(Conf.Language(193), 5000)
		return
	}
	util.PushMsg("AI is not configured", 5000)
}

func getEditingMaxHistoryMessages() int {
	if Conf != nil && Conf.AI != nil && Conf.AI.Editing != nil && Conf.AI.Editing.MaxHistoryMessages > 0 {
		return Conf.AI.Editing.MaxHistoryMessages
	}
	return 7
}

func newOpenAIGPT() (*OpenAIGPT, int, error) {
	if Conf == nil || Conf.AI == nil {
		return nil, 7, errors.New("no AI config")
	}

	ai := Conf.AI
	maxHistoryMessages := getEditingMaxHistoryMessages()
	if prov, m := ai.GetEditingModel(); nil != prov && nil != m {
		timeout := prov.RequestTimeout
		if timeout < 1 {
			timeout = 30
		}
		maxCompletionTokens := 0
		temperature := 1.0
		if ai.Editing != nil {
			maxCompletionTokens = ai.Editing.MaxCompletionTokens
			temperature = ai.Editing.Temperature
		}
		apiProvider := "OpenAI"
		if ai.OpenAI != nil {
			apiProvider = ai.OpenAI.APIProvider
		}
		if apiProvider == "" {
			apiProvider = "OpenAI"
		}
		apiProxy := ai.EffectiveAPIProxy(Conf.System)
		return &OpenAIGPT{
			c:                   util.NewOpenAIClientWithModel(prov.APIKey, prov.BaseURL, m.Name, apiProxy),
			modelName:           m.Name,
			timeout:             timeout,
			maxCompletionTokens: maxCompletionTokens,
			temperature:         temperature,
			apiProvider:         apiProvider,
			apiKey:              prov.APIKey,
			apiProxy:            apiProxy,
			apiBaseURL:          prov.BaseURL,
		}, maxHistoryMessages, nil
	}

	if ai.OpenAI != nil && ai.OpenAI.APIKey != "" {
		maxHistoryMessages = ai.OpenAI.APIMaxContexts
		if maxHistoryMessages < 1 {
			maxHistoryMessages = 7
		}
		apiProvider := ai.OpenAI.APIProvider
		if apiProvider == "" {
			apiProvider = "OpenAI"
		}
		apiProxy := ai.EffectiveAPIProxy(Conf.System)
		return &OpenAIGPT{
			c:                   util.NewOpenAIClientWithModel(ai.OpenAI.APIKey, ai.OpenAI.APIBaseURL, ai.OpenAI.APIModel, apiProxy),
			modelName:           ai.OpenAI.APIModel,
			timeout:             ai.OpenAI.APITimeout,
			maxCompletionTokens: ai.OpenAI.APIMaxTokens,
			temperature:         ai.OpenAI.APITemperature,
			apiProvider:         apiProvider,
			apiKey:              ai.OpenAI.APIKey,
			apiProxy:            apiProxy,
			apiBaseURL:          ai.OpenAI.APIBaseURL,
		}, maxHistoryMessages, nil
	}

	return nil, maxHistoryMessages, errors.New("no AI provider configured")
}

func getBlocksContent(ids []string) string {
	var nodes []*ast.Node
	trees := map[string]*parse.Tree{}
	for _, id := range ids {
		bt := treenode.GetBlockTree(id)
		if nil == bt {
			continue
		}

		var tree *parse.Tree
		if tree = trees[bt.RootID]; nil == tree {
			tree, _ = LoadTreeByBlockID(bt.RootID)
			if nil == tree {
				continue
			}

			trees[bt.RootID] = tree
		}

		if node := treenode.GetNodeInTree(tree, id); nil != node {
			if ast.NodeDocument == node.Type {
				for child := node.FirstChild; nil != child; child = child.Next {
					nodes = append(nodes, child)
				}
			} else {
				nodes = append(nodes, node)
			}
		}
	}

	luteEngine := util.NewLute()
	buf := bytes.Buffer{}
	for _, node := range nodes {
		md := treenode.ExportNodeStdMd(node, luteEngine)
		buf.WriteString(md)
		buf.WriteString("\n\n")
	}
	return buf.String()
}

type GPT interface {
	chat(msg string, contextMsgs []string) (partRet string, stop bool, err error)
}

type OpenAIGPT struct {
	c                   *openai.Client
	modelName           string
	timeout             int
	maxCompletionTokens int
	temperature         float64
	apiProvider         string
	apiKey              string
	apiProxy            string
	apiBaseURL          string
}

func (gpt *OpenAIGPT) chat(msg string, contextMsgs []string) (partRet string, stop bool, err error) {
	return util.ChatGPT(msg, contextMsgs, gpt.c, gpt.modelName, gpt.maxCompletionTokens, gpt.temperature, gpt.timeout, gpt.apiProvider, gpt.apiKey, gpt.apiProxy, gpt.apiBaseURL)
}

type CloudGPT struct {
}

func (gpt *CloudGPT) chat(msg string, contextMsgs []string) (partRet string, stop bool, err error) {
	return CloudChatGPT(msg, contextMsgs)
}
