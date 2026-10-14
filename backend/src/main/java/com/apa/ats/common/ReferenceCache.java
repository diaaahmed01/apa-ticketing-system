package com.apa.ats.common;

import com.apa.ats.module.ModuleController;
import com.apa.ats.user.AtsUser;
import com.apa.ats.user.UserRepository;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Short-lived snapshot of users and modules for display and "is active" checks. Both lists are
 * small and read on nearly every request; writers call {@link #invalidate()} so changes show at once.
 */
@Component
@RequiredArgsConstructor
public class ReferenceCache {

    private static final long TTL_MILLIS = 30_000;

    public record UserSnap(Long id, String fullName, String organization, String avatarColor, boolean active) {}
    public record ModuleSnap(Long id, String name, String nameAr, boolean active) {}
    public record Snapshot(Map<Long, UserSnap> users, Map<Long, ModuleSnap> modules, long loadedAt) {}

    private final UserRepository userRepo;
    private final ModuleController.Modules moduleRepo;

    private volatile Snapshot current;

    public Snapshot get() {
        Snapshot s = current;
        if (s != null && System.currentTimeMillis() - s.loadedAt() < TTL_MILLIS) return s;
        return reload();
    }

    /** Drops the snapshot; inside a transaction this waits for the commit so a reload can't see old rows. */
    public void invalidate() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { current = null; }
            });
        } else {
            current = null;
        }
    }

    private synchronized Snapshot reload() {
        Snapshot s = current;
        if (s != null && System.currentTimeMillis() - s.loadedAt() < TTL_MILLIS) return s;
        Map<Long, UserSnap> users = new HashMap<>();
        for (Object[] r : userRepo.referenceRows()) {
            Long id = (Long) r[0];
            users.put(id, new UserSnap(id, (String) r[1], ((AtsUser.Organization) r[2]).name(), (String) r[3], (Boolean) r[4]));
        }
        Map<Long, ModuleSnap> modules = new HashMap<>();
        moduleRepo.findAll().forEach(m -> modules.put(m.getId(), new ModuleSnap(m.getId(), m.getName(), m.getNameAr(), m.isActive())));
        current = new Snapshot(users, modules, System.currentTimeMillis());
        return current;
    }
}
