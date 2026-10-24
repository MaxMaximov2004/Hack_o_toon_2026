package ru.rt.radar.radar.filter;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import ru.rt.radar.TestDb;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.rt.radar.radar.filter.QueryString.filter;

/** CompanyFilterSql на настоящем Postgres 16 (infra/db/init) под core_svc. Данные — TestDb.resetStandardData(). */
class CompanyFilterSqlDbTest {

    static NamedParameterJdbcTemplate jdbc;

    @BeforeAll
    static void data() {
        TestDb.resetStandardData();
        jdbc = new NamedParameterJdbcTemplate(TestDb.coreDataSource());
    }

    private static long count(String query) {
        CompanyFilterSql.Where w = CompanyFilterSql.build(filter(query));
        Long n = jdbc.queryForObject("SELECT count(*) FROM company c " + w.sql(), w.params(), Long.class);
        return n == null ? -1 : n;
    }

    @ParameterizedTest(name = "[{0}] → {1}")
    @CsvSource(delimiter = '|', value = {
            "                                                         | 6",  // по умолчанию: все, действующие
            "client=all                                               | 6",
            "client=ours                                              | 2",
            "client=others                                            | 4",
            "status=excluded                                          | 2",
            "client=ours&status=excluded                              | 1",
            "status=all                                               | 8",
            "industry=logistics&industry=trade                        | 4",
            // выручка задана → «Гамма» без выручки отсекается
            "industry=logistics&revenueMin=10000000&revenueMax=100000000 | 1",
            "revenueMax=100000000                                     | 5",
            "minLat=47&maxLat=48&minLon=39&maxLon=40                  | 4",
            "minLat=47&maxLat=48&minLon=39&maxLon=40&status=all       | 5",
            "municipalityId=2                                         | 2",
            "municipalityId=1&municipalityId=2                        | 6",
            "sizeCategory=micro                                       | 5",
            "growthMin=10                                             | 2",
            "isNew=true                                               | 2",
            "isNew=false                                              | 6",
            "q=%D0%B0%D0%BB%D1%8C%D1%84%D0%B0                         | 1",  // «альфа» — регистр не важен
            "q=6100000006                                             | 1",  // начало ИНН
            "q=61000000                                               | 6",
            "q=00000002                                               | 0",  // ИНН — только с начала
            "q=_1&status=all                                          | 1",  // «_» буквально, не любой символ
            "q=%25%25&status=all                                      | 0",  // «%%» буквально
            "q=100%25&status=all                                      | 1",
    })
    void counts(String query, long expected) {
        assertThat(count(query == null ? "" : query)).isEqualTo(expected);
    }

    @Test
    void kindExpression() {
        var kinds = jdbc.getJdbcTemplate().queryForList(
                "SELECT c.inn || ':' || " + CompanyFilterSql.KIND + " FROM company c ORDER BY c.inn", String.class);
        assertThat(kinds).containsExactly(
                "6100000001:ours", "6100000002:others", "610000000301:others", "6100000004:excluded",
                "6100000005:others", "610000000601:ours", "6100000007:others", "6100000008:others");
    }
}
