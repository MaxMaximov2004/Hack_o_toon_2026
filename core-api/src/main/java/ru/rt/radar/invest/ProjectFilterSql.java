package ru.rt.radar.invest;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import ru.rt.radar.radar.filter.CodedEnum;
import ru.rt.radar.radar.filter.CompanyFilterSql;

import java.util.ArrayList;
import java.util.List;

/**
 * Единственный построитель WHERE для ProjectFilter: список, таймлайн и /internal/projects — поэтому при одном фильтре
 * цифры везде сходятся. Таблица invest_project — под алиасом {@code p}. Только заданные условия, значения — параметрами.
 */
public final class ProjectFilterSql {

    private ProjectFilterSql() {
    }

    public static CompanyFilterSql.Where build(ProjectFilter f) {
        List<String> and = new ArrayList<>();
        MapSqlParameterSource p = new MapSqlParameterSource();

        if (!f.stages().isEmpty()) {
            and.add("p.stage = ANY(:stages)");
            p.addValue("stages", f.stages().stream().map(CodedEnum::code).toArray(String[]::new));
        }
        if (!f.industries().isEmpty()) {
            and.add("p.industry = ANY(:industries)");
            p.addValue("industries", f.industries().stream().map(CodedEnum::code).toArray(String[]::new));
        }
        if (!f.needs().isEmpty()) {
            // есть хотя бы одна из выбранных потребностей
            and.add("p.needs && CAST(:needs AS text[])");
            p.addValue("needs", f.needs().stream().map(CodedEnum::code).toArray(String[]::new));
        }
        if (!f.municipalityIds().isEmpty()) {
            and.add("p.municipality_id = ANY(:municipalityIds)");
            p.addValue("municipalityIds", f.municipalityIds().toArray(Integer[]::new));
        }
        // проект «идёт» в периоде; неизвестный год проекта не отсекает
        if (f.yearTo() != null) {
            and.add("(p.start_year IS NULL OR p.start_year <= :yearTo)");
            p.addValue("yearTo", f.yearTo());
        }
        if (f.yearFrom() != null) {
            and.add("(p.launch_year IS NULL OR p.launch_year >= :yearFrom)");
            p.addValue("yearFrom", f.yearFrom());
        }
        if (f.isKey()) {
            and.add("p.is_key = true");
        }
        if (f.amountMin() != null) {
            and.add("p.amount_mln >= :amountMin");
            p.addValue("amountMin", f.amountMin());
        }
        if (f.q() != null) {
            and.add("(p.title ILIKE '%' || :q || '%' ESCAPE '\\' OR p.initiator ILIKE '%' || :q || '%' ESCAPE '\\')");
            p.addValue("q", CompanyFilterSql.escapeLike(f.q()));
        }

        String sql = and.isEmpty() ? "WHERE true" : "WHERE " + String.join("\n  AND ", and);
        return new CompanyFilterSql.Where(sql, p);
    }
}
