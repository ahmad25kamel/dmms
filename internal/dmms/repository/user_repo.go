package repository

import (
	"database/sql"
	"fmt"

	"finance-game/internal/dmms/models"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(u *models.User, passwordHash string) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_users (id, email, password_hash, name, role) VALUES (?,?,?,?,?)`,
		u.ID, u.Email, passwordHash, u.Name, u.Role,
	)
	return err
}

func (r *UserRepo) FindByEmail(email string) (*models.User, string, error) {
	row := r.db.QueryRow(
		`SELECT id, email, password_hash, name, role, created_at FROM dmms_users WHERE email=?`, email,
	)
	var u models.User
	var hash string
	if err := row.Scan(&u.ID, &u.Email, &hash, &u.Name, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, "", fmt.Errorf("user not found")
		}
		return nil, "", err
	}
	return &u, hash, nil
}

func (r *UserRepo) FindByID(id string) (*models.User, error) {
	row := r.db.QueryRow(
		`SELECT id, email, name, role, created_at FROM dmms_users WHERE id=?`, id,
	)
	var u models.User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) List() ([]*models.User, error) {
	rows, err := r.db.Query(`SELECT id, email, name, role, created_at FROM dmms_users ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []*models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, &u)
	}
	return users, rows.Err()
}

func (r *UserRepo) UpdateRole(id string, role models.Role) error {
	_, err := r.db.Exec(`UPDATE dmms_users SET role=? WHERE id=?`, role, id)
	return err
}

func (r *UserRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_users WHERE id=?`, id)
	return err
}
