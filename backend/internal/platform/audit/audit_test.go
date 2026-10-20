package audit

import "testing"

func TestRoute(t *testing.T) {
	id := "0123456789abcdef0123456789abcdef"
	action, target := Route("PUT", "/v1/admin/users/"+id+"/password")
	if action != "PUT /v1/admin/users/{id}/password" || target != id {
		t.Fatalf("%q %q", action, target)
	}
	action, target = Route("DELETE", "/v1/admin/rating/seasons/42")
	if action != "DELETE /v1/admin/rating/seasons/{id}" || target != "42" {
		t.Fatalf("%q %q", action, target)
	}
	if action, target = Route("POST", "/v1/admin/gifts"); action != "POST /v1/admin/gifts" || target != "" {
		t.Fatalf("%q %q", action, target)
	}
}
