package ru.rt.radar.notifier.worker;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Ручной запуск проверки — для демо, не ждать CHECK_INTERVAL. Снаружи закрыт (nginx /internal → 404), нужен X-Internal-Token. */
@RestController
@Tag(name = "Внутреннее")
public class InternalCheckController {

    private final ProjectCheckService checks;

    public InternalCheckController(ProjectCheckService checks) {
        this.checks = checks;
    }

    @PostMapping("/internal/notifier/check")
    @Operation(summary = "Проверить новые проекты сейчас")
    public ProjectCheckService.CheckResult check() {
        return checks.check();
    }
}
