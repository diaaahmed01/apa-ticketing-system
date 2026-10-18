package com.apa.ats.settings;

import com.apa.ats.permission.AccessGuard;
import com.apa.ats.settings.SettingsService.Settings;
import com.apa.ats.settings.SettingsService.TestEmailResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final AccessGuard guard;
    private final SettingsService service;

    public record TestEmailRequest(String to) {}

    @GetMapping
    public Settings get() {
        guard.require("SETTINGS_MANAGE");
        return service.get();
    }

    @PostMapping("/test-email")
    public TestEmailResult testEmail(@RequestBody TestEmailRequest r) {
        guard.require("SETTINGS_MANAGE");
        return service.sendTest(r == null ? null : r.to());
    }
}
