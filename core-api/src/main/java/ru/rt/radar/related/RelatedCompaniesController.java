package ru.rt.radar.related;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Навигатор (продукт 2)")
public class RelatedCompaniesController {

    private final RelatedCompaniesService service;

    public RelatedCompaniesController(RelatedCompaniesService service) {
        this.service = service;
    }

    @GetMapping("/api/projects/{id}/related-companies")
    @Operation(summary = "Кому продавать вокруг проекта",
            description = "Инициатор проекта, найденный в реестре по нормализованному названию, и до 20 действующих компаний "
                    + "той же отрасли в том же районе (сначала не клиенты). radarQuery — фильтр для «Открыть в радаре». "
                    + "Нет проекта — 404.")
    public RelatedCompanies relatedCompanies(@PathVariable int id) {
        return service.find(id);
    }
}
