package app

import "time"

func projectID(projects []map[string]any, name string) any {
	if index, found := findMap(projects, "name", name); found {
		return projects[index]["project_id"]
	}
	return 0
}

func updateDemoRepoCount(projects []map[string]any, project string, count int) {
	if index, found := findMap(projects, "name", project); found {
		projects[index]["repo_count"] = count
		projects[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
	}
}

func demoRoleName(role int) string {
	roles := map[int]string{1: "projectAdmin", 2: "developer", 3: "guest", 4: "maintainer"}
	return roles[role]
}
