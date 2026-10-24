package ru.rt.radar.radar.stats;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Чтение municipality_stats. Таблицу заполняет SQL-функция refresh_municipality_stats (ETL и импорт клиентов) —
 * формулы потенциала и белых пятен в Java не дублируются; здесь считается только coverage.
 */
@Repository
public class StatsRepository {

    private static final String FROM = """
            FROM municipality_stats s JOIN municipality m ON m.id = s.municipality_id
            WHERE s.industry = :industry
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public StatsRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<MunicipalityStats> stats(String industry) {
        String sql = """
                SELECT s.municipality_id, m.name, m.kind, m.lat, m.lon, s.industry, s.companies, s.clients,
                       s.excluded_clients, s.new_share, s.revenue_est_sum, s.potential_score, s.is_white_spot, s.reason
                """ + FROM + "ORDER BY s.potential_score DESC, m.name";
        return jdbc.query(sql, new MapSqlParameterSource("industry", industry), (rs, i) -> {
            int companies = rs.getInt("companies");
            int clients = rs.getInt("clients");
            BigDecimal revenue = rs.getBigDecimal("revenue_est_sum");
            return new MunicipalityStats(
                    rs.getInt("municipality_id"), rs.getString("name"), rs.getString("kind"),
                    rs.getDouble("lat"), rs.getDouble("lon"), rs.getString("industry"),
                    companies, clients, rs.getInt("excluded_clients"),
                    coverage(clients, companies),
                    rs.getDouble("new_share"),
                    revenue == null ? null : revenue.setScale(0, RoundingMode.HALF_UP).longValueExact(),
                    rs.getDouble("potential_score"),
                    rs.getBoolean("is_white_spot"),
                    rs.getString("reason"));
        });
    }

    public List<WhiteSpot> whiteSpots(String industry, int limit) {
        String sql = "SELECT s.municipality_id, m.name, m.lat, m.lon, s.potential_score, s.companies, s.clients, s.reason\n"
                + FROM + "  AND s.is_white_spot\nORDER BY s.potential_score DESC, m.name\nLIMIT :limit";
        return jdbc.query(sql, new MapSqlParameterSource("industry", industry).addValue("limit", limit),
                (rs, i) -> new WhiteSpot(
                        rs.getInt("municipality_id"), rs.getString("name"), rs.getDouble("lat"), rs.getDouble("lon"),
                        rs.getDouble("potential_score"), rs.getInt("companies"), rs.getInt("clients"),
                        rs.getString("reason")));
    }

    /** Охват района = клиенты / действующие компании, 4 знака. Нет компаний — 0. */
    static double coverage(int clients, int companies) {
        if (companies <= 0) {
            return 0.0;
        }
        return BigDecimal.valueOf(clients).divide(BigDecimal.valueOf(companies), 4, RoundingMode.HALF_UP).doubleValue();
    }
}
