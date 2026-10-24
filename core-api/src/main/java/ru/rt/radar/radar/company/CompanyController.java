package ru.rt.radar.radar.company;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.radar.error.NotFoundException;
import ru.rt.radar.radar.error.ValidationException;
import ru.rt.radar.radar.filter.CompanyFilter;
import ru.rt.radar.radar.web.PageResponse;

@RestController
@Tag(name = "Компании")
public class CompanyController {

    static final int MAX_SIZE = 200;

    private final CompanyRepository companies;

    public CompanyController(CompanyRepository companies) {
        this.companies = companies;
    }

    @GetMapping("/api/companies")
    @Operation(summary = "Список компаний по фильтру (страница)",
            description = "Тот же CompanyFilter, что у карты и экспорта: при одном фильтре total совпадает.")
    public PageResponse<CompanyShort> list(
            CompanyFilter filter,
            @Parameter(description = "Номер страницы с 0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Размер страницы, 1–" + MAX_SIZE)
            @RequestParam(defaultValue = "50") int size,
            @Parameter(description = "Поле и направление; пустые значения поля — всегда в конце",
                    schema = @Schema(defaultValue = CompanySort.DEFAULT, allowableValues = {
                            "revenueEst,desc", "revenueEst,asc", "revenueGrowthEst,desc", "revenueGrowthEst,asc",
                            "name,asc", "name,desc", "employees,desc", "employees,asc",
                            "registeredAt,desc", "registeredAt,asc"}))
            @RequestParam(name = CompanySort.PARAM, defaultValue = CompanySort.DEFAULT) String sort) {
        if (page < 0) {
            throw new ValidationException("page", "page не может быть отрицательным");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new ValidationException("size", "size должен быть от 1 до " + MAX_SIZE);
        }
        CompanyRepository.CompanyPage result = companies.findPage(filter, CompanySort.parse(sort), page, size);
        return new PageResponse<>(result.items(), page, size, result.total());
    }

    @GetMapping("/api/companies/{id}")
    @Operation(summary = "Карточка компании", description = "Открывается и исключённая из реестра компания. Нет — 404.")
    public Company byId(@PathVariable int id) {
        return companies.findById(id).orElseThrow(() -> new NotFoundException("Компания " + id + " не найдена"));
    }
}
