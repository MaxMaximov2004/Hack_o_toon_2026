package ru.rt.radar.radar.filter;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.rt.radar.radar.filter.QueryString.filter;

class CompanyFilterSqlTest {

    @Test
    void defaultsOnlyActive() {
        CompanyFilterSql.Where w = CompanyFilterSql.build(CompanyFilter.defaults());
        assertThat(w.sql()).isEqualTo("WHERE c.status = 'active'");
        assertThat(w.params().getParameterNames()).isEmpty();
    }

    @Test
    void statusAllAndClientAllHaveNoConditions() {
        assertThat(CompanyFilterSql.build(filter("status=all")).sql()).isEqualTo("WHERE true");
    }

    @Test
    void clientModes() {
        assertThat(CompanyFilterSql.build(filter("client=ours&status=excluded")).sql())
                .contains("c.is_client = true").contains("c.status = 'excluded'");
        assertThat(CompanyFilterSql.build(filter("client=others")).sql()).contains("c.is_client = false");
    }

    @Test
    void onlyGivenConditionsAndNamedParams() {
        CompanyFilterSql.Where w = CompanyFilterSql.build(filter("industry=trade&industry=logistics&revenueMin=10"));
        assertThat(w.sql()).contains("c.industry = ANY(:industries)").contains("c.revenue_est >= :revenueMin")
                .doesNotContain("revenueMax").doesNotContain("lat").doesNotContain("ILIKE");
        assertThat((String[]) w.params().getValue("industries")).containsExactly("trade", "logistics");
        assertThat(w.params().getParameterNames()).containsExactlyInAnyOrder("industries", "revenueMin");
    }

    @Test
    void allConditions() {
        CompanyFilterSql.Where w = CompanyFilterSql.build(filter("client=ours&industry=it&revenueMin=1&revenueMax=2"
                + "&minLat=47&maxLat=48&minLon=39&maxLon=40&municipalityId=3&sizeCategory=small&growthMin=5"
                + "&isNew=true&q=abc"));
        assertThat(w.sql()).contains(
                "c.is_client = true", "c.status = 'active'", "c.industry = ANY(:industries)",
                "c.municipality_id = ANY(:municipalityIds)", "c.size_category = ANY(:sizes)",
                "c.revenue_est >= :revenueMin", "c.revenue_est <= :revenueMax", "c.revenue_growth_est >= :growthMin",
                "c.is_new = true", "c.lat BETWEEN :minLat AND :maxLat AND c.lon BETWEEN :minLon AND :maxLon",
                "c.name ILIKE '%' || :q || '%'", "c.inn LIKE :q || '%'");
        assertThat((Integer[]) w.params().getValue("municipalityIds")).containsExactly(3);
        assertThat((String[]) w.params().getValue("sizes")).containsExactly("small");
    }

    @Test
    void userValuesNeverInSql() {
        String injection = "x' OR 1=1 --";
        CompanyFilterSql.Where w = CompanyFilterSql.build(filter("q=" + injection.replace(" ", "%20")));
        assertThat(w.sql()).doesNotContain("OR 1=1");
        assertThat(w.params().getValue("q")).isEqualTo(injection);
    }

    @Test
    void likeEscaping() {
        assertThat(CompanyFilterSql.escapeLike("100%")).isEqualTo("100\\%");
        assertThat(CompanyFilterSql.escapeLike("a_b")).isEqualTo("a\\_b");
        assertThat(CompanyFilterSql.escapeLike("a\\b")).isEqualTo("a\\\\b");
    }
}
