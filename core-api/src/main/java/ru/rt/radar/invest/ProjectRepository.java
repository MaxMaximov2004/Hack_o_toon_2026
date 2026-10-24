package ru.rt.radar.invest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.rt.radar.radar.filter.CodedEnum;
import ru.rt.radar.radar.filter.CompanyFilterSql;
import ru.rt.radar.radar.filter.Industry;
import ru.rt.radar.radar.filter.Need;
import ru.rt.radar.radar.filter.Stage;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Чтение инвестпроектов. WHERE — только из {@link ProjectFilterSql}, чтобы список, таймлайн и /internal сходились. */
@Repository
public class ProjectRepository {

    private static final Logger log = LoggerFactory.getLogger(ProjectRepository.class);

    static final String SELECT = """
            SELECT p.id, p.title, p.initiator, p.municipality_id, m.name AS municipality_name, m.lat, m.lon,
                   p.is_key, p.curator, p.start_year, p.launch_year, p.amount_mln, p.jobs, p.stage, p.industry,
                   p.needs, p.updated_at
            FROM invest_project p JOIN municipality m ON m.id = p.municipality_id
            """;

    private static final Set<String> warnedCodes = ConcurrentHashMap.newKeySet();

    private final NamedParameterJdbcTemplate jdbc;
    private final NeedOfferRepository needOffers;

    public ProjectRepository(NamedParameterJdbcTemplate jdbc, NeedOfferRepository needOffers) {
        this.jdbc = jdbc;
        this.needOffers = needOffers;
    }

    public long count(ProjectFilter filter) {
        CompanyFilterSql.Where w = ProjectFilterSql.build(filter);
        Long total = jdbc.queryForObject("SELECT count(*) FROM invest_project p " + w.sql(), w.params(), Long.class);
        return total == null ? 0 : total;
    }

    /** Страница списка; total — по тому же фильтру. */
    public ProjectPage findPage(ProjectFilter filter, ProjectSort sort, int page, int size) {
        long total = count(filter);
        long offset = (long) page * size;
        if (offset >= total) {
            return new ProjectPage(List.of(), total);
        }
        CompanyFilterSql.Where w = ProjectFilterSql.build(filter);
        MapSqlParameterSource params = w.params().addValue("limit", size).addValue("offset", offset);
        return new ProjectPage(query(SELECT + w.sql() + "\n" + sort.orderBy() + "\nLIMIT :limit OFFSET :offset", params), total);
    }

    public Optional<Project> findById(int id) {
        return query(SELECT + "WHERE p.id = :id", new MapSqlParameterSource("id", id)).stream().findFirst();
    }

    /** Все проекты под фильтром — для таймлайна (их десятки). */
    public List<Project> findAll(ProjectFilter filter) {
        CompanyFilterSql.Where w = ProjectFilterSql.build(filter);
        return query(SELECT + w.sql() + "\nORDER BY p.id", w.params());
    }

    public record ProjectPage(List<Project> items, long total) {
    }

    /** Проекты, изменённые строго после since (null — все), по updatedAt, затем id. Для notifier и экспорта. */
    public List<Project> findUpdatedSince(ProjectFilter filter, OffsetDateTime since) {
        CompanyFilterSql.Where w = ProjectFilterSql.build(filter);
        String sql = SELECT + w.sql();
        if (since != null) {
            sql += "\n  AND p.updated_at > :updatedSince";
            w.params().addValue("updatedSince", since);
        }
        return query(sql + "\nORDER BY p.updated_at, p.id", w.params());
    }

    private List<Project> query(String sql, MapSqlParameterSource params) {
        Map<String, List<String>> offers = needOffers.offersByNeed();
        return jdbc.query(sql, params, (rs, i) -> map(rs, offers));
    }

    // ---- маппинг ----

    private static Project map(ResultSet rs, Map<String, List<String>> offersByNeed) throws SQLException {
        String stage = rs.getString("stage");
        String industry = rs.getString("industry");
        List<String> needs = textArray(rs.getArray("needs"));
        BigDecimal amount = rs.getBigDecimal("amount_mln");
        return new Project(
                rs.getInt("id"),
                rs.getString("title"),
                rs.getString("initiator"),
                rs.getInt("municipality_id"),
                rs.getString("municipality_name"),
                rs.getDouble("lat"),
                rs.getDouble("lon"),
                rs.getBoolean("is_key"),
                rs.getString("curator"),
                rs.getObject("start_year", Integer.class),
                rs.getObject("launch_year", Integer.class),
                amount == null ? null : amount.doubleValue(),
                rs.getObject("jobs", Integer.class),
                stage,
                title(Stage.class, stage, "stage"),
                industry,
                title(Industry.class, industry, "industry"),
                needs,
                recommendedOffers(needs, offersByNeed),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }

    /** По needs проекта, в их порядке. Нет строки в need_offer — offers []; неизвестный код — пропуск и WARN. */
    static List<Project.RecommendedOffer> recommendedOffers(List<String> needs, Map<String, List<String>> offersByNeed) {
        List<Project.RecommendedOffer> result = new ArrayList<>();
        for (String code : needs) {
            Optional<Need> need = CodedEnum.find(Need.class, code);
            if (need.isEmpty()) {
                warnUnknown("needs", code);
                continue;
            }
            result.add(new Project.RecommendedOffer(code, need.get().title(), offersByNeed.getOrDefault(code, List.of())));
        }
        return result;
    }

    private static List<String> textArray(Array arr) throws SQLException {
        return arr == null ? List.of() : Arrays.asList((String[]) arr.getArray());
    }

    /** Название по коду; null-код → null; неизвестный код (ошибка ETL) → null и одно предупреждение, а не 500. */
    private static <E extends Enum<E> & CodedEnum> String title(Class<E> type, String code, String column) {
        if (code == null) {
            return null;
        }
        Optional<E> e = CodedEnum.find(type, code);
        if (e.isEmpty()) {
            warnUnknown(column, code);
        }
        return e.map(CodedEnum::title).orElse(null);
    }

    private static void warnUnknown(String column, String code) {
        if (warnedCodes.add(column + ":" + code)) {
            log.warn("В invest_project.{} неизвестный код '{}' — название будет null / услуга пропущена", column, code);
        }
    }
}
