package main

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

//go:embed web/*
var assets embed.FS

type settings struct {
	Token string `json:"token"`
	Sound bool   `json:"som"`
}
type event struct {
	ID   string    `json:"id"`
	Kind string    `json:"tipo"`
	Time time.Time `json:"horario"`
}
type receiver struct {
	mu       sync.Mutex
	cfg      settings
	path     string
	port     int
	events   []event
	seen     map[string]time.Time
	last     time.Time
	notify   func(event, bool)
	shutdown func()
}

func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func loadSettings(path string) (settings, error) {
	b, err := os.ReadFile(path)
	if err == nil {
		var cfg settings
		if err = json.Unmarshal(b, &cfg); err != nil {
			return cfg, err
		}
		if len(cfg.Token) < 32 {
			return cfg, fmt.Errorf("chave de acesso inválida no arquivo de configuração")
		}
		return cfg, nil
	}
	if !os.IsNotExist(err) {
		return settings{}, err
	}
	cfg := settings{Token: newToken(), Sound: true}
	return cfg, saveSettings(path, cfg)
}
func saveSettings(path string, cfg settings) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err = os.WriteFile(path+".tmp", b, 0600); err != nil {
		return err
	}
	return os.Rename(path+".tmp", path)
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(out) != nil || d.Decode(new(any)) != io.EOF {
		writeJSON(w, 400, map[string]any{"ok": false, "erro": "JSON inválido"})
		return false
	}
	return true
}
func localAdmin(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil || !net.ParseIP(host).IsLoopback() {
		return false
	}
	h, _, err := net.SplitHostPort(r.Host)
	if err != nil || (h != "127.0.0.1" && h != "localhost" && h != "::1") {
		return false
	}
	origin := r.Header.Get("Origin")
	return origin == "" || origin == "http://"+r.Host
}
func (s *receiver) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
	if r.URL.Path == "/api/notify" {
		s.receive(w, r)
		return
	}
	if r.URL.Path == "/api/health" && r.Method == "GET" {
		writeJSON(w, 200, map[string]any{"app": "AurenBot Alertas", "ok": true})
		return
	}
	if !localAdmin(r) {
		writeJSON(w, 403, map[string]any{"erro": "Abra o painel por http://127.0.0.1 no próprio PC receptor."})
		return
	}
	switch {
	case r.URL.Path == "/api/state" && r.Method == "GET":
		s.mu.Lock()
		defer s.mu.Unlock()
		writeJSON(w, 200, map[string]any{"token": s.cfg.Token, "som": s.cfg.Sound, "enderecos": addresses(s.port), "eventos": s.events, "windows": runtime.GOOS == "windows"})
	case r.URL.Path == "/api/settings" && r.Method == "POST":
		var body struct {
			Sound *bool `json:"som"`
		}
		if !decode(w, r, &body) {
			return
		}
		if body.Sound == nil {
			writeJSON(w, 400, map[string]any{"erro": "Informe som."})
			return
		}
		s.mu.Lock()
		cfg := s.cfg
		cfg.Sound = *body.Sound
		err := saveSettings(s.path, cfg)
		if err == nil {
			s.cfg = cfg
		}
		s.mu.Unlock()
		if err != nil {
			writeJSON(w, 500, map[string]any{"erro": "Não consegui salvar a configuração."})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	case r.URL.Path == "/api/test" && r.Method == "POST":
		s.mu.Lock()
		sound := s.cfg.Sound
		s.mu.Unlock()
		s.notify(event{ID: newToken(), Kind: "teste", Time: time.Now()}, sound)
		writeJSON(w, 200, map[string]any{"ok": true})
	case r.URL.Path == "/api/stop" && r.Method == "POST":
		writeJSON(w, 200, map[string]any{"ok": true})
		go func() { time.Sleep(200 * time.Millisecond); s.shutdown() }()
	case r.Method == "GET" && (r.URL.Path == "/" || r.URL.Path == "/app.js" || r.URL.Path == "/style.css"):
		name := r.URL.Path
		if name == "/" {
			name = "/index.html"
		}
		b, err := assets.ReadFile("web" + name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		types := map[string]string{"/index.html": "text/html; charset=utf-8", "/app.js": "text/javascript; charset=utf-8", "/style.css": "text/css; charset=utf-8"}
		w.Header().Set("Content-Type", types[name])
		_, _ = w.Write(b)
	default:
		http.NotFound(w, r)
	}
}
func (s *receiver) receive(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		if !regexp.MustCompile(`^chrome-extension://[a-p]{32}$`).MatchString(origin) {
			writeJSON(w, 403, map[string]any{"erro": "Origem não permitida."})
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	if r.Method == "OPTIONS" && origin != "" {
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
		w.WriteHeader(204)
		return
	}
	if r.Method != "POST" {
		w.Header().Set("Allow", "POST")
		writeJSON(w, 405, map[string]any{"erro": "Use POST."})
		return
	}
	s.mu.Lock()
	token := s.cfg.Token
	s.mu.Unlock()
	header := r.Header.Get("Authorization")
	auth := strings.TrimPrefix(header, "Bearer ")
	if !strings.HasPrefix(header, "Bearer ") || len(auth) != len(token) || subtle.ConstantTimeCompare([]byte(auth), []byte(token)) != 1 {
		writeJSON(w, 401, map[string]any{"erro": "Chave de acesso inválida."})
		return
	}
	var body struct {
		ID   string `json:"id"`
		Kind string `json:"tipo"`
	}
	if !decode(w, r, &body) {
		return
	}
	if body.ID == "" || len(body.ID) > 100 || (body.Kind != "cloudflare" && body.Kind != "sombra") {
		writeJSON(w, 400, map[string]any{"erro": "Aviso inválido."})
		return
	}
	s.mu.Lock()
	now := time.Now()
	for id, seen := range s.seen {
		if now.Sub(seen) > 24*time.Hour {
			delete(s.seen, id)
		}
	}
	if _, exists := s.seen[body.ID]; exists {
		s.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true, "duplicado": true})
		return
	}
	if now.Sub(s.last) < 10*time.Second {
		s.mu.Unlock()
		w.Header().Set("Retry-After", "10")
		writeJSON(w, 429, map[string]any{"erro": "Aguarde alguns segundos."})
		return
	}
	if len(s.seen) >= 4096 {
		s.mu.Unlock()
		writeJSON(w, 429, map[string]any{"erro": "Limite diário de avisos atingido."})
		return
	}
	e := event{ID: body.ID, Kind: body.Kind, Time: now}
	s.seen[e.ID] = now
	s.last = now
	s.events = append([]event{e}, s.events...)
	if len(s.events) > 50 {
		s.events = s.events[:50]
	}
	sound := s.cfg.Sound
	s.mu.Unlock()
	s.notify(e, sound)
	writeJSON(w, 200, map[string]any{"ok": true})
}
func addresses(port int) []string {
	out := []string{fmt.Sprintf("http://127.0.0.1:%d", port)}
	ifaces, _ := net.InterfaceAddrs()
	for _, addr := range ifaces {
		ip, _, err := net.ParseCIDR(addr.String())
		if err == nil && ip.To4() != nil && !ip.IsLoopback() {
			out = append(out, fmt.Sprintf("http://%s:%d", ip.String(), port))
		}
	}
	return out
}
func openBrowser(url string) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	} else {
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
func main() {
	port := flag.Int("port", 8765, "Porta do receptor")
	headless := flag.Bool("headless", false, "Não abrir o painel automaticamente")
	configPath := flag.String("config", "", "Arquivo de configuração")
	flag.Parse()
	if *port < 1 || *port > 65535 {
		platformError("Porta inválida.")
		return
	}
	if *configPath == "" {
		dir, err := os.UserConfigDir()
		if err != nil {
			platformError(err.Error())
			return
		}
		*configPath = filepath.Join(dir, "AurenBotAlertas", "config.json")
	}
	cfg, err := loadSettings(*configPath)
	if err != nil {
		platformError("Não consegui ler a configuração: " + err.Error())
		return
	}
	listener, err := net.Listen("tcp4", fmt.Sprintf("0.0.0.0:%d", *port))
	if err != nil {
		platformError(fmt.Sprintf("Não consegui usar a porta %d. O receptor já pode estar aberto. Abra http://127.0.0.1:%d", *port, *port))
		return
	}
	notify, cleanup, err := platformNotifier()
	if err != nil {
		_ = listener.Close()
		platformError(err.Error())
		return
	}
	defer cleanup()
	s := &receiver{cfg: cfg, path: *configPath, port: *port, seen: make(map[string]time.Time), events: []event{}, notify: notify}
	httpServer := &http.Server{Handler: s, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192}
	s.shutdown = func() { _ = httpServer.Close() }
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()
	go func() { <-ctx.Done(); s.shutdown() }()
	if !*headless {
		openBrowser(fmt.Sprintf("http://127.0.0.1:%d", *port))
	}
	log.Printf("AurenBot Alertas: http://127.0.0.1:%d", *port)
	if err = httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
		platformError(err.Error())
	}
}
