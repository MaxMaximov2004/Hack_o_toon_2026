package ru.rt.radar.radar.map;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.rt.radar.radar.filter.CompanyFilter;
import ru.rt.radar.radar.filter.CompanyFilterSql;

import java.util.List;

/** Точки и кластеры карты. WHERE — из {@link CompanyFilterSql}, как у списка и экспорта. */
@Repository
public class MapRepository {

    private static final String POINTS = """
            SELECT c.id, round(c.lat::numeric, 5) AS lat, round(c.lon::numeric, 5) AS lon, %s AS kind
            FROM company c
            """.formatted(CompanyFilterSql.KIND);

    private static final String CELLS = """
            SELECT round(avg(c.lat)::numeric, 4) AS lat, round(avg(c.lon)::numeric, 4) AS lon,
                   count(*) AS total,
                   count(*) FILTER (WHERE c.is_client AND c.status = 'active')   AS ours,
                   count(*) FILTER (WHERE NOT c.is_client)                       AS others,
                   count(*) FILTER (WHERE c.is_client AND c.status = 'excluded') AS excluded
            FROM company c
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public MapRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PointsResponse.Point> points(CompanyFilter filter) {
        CompanyFilterSql.Where w = CompanyFilterSql.build(filter);
        return jdbc.query(POINTS + w.sql() + "\nORDER BY c.id", w.params(), (rs, i) -> new PointsResponse.Point(
                rs.getInt("id"), rs.getDouble("lat"), rs.getDouble("lon"), rs.getString("kind")));
    }

    public List<CellsResponse.Cell> cells(CompanyFilter filter, double cellDeg) {
        CompanyFilterSql.Where w = CompanyFilterSql.build(filter);
        w.params().addValue("cellDeg", cellDeg);
        String sql = CELLS + w.sql()
                + "\nGROUP BY floor(c.lat / :cellDeg), floor(c.lon / :cellDeg)"
                + "\nORDER BY total DESC, lat, lon";
        return jdbc.query(sql, w.params(), (rs, i) -> new CellsResponse.Cell(
                rs.getDouble("lat"), rs.getDouble("lon"),
                rs.getLong("total"), rs.getLong("ours"), rs.getLong("others"), rs.getLong("excluded")));
    }
}
