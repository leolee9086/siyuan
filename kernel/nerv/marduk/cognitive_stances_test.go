package marduk

import "testing"

func TestResolveCognitiveStancesFromPreset(t *testing.T) {
	stances, err := ResolveCognitiveStances(GetKaoruPreset())
	if err != nil {
		t.Fatalf("ResolveCognitiveStances() error = %v", err)
	}
	if stances.Profession != "司令" {
		t.Fatalf("profession = %q, want %q", stances.Profession, "司令")
	}
	if stances.PrimarySocialRelation != "第一使徒" {
		t.Fatalf("primarySocialRelation = %q, want %q", stances.PrimarySocialRelation, "第一使徒")
	}
	if stances.SelfName != "薰" {
		t.Fatalf("selfName = %q, want %q", stances.SelfName, "薰")
	}
}

func TestResolveCognitiveStancesRejectsMissingFields(t *testing.T) {
	profile := &IpipPersonaProfile{
		Subject: IpipSubjectProfile{
			ID:   "custom",
			Name: "自定义",
			CognitiveStances: &SubjectCognitiveStances{
				Profession: "科学家",
			},
		},
	}

	if _, err := ResolveCognitiveStances(profile); err == nil {
		t.Fatal("expected ResolveCognitiveStances() to reject incomplete stances")
	}
}
