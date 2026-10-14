package com.apa.ats;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@ConfigurationPropertiesScan
// Some small repositories are declared next to the code that uses them.
@EnableJpaRepositories(considerNestedRepositories = true)
public class AtsApplication {
    public static void main(String[] args) {
        SpringApplication.run(AtsApplication.class, args);
    }
}
