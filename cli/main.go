package main

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	restish "github.com/rest-sh/restish/v2"
	"github.com/rest-sh/restish/v2/auth"
	"golang.org/x/term"
)

//go:embed openapi.json
var spec []byte

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

// specFile writes the embedded spec to the user cache, since Restish only loads spec files from disk.
func specFile() (string, error) {
	dir, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, "kayman", fmt.Sprintf("openapi-%x.json", sha256.Sum256(spec)))
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}
	return path, os.WriteFile(path, spec, 0o644)
}

// passwordAuth logs in through the backend's OAuth2 password grant and caches the bearer token.
type passwordAuth struct{}

func (passwordAuth) SupportsForce() {}

func (passwordAuth) Parameters() []restish.AuthParam {
	return []restish.AuthParam{
		{Name: "client", Required: true},
		{Name: "password", Required: true, Secret: true},
	}
}

func (passwordAuth) Authenticate(ctx context.Context, req *http.Request, ac restish.AuthContext) error {
	if !ac.Force {
		if cached, err := ac.TokenStore.Get(ac.CacheKey); err == nil && cached != nil && !cached.IsExpired() {
			req.Header.Set("Authorization", "Bearer "+cached.AccessToken)
			return nil
		}
	}

	form := url.Values{"username": {ac.Params["client"]}, "password": {ac.Params["password"]}}
	login, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(ac.BaseURL, "/")+"/api/token", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	login.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := ac.HTTPClient.Do(login)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("login as %q failed: %s", ac.Params["client"], resp.Status)
	}

	var token auth.CachedToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return err
	}
	if err := ac.TokenStore.Set(ac.CacheKey, token); err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	return nil
}

func main() {
	baseURL := strings.TrimRight(os.Getenv("KAYMAN_URL"), "/")
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}
	specPath, err := specFile()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	// Print only the pretty body in a terminal; set RSH_PRINT or --rsh-print to see status and headers.
	if os.Getenv("RSH_PRINT") == "" && term.IsTerminal(int(os.Stdout.Fd())) {
		if os.Getenv("NO_COLOR") == "" {
			os.Setenv("RSH_PRINT", "bpc")
		} else {
			os.Setenv("RSH_PRINT", "bp")
		}
	}

	cli := restish.New()
	cli.SetCommandName("kayman")
	cli.SetVersion(version)
	cli.SetCommandDescription("Kayman CLI", "Command line for the Kayman personal finance API.")
	cli.AddAuthHandler("kayman-password", passwordAuth{})
	cli.SetDefaultConfig(&restish.Config{APIs: map[string]*restish.APIConfig{
		"kayman": {
			BaseURL:   baseURL,
			SpecFiles: []string{specPath},
			Profiles: map[string]*restish.ProfileConfig{
				"default": {Auth: &restish.AuthConfig{
					Type:   "kayman-password",
					Params: map[string]string{"client": "env:KAYMAN_CLI_CLIENT", "password": "env:KAYMAN_CLI_PASSWORD"},
				}},
			},
		},
	}})
	cli.SetCommandSurface(restish.CommandSurface{PromotedAPI: "kayman", SupportCommandNamespace: "rsh"})

	if err := cli.Run(os.Args); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
