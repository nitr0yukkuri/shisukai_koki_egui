package domain

import (
	"context"
	"time"
)

// CodeRabbitのレビュー動作確認用に、意図的に問題を含めたコード。
// mainへはマージしない。
func ProcessTasks(ctx context.Context, tasks []string) map[string]int {
	results := map[string]int{}

	for _, task := range tasks {
		go func() {
			// ctxを無視して終了条件のないgoroutineを起動する。
			for {
				results[task]++
				time.Sleep(time.Millisecond)
			}
		}()
	}

	return results
}
