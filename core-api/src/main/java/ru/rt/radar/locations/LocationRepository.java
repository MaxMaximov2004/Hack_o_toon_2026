package ru.rt.radar.locations;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.rt.radar.radar.filter.CompanyFilterSql;

import java.math.BigDecimal;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * company_location — фактические места ведения бизнеса. Связь с компанией — по ИНН, без FK: ETL пересоздаёт company,
 * а адреса, введённые людьми, должны пережить перезагрузку. Место регистрации в таблицу не пишем — оно в company.
 */
@Repository
public class LocationRepository {

    static final String ACTUAL = "actual";

    private static final RowMapper<CompanyLocations.Actual> ACTUAL_MAPPER = (rs, i) -> new CompanyLocations.Actual(
            rs.getLong("id"), rs.getString("municipality_name"), rs.getString("region_name"), rs.getString("address"),
            rs.getObject("lat", Double.class), rs.getObject("lon", Double.class), rs.getString("source"),
            rs.getBigDecimal("confidence").doubleValue(), rs.getString("note"),
            rs.getObject("created_at", OffsetDateTime.class).toInstant());

    private final NamedParameterJdbcTemplate jdbc;

    public LocationRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Компания по id: ИНН, место регистрации и relocated — тем же выражением, что фильтр. */
    public Optional<CompanyRef> company(int id) {
        return jdbc.query("""
                SELECT c.inn, m.name AS municipality_name, c.settlement, c.lat, c.lon, %s AS relocated
                FROM company c JOIN municipality m ON m.id = c.municipality_id
                WHERE c.id = :id
                """.formatted(CompanyFilterSql.RELOCATED), new MapSqlParameterSource("id", id), (rs, i) -> new CompanyRef(
                rs.getString("inn"),
                new CompanyLocations.Registered(rs.getString("municipality_name"), rs.getString("settlement"),
                        rs.getDouble("lat"), rs.getDouble("lon")),
                rs.getBoolean("relocated"))).stream().findFirst();
    }

    public List<CompanyLocations.Actual> actual(String inn) {
        return jdbc.query("""
                SELECT id, municipality_name, region_name, address, lat, lon, source, confidence, note, created_at
                FROM company_location WHERE inn = :inn AND kind = 'actual'
                ORDER BY created_at DESC, id DESC
                """, new MapSqlParameterSource("inn", inn), ACTUAL_MAPPER);
    }

    public Optional<CompanyLocations.Actual> find(long id, String inn) {
        return jdbc.query("""
                SELECT id, municipality_name, region_name, address, lat, lon, source, confidence, note, created_at
                FROM company_location WHERE id = :id AND inn = :inn AND kind = 'actual'
                """, new MapSqlParameterSource("id", id).addValue("inn", inn), ACTUAL_MAPPER).stream().findFirst();
    }

    /**
     * Новое фактическое место. skipDuplicate = true (импорт): точный повтор уже сохранённого — то же место, адрес и
     * источник — не добавляется, и тогда результат пустой. Ручной ввод менеджера дубли не проверяет.
     */
    public Optional<CompanyLocations.Actual> insert(String inn, Place place, String address, String source,
                                                    BigDecimal confidence, String note, boolean skipDuplicate) {
        String guard = skipDuplicate ? """
                WHERE NOT EXISTS (SELECT 1 FROM company_location l
                                  WHERE l.inn = :inn AND l.kind = 'actual' AND l.source = :source
                                    AND l.municipality_name IS NOT DISTINCT FROM :municipalityName
                                    AND l.region_name IS NOT DISTINCT FROM :regionName
                                    AND l.address IS NOT DISTINCT FROM :address)
                """ : "";
        return jdbc.query("""
                INSERT INTO company_location (inn, kind, municipality_name, region_name, address, lat, lon, source,
                                              confidence, note)
                SELECT :inn, 'actual', :municipalityName, :regionName, :address, :lat, :lon, :source, :confidence, :note
                """ + guard + """
                RETURNING id, municipality_name, region_name, address, lat, lon, source, confidence, note, created_at
                """, new MapSqlParameterSource()
                .addValue("inn", inn)
                .addValue("municipalityName", place.municipalityName(), Types.VARCHAR)
                .addValue("regionName", place.regionName(), Types.VARCHAR)
                .addValue("address", address, Types.VARCHAR)
                .addValue("lat", place.lat(), Types.DOUBLE)
                .addValue("lon", place.lon(), Types.DOUBLE)
                .addValue("source", source)
                .addValue("confidence", confidence)
                .addValue("note", note, Types.VARCHAR), ACTUAL_MAPPER).stream().findFirst();
    }

    public void delete(long id) {
        jdbc.update("DELETE FROM company_location WHERE id = :id", new MapSqlParameterSource("id", id));
    }

    /** Какие ИНН из списка есть в реестре. */
    public List<String> existingInns(String[] inns) {
        return jdbc.queryForList("SELECT inn FROM company WHERE inn = ANY(:inns)",
                new MapSqlParameterSource("inns", inns), String.class);
    }

    public record CompanyRef(String inn, CompanyLocations.Registered registered, boolean relocated) {
    }

    /** Где: район/город области (с центроидом) или другой регион (без координат). */
    public record Place(String municipalityName, String regionName, Double lat, Double lon) {
    }
}
