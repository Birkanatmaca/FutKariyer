package transport

import "testing"

func TestBrowserOriginRequiresHTTPSUnlessExplicitlyAllowed(t *testing.T) {
	if _, err := BrowserOrigin("http://153.56.210.50", false); err == nil {
		t.Fatal("plain HTTP public origin accepted without opt-in")
	}
	cfg, err := BrowserOrigin("http://153.56.210.50", true)
	if err != nil || cfg.secure || cfg.origin != "http://153.56.210.50" {
		t.Fatalf("explicit insecure opt-in: %+v %v", cfg, err)
	}
	if cfg, err := BrowserOrigin("https://admin.example.com", false); err != nil || !cfg.secure {
		t.Fatalf("https origin: %+v %v", cfg, err)
	}
	if _, err := BrowserOrigin("http://localhost:5175", false); err != nil {
		t.Fatal("localhost development rejected")
	}
}
