package com.apa.ats.dashboard;

import com.apa.ats.dashboard.DashboardService.Dashboard;
import com.apa.ats.permission.AccessGuard;
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
    public Dashboard get(@RequestParam(required = false) Long module, @RequestParam(defaultValue = "90") int days) {
        guard.require("DASHBOARD_VIEW");
        return service.build(module, days);
    }
}
