package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"dmms/internal/models"
	"dmms/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	users     *repository.UserRepo
	jwtSecret []byte
}

func NewAuthService(users *repository.UserRepo, jwtSecret string) *AuthService {
	return &AuthService{users: users, jwtSecret: []byte(jwtSecret)}
}

type Claims struct {
	UserID string      `json:"user_id"`
	Role   models.Role `json:"role"`
	jwt.RegisteredClaims
}

func (s *AuthService) Register(username, email, name, password string, role models.Role) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}
	u := &models.User{
		ID:       uuid.New().String(),
		Username: username,
		Email:    email,
		Name:     name,
		Role:     role,
		Approved: false, // requires admin approval before first login
	}
	if err := s.users.Create(u, string(hash)); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

func (s *AuthService) Login(username, password string) (*models.User, string, error) {
	u, hash, err := s.users.FindByUsername(username)
	if err != nil {
		return nil, "", fmt.Errorf("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, "", fmt.Errorf("invalid credentials")
	}
	if !u.Approved {
		return nil, "", fmt.Errorf("account pending approval")
	}
	token, err := s.issueToken(u)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

func (s *AuthService) issueToken(u *models.User) (string, error) {
	claims := Claims{
		UserID: u.ID,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) GenerateAPIKey(userID string) (string, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate key bytes: %w", err)
	}
	key := "dmms_" + hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(key))
	hashHex := hex.EncodeToString(hash[:])
	prefix := key[:13] // "dmms_" + first 8 hex chars
	if err := s.users.SetAPIKey(userID, hashHex, prefix); err != nil {
		return "", fmt.Errorf("store api key: %w", err)
	}
	return key, nil
}

func (s *AuthService) RevokeAPIKey(userID string) error {
	return s.users.ClearAPIKey(userID)
}

func (s *AuthService) VerifyAPIKey(key string) (*models.User, error) {
	hash := sha256.Sum256([]byte(key))
	hashHex := hex.EncodeToString(hash[:])
	u, err := s.users.FindByAPIKeyHash(hashHex)
	if err != nil {
		return nil, err
	}
	if !u.Approved {
		return nil, fmt.Errorf("account not approved")
	}
	return u, nil
}

func (s *AuthService) VerifyToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}
