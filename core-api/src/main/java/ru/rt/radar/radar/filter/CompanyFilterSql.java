package ru.rt.radar.radar.filter;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.util.ArrayList;
import java.util.List;

/**
 * Единственный построитель WHERE для CompanyFilter: им пользуются список, карта и /internal/companies,
 * поэтому при одном фильтре цифры везде сходятся. Таблица company — под алиасом {@code c}.
 * В SQL попадают только заданные условия; все пользовательские значения — именованными параметрами.
 */
public final class CompanyFilterSql {

    /** Вид компании (kind) в SQL — та же логика, что {@link CompanyKind}. */
    public static final String KIND =
            "CASE WHEN NOT c.is_client THEN 'others' WHEN c.status = 'excluded' THEN 'excluded' ELSE 'ours' END";

    /** WHERE-часть и её параметры. К params можно добавлять свои (limit, offset…). */
    public record Where(String sql, MapSqlParameterSource params) {
    }

    private CompanyFilterSql() {
    }

    public static Where build(CompanyFilter f) {
        List<String> and = new ArrayList<>();
        MapSqlParameterSource p = new MapSqlParameterSource();

        switch (f.client()) {
            case OURS -> and.add("c.is_client = true");
            case OTHERS -> and.add("c.is_client = false");
            case ALL -> { }
        }
        switch (f.status()) {
            case ACTIVE -> and.add("c.status = 'active'");
            case EXCLUDED -> and.add("c.status = 'excluded'");
            case ALL -> { }
        }
        if (!f.industries().isEmpty()) {
            and.add("c.industry = ANY(:industries)");
            p.addValue("industries", f.industries().stream().map(CodedEnum::code).toArray(String[]::new));
        }
        if (!f.municipalityIds().isEmpty()) {
            and.add("c.municipality_id = ANY(:municipalityIds)");
            p.addValue("municipalityIds", f.municipalityIds().toArray(Integer[]::new));
        }
        if (!f.sizeCategories().isEmpty()) {
            and.add("c.size_category = ANY(:sizes)");
            p.addValue("sizes", f.sizeCategories().stream().map(CodedEnum::code).toArray(String[]::new));
        }
        // revenue_est IS NULL отсекается само: сравнение с NULL не истинно
        if (f.revenueMin() != null) {
            and.add("c.revenue_est >= :revenueMin");
            p.addValue("revenueMin", f.revenueMin());
        }
        if (f.revenueMax() != null) {
            and.add("c.revenue_est <= :revenueMax");
            p.addValue("revenueMax", f.revenueMax());
        }
        if (f.growthMin() != null) {
            and.add("c.revenue_growth_est >= :growthMin");
            p.addValue("growthMin", f.growthMin());
        }
        if (f.isNew()) {
            and.add("c.is_new = true");
        }
        if (f.hasBounds()) {
            and.add("c.lat BETWEEN :minLat AND :maxLat AND c.lon BETWEEN :minLon AND :maxLon");
            p.addValue("minLat", f.minLat());
            p.addValue("maxLat", f.maxLat());
            p.addValue("minLon", f.minLon());
            p.addValue("maxLon", f.maxLon());
        }
        if (f.q() != null) {
            and.add("(c.name ILIKE '%' || :q || '%' ESCAPE '\\' OR c.inn LIKE :q || '%' ESCAPE '\\')");
            p.addValue("q", escapeLike(f.q()));
        }

        String sql = and.isEmpty() ? "WHERE true" : "WHERE " + String.join("\n  AND ", and);
        return new Where(sql, p);
    }

    /** Экранирует спецсимволы LIKE, чтобы «100%» или «_» искались буквально. */
    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
