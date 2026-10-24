package ru.rt.radar.invest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.common.exception.ValidationException;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Проекты для notifier и export-service. X-Internal-Token проверяет common/security/InternalTokenFilter;
 * снаружи nginx отдаёт на /internal/ 404.
 */
@RestController
@Tag(name = "Внутреннее (notifier, export-service)")
public class InternalProjectController {

    static final String UPDATED_SINCE = "updatedSince";

    private final ProjectRepository projects;

    public InternalProjectController(ProjectRepository projects) {
        this.projects = projects;
    }

    @GetMapping("/internal/projects")
    @Operation(summary = "Проекты, изменённые после updatedSince — для уведомлений и экспорта",
            description = "Массив полных Project без пагинации (их десятки), updated_at строго больше updatedSince, "
                    + "сортировка по updatedAt, затем id. updatedAt отдаётся с микросекундами — его можно передать "
                    + "обратно в updatedSince, и тот же проект не придёт повторно.")
    public List<Project> projects(
            ProjectFilter filter,
            @Parameter(description = "ISO-8601 с часовым поясом, например 2026-10-24T03:49:56.123456Z; не задан — все проекты")
            @RequestParam(name = UPDATED_SINCE, required = false) String updatedSince) {
        return projects.findUpdatedSince(filter, parseUpdatedSince(updatedSince));
    }

    static OffsetDateTime parseUpdatedSince(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        // «+03:00» без кодирования в URL приходит как « 03:00» — возвращаем плюс
        String v = value.trim().replace(' ', '+');
        try {
            return OffsetDateTime.parse(v);
        } catch (DateTimeParseException e) {
            throw new ValidationException(UPDATED_SINCE,
                    "updatedSince — дата и время ISO-8601 с часовым поясом, например 2026-10-24T03:49:56Z; получено '"
                            + value + "'");
        }
    }
}
