package com.apa.ats.permission;

import com.apa.ats.permission.PermissionMatrixService.RoleView;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Role editor behind the Permissions Center (the read side is GET /api/roles and the permission matrix). */
@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class RoleAdminController {

    private final AccessGuard guard;
    private final RoleAdminService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoleView create(@RequestBody RoleAdminService.RoleInput in) {
        guard.require("ROLE_PERMISSION_MANAGE");
        return service.create(in);
    }

    @PutMapping("/{id}")
    public RoleView update(@PathVariable Long id, @RequestBody RoleAdminService.RoleInput in) {
        guard.require("ROLE_PERMISSION_MANAGE");
        return service.update(id, in);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        guard.require("ROLE_PERMISSION_MANAGE");
        service.delete(id);
    }
}
