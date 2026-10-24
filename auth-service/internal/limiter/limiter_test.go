package limiter

import "testing"

// 10 попыток в минуту на email — по ТЗ.
func TestEmailLimiter_AllowsTenThenBlocks(t *testing.T) {
	l := New()

	for i := 1; i <= 10; i++ {
		if !l.Allow("demo@rt.ru") {
			t.Fatalf("attempt %d must be allowed", i)
		}
	}
	if l.Allow("demo@rt.ru") {
		t.Fatal("11th attempt must be blocked")
	}
}

// Лимитер — на каждый email отдельно.
func TestEmailLimiter_IsPerEmail(t *testing.T) {
	l := New()
	for i := 0; i < 10; i++ {
		l.Allow("a@rt.ru")
	}
	if !l.Allow("b@rt.ru") {
		t.Fatal("other email must not be affected")
	}
}

func TestEmailLimiter_Concurrent(t *testing.T) {
	l := New()
	done := make(chan bool)
	for i := 0; i < 50; i++ {
		go func() {
			l.Allow("x@rt.ru")
			done <- true
		}()
	}
	for i := 0; i < 50; i++ {
		<-done
	}
}
