package com.apa.ats.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;

class SchemaMigratorTest {

    @Test
    void splitsOnTrailingSemicolonAndDropsComments() {
        List<String> out = SchemaMigrator.split("""
                -- header
                CREATE TABLE A (
                  X NUMBER -- inline note stays
                );

                INSERT INTO A VALUES ('a;b');
                """);
        assertThat(out).hasSize(2);
        assertThat(out.get(0)).startsWith("CREATE TABLE A").endsWith(")").doesNotContain(";");
        assertThat(out.get(1)).isEqualTo("INSERT INTO A VALUES ('a;b')");
    }

    @Test
    void realScriptsSplitIntoCleanStatements() throws IOException {
        for (String file : List.of("db/ats/V001__identity_access_modules.sql", "db/ats/V002__seed_roles_permissions_modules.sql")) {
            String sql = StreamUtils.copyToString(new ClassPathResource(file).getInputStream(), StandardCharsets.UTF_8);
            List<String> statements = SchemaMigrator.split(sql);
            assertThat(statements).isNotEmpty();
            for (String s : statements) {
                assertThat(s).as(file).doesNotEndWith(";").matches("(?s)^(CREATE|INSERT).*");
            }
        }
    }

    @Test
    void everyObjectIsPrefixedAts() throws IOException {
        String sql = StreamUtils.copyToString(new ClassPathResource("db/ats/V001__identity_access_modules.sql").getInputStream(), StandardCharsets.UTF_8);
        for (String s : SchemaMigrator.split(sql)) {
            String name = s.replaceAll("(?s)^CREATE (UNIQUE )?(TABLE|SEQUENCE|INDEX) (\\w+).*", "$3");
            assertThat(name).as(s.lines().findFirst().orElse("")).startsWith("ATS_");
        }
    }
}
