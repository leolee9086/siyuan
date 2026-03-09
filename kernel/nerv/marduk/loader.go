// Package marduk 提供人格档案存储、校验和注入功能
package marduk

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/siyuan-note/filelock"
)

// LoadPersonaProfile 加载人格档案
// 优先级：用户档案 > 性别匹配预设 > 默认预设（丽）
func LoadPersonaProfile(dataDir string) (*IpipPersonaProfile, bool, error) {
	// 尝试加载用户档案
	userProfile, err := loadUserProfile(dataDir)
	if err == nil && userProfile != nil {
		if userProfile.Subject.Gender != nil && *userProfile.Subject.Gender != "" {
			// 有完整性别信息，档案完整
			return userProfile, true, nil
		}
		// 有档案但缺少性别信息，使用默认预设
		return GetReiPreset(), false, nil
	}

	// 没有用户档案，使用默认预设
	return GetReiPreset(), false, nil
}

// LoadPersonaProfileWithGenderFallback 根据性别加载人格档案
// 如果用户档案不完整，根据性别选择预设（女->丽，男->薰）
func LoadPersonaProfileWithGenderFallback(dataDir string) (*IpipPersonaProfile, bool, string, error) {
	// 尝试加载用户档案
	userProfile, err := loadUserProfile(dataDir)
	if err == nil && userProfile != nil {
		// 检查档案完整性
		isComplete := isProfileComplete(userProfile)
		if isComplete {
			return userProfile, true, "", nil
		}

		// 档案不完整，根据性别选择预设
		if userProfile.Subject.Gender != nil {
			gender := *userProfile.Subject.Gender
			if gender == "男" {
				return GetKaoruPreset(), false, "薰", nil
			}
			return GetReiPreset(), false, "丽", nil
		}

		// 连性别都没有，使用默认预设（丽）
		return GetReiPreset(), false, "丽", nil
	}

	// 没有用户档案，使用默认预设（丽）
	return GetReiPreset(), false, "丽", nil
}

// loadUserProfile 从数据目录加载用户人格档案
func loadUserProfile(dataDir string) (*IpipPersonaProfile, error) {
	storage := NewStorage(dataDir)
	if profile, err := loadUserProfileFromActiveSeed(storage); err == nil {
		return profile, nil
	}
	return loadUserProfileFromLegacyPath(dataDir)
}

func loadUserProfileFromActiveSeed(storage *Storage) (*IpipPersonaProfile, error) {
	pointer, err := loadActiveSeedPointer(storage)
	if err != nil {
		return nil, err
	}

	profilePath := strings.TrimSpace(pointer.ActiveProfilePath)
	if profilePath == "" {
		return nil, fmt.Errorf("active profile path is empty")
	}
	absoluteProfilePath := filepath.Clean(storage.resolveFullPath(profilePath))
	return loadPersonaProfileWithoutValidation(absoluteProfilePath)
}

func loadUserProfileFromLegacyPath(dataDir string) (*IpipPersonaProfile, error) {
	legacyProfilePath := filepath.Clean(filepath.Join(dataDir, "petal", "persona", "active_profile.json"))
	return loadPersonaProfileWithoutValidation(legacyProfilePath)
}

func loadPersonaProfileWithoutValidation(profilePath string) (*IpipPersonaProfile, error) {
	profileFile, err := filelock.OpenFile(profilePath, os.O_RDONLY, 0644)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("profile not found: %s", profilePath)
		}
		return nil, fmt.Errorf("open profile failed: %w", err)
	}
	defer filelock.CloseFile(profileFile)

	fileInfo, err := profileFile.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat profile failed: %w", err)
	}

	// 确保是常规文件
	if !fileInfo.Mode().IsRegular() {
		return nil, fmt.Errorf("profile is not a regular file: %s", profilePath)
	}

	data, err := io.ReadAll(profileFile)
	if err != nil {
		return nil, fmt.Errorf("read profile failed: %w", err)
	}

	var profile IpipPersonaProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		return nil, fmt.Errorf("parse profile failed: %w", err)
	}

	return &profile, nil
}

// isProfileComplete 检查人格档案是否完整
func isProfileComplete(profile *IpipPersonaProfile) bool {
	if profile == nil {
		return false
	}

	// 检查必要字段
	if profile.Subject.Name == "" {
		return false
	}

	if profile.Subject.Gender == nil || *profile.Subject.Gender == "" {
		return false
	}

	// 检查PersonaBase是否有数据
	if len(profile.PersonaBase.Traits) == 0 {
		return false
	}

	// 检查五大特质是否都存在
	requiredTraits := []string{"O", "C", "E", "A", "N"}
	for _, trait := range requiredTraits {
		if _, exists := profile.PersonaBase.Traits[trait]; !exists {
			return false
		}
	}

	return true
}
