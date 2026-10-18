package com.apa.ats.dashboard;

import com.apa.ats.dashboard.DashboardService.Dashboard;
import com.apa.ats.common.ApiException;
import com.apa.ats.permission.AccessGuard;
import com.apa.ats.ticket.TicketEnums.Environment;
import com.apa.ats.ticket.TicketEnums.Priority;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final AccessGuard guard;
    private final DashboardService service;

    @GetMapping
    public Dashboard get(@RequestParam(required = false) Long module,
                         @RequestParam(required = false) String environment,
                         @RequestParam(required = false) String priority,
                         @RequestParam(defaultValue = "90") int days) {
        guard.require("DASHBOARD_VIEW");
        return service.build(module, parse(Environment.class, environment), parse(Priority.class, priority), days);
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Enum.valueOf(type, value.strip().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("BAD_FILTER", "Unknown " + type.getSimpleName().toLowerCase() + ": " + value);
        }
    }
}
