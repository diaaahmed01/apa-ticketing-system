package com.apa.ats.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StreamUtils;

/**
 * Applies the versioned scripts in {@code classpath:db/ats/V###__name.sql} that are
 * not yet recorded in ATS_SCHEMA_HISTORY. Stands in for Flyway, which the corporate
 * proxy keeps out of the Maven cache.
 *
 * <p>Statements end with ";" at end of line. A script that fails is not recorded, so
 * after fixing it the next start retries it; Oracle DDL auto-commits, so a partially
 * applied script must be cleaned up by hand first (the log names the statement).
 */
@Slf4j
@Component
@Order(1)
public class SchemaMigrator implements ApplicationRunner {

    private static final Pattern FILE = Pattern.compile("V(\\d{3})__(.+)\\.sql");
    private static final String HISTORY = "ATS_SCHEMA_HISTORY";

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final AtsProperties props;

    public SchemaMigrator(DataSource dataSource, TransactionTemplate tx, AtsProperties props) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.tx = tx;
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (!props.db().migrate()) {
            log.info("ATS schema migration disabled (ats.db.migrate=false)");
            return;
        }
        ensureHistoryTable();

        Resource[] scripts = new PathMatchingResourcePatternResolver().getResources("classpath:db/ats/V*.sql");
        Arrays.sort(scripts, Comparator.comparing(Resource::getFilename));

        for (Resource script : scripts) {
            Matcher m = FILE.matcher(script.getFilename());
            if (!m.matches()) {
                throw new IllegalStateException("Bad migration file name: " + script.getFilename());
            }
            int version = Integer.parseInt(m.group(1));
            Integer applied = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + HISTORY + " WHERE VERSION = ?", Integer.class, version);
            if (applied != null && applied > 0) continue;

            String sql = StreamUtils.copyToString(script.getInputStream(), StandardCharsets.UTF_8);
            List<String> statements = split(sql);
            log.info("Applying ATS migration V{} ({} statements): {}", version, statements.size(), m.group(2));
            tx.executeWithoutResult(status -> {
                for (int i = 0; i < statements.size(); i++) {
                    try {
                        jdbc.execute(statements.get(i));
                    } catch (RuntimeException e) {
                        throw new IllegalStateException("ATS migration V%03d failed at statement %d:%n%s"
                                .formatted(version, i + 1, statements.get(i)), e);
                    }
                }
                jdbc.update("INSERT INTO " + HISTORY + " (VERSION, DESCRIPTION, SCRIPT) VALUES (?, ?, ?)",
                        version, m.group(2).replace('_', ' '), script.getFilename());
            });
        }
    }

    private void ensureHistoryTable() {
        Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = ?", Integer.class, HISTORY);
        if (exists != null && exists > 0) return;
        jdbc.execute("""
                CREATE TABLE ATS_SCHEMA_HISTORY (
                  VERSION      NUMBER(5)      NOT NULL,
                  DESCRIPTION  VARCHAR2(200)  NOT NULL,
                  SCRIPT       VARCHAR2(200)  NOT NULL,
                  APPLIED_AT   TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
                  CONSTRAINT ATS_SCHEMA_HISTORY_PK PRIMARY KEY (VERSION)
                )""");
        log.info("Created {}", HISTORY);
    }

    /** Splits on ";" at end of line, dropping full-line "--" comments. */
    static List<String> split(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String line : sql.split("\\R")) {
            String trimmed = line.strip();
            if (trimmed.isEmpty() || trimmed.startsWith("--")) continue;
            if (trimmed.endsWith(";")) {
                current.append(line, 0, line.lastIndexOf(';'));
                String stmt = current.toString().strip();
                if (!stmt.isEmpty()) out.add(stmt);
                current.setLength(0);
            } else {
                current.append(line).append('\n');
            }
        }
        if (!current.toString().isBlank()) out.add(current.toString().strip());
        return out;
    }
}
