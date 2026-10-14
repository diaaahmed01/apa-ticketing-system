package com.apa.ats.module;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.common.ApiException;
import com.apa.ats.permission.AccessGuard;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ModuleController {

    public interface Modules extends JpaRepository<AtsModule, Long> {
        List<AtsModule> findAllByOrderBySortOrderAscNameAsc();
        boolean existsByNameIgnoreCase(String name);
        boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    }

    private final Modules modules;
    private final AccessGuard guard;

    public record ModuleView(Long id, String name, String nameAr, boolean active, int sortOrder) {}
    public record ModuleInput(String name, String nameAr, Integer sortOrder) {}

    /** Active modules for everyone; inactive ones too for module managers (includeInactive=true). */
    @GetMapping("/api/modules")
    public List<ModuleView> list(@RequestParam(defaultValue = "false") boolean includeInactive) {
        if (includeInactive) guard.require("MODULE_MANAGE");
        return modules.findAllByOrderBySortOrderAscNameAsc().stream()
                .filter(m -> includeInactive || m.isActive())
                .map(ModuleController::view).toList();
    }

    @PostMapping("/api/modules")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ModuleView create(@RequestBody ModuleInput in) {
        guard.require("MODULE_MANAGE");
        String name = name(in);
        if (modules.existsByNameIgnoreCase(name)) throw ApiException.conflict("MODULE_EXISTS", "A module named \"" + name + "\" already exists.");
        AtsModule m = new AtsModule();
        m.setName(name);
        m.setNameAr(blankToNull(in.nameAr()));
        m.setActive(true);
        m.setSortOrder(in.sortOrder() == null ? nextSort() : in.sortOrder());
        m.setCreatedBy(CurrentUser.require().id());
        return view(modules.save(m));
    }

    @PutMapping("/api/modules/{id}")
    @Transactional
    public ModuleView update(@PathVariable Long id, @RequestBody ModuleInput in) {
        guard.require("MODULE_MANAGE");
        AtsModule m = modules.findById(id).orElseThrow(() -> ApiException.notFound("Module"));
        String name = name(in);
        if (modules.existsByNameIgnoreCaseAndIdNot(name, id)) throw ApiException.conflict("MODULE_EXISTS", "A module named \"" + name + "\" already exists.");
        m.setName(name);
        m.setNameAr(blankToNull(in.nameAr()));
        if (in.sortOrder() != null) m.setSortOrder(in.sortOrder());
        touch(m);
        return view(m);
    }

    /** Deactivated modules disappear from new-ticket dropdowns but stay on existing tickets. */
    @PostMapping("/api/modules/{id}/{action:activate|deactivate}")
    @Transactional
    public ModuleView setActive(@PathVariable Long id, @PathVariable String action) {
        guard.require("MODULE_MANAGE");
        AtsModule m = modules.findById(id).orElseThrow(() -> ApiException.notFound("Module"));
        m.setActive("activate".equals(action));
        touch(m);
        return view(m);
    }

    private int nextSort() {
        return modules.findAll().stream().mapToInt(AtsModule::getSortOrder).max().orElse(0) + 10;
    }

    private static String name(ModuleInput in) {
        if (in.name() == null || in.name().isBlank()) throw ApiException.badRequest("REQUIRED", "Module name is required.");
        String n = in.name().strip();
        if (n.length() > 80) throw ApiException.badRequest("BAD_NAME", "Module name is too long (80 characters max).");
        return n;
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.strip(); }

    private static void touch(AtsModule m) {
        m.setUpdatedAt(Instant.now());
        m.setUpdatedBy(CurrentUser.require().id());
    }

    private static ModuleView view(AtsModule m) {
        return new ModuleView(m.getId(), m.getName(), m.getNameAr(), m.isActive(), m.getSortOrder());
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "app", "ats");
    }
}
