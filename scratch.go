package main

import (
	"encoding/json"
	"fmt"
	"finance-game/internal/dmms/handlers"
)

func main() {
	jsonStr := `[
  {
    "title": "Example Deliverable",
    "brief": "Brief description of the deliverable",
    "scope": "Scope of work",
    "acceptance_criteria": "[\"Criteria 1\", \"Criteria 2\"]",
    "max_budget": 1000,
    "start_date": "2026-05-01",
    "due_date": "2026-05-15",
    "visibility": "public",
    "tasks": [
      {
        "title": "Initial Research",
        "description": "Gather context"
      },
      {
        "title": "Implementation",
        "description": "Write code"
      }
    ],
    "children": [
      {
        "title": "Sub-deliverable",
        "brief": "Smaller component",
        "scope": "...",
        "acceptance_criteria": "[]",
        "max_budget": 500,
        "start_date": "2026-05-01",
        "due_date": "2026-05-07",
        "visibility": "public",
        "tasks": []
      }
    ]
  }
]`
	var body []handlers.ImportDeliverable
	if err := json.Unmarshal([]byte(jsonStr), &body); err != nil {
		fmt.Println("Error decoding:", err)
		return
	}
	fmt.Printf("Decoded %d items\n", len(body))
    fmt.Printf("Item 0 title: '%s'\n", body[0].Title)
}
