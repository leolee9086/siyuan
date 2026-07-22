package conf

import (
	"testing"

	"github.com/88250/lute/ast"
)

func TestCommandReviewConfigurationIsIndependent(t *testing.T) {
	ai := NewAI()
	agentModelID := ast.NewNodeID()
	reviewModelID := ast.NewNodeID()
	ai.Providers = []*Provider{{
		ID:      ast.NewNodeID(),
		Enabled: true,
		APIKey:  "test-key",
		Models: []*Model{
			{ID: agentModelID, Name: "agent", Enabled: true},
			{ID: reviewModelID, Name: "review", Enabled: true},
		},
	}}
	ai.Agent.ModelID = agentModelID
	ai.CommandReview.ModelID = reviewModelID
	ai.Normalize()

	_, agentModel := ai.GetAgentModel()
	_, reviewModel := ai.GetCommandReviewModel()
	if agentModel == nil || agentModel.ID != agentModelID {
		t.Fatalf("unexpected agent model: %#v", agentModel)
	}
	if reviewModel == nil || reviewModel.ID != reviewModelID {
		t.Fatalf("command review model did not remain independent: %#v", reviewModel)
	}
}

func TestCommandReviewConfigurationMigratesFromAgentModel(t *testing.T) {
	ai := NewAI()
	ai.Agent.ModelID = "agent-model"
	ai.CommandReview = nil
	ai.Normalize()

	if ai.CommandReview == nil || ai.CommandReview.ModelID != "agent-model" || ai.CommandReview.Timeout != 30 {
		t.Fatalf("unexpected migrated command review config: %#v", ai.CommandReview)
	}
}
