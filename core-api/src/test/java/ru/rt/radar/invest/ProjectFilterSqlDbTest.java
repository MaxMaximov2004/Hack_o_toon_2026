package ru.rt.radar.invest;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import ru.rt.radar.TestDb;
import ru.rt.radar.radar.filter.CompanyFilterSql;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** ProjectFilterSql на настоящем Postgres (infra/db/init) под core_svc. Данные — TestDb.resetStandardDataWithProjects(). */
class ProjectFilterSqlDbTest {

    static NamedParameterJdbcTemplate jdbc;

    @BeforeAll
    static void data() {
        TestDb.resetStandardDataWithProjects();
        jdbc = new NamedParameterJdbcTemplate(TestDb.coreDataSource());
    }

    @ParameterizedTest(name = "[{0}] → {1}")
    @CsvSource(delimiter = '|', value = {
            "                                        | 1,2,3,4,5",
            "stage=construction                      | 1,2",
            "stage=launch&stage=design               | 3,5",
            "industry=logistics                      | 1,5",
            "need=apcs                               | 2",
            "need=it_infra&need=info_security        | 1,2,4,5",     // хотя бы одна из выбранных
            "municipalityId=2                        | 3,4",
            "yearFrom=2027                           | 2,4",         // идёт после 2027 или год неизвестен
            "yearTo=2020                             | 4,5",
            "yearFrom=2025&yearTo=2025               | 1,2,3,4,5",
            "yearFrom=2027&yearTo=2027               | 2,4",
            "isKey=true                              | 1,5",
            "isKey=false                             | 1,2,3,4,5",
            "amountMin=1000                          | 1,2,3",       // объём null отсекается
            "q=%D0%B7%D0%B0%D0%B2%D0%BE%D0%B4        | 2",           // «завод» — в названии, без учёта регистра
            "q=%D0%B7%D0%B5%D1%82%D0%B0              | 2",           // «зета» — в инициаторе
            "q=100%25                                | 4",           // «%» буквально
            "q=_1                                    | 5",           // «_» буквально
            "industry=logistics&isKey=true&need=it_infra | 1,5",
    })
    void ids(String query, String expected) {
        CompanyFilterSql.Where w = ProjectFilterSql.build(ProjectFilterParserTest.filter(query == null ? "" : query));
        List<Integer> ids = jdbc.queryForList("SELECT p.id FROM invest_project p " + w.sql() + " ORDER BY p.id",
                w.params(), Integer.class);
        assertThat(ids.stream().map(String::valueOf).toList()).containsExactly(expected.split(","));
    }
}
