package main

import (
	"bufio"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	baseURL      = "https://api.binance.com"
	earnEndpoint = "/sapi/v1/simple-earn/flexible/list"
	pageSize     = 100
)

// TierAnnualPercentageRate is a dynamic map whose keys are range strings
// (e.g. "0-200USDC") and whose values are APR decimals (e.g. "0.05000000").
type FlexibleProduct struct {
	Asset                 string            `json:"asset"`
	LatestAnnualPerRate   string            `json:"latestAnnualPercentageRate"`
	TierAnnualPerRate     map[string]string `json:"tierAnnualPercentageRate"`
	AirDropPerRate        string            `json:"airDropPercentageRate"`
	CanPurchase           bool              `json:"canPurchase"`
	CanRedeem             bool              `json:"canRedeem"`
	IsSoldOut             bool              `json:"isSoldOut"`
	Hot                   bool              `json:"hot"`
	MinPurchaseAmount     string            `json:"minPurchaseAmount"`
	ProductID             string            `json:"productId"`
	SubscriptionStartTime int64             `json:"subscriptionStartTime"`
	Status                string            `json:"status"`
}

type APIResponse struct {
	Rows  []FlexibleProduct `json:"rows"`
	Total int               `json:"total"`
}

type Output struct {
	UpdatedAt   string            `json:"updatedAt"`
	Total       int               `json:"total"`
	Stablecoins []string          `json:"stablecoins"`
	Products    []FlexibleProduct `json:"products"`
}

type llamaResponse struct {
	PeggedAssets []struct {
		Symbol string `json:"symbol"`
	} `json:"peggedAssets"`
}

// fetchStablecoins retrieves the canonical stablecoin symbol list from
// DeFiLlama and returns them deduplicated and uppercased.
func fetchStablecoins(client *http.Client) ([]string, error) {
	resp, err := client.Get("https://stablecoins.llama.fi/stablecoins")
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, body)
	}

	var result llamaResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	seen := make(map[string]struct{}, len(result.PeggedAssets))
	symbols := make([]string, 0, len(result.PeggedAssets))
	for _, a := range result.PeggedAssets {
		sym := strings.ToUpper(strings.TrimSpace(a.Symbol))
		if sym == "" {
			continue
		}
		if _, dup := seen[sym]; dup {
			continue
		}
		seen[sym] = struct{}{}
		symbols = append(symbols, sym)
	}
	return symbols, nil
}

func sign(secret, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func fetchPage(client *http.Client, apiKey, apiSecret string, page int, asset string) (*APIResponse, error) {
	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)

	params := url.Values{}
	params.Set("current", strconv.Itoa(page))
	params.Set("size", strconv.Itoa(pageSize))
	params.Set("timestamp", timestamp)
	if asset != "" {
		params.Set("asset", asset)
	}

	// Per Binance's requirement (effective Jan 15 2026): percent-encode the
	// query string *before* computing the HMAC-SHA256 signature.
	encoded := params.Encode()
	sig := sign(apiSecret, encoded)

	reqURL := fmt.Sprintf("%s%s?%s&signature=%s", baseURL, earnEndpoint, encoded, sig)

	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("X-MBX-APIKEY", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, body)
	}

	var result APIResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	// Ensure every product has an initialised (non-nil) tier map, then
	// drop any entries whose value is an empty string. A nil map serialises
	// to JSON null; an empty map serialises to {}, which is what we want.
	for i := range result.Rows {
		if result.Rows[i].TierAnnualPerRate == nil {
			result.Rows[i].TierAnnualPerRate = map[string]string{}
		}
		for k, v := range result.Rows[i].TierAnnualPerRate {
			if v == "" {
				delete(result.Rows[i].TierAnnualPerRate, k)
			}
		}
	}

	return &result, nil
}

func fetchAllProducts(client *http.Client, apiKey, apiSecret string) ([]FlexibleProduct, error) {

	var all []FlexibleProduct
	page := 1

	for {
		log.Printf("Fetching page %d…", page)

		res, err := fetchPage(client, apiKey, apiSecret, page, "")
		if err != nil {
			return nil, fmt.Errorf("page %d: %w", page, err)
		}

		all = append(all, res.Rows...)
		log.Printf("  Got %d products (total reported by API: %d)", len(res.Rows), res.Total)

		if len(all) >= res.Total || len(res.Rows) == 0 {
			break
		}

		page++

		// Be polite to the API – endpoint weight is 150/IP.
		time.Sleep(500 * time.Millisecond)
	}

	// The bulk list returns aggregated (often empty) tier data. Fetch each
	// asset individually to retrieve the real per-range tier APRs.
	log.Printf("Enriching tier APR data for %d products…", len(all))
	index := make(map[string]int, len(all))
	for i, p := range all {
		index[p.Asset] = i
	}

	for i := range all {
		asset := all[i].Asset
		res, err := fetchPage(client, apiKey, apiSecret, 1, asset)
		if err != nil {
			log.Printf("  Warning: could not fetch tier data for %s: %v", asset, err)
			time.Sleep(200 * time.Millisecond)
			continue
		}
		for _, p := range res.Rows {
			if p.Asset == asset && len(p.TierAnnualPerRate) > 0 {
				all[i].TierAnnualPerRate = p.TierAnnualPerRate
				break
			}
		}
		// Weight 150/IP per call — keep pace at ~3 req/s to stay comfortable.
		time.Sleep(350 * time.Millisecond)
	}

	return all, nil
}

// loadDotEnv reads a .env file and sets any variables that are not already
// present in the environment. Real environment variables always take precedence,
// so CI secrets are never overwritten.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return // .env is optional
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		// Strip optional surrounding quotes (" or ')
		value = strings.TrimSpace(value)
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}
		// Only set if not already in the environment
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}

func main() {
	outputPath := flag.String("output", "data/flexible-earn.json", "Path to write the JSON output file")
	envFile := flag.String("env", ".env", "Path to .env file (skipped when vars are already set)")
	flag.Parse()

	loadDotEnv(*envFile)

	apiKey := os.Getenv("API_KEY")
	apiSecret := os.Getenv("API_SECRET")

	if apiKey == "" || apiSecret == "" {
		log.Fatal("API_KEY and API_SECRET must be set (via environment variables or a .env file)")
	}

	httpClient := &http.Client{Timeout: 30 * time.Second}

	log.Println("Fetching stablecoin list from DeFiLlama…")
	stablecoins, err := fetchStablecoins(httpClient)
	if err != nil {
		// Non-fatal: warn and continue with an empty list so the rest still works.
		log.Printf("Warning: could not fetch stablecoin list: %v", err)
		stablecoins = []string{}
	} else {
		log.Printf("  Got %d stablecoin symbols", len(stablecoins))
	}

	log.Println("Fetching Binance Simple Earn flexible products…")

	products, err := fetchAllProducts(httpClient, apiKey, apiSecret)
	if err != nil {
		log.Fatalf("Failed to fetch products: %v", err)
	}

	output := Output{
		UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
		Total:       len(products),
		Stablecoins: stablecoins,
		Products:    products,
	}

	data, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal JSON: %v", err)
	}

	if err := os.MkdirAll(getDir(*outputPath), 0o755); err != nil {
		log.Fatalf("Failed to create output directory: %v", err)
	}

	if err := os.WriteFile(*outputPath, data, 0o644); err != nil {
		log.Fatalf("Failed to write output file: %v", err)
	}

	log.Printf("Done. Wrote %d products to %s", len(products), *outputPath)
}

func getDir(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' {
			return path[:i]
		}
	}
	return "."
}
