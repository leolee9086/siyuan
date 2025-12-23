// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package embedding

import (
	"testing"
)

func TestOllamaInit(t *testing.T) {
	InitOllama()

	if !OllamaEnabled {
		t.Skip("Ollama not available, skipping test")
	}

	t.Logf("Ollama enabled: host=%s, model=%s, ver=%s",
		OllamaHost, OllamaEmbedModel, OllamaVersion)
}

func TestOllamaEmbed(t *testing.T) {
	InitOllama()

	if !OllamaEnabled {
		t.Skip("Ollama not available, skipping test")
	}

	// 先确保模型存在
	if !HasModel(OllamaEmbedModel) {
		t.Logf("Model %s not found, pulling...", OllamaEmbedModel)
		err := OllamaPullModel(OllamaEmbedModel, func(p OllamaPullProgress) {
			t.Logf("Pull progress: %s", p.Status)
		})
		if err != nil {
			t.Fatalf("Failed to pull model: %v", err)
		}
	}

	text := "这是一个测试文本，用于验证嵌入功能"
	embedding, err := OllamaEmbed(text)
	if err != nil {
		t.Fatalf("OllamaEmbed failed: %v", err)
	}

	t.Logf("Embedding dimension: %d", len(embedding))
	if len(embedding) < 100 {
		t.Errorf("Embedding dimension too small: %d", len(embedding))
	}
}

func TestCollectionNames(t *testing.T) {
	model := "nomic-embed-text"
	blocksName := GetBlocksCollectionName(model)
	assetsName := GetAssetsCollectionName(model)

	expectedBlocks := "blocks_embedding_nomic-embed-text"
	expectedAssets := "assets_embedding_nomic-embed-text"

	if blocksName != expectedBlocks {
		t.Errorf("Expected %s, got %s", expectedBlocks, blocksName)
	}
	if assetsName != expectedAssets {
		t.Errorf("Expected %s, got %s", expectedAssets, assetsName)
	}

	// 测试带冒号的模型名
	model2 := "nomic-embed-text:latest"
	blocksName2 := GetBlocksCollectionName(model2)
	if blocksName2 != "blocks_embedding_nomic-embed-text_latest" {
		t.Errorf("Unexpected collection name: %s", blocksName2)
	}
}

func TestGetStatus(t *testing.T) {
	InitOllama()

	status := GetStatus()
	t.Logf("Status: %+v", status)

	if _, ok := status["enabled"]; !ok {
		t.Error("Status should have 'enabled' field")
	}
	if _, ok := status["model"]; !ok {
		t.Error("Status should have 'model' field")
	}
	if _, ok := status["available_models"]; !ok {
		t.Error("Status should have 'available_models' field")
	}
}

func TestHashContent(t *testing.T) {
	hash1 := HashContent("hello world")
	hash2 := HashContent("hello world")
	hash3 := HashContent("hello world!")

	if hash1 != hash2 {
		t.Error("Same content should produce same hash")
	}
	if hash1 == hash3 {
		t.Error("Different content should produce different hash")
	}

	t.Logf("Hash: %s", hash1)
}
