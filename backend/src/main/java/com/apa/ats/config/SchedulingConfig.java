package com.apa.ats.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on {@code @Scheduled} jobs (the email sender). */
@Configuration
@EnableScheduling
public class SchedulingConfig {}
