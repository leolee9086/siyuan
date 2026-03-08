package marduk

import "testing"

func TestKaoruSubmissionPayload(t *testing.T) {
	payload := GetKaoruSubmissionPayload()
	if err := ValidateSubmissionPayload(payload); err != nil {
		t.Errorf("薰的提交载荷验证失败: %v", err)
	}
}

func TestKaoruPreset(t *testing.T) {
	profile := GetKaoruPreset()
	if err := ValidatePersonaProfile(profile); err != nil {
		t.Errorf("薰的人格档案验证失败: %v", err)
	}
}
