package marduk

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/util"
)

// Storage 人格档案存储接口
type Storage struct {
	dataDir string // 数据目录路径
}

// NewStorage 创建存储实例
func NewStorage(dataDir string) *Storage {
	return &Storage{
		dataDir: dataDir,
	}
}

// LoadSubmissionPayload 加载问卷提交载荷
func (s *Storage) LoadSubmissionPayload(filePath string) (*IpipNeo120SubmissionPayload, error) {
	fullPath := s.resolveFullPath(filePath)

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	var payload IpipNeo120SubmissionPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析JSON失败: %w", err)
	}

	// 校验数据结构
	if err := ValidateSubmissionPayload(&payload); err != nil {
		return nil, fmt.Errorf("数据校验失败: %w", err)
	}

	return &payload, nil
}

// LoadPersonaProfile 加载人格档案
func (s *Storage) LoadPersonaProfile(filePath string) (*IpipPersonaProfile, error) {
	fullPath := s.resolveFullPath(filePath)

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	var profile IpipPersonaProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		return nil, fmt.Errorf("解析JSON失败: %w", err)
	}

	// 校验数据结构
	if err := ValidatePersonaProfile(&profile); err != nil {
		return nil, fmt.Errorf("数据校验失败: %w", err)
	}

	return &profile, nil
}

// ListPersonaProfiles 列出指定用户的所有人格档案
func (s *Storage) ListPersonaProfiles(subjectID string) ([]string, error) {
	privateDir := filepath.Join(s.dataDir, "private")

	entries, err := os.ReadDir(privateDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("读取目录失败: %w", err)
	}

	var profiles []string
	prefix := subjectID + "_persona_profile_"

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, prefix) && strings.HasSuffix(name, ".json") {
			profiles = append(profiles, filepath.Join("/data/private", name))
		}
	}

	return profiles, nil
}

// resolveFullPath 将相对路径转换为完整路径
func (s *Storage) resolveFullPath(relativePath string) string {
	// 移除开头的 /data/
	trimmed := strings.TrimPrefix(relativePath, "/data/")
	return filepath.Join(s.dataDir, trimmed)
}

// GetDefaultStorage 获取默认存储实例（使用思源笔记的数据目录）
func GetDefaultStorage() *Storage {
	return NewStorage(util.DataDir)
}
