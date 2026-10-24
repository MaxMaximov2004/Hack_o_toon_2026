package ru.rt.radar.radar;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.radar.filter.CompanyFilter;

/** Только для тестов: эндпоинт с CompanyFilter, чтобы проверить резолвер, ошибки и Swagger. */
@RestController
class FilterProbeController {

    @GetMapping("/test/filter-probe")
    CompanyFilter probe(CompanyFilter filter) {
        return filter;
    }
}
