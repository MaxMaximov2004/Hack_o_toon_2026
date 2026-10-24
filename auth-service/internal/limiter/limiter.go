package limiter

import (
	"sync"
	"time"
)

// EmailLimiter — ограничение попыток входа по паролю: 10 в минуту на email.
type EmailLimiter struct {
	mu       sync.Mutex
	attempts map[string]*bucket
}

type bucket struct {
	count    int
	windowAt time.Time
}

const (
	maxAttempts = 10
	windowSize  = time.Minute
)

// New создаёт новый EmailLimiter.
func New() *EmailLimiter {
	return &EmailLimiter{
		attempts: make(map[string]*bucket),
	}
}

// Allow проверяет, можно ли попытку для email. Если нет — false.
func (l *EmailLimiter) Allow(email string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	b, ok := l.attempts[email]
	if !ok || now.Sub(b.windowAt) > windowSize {
		l.attempts[email] = &bucket{count: 1, windowAt: now}
		return true
	}
	b.count++
	if b.count > maxAttempts {
		return false
	}
	return true
}
