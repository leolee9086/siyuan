// Package marduk 提供人格档案存储、校验和注入功能
package marduk

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/siyuan-note/filelock"
)

// PresetPersona 预设人格定义
type PresetPersona struct {
	Name    string
	GetFunc func() *IpipPersonaProfile
}

// TestPersonaPresetEnvKey 测试专用：强制指定预设人格（仅 go test 进程生效）。
const TestPersonaPresetEnvKey = "MAGI_TEST_PERSONA_PRESET"

// availablePresets 可用的预设人格列表
var availablePresets = []PresetPersona{
	{Name: "丽", GetFunc: GetReiPreset},
	{Name: "薰", GetFunc: GetKaoruPreset},
	{Name: "Jarvis", GetFunc: GetJarvisPreset},
}

// GetPresetByName 根据名称/别名解析预设人格。
func GetPresetByName(name string) (*IpipPersonaProfile, string, bool) {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.ReplaceAll(normalized, "_", "")
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, " ", "")

	switch normalized {
	case "丽", "rei", "ayanami", "绫波", "绫波丽":
		return GetReiPreset(), "丽", true
	case "薰", "kaoru", "nagisa", "渚薰":
		return GetKaoruPreset(), "薰", true
	case "jarvis", "贾维斯":
		return GetJarvisPreset(), "Jarvis", true
	case "式波", "式波明日香", "asuka", "shikinami", "asukashikinami", "明日香":
		return GetShikinamiPreset(), "式波", true
	default:
		return nil, "", false
	}
}

func loadTestPresetOverride() (*IpipPersonaProfile, string, bool) {
	if !isGoTestProcess() {
		return nil, "", false
	}

	rawPreset := strings.TrimSpace(os.Getenv(TestPersonaPresetEnvKey))
	if rawPreset == "" {
		return nil, "", false
	}
	return GetPresetByName(rawPreset)
}

func isGoTestProcess() bool {
	binName := strings.ToLower(strings.TrimSpace(filepath.Base(os.Args[0])))
	return strings.Contains(binName, ".test")
}

// getRandomPreset 从可用预设中随机选择一个
func getRandomPreset() (*IpipPersonaProfile, string) {
	rand.Seed(time.Now().UnixNano())
	preset := availablePresets[rand.Intn(len(availablePresets))]
	return preset.GetFunc(), preset.Name
}

// LoadPersonaProfile 加载人格档案
// 优先级：用户档案 > 随机预设
func LoadPersonaProfile(dataDir string) (*IpipPersonaProfile, bool, error) {
	// 测试专用：允许强制指定预设人格。
	if profile, _, ok := loadTestPresetOverride(); ok {
		return profile, false, nil
	}

	// 尝试加载用户档案
	userProfile, err := loadUserProfile(dataDir)
	if err == nil && userProfile != nil {
		if userProfile.Subject.Gender != nil && *userProfile.Subject.Gender != "" {
			// 有完整性别信息，档案完整
			return userProfile, true, nil
		}
		// 有档案但缺少性别信息，随机选择预设
		profile, _ := getRandomPreset()
		return profile, false, nil
	}

	// 没有用户档案，随机选择预设
	profile, _ := getRandomPreset()
	return profile, false, nil
}

// LoadPersonaProfileWithGenderFallback 根据性别加载人格档案
// 如果用户档案不完整，根据性别选择预设（女->丽，男->薰）
func LoadPersonaProfileWithGenderFallback(dataDir string) (*IpipPersonaProfile, bool, string, error) {
	// 测试专用：允许强制指定预设人格。
	if profile, presetName, ok := loadTestPresetOverride(); ok {
		return profile, false, presetName, nil
	}

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

		// 连性别都没有，随机选择预设
		profile, name := getRandomPreset()
		return profile, false, name, nil
	}

	// 没有用户档案，随机选择预设
	profile, name := getRandomPreset()
	return profile, false, name, nil
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
