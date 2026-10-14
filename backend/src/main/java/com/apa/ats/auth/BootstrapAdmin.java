package com.apa.ats.auth;

import com.apa.ats.common.Passwords;
import com.apa.ats.config.AtsProperties;
import com.apa.ats.user.AtsUser;
import com.apa.ats.user.Role;
import com.apa.ats.user.RoleRepository;
import com.apa.ats.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates the first System Administrator when ATS_USERS is empty, after the schema migration. */
@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
public class BootstrapAdmin implements ApplicationRunner {

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;
    private final AtsProperties props;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) return;
        AtsProperties.BootstrapAdmin cfg = props.bootstrapAdmin();
        Role admin = roles.findByCode(Role.SYS_ADMIN)
                .orElseThrow(() -> new IllegalStateException("SYS_ADMIN role missing; did migration V002 run?"));

        boolean generated = cfg.initialPassword() == null || cfg.initialPassword().isBlank();
        String password = generated ? Passwords.temporary() : cfg.initialPassword();

        AtsUser u = new AtsUser();
        u.setUsername(cfg.username());
        u.setFullName(cfg.fullName());
        u.setEmail(cfg.email() == null || cfg.email().isBlank() ? null : cfg.email());
        u.setOrganization(AtsUser.Organization.PORT);
        u.setPasswordHash(encoder.encode(password));
        u.setMustChangePassword(true);
        u.setActive(true);
        u.setAvatarColor("#14283F");
        u.getRoles().add(admin);
        users.save(u);

        if (generated) {
            log.warn("""

                    ============================================================
                     ATS first administrator created
                       username: {}
                       temporary password: {}
                     You'll be asked to change it at first sign-in.
                     This is shown once and is not stored anywhere in plain text.
                    ============================================================""", cfg.username(), password);
        } else {
            log.warn("ATS first administrator '{}' created with ATS_ADMIN_INITIAL_PASSWORD; change it at first sign-in.", cfg.username());
        }
    }
}
