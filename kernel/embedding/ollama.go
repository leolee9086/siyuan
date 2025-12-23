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

package embedding

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
)

var (
	// OllamaHost Ollama 服务地址（默认值，可通过 API 自定义）
	OllamaHost = "http://127.0.0.1:11434"

	// OllamaEmbedModel 当前使用的嵌入模型
	OllamaEmbedModel = "nomic-embed-text"

	// OllamaDimension 嵌入向量维度
	OllamaDimension = 768

	// 模型缓存锁
	ollamaModelsLock sync.RWMutex
	ollamaModels     []OllamaModel
)

// IsOllamaEnabled 动态检测 Ollama 服务是否可用
func IsOllamaEnabled() bool {
	return getOllamaVersion() != ""
}

// GetOllamaVersion 动态获取 Ollama 版本
func GetOllamaVersion() string {
	return getOllamaVersion()
}

// 推荐的嵌入模型列表
var RecommendedEmbedModels = []string{
	"nomic-embed-text",   // 通用英文/中文 768维
	"mxbai-embed-large",  // 高质量多语言 1024维
	"all-minilm",         // 轻量级 384维
	"bge-m3",             // BGE 多语言
	"snowflake-arctic-embed", // Snowflake 嵌入模型
}

// OllamaModel Ollama 模型信息
type OllamaModel struct {
	Name       string    `json:"name"`
	ModifiedAt time.Time `json:"modified_at"`
	Size       int64     `json:"size"`
	Digest     string    `json:"digest"`
	Details    struct {
		Format            string   `json:"format"`
		Family            string   `json:"family"`
		Families          []string `json:"families"`
		ParameterSize     string   `json:"parameter_size"`
		QuantizationLevel string   `json:"quantization_level"`
	} `json:"details"`
}

// ollamaVersionResponse Ollama 版本响应
type ollamaVersionResponse struct {
	Version string `json:"version"`
}

// ollamaTagsResponse Ollama 模型列表响应
type ollamaTagsResponse struct {
	Models []OllamaModel `json:"models"`
}

// ollamaEmbedRequest Ollama 嵌入请求
type ollamaEmbedRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

// ollamaEmbedResponse Ollama 嵌入响应
type ollamaEmbedResponse struct {
	Embeddings [][]float32 `json:"embeddings"`
}

// ollamaPullRequest Ollama 拉取模型请求
type ollamaPullRequest struct {
	Model    string `json:"model"`
	Insecure bool   `json:"insecure"`
	Stream   bool   `json:"stream"`
}

// OllamaPullProgress 模型下载进度
type OllamaPullProgress struct {
	Status    string `json:"status"`
	Digest    string `json:"digest,omitempty"`
	Total     int64  `json:"total,omitempty"`
	Completed int64  `json:"completed,omitempty"`
}

// getOllamaVersion 获取 Ollama 版本
func getOllamaVersion() string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", OllamaHost+"/api/version", nil)
	if err != nil {
		return ""
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ""
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	var verResp ollamaVersionResponse
	if err := json.Unmarshal(body, &verResp); err != nil {
		return ""
	}

	return verResp.Version
}

// RefreshOllamaModels 刷新本地模型列表
func RefreshOllamaModels() error {
	if !IsOllamaEnabled() {
		return fmt.Errorf("ollama not enabled")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", OllamaHost+"/api/tags", nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}

	var tagsResp ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&tagsResp); err != nil {
		return err
	}

	ollamaModelsLock.Lock()
	ollamaModels = tagsResp.Models
	ollamaModelsLock.Unlock()

	return nil
}

// GetOllamaModels 获取本地已下载的模型列表
func GetOllamaModels() []OllamaModel {
	ollamaModelsLock.RLock()
	defer ollamaModelsLock.RUnlock()
	return ollamaModels
}

// HasModel 检查模型是否已下载
func HasModel(modelName string) bool {
	ollamaModelsLock.RLock()
	defer ollamaModelsLock.RUnlock()
	for _, m := range ollamaModels {
		if m.Name == modelName || m.Name == modelName+":latest" {
			return true
		}
	}
	return false
}

// OllamaPullModel 拉取模型（阻塞式，带进度回调）
func OllamaPullModel(modelName string, progressCb func(OllamaPullProgress)) error {
	if !IsOllamaEnabled() {
		return fmt.Errorf("ollama not enabled")
	}

	reqBody := ollamaPullRequest{
		Model:  modelName,
		Stream: true,
	}
	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", OllamaHost+"/api/pull", bytes.NewReader(reqData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ollama pull failed with status %d: %s", resp.StatusCode, string(body))
	}

	// 读取流式响应
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		var progress OllamaPullProgress
		if err := json.Unmarshal(scanner.Bytes(), &progress); err != nil {
			continue
		}
		if progressCb != nil {
			progressCb(progress)
		}
	}

	// 刷新模型列表
	RefreshOllamaModels()
	return nil
}

// OllamaPullModelAsync 异步拉取模型（返回进度通道）
func OllamaPullModelAsync(modelName string) (<-chan OllamaPullProgress, <-chan error) {
	progressCh := make(chan OllamaPullProgress, 100)
	errCh := make(chan error, 1)

	go func() {
		defer close(progressCh)
		defer close(errCh)

		err := OllamaPullModel(modelName, func(p OllamaPullProgress) {
			select {
			case progressCh <- p:
			default:
			}
		})
		if err != nil {
			errCh <- err
		}
	}()

	return progressCh, errCh
}

// SetEmbedModel 设置当前使用的嵌入模型
func SetEmbedModel(modelName string) error {
	if !HasModel(modelName) {
		return fmt.Errorf("model %s not found, please pull it first", modelName)
	}
	OllamaEmbedModel = modelName
	// 重置维度，下次嵌入时会自动检测
	OllamaDimension = 0
	logging.LogInfof("switched embedding model to [%s]", modelName)
	return nil
}

// OllamaEmbed 调用 Ollama 生成嵌入向量
func OllamaEmbed(text string) ([]float32, error) {
	return OllamaEmbedWithModel(text, OllamaEmbedModel)
}

// OllamaEmbedWithModel 使用指定模型生成嵌入向量
func OllamaEmbedWithModel(text string, model string) ([]float32, error) {
	if !IsOllamaEnabled() {
		return nil, fmt.Errorf("ollama service not enabled")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	reqBody := ollamaEmbedRequest{
		Model: model,
		Input: text,
	}
	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", OllamaHost+"/api/embed", bytes.NewReader(reqData))
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama returned status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response failed: %w", err)
	}

	var embedResp ollamaEmbedResponse
	if err := json.Unmarshal(body, &embedResp); err != nil {
		return nil, fmt.Errorf("unmarshal response failed: %w", err)
	}

	if len(embedResp.Embeddings) == 0 {
		return nil, fmt.Errorf("no embeddings returned")
	}

	// 更新维度
	if len(embedResp.Embeddings[0]) > 0 && OllamaDimension == 0 {
		OllamaDimension = len(embedResp.Embeddings[0])
		logging.LogInfof("detected embedding dimension: %d for model %s", OllamaDimension, model)
	}

	return embedResp.Embeddings[0], nil
}

// OllamaEmbedBatch 批量生成嵌入向量
func OllamaEmbedBatch(texts []string) ([][]float32, error) {
	return OllamaEmbedBatchWithModel(texts, OllamaEmbedModel)
}

// OllamaEmbedBatchWithModel 使用指定模型批量生成嵌入向量
func OllamaEmbedBatchWithModel(texts []string, model string) ([][]float32, error) {
	if !IsOllamaEnabled() {
		return nil, fmt.Errorf("ollama service not enabled")
	}

	results := make([][]float32, len(texts))
	for i, text := range texts {
		embedding, err := OllamaEmbedWithModel(text, model)
		if err != nil {
			return nil, fmt.Errorf("embed text %d failed: %w", i, err)
		}
		results[i] = embedding
	}
	return results, nil
}

// GetOllamaStatus 获取 Ollama 服务状态
func GetOllamaStatus() map[string]interface{} {
	models := GetOllamaModels()
	modelNames := make([]string, len(models))
	for i, m := range models {
		modelNames[i] = m.Name
	}

	return map[string]interface{}{
		"enabled":            IsOllamaEnabled(),
		"version":            GetOllamaVersion(),
		"host":               OllamaHost,
		"model":              OllamaEmbedModel,
		"dimension":          OllamaDimension,
		"available_models":   modelNames,
		"recommended_models": RecommendedEmbedModels,
	}
}
