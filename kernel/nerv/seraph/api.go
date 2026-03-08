package seraph

import "github.com/siyuan-note/siyuan/kernel/nerv/marduk"

// ScoreFromPayload 从marduk的IpipNeo120SubmissionPayload计算PersonaBase
// 这是seraph的主要对外接口
func ScoreFromPayload(payload *marduk.IpipNeo120SubmissionPayload) (*PersonaBase, error) {
	return ScoreIpipNeo120PersonaBase(payload.Answers, IpipNeo120QuestionBank)
}
