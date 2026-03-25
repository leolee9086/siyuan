// Package marduk 提供人格档案存储、校验和注入功能
package marduk

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/siyuan-note/filelock"
)

var ErrActiveSeedPointerNotFound = errors.New("active seed pointer not found")

// PersonaProfileValidationError 表示已保存人格档案缺少运行时必填字段。
type PersonaProfileValidationError struct {
	ProfilePath   string
	MissingFields []string
}

func (e *PersonaProfileValidationError) Error() string {
	if e == nil {
		return "persona profile validation failed"
	}
	if len(e.MissingFields) == 0 {
		return fmt.Sprintf("persona profile validation failed: %s", e.ProfilePath)
	}
	return fmt.Sprintf("persona profile validation failed at %s: missing %s", e.ProfilePath, strings.Join(e.MissingFields, ", "))
}

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
	{Name: "式波", GetFunc: GetShikinamiPreset},
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

func collectMissingPersonaProfileFields(profile *IpipPersonaProfile) []string {
	missing := make([]string, 0, 10)
	if profile == nil {
		return []string{"profile"}
	}

	if strings.TrimSpace(profile.Subject.Name) == "" {
		missing = append(missing, "name")
	}
	if profile.Subject.Gender == nil || strings.TrimSpace(*profile.Subject.Gender) == "" {
		missing = append(missing, "gender")
	}
	requiredTraits := []string{"O", "C", "E", "A", "N"}
	for _, trait := range requiredTraits {
		if _, exists := profile.PersonaBase.Traits[trait]; !exists {
			missing = append(missing, "personaBase.traits."+trait)
		}
	}

	stances := profile.Subject.CognitiveStances.Normalized()
	if stances.Profession == "" {
		missing = append(missing, "profession")
	}
	if stances.PrimarySocialRelation == "" {
		missing = append(missing, "primarySocialRelation")
	}
	if stances.SelfName == "" {
		missing = append(missing, "selfName")
	}
	return missing
}

func validateLoadedPersonaProfile(profilePath string, profile *IpipPersonaProfile) error {
	missing := collectMissingPersonaProfileFields(profile)
	if len(missing) == 0 {
		return nil
	}
	return &PersonaProfileValidationError{
		ProfilePath:   profilePath,
		MissingFields: missing,
	}
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

func resolvePresetFromProfileHint(profile *IpipPersonaProfile) (*IpipPersonaProfile, string, bool) {
	if profile == nil {
		return nil, "", false
	}

	if hintedPreset, presetName, ok := GetPresetByName(profile.Subject.ID); ok {
		return hintedPreset, presetName, true
	}
	if hintedPreset, presetName, ok := GetPresetByName(profile.Subject.Name); ok {
		return hintedPreset, presetName, true
	}
	return nil, "", false
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
		return userProfile, true, nil
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, false, err
	}

	// 没有用户档案，随机选择预设
	profile, _ := getRandomPreset()
	return profile, false, nil
}

// LoadPersonaProfileWithGenderFallback 根据档案信息加载人格档案。
// 仅当工作空间中不存在用户档案时，才回退到预设人格。
// 若已保存档案缺少运行时必填字段，则直接返回验证错误，不做任何兜底填充。
func LoadPersonaProfileWithGenderFallback(dataDir string) (*IpipPersonaProfile, bool, string, error) {
	// 测试专用：允许强制指定预设人格。
	if profile, presetName, ok := loadTestPresetOverride(); ok {
		return profile, false, presetName, nil
	}

	// 尝试加载用户档案
	userProfile, err := loadUserProfile(dataDir)
	if err == nil && userProfile != nil {
		return userProfile, true, "", nil
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, false, "", err
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
	} else if !errors.Is(err, ErrActiveSeedPointerNotFound) {
		return nil, err
	}
	return loadUserProfileFromLegacyPath(dataDir)
}

func loadUserProfileFromActiveSeed(storage *Storage) (*IpipPersonaProfile, error) {
	pointer, err := loadActiveSeedPointer(storage)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("%w: %v", ErrActiveSeedPointerNotFound, err)
		}
		return nil, err
	}

	profilePath := strings.TrimSpace(pointer.ActiveProfilePath)
	if profilePath == "" {
		return nil, fmt.Errorf("active profile path is empty")
	}
	absoluteProfilePath := filepath.Clean(storage.resolveFullPath(profilePath))
	profile, err := loadPersonaProfileWithoutValidation(absoluteProfilePath)
	if err != nil {
		return nil, err
	}
	if err := validateLoadedPersonaProfile(absoluteProfilePath, profile); err != nil {
		return nil, err
	}
	return profile, nil
}

func loadUserProfileFromLegacyPath(dataDir string) (*IpipPersonaProfile, error) {
	legacyProfilePath := filepath.Clean(filepath.Join(dataDir, "petal", "persona", "active_profile.json"))
	profile, err := loadPersonaProfileWithoutValidation(legacyProfilePath)
	if err != nil {
		return nil, err
	}
	if err := validateLoadedPersonaProfile(legacyProfilePath, profile); err != nil {
		return nil, err
	}
	return profile, nil
}

func loadPersonaProfileWithoutValidation(profilePath string) (*IpipPersonaProfile, error) {
	profileFile, err := filelock.OpenFile(profilePath, os.O_RDONLY, 0644)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("profile not found: %s: %w", profilePath, err)
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

	return len(collectMissingPersonaProfileFields(profile)) == 0
}
