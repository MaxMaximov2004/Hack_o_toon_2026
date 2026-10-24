package ru.rt.radar.invest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.common.exception.NotFoundException;
import ru.rt.radar.common.exception.ValidationException;
import ru.rt.radar.radar.web.PageResponse;

@RestController
@Tag(name = "Навигатор (продукт 2)")
public class ProjectController {

    static final int MAX_SIZE = 200;

    private final ProjectRepository projects;

    public ProjectController(ProjectRepository projects) {
        this.projects = projects;
    }

    @GetMapping("/api/projects")
    @Operation(summary = "Инвестпроекты по фильтру (страница)",
            description = "ProjectFilter — тот же, что у таймлайна и /internal/projects: при одном фильтре total совпадает. "
                    + "recommendedOffers — услуги РТ под потребности проекта.")
    public PageResponse<Project> list(
            ProjectFilter filter,
            @Parameter(description = "Номер страницы с 0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Размер страницы, 1–" + MAX_SIZE)
            @RequestParam(defaultValue = "50") int size,
            @Parameter(description = "Поле и направление; пустые значения поля — всегда в конце",
                    schema = @Schema(defaultValue = ProjectSort.DEFAULT, allowableValues = {
                            "amountMln,desc", "amountMln,asc", "jobs,desc", "jobs,asc", "startYear,asc", "startYear,desc",
                            "launchYear,asc", "launchYear,desc", "title,asc", "title,desc"}))
            @RequestParam(name = ProjectSort.PARAM, defaultValue = ProjectSort.DEFAULT) String sort) {
        if (page < 0) {
            throw new ValidationException("page", "page не может быть отрицательным");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new ValidationException("size", "size должен быть от 1 до " + MAX_SIZE);
        }
        ProjectRepository.ProjectPage result = projects.findPage(filter, ProjectSort.parse(sort), page, size);
        return new PageResponse<>(result.items(), page, size, result.total());
    }

    @GetMapping("/api/projects/timeline")
    @Operation(summary = "Таймлайн проектов по годам",
            description = "На каждый проект — событие start (startYear) и launch (launchYear), если год известен. "
                    + "Годы по возрастанию, внутри года — сначала start, затем по объёму убыв. При yearFrom/yearTo — только "
                    + "события внутри периода. total — число проектов под фильтром (как у /api/projects), не событий.")
    public Timeline timeline(ProjectFilter filter) {
        return Timeline.of(projects.findAll(filter), filter.yearFrom(), filter.yearTo());
    }

    @GetMapping("/api/projects/{id}")
    @Operation(summary = "Карточка инвестпроекта с услугами РТ", description = "Нет проекта — 404.")
    public Project byId(@PathVariable int id) {
        return projects.findById(id).orElseThrow(() -> new NotFoundException("Проект " + id + " не найден"));
    }
}
