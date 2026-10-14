package com.apa.ats.notification;

import com.apa.ats.auth.CurrentUser;
import com.apa.ats.notification.NotificationService.NotificationPage;
import com.apa.ats.notification.NotificationService.Unread;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's own notifications. Any authenticated user may use these; there is no permission code. */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;

    @GetMapping
    public NotificationPage list(@RequestParam(defaultValue = "false") boolean unread,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "20") int size) {
        return service.list(CurrentUser.require().id(), unread, page, size);
    }

    @GetMapping("/unread-count")
    public Unread unreadCount() {
        return service.unread(CurrentUser.require().id());
    }

    @PostMapping("/{id}/read")
    public Unread read(@PathVariable Long id) {
        return service.markRead(CurrentUser.require().id(), id);
    }

    @PostMapping("/read-all")
    public Unread readAll() {
        return service.markAllRead(CurrentUser.require().id());
    }
}
