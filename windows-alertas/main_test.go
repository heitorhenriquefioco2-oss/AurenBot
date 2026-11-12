package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func fixture(t *testing.T) (*receiver, *atomic.Int32) {
	t.Helper()
	var calls atomic.Int32
	s := &receiver{cfg: settings{Token: strings.Repeat("a", 64), Sound: true}, path: filepath.Join(t.TempDir(), "config.json"), port: 8765, seen: map[string]time.Time{}, events: []event{}, notify: func(event, bool) { calls.Add(1) }, shutdown: func() {}}
	return s, &calls
}
func request(s *receiver, method, path, body, auth, remote, host, origin string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://127.0.0.1:8765"+path, strings.NewReader(body))
	r.RemoteAddr = remote
	r.Host = host
	if auth != "" {
		r.Header.Set("Authorization", auth)
	}
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	return w
}
func post(s *receiver, body string) *httptest.ResponseRecorder {
	return request(s, "POST", "/api/notify", body, "Bearer "+s.cfg.Token, "100.70.0.2:5000", "100.70.0.1:8765", "")
}
func TestReceiverAuthenticationAndValidation(t *testing.T) {
	s, calls := fixture(t)
	w := request(s, "POST", "/api/notify", `{"id":"one","tipo":"sombra"}`, "", "100.70.0.2:5000", "100.70.0.1:8765", "")
	if w.Code != 401 {
		t.Fatal(w.Code)
	}
	for _, body := range []string{`{"id":"a","tipo":"unknown"}`, `{"id":"a","tipo":"sombra","image":"no"}`, `{"id":"","tipo":"sombra"}`, `{} {}`, strings.Repeat("x", 5000)} {
		if w := post(s, body); w.Code != 400 {
			t.Fatalf("invalid body accepted: %d", w.Code)
		}
	}
	if calls.Load() != 0 {
		t.Fatal("invalid request caused notification")
	}
	if w := post(s, `{"id":"one","tipo":"sombra"}`); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
}
func TestDeduplicationAndRateLimit(t *testing.T) {
	s, calls := fixture(t)
	if post(s, `{"id":"one","tipo":"cloudflare"}`).Code != 200 {
		t.Fatal("first")
	}
	w := post(s, `{"id":"one","tipo":"cloudflare"}`)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"duplicado":true`) {
		t.Fatal(w.Body.String())
	}
	if post(s, `{"id":"two","tipo":"cloudflare"}`).Code != 429 {
		t.Fatal("rate limit missing")
	}
	if calls.Load() != 1 {
		t.Fatal("duplicate notified")
	}
	s.last = time.Now().Add(-11 * time.Second)
	if post(s, `{"id":"two","tipo":"cloudflare"}`).Code != 200 || calls.Load() != 2 {
		t.Fatal("later notification blocked")
	}
}
func TestConcurrentDuplicateIsDeliveredOnce(t *testing.T) {
	s, calls := fixture(t)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); post(s, `{"id":"same","tipo":"sombra"}`) }()
	}
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
}
func TestLocalAdminAndRebindingProtection(t *testing.T) {
	s, _ := fixture(t)
	for _, args := range [][3]string{{"192.168.1.2:1000", "127.0.0.1:8765", ""}, {"127.0.0.1:1000", "evil.example:8765", ""}, {"127.0.0.1:1000", "127.0.0.1:8765", "https://evil.example"}} {
		w := request(s, "GET", "/api/state", "", "", args[0], args[1], args[2])
		if w.Code != 403 || strings.Contains(w.Body.String(), s.cfg.Token) {
			t.Fatal("admin exposed", w.Code)
		}
	}
	w := request(s, "GET", "/api/state", "", "", "127.0.0.1:1000", "127.0.0.1:8765", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), s.cfg.Token) {
		t.Fatal("local setup inaccessible")
	}
	if w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing response protection")
	}
}
func TestBrowserOriginAndPrivateNetworkPreflight(t *testing.T) {
	s, _ := fixture(t)
	if w := request(s, "POST", "/api/notify", `{"id":"one","tipo":"sombra"}`, "Bearer "+s.cfg.Token, "127.0.0.1:4", "127.0.0.1:8765", "https://evil.example"); w.Code != 403 {
		t.Fatal(w.Code)
	}
	origin := "chrome-extension://" + strings.Repeat("a", 32)
	w := request(s, "OPTIONS", "/api/notify", "", "", "127.0.0.1:4", "127.0.0.1:8765", origin)
	if w.Code != 204 || w.Header().Get("Access-Control-Allow-Origin") != origin || w.Header().Get("Access-Control-Allow-Private-Network") != "true" {
		t.Fatal(w.Code, w.Header())
	}
}
func TestSettingsPersistenceAndSound(t *testing.T) {
	s, _ := fixture(t)
	var sound bool = true
	s.notify = func(_ event, b bool) { sound = b }
	w := request(s, "POST", "/api/settings", `{"som":false}`, "", "127.0.0.1:4", "127.0.0.1:8765", "http://127.0.0.1:8765")
	if w.Code != 200 {
		t.Fatal(w.Code)
	}
	cfg, err := loadSettings(s.path)
	if err != nil || cfg.Sound || cfg.Token != s.cfg.Token {
		t.Fatal(cfg, err)
	}
	w = request(s, "POST", "/api/test", `{}`, "", "127.0.0.1:4", "127.0.0.1:8765", "")
	if w.Code != 200 || sound {
		t.Fatal("sound preference ignored")
	}
}
func TestFirstRunKeyIsStable(t *testing.T) {
	p := filepath.Join(t.TempDir(), "AurenBotAlertas", "config.json")
	a, err := loadSettings(p)
	if err != nil {
		t.Fatal(err)
	}
	b, err := loadSettings(p)
	if err != nil || a.Token != b.Token || len(a.Token) != 64 || !a.Sound {
		t.Fatal("invalid first-run configuration")
	}
}
func TestOnlyMetadataIsStoredAndUIIsStatic(t *testing.T) {
	s, _ := fixture(t)
	post(s, `{"id":"event","tipo":"sombra"}`)
	w := request(s, "GET", "/api/state", "", "", "127.0.0.1:4", "127.0.0.1:8765", "")
	var state map[string]json.RawMessage
	if json.Unmarshal(w.Body.Bytes(), &state) != nil {
		t.Fatal("invalid state")
	}
	if !bytes.Contains(state["eventos"], []byte(`"tipo":"sombra"`)) {
		t.Fatal("event missing")
	}
	for _, path := range []string{"/", "/app.js", "/style.css"} {
		w = request(s, "GET", path, "", "", "127.0.0.1:4", "127.0.0.1:8765", "")
		if w.Code != 200 {
			t.Fatal(path, w.Code)
		}
	}
}
