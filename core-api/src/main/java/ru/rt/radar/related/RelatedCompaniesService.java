package ru.rt.radar.related;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import ru.rt.radar.common.exception.NotFoundException;
import ru.rt.radar.radar.company.Company;
import ru.rt.radar.radar.company.CompanyRepository;

import java.util.ArrayList;
import java.util.List;

/**
 * Кому продавать вокруг инвестпроекта (docs/tz/08-product2-contract.md): инициатор, найденный в реестре по названию,
 * и до 20 действующих компаний той же отрасли в том же районе — сначала не клиенты.
 */
@Service
public class RelatedCompaniesService {

    static final int SAME_AREA_LIMIT = 20;
    /** Кандидатов по LIKE берём с запасом: дальше точное сравнение нормализованных названий. */
    private static final int CANDIDATES_LIMIT = 200;

    private static final String CANDIDATES = """
            WHERE translate(lower(c.name), 'ё', 'е') LIKE :pattern
            ORDER BY c.id
            LIMIT %d
            """.formatted(CANDIDATES_LIMIT);

    private static final String SAME_AREA = """
            WHERE c.status = 'active' AND c.industry = :industry AND c.municipality_id = :municipalityId AND c.id <> :exclude
            ORDER BY c.is_client, c.revenue_est DESC NULLS LAST, c.id
            LIMIT %d
            """.formatted(SAME_AREA_LIMIT);

    private final NamedParameterJdbcTemplate jdbc;
    private final CompanyRepository companies;

    public RelatedCompaniesService(NamedParameterJdbcTemplate jdbc, CompanyRepository companies) {
        this.jdbc = jdbc;
        this.companies = companies;
    }

    public RelatedCompanies find(int projectId) {
        Project p = jdbc.query("SELECT initiator, industry, municipality_id FROM invest_project WHERE id = :id",
                        new MapSqlParameterSource("id", projectId),
                        (rs, i) -> new Project(rs.getString("initiator"), rs.getString("industry"), rs.getInt("municipality_id")))
                .stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Проект " + projectId + " не найден"));

        List<RelatedCompanies.Item> items = new ArrayList<>();
        Company initiator = findInitiator(p);
        if (initiator != null) {
            items.add(new RelatedCompanies.Item(initiator.toShort(), RelatedCompanies.INITIATOR));
        }
        if (p.industry() == null) {
            return new RelatedCompanies(projectId, items, 0, null);
        }

        MapSqlParameterSource area = new MapSqlParameterSource()
                .addValue("industry", p.industry())
                .addValue("municipalityId", p.municipalityId())
                .addValue("exclude", initiator == null ? -1 : initiator.id());
        companies.findWhere(SAME_AREA, area)
                .forEach(c -> items.add(new RelatedCompanies.Item(c.toShort(), RelatedCompanies.SAME_AREA_INDUSTRY)));
        Long total = jdbc.queryForObject("""
                SELECT count(*) FROM company
                WHERE status = 'active' AND industry = :industry AND municipality_id = :municipalityId
                """, area, Long.class);
        String radarQuery = "industry=" + p.industry() + "&municipalityId=" + p.municipalityId();
        return new RelatedCompanies(projectId, items, total == null ? 0 : total, radarQuery);
    }

    /** Совпадение нормализованных названий; несколько — берём из района проекта; иначе не угадываем. */
    private Company findInitiator(Project p) {
        String target = InitiatorName.normalize(p.initiator());
        String token = InitiatorName.longestToken(target);
        if (token == null) {
            return null;
        }
        String pattern = "%" + token.replace("\\", "\\\\").replace("_", "\\_").replace("%", "\\%") + "%";
        List<Company> matches = companies.findWhere(CANDIDATES, new MapSqlParameterSource("pattern", pattern)).stream()
                .filter(c -> InitiatorName.normalize(c.name()).equals(target))
                .toList();
        if (matches.size() > 1) {
            matches = matches.stream().filter(c -> c.municipalityId() == p.municipalityId()).toList();
        }
        return matches.size() == 1 ? matches.get(0) : null;
    }

    private record Project(String initiator, String industry, int municipalityId) {
    }
}
