package com.apa.ats.permission;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final PermissionMatrixService matrix;
    private final AccessGuard guard;

    public record ChangeRequest(List<PermissionMatrixService.Change> changes) {}

    @GetMapping
    public PermissionMatrixService.Matrix get() {
        guard.require("ROLE_PERMISSION_MANAGE");
        return matrix.matrix();
    }

    @PutMapping
    public PermissionMatrixService.ChangeResult save(@RequestBody ChangeRequest body) {
        guard.require("ROLE_PERMISSION_MANAGE");
        return matrix.apply(body.changes());
    }
}
