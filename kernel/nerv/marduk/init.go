// Package marduk 提供人格档案存储、校验和注入功能
package marduk

import (
	"fmt"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// InitializeMAGIWithPersona 使用人格档案初始化MAGI
// 返回：档案、是否完整、预设名称（如果使用预设）、错误
func InitializeMAGIWithPersona() (*IpipPersonaProfile, bool, string, error) {
	// 加载人格档案（根据性别选择预设）
	profile, isComplete, presetName, err := LoadPersonaProfileWithGenderFallback(util.DataDir)
	if err != nil {
		logging.LogWarnf("加载人格档案失败，使用默认预设（丽）: %v", err)
		return GetReiPreset(), false, "丽", nil
	}

	// 如果使用了预设，记录日志
	if !isComplete && presetName != "" {
		logging.LogInfof("人格档案不完整，当前使用预设人格：%s", presetName)
	} else if isComplete {
		logging.LogInfof("成功加载完整人格档案：%s", profile.Subject.Name)
	}

	return profile, isComplete, presetName, nil
}

// GetPersonaProfileStatus 获取人格档案状态信息（用于WebSocket推送）
func GetPersonaProfileStatus(isComplete bool, presetName string) map[string]interface{} {
	status := map[string]interface{}{
		"isComplete": isComplete,
	}

	if !isComplete && presetName != "" {
		status["usingPreset"] = true
		status["presetName"] = presetName
		status["message"] = fmt.Sprintf("人格档案尚不完整，当前由%s负责回答，直到档案构建完成", presetName)
	} else if isComplete {
		status["usingPreset"] = false
		status["message"] = "已加载完整人格档案"
	}

	return status
}
