package ru.rt.radar.notifier.worker;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

import java.time.Duration;

import static ru.rt.radar.notifier.common.util.LogPatterns.CHECK_FAILED;

/**
 * Воркер раз в CHECK_INTERVAL (60s, 5m — формат Spring Boot). Два потока: проверка проектов и long polling Telegram
 * не ждут друг друга. Ошибка (core-api ещё не поднялся) — в лог, следующая попытка по расписанию.
 */
@Configuration
public class WorkerConfig implements SchedulingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WorkerConfig.class);

    private final ProjectCheckService checks;
    private final Duration interval;

    public WorkerConfig(ProjectCheckService checks, @Value("${radar.check-interval:60s}") Duration interval) {
        this.checks = checks;
        this.interval = interval;
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("notifier-");
        scheduler.initialize();
        registrar.setTaskScheduler(scheduler);
        registrar.addFixedDelayTask(() -> {
            try {
                checks.check();
            } catch (Exception e) {
                log.warn(CHECK_FAILED, e.getMessage());
            }
        }, interval);
    }
}
