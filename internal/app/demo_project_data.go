package app

import (
	"harbor-console/internal/timefmt"
)

func projectID(projects []map[string]any, name string) any {
	if index, found := findMap(projects, "name", name); found {
		return projects[index]["project_id"]
	}
	return 0
}

func (ds *demoState) updateRepoCount(project string) {
	projects, count := ds.projects, len(ds.repositories[project])
	if index, found := findMap(projects, "name", project); found {
		projects[index]["repo_count"] = count
		projects[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
	}
}

func demoRoleName(role int) string {
	roles := map[int]string{1: "projectAdmin", 2: "developer", 3: "guest", 4: "maintainer"}
	return roles[role]
}
