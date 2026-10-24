package ru.rt.radar.common.exception;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Только для тестов: по эндпоинту на каждую ветку GlobalExceptionHandler. */
@RestController
class ErrorProbeController {

    record Body(@NotBlank String name, @Min(1) int size) {
    }

    @GetMapping("/test/errors/validation")
    void validation() {
        throw new ValidationException("revenueMin", "revenueMin больше revenueMax");
    }

    @GetMapping("/test/errors/not-found")
    void notFound() {
        throw new NotFoundException("Компания 42 не найдена");
    }

    @GetMapping("/test/errors/too-large")
    void tooLarge() {
        throw new TooLargeException(250_000, 100_000);
    }

    @GetMapping("/test/errors/boom")
    void boom() {
        throw new IllegalStateException("секрет: пароль от БД");
    }

    @GetMapping("/test/errors/typed/{id}")
    int typed(@PathVariable int id) {
        return id;
    }

    @GetMapping("/test/errors/required")
    String required(@RequestParam String name) {
        return name;
    }

    @GetMapping("/test/errors/min")
    int min(@RequestParam @Min(1) int size) {
        return size;
    }

    @PostMapping("/test/errors/body")
    Body body(@Valid @RequestBody Body body) {
        return body;
    }
}
