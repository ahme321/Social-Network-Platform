package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

var (
	jwtSecret   []byte
	redisClient *redis.Client
	ctx         = context.Background()

	userServiceURL         string
	postServiceURL         string
	chatServiceURL         string
	dashboardServiceURL    string
	notificationServiceURL string
	eventServiceURL        string
	analyticsServiceURL    string
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	jwtSecret = []byte(os.Getenv("JWT_SECRET"))

	redisClient = redis.NewClient(&redis.Options{
		Addr:     os.Getenv("REDIS_ADDR"),
		Password: "",
		DB:       0,
	})

	userServiceURL = os.Getenv("USER_SERVICE_URL")
	postServiceURL = os.Getenv("POST_SERVICE_URL")
	chatServiceURL = os.Getenv("CHAT_SERVICE_URL")
	dashboardServiceURL = os.Getenv("DASHBOARD_SERVICE_URL")
	notificationServiceURL = os.Getenv("NOTIFICATION_SERVICE_URL")
	eventServiceURL = os.Getenv("EVENT_SERVICE_URL")
	analyticsServiceURL = os.Getenv("ANALYTICS_SERVICE_URL")

	r := gin.Default()
	r.Use(cors.Default())
	r.Use(rateLimitMiddleware(redisClient))
	r.Use(concurrencyMiddleware(redisClient))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "API Gateway is running"})
	})

	r.POST("/login", googleOAuthHandler)

	auth := r.Group("/")
	auth.Use(authMiddleware())
	{
		auth.Any("/user/*any", forwardTo(userServiceURL))
		auth.Any("/post/*any", forwardTo(postServiceURL))
		auth.Any("/chat/*any", forwardTo(chatServiceURL))
		auth.Any("/dashboard/*any", forwardTo(dashboardServiceURL))
		auth.Any("/notification/*any", forwardTo(notificationServiceURL))
		auth.Any("/event/*any", forwardTo(eventServiceURL))
		auth.Any("/analytics/*any", forwardTo(analyticsServiceURL))

		// Add unified search endpoint
		auth.GET("/search", searchHandler)
	}

	port := ":" + os.Getenv("GATEWAY_PORT")
	log.Printf("API Gateway running on %s", port)
	r.Run(port)
}

func forwardTo(target string) gin.HandlerFunc {
	return func(c *gin.Context) {
		finalURL := target + c.Request.URL.Path
		if c.Request.URL.RawQuery != "" {
			finalURL += "?" + c.Request.URL.RawQuery
		}

		req, err := http.NewRequest(c.Request.Method, finalURL, c.Request.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
			return
		}

		for k, v := range c.Request.Header {
			req.Header[k] = v
		}

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service unavailable"})
			return
		}
		defer resp.Body.Close()

		c.Status(resp.StatusCode)
		for k, v := range resp.Header {
			c.Writer.Header()[k] = v
		}

		bodyBytes, _ := io.ReadAll(resp.Body)
		c.Writer.Write(bodyBytes)
	}
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization token not provided"})
			return
		}
		tokenString = strings.TrimPrefix(tokenString, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		c.Next()
	}
}

func googleOAuthHandler(c *gin.Context) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": "user@example.com",
	})
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": tokenString})
}

func rateLimitMiddleware(rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func concurrencyMiddleware(rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func searchHandler(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query parameter is required"})
		return
	}

	// Get auth token from the request
	authToken := c.GetHeader("Authorization")

	// Set up response channel for concurrent requests
	type searchResult struct {
		Source string      `json:"source"`
		Data   interface{} `json:"data"`
		Error  string      `json:"error,omitempty"`
	}

	responses := make(chan searchResult, 3) // We're searching in 3 services max

	// Search users
	go func() {
		userReq, err := http.NewRequest(http.MethodGet, userServiceURL+"/auth/search?query="+query, nil)
		if err != nil {
			responses <- searchResult{Source: "users", Error: "Failed to create request"}
			return
		}

		userReq.Header.Set("Authorization", authToken)
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(userReq)

		if err != nil {
			responses <- searchResult{Source: "users", Error: "Service unavailable"}
			return
		}
		defer resp.Body.Close()

		var userData interface{}
		json.NewDecoder(resp.Body).Decode(&userData)

		if resp.StatusCode != http.StatusOK {
			responses <- searchResult{Source: "users", Error: "Failed to search users"}
			return
		}

		responses <- searchResult{Source: "users", Data: userData}
	}()

	// Search posts by content
	go func() {
		postContentReq, err := http.NewRequest(http.MethodGet, postServiceURL+"/post/search/keyword?keyword="+query, nil)
		if err != nil {
			responses <- searchResult{Source: "posts_content", Error: "Failed to create request"}
			return
		}

		postContentReq.Header.Set("Authorization", authToken)
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(postContentReq)

		if err != nil {
			responses <- searchResult{Source: "posts_content", Error: "Service unavailable"}
			return
		}
		defer resp.Body.Close()

		var postData interface{}
		json.NewDecoder(resp.Body).Decode(&postData)

		if resp.StatusCode != http.StatusOK {
			responses <- searchResult{Source: "posts_content", Error: "Failed to search posts"}
			return
		}

		responses <- searchResult{Source: "posts_content", Data: postData}
	}()

	// If query could be a category, search posts by category too
	go func() {
		postCategoryReq, err := http.NewRequest(http.MethodGet, postServiceURL+"/post/search/category/"+query, nil)
		if err != nil {
			responses <- searchResult{Source: "posts_category", Error: "Failed to create request"}
			return
		}

		postCategoryReq.Header.Set("Authorization", authToken)
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(postCategoryReq)

		if err != nil {
			responses <- searchResult{Source: "posts_category", Error: "Service unavailable"}
			return
		}
		defer resp.Body.Close()

		var categoryData interface{}
		json.NewDecoder(resp.Body).Decode(&categoryData)

		if resp.StatusCode != http.StatusOK {
			responses <- searchResult{Source: "posts_category", Error: "Failed to search categories"}
			return
		}

		responses <- searchResult{Source: "posts_category", Data: categoryData}
	}()

	// Collect all search results
	results := make(map[string]interface{})
	for i := 0; i < 3; i++ {
		result := <-responses
		if result.Error != "" {
			results[result.Source] = gin.H{"error": result.Error}
		} else {
			results[result.Source] = result.Data
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"query":   query,
		"results": results,
	})
}
