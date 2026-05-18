package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"dmms/internal/config"
	"dmms/internal/database"
	"dmms/internal/handlers"
	"dmms/internal/middleware"
	"dmms/internal/models"
	"dmms/internal/repository"
	"dmms/internal/service"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	// Repositories
	userRepo := repository.NewUserRepo(db)
	projectRepo := repository.NewProjectRepo(db)
	deliverableRepo := repository.NewDeliverableRepo(db)
	taskRepo := repository.NewTaskRepo(db)
	kanbanRepo := repository.NewKanbanRepo(db)
	proposalRepo := repository.NewProposalRepo(db)
	submissionRepo := repository.NewSubmissionRepo(db)
	rewardRepo := repository.NewRewardRepo(db)
	notifRepo := repository.NewNotificationRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	delivSvc := service.NewDeliverableService(deliverableRepo, proposalRepo, rewardRepo, projectRepo, db)

	// Handlers
	authH := handlers.NewAuthHandler(authSvc, userRepo)
	projectH := handlers.NewProjectHandler(projectRepo)
	delivH := handlers.NewDeliverableHandler(deliverableRepo, taskRepo, delivSvc, projectRepo)
	proposalH := handlers.NewProposalHandler(proposalRepo, deliverableRepo, projectRepo, delivSvc)
	submissionH := handlers.NewSubmissionHandler(submissionRepo, deliverableRepo, taskRepo, delivSvc)
	marketH := handlers.NewMarketplaceHandler(deliverableRepo)
	rewardH := handlers.NewRewardHandler(rewardRepo)
	adminH := handlers.NewAdminHandler(userRepo)
	kanbanH := handlers.NewKanbanHandler(taskRepo, kanbanRepo, userRepo, notifRepo, deliverableRepo)

	// Auth middleware
	authMW := middleware.Auth(authSvc)
	pmOnly := middleware.RequireRole(models.RolePM, models.RoleAdmin)
	adminOnly := middleware.RequireRole(models.RoleAdmin)

	mux := http.NewServeMux()

	rateLimitMW := middleware.RateLimit

	// Auth
	mux.Handle("POST /api/dmms/auth/register", rateLimitMW(http.HandlerFunc(authH.Register)))
	mux.Handle("POST /api/dmms/auth/login", rateLimitMW(http.HandlerFunc(authH.Login)))
	mux.Handle("GET /api/dmms/auth/me", authMW(http.HandlerFunc(authH.Me)))
	mux.Handle("GET /api/dmms/users", authMW(http.HandlerFunc(adminH.ListUsers)))

	// Projects (PM)
	mux.Handle("GET /api/dmms/projects", authMW(http.HandlerFunc(projectH.List)))
	mux.Handle("POST /api/dmms/projects", authMW(pmOnly(http.HandlerFunc(projectH.Create))))
	mux.Handle("GET /api/dmms/projects/{id}", authMW(http.HandlerFunc(projectH.Get)))
	mux.Handle("PATCH /api/dmms/projects/{id}", authMW(pmOnly(http.HandlerFunc(projectH.Update))))
	mux.Handle("DELETE /api/dmms/projects/{id}", authMW(pmOnly(http.HandlerFunc(projectH.Delete))))

	// Deliverable tree
	mux.Handle("GET /api/dmms/projects/{projectId}/deliverables/tree", authMW(http.HandlerFunc(delivH.Tree)))
	mux.Handle("POST /api/dmms/projects/{projectId}/deliverables/import", authMW(pmOnly(http.HandlerFunc(delivH.ImportJSON))))
	mux.Handle("GET /api/dmms/projects/{projectId}/deliverables/template", authMW(pmOnly(http.HandlerFunc(delivH.DownloadTemplate))))
	mux.Handle("POST /api/dmms/deliverables", authMW(pmOnly(http.HandlerFunc(delivH.Create))))
	mux.Handle("GET /api/dmms/deliverables/{id}", authMW(http.HandlerFunc(delivH.Get)))
	mux.Handle("PATCH /api/dmms/deliverables/{id}", authMW(pmOnly(http.HandlerFunc(delivH.Update))))
	mux.Handle("DELETE /api/dmms/deliverables/{id}", authMW(pmOnly(http.HandlerFunc(delivH.Delete))))
	mux.Handle("POST /api/dmms/deliverables/{id}/open-bids", authMW(pmOnly(http.HandlerFunc(delivH.OpenForBids))))
	mux.Handle("POST /api/dmms/deliverables/{id}/cancel", authMW(pmOnly(http.HandlerFunc(delivH.Cancel))))
	mux.Handle("POST /api/dmms/deliverables/{id}/reopen", authMW(pmOnly(http.HandlerFunc(delivH.Reopen))))
	mux.Handle("POST /api/dmms/deliverables/{id}/reassign", authMW(pmOnly(http.HandlerFunc(delivH.Reassign))))
	mux.Handle("GET /api/dmms/deliverables/assigned", authMW(http.HandlerFunc(delivH.MyAssigned)))

	mux.Handle("GET /api/dmms/deliverables/{id}/children", authMW(http.HandlerFunc(delivH.ListChildren)))

	// Tasks
	mux.Handle("GET /api/dmms/deliverables/{id}/tasks", authMW(http.HandlerFunc(delivH.ListTasks)))
	mux.Handle("POST /api/dmms/deliverables/{id}/tasks", authMW(pmOnly(http.HandlerFunc(delivH.CreateTask))))
	mux.Handle("PATCH /api/dmms/deliverables/{id}/tasks/{taskId}", authMW(pmOnly(http.HandlerFunc(delivH.UpdateTask))))
	mux.Handle("DELETE /api/dmms/deliverables/{id}/tasks/{taskId}", authMW(pmOnly(http.HandlerFunc(delivH.DeleteTask))))

	// Marketplace
	mux.Handle("GET /api/dmms/marketplace/bids", authMW(http.HandlerFunc(marketH.ListBids)))

	// Proposals
	mux.Handle("GET /api/dmms/deliverables/{id}/proposals", authMW(pmOnly(http.HandlerFunc(proposalH.List))))
	mux.Handle("POST /api/dmms/deliverables/{id}/proposals", authMW(http.HandlerFunc(proposalH.Submit)))
	mux.Handle("GET /api/dmms/proposals/mine", authMW(http.HandlerFunc(proposalH.Mine)))
	mux.Handle("GET /api/dmms/proposals/all", authMW(pmOnly(http.HandlerFunc(proposalH.AllForPM))))
	mux.Handle("PATCH /api/dmms/proposals/{id}", authMW(http.HandlerFunc(proposalH.Revise)))
	mux.Handle("POST /api/dmms/proposals/{id}/withdraw", authMW(http.HandlerFunc(proposalH.Withdraw)))
	mux.Handle("POST /api/dmms/proposals/{id}/accept", authMW(pmOnly(http.HandlerFunc(proposalH.Accept))))
	mux.Handle("POST /api/dmms/proposals/{id}/reject", authMW(pmOnly(http.HandlerFunc(proposalH.Reject))))

	// Workspace (subtasks + submissions)
	mux.Handle("GET /api/dmms/deliverables/{id}/subtasks", authMW(http.HandlerFunc(submissionH.ListSubtasks)))
	mux.Handle("POST /api/dmms/deliverables/{id}/subtasks", authMW(http.HandlerFunc(submissionH.CreateSubtask)))
	mux.Handle("PATCH /api/dmms/deliverables/{id}/subtasks/{subtaskId}", authMW(http.HandlerFunc(submissionH.UpdateSubtask)))
	mux.Handle("POST /api/dmms/deliverables/{id}/submissions", authMW(http.HandlerFunc(submissionH.Submit)))
	mux.Handle("GET /api/dmms/deliverables/{id}/submission", authMW(http.HandlerFunc(submissionH.GetByDeliverable)))
	mux.Handle("GET /api/dmms/deliverables/{id}/submissions", authMW(http.HandlerFunc(submissionH.ListHistory)))

	// Review (PM)
	mux.Handle("GET /api/dmms/submissions/pending", authMW(pmOnly(http.HandlerFunc(submissionH.PendingForPM))))
	mux.Handle("POST /api/dmms/submissions/{id}/approve", authMW(pmOnly(http.HandlerFunc(submissionH.Approve))))
	mux.Handle("POST /api/dmms/submissions/{id}/request-revision", authMW(pmOnly(http.HandlerFunc(submissionH.RequestRevision))))
	mux.Handle("POST /api/dmms/submissions/{id}/reject", authMW(pmOnly(http.HandlerFunc(submissionH.RejectSubmission))))

	// Ledger
	mux.Handle("GET /api/dmms/rewards/ledger", authMW(http.HandlerFunc(rewardH.Ledger)))

	// Kanban
	mux.Handle("GET /api/dmms/kanban", authMW(http.HandlerFunc(kanbanH.List)))
	mux.Handle("GET /api/dmms/kanban/mine", authMW(http.HandlerFunc(kanbanH.Mine)))
	mux.Handle("POST /api/dmms/kanban", authMW(http.HandlerFunc(kanbanH.Create)))
	mux.Handle("PUT /api/dmms/kanban/reorder", authMW(http.HandlerFunc(kanbanH.Reorder)))
	mux.Handle("GET /api/dmms/kanban/{id}", authMW(http.HandlerFunc(kanbanH.GetOne)))
	mux.Handle("PATCH /api/dmms/kanban/{id}", authMW(http.HandlerFunc(kanbanH.Update)))
	mux.Handle("DELETE /api/dmms/kanban/{id}", authMW(http.HandlerFunc(kanbanH.Delete)))
	mux.Handle("POST /api/dmms/kanban/{id}/archive", authMW(http.HandlerFunc(kanbanH.Archive)))
	mux.Handle("GET /api/dmms/kanban/{id}/comments", authMW(http.HandlerFunc(kanbanH.ListComments)))
	mux.Handle("POST /api/dmms/kanban/{id}/comments", authMW(http.HandlerFunc(kanbanH.CreateComment)))
	mux.Handle("POST /api/dmms/kanban/{id}/members", authMW(http.HandlerFunc(kanbanH.JoinTask)))
	mux.Handle("DELETE /api/dmms/kanban/{id}/members", authMW(http.HandlerFunc(kanbanH.LeaveTask)))
	mux.Handle("POST /api/dmms/files", authMW(http.HandlerFunc(kanbanH.UploadGeneric)))

	// Notifications
	mux.Handle("GET /api/dmms/notifications", authMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r)
		ns, err := notifRepo.ListForUser(userID)
		if err != nil {
			handlers.Err(w, http.StatusInternalServerError, "failed to list notifications")
			return
		}
		handlers.JSON(w, http.StatusOK, ns)
	})))
	mux.Handle("PATCH /api/dmms/notifications/{id}/read", authMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r)
		id := r.PathValue("id")
		if err := notifRepo.MarkRead(id, userID); err != nil {
			handlers.Err(w, http.StatusInternalServerError, "failed to mark notification read")
			return
		}
		handlers.JSON(w, http.StatusOK, map[string]bool{"ok": true})
	})))

	// Admin
	mux.Handle("GET /api/dmms/admin/users", authMW(adminOnly(http.HandlerFunc(adminH.ListUsers))))
	mux.Handle("PATCH /api/dmms/admin/users/{id}", authMW(adminOnly(http.HandlerFunc(adminH.UpdateUserRole))))
	mux.Handle("DELETE /api/dmms/admin/users/{id}", authMW(adminOnly(http.HandlerFunc(adminH.DeleteUser))))

	// Serve uploaded files
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// SPA fallback
	fs := http.FileServer(http.Dir("./dist"))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join("dist", r.URL.Path)
		if _, err := os.Stat(path); os.IsNotExist(err) || r.URL.Path == "/" {
			http.ServeFile(w, r, "dist/index.html")
			return
		}
		fs.ServeHTTP(w, r)
	})

	handler := corsMiddleware(mux)
	fmt.Printf("DMMS server starting on :%s\n", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, handler))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
