package ru.rt.radar.radar.stats;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.common.exception.ValidationException;
import ru.rt.radar.radar.filter.CodedEnum;
import ru.rt.radar.radar.filter.Industry;

import java.util.List;

@RestController
@Tag(name = "Районы и белые пятна")
public class StatsController {

    static final String ALL = "all";
    static final int MAX_LIMIT = 50;

    private final StatsRepository stats;

    public StatsController(StatsRepository stats) {
        this.stats = stats;
    }

    @GetMapping("/api/municipalities/stats")
    @Operation(summary = "Статистика и потенциал районов",
            description = "Цифры считает SQL-функция refresh_municipality_stats (после ETL и импорта клиентов). "
                    + "coverage = clients / companies. Сортировка — по потенциалу, убыв.")
    public List<MunicipalityStats> municipalities(
            @Parameter(description = "Отрасль или all", schema = @Schema(defaultValue = ALL, allowableValues = {
                    "all", "agro", "energy", "manufacturing", "construction", "trade", "logistics",
                    "hospitality", "it", "realestate", "services", "other"}))
            @RequestParam(defaultValue = ALL) String industry) {
        return stats.stats(industry(industry));
    }

    @GetMapping("/api/white-spots")
    @Operation(summary = "Белые пятна: районы с высоким потенциалом и низким охватом",
            description = "reason — человекочитаемое объяснение из SQL-функции. Сортировка — по потенциалу, убыв.")
    public List<WhiteSpot> whiteSpots(
            @Parameter(description = "Отрасль или all", schema = @Schema(defaultValue = ALL, allowableValues = {
                    "all", "agro", "energy", "manufacturing", "construction", "trade", "logistics",
                    "hospitality", "it", "realestate", "services", "other"}))
            @RequestParam(defaultValue = ALL) String industry,
            @Parameter(description = "Сколько районов, 1–" + MAX_LIMIT,
                    schema = @Schema(minimum = "1", maximum = "" + MAX_LIMIT, defaultValue = "10"))
            @RequestParam(defaultValue = "10") int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new ValidationException("limit", "limit должен быть от 1 до " + MAX_LIMIT);
        }
        return stats.whiteSpots(industry(industry), limit);
    }

    /** all или код отрасли из контракта. Повтор параметра Spring склеивает через запятую — это тоже ошибка. */
    static String industry(String value) {
        String v = value.trim();
        if (v.equals(ALL)) {
            return ALL;
        }
        if (CodedEnum.find(Industry.class, v).isEmpty()) {
            throw new ValidationException("industry", "Неизвестное значение industry='" + v + "', допустимо: all, "
                    + String.join(", ", CodedEnum.codes(Industry.class)));
        }
        return v;
    }
}
