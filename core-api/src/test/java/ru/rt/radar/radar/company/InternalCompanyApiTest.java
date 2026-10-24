package ru.rt.radar.radar.company;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.MvcResult;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /internal/companies — потоковая выгрузка для export-service. */
class InternalCompanyApiTest extends DbWebTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @BeforeAll
    static void data() {
        TestDb.resetStandardData();
        TestDb.insertBulk(3000, true);
    }

    /** Поток: запрос уходит в async — дожидаемся и забираем тело. */
    private String stream(String url) throws Exception {
        MvcResult started = mvc.perform(get(URI.create(url))).andExpect(request().asyncStarted()).andReturn();
        return mvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private JsonNode streamJson(String url) throws Exception {
        return JSON.readTree(stream(url));
    }

    private long companiesTotal(String filter) throws Exception {
        String body = mvc.perform(get(URI.create("/api/companies?size=1&" + filter))).andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("total").asLong();
    }

    @Test
    void matchesContractExample() throws Exception {
        ContractShape.assertMatches("companies-internal.json", stream("/internal/companies?status=all&municipalityId=2"));
    }

    @ParameterizedTest(name = "[{0}]")
    @ValueSource(strings = {
            "",
            "client=ours&status=excluded",
            "client=others&industry=services&revenueMin=10000000&revenueMax=50000000",
            "minLat=47.1&maxLat=47.3&minLon=39.2&maxLon=39.8",
            "status=all&q=%D1%81%D0%B8%D0%BD%D1%82%D0%B5%D1%82%D0%B8%D0%BA%D0%B0%201",   // «синтетика 1»
    })
    void sameCountAsListAndSortedByNameThenId(String filter) throws Exception {
        JsonNode arr = streamJson("/internal/companies?" + filter);
        assertThat(arr.isArray()).isTrue();
        assertThat((long) arr.size()).isEqualTo(companiesTotal(filter)).isPositive();

        List<JsonNode> items = new ArrayList<>();
        arr.forEach(items::add);
        // порядок name, id — как в БД (collation может отличаться от Java), поэтому сверяем с запросом в БД
        List<Integer> expectedIds = TestDb.jdbc().queryForList(
                "SELECT id FROM company WHERE id = ANY(?) ORDER BY name, id", Integer.class,
                (Object) items.stream().map(i -> i.get("id").asInt()).toArray(Integer[]::new));
        assertThat(items.stream().map(i -> i.get("id").asInt()).toList()).isEqualTo(expectedIds);
    }

    @Test
    void fullCompanyFields() throws Exception {
        JsonNode arr = streamJson("/internal/companies?status=all&q=6100000001");
        assertThat(arr.size()).isEqualTo(1);
        JsonNode c = arr.get(0);
        assertThat(c.get("inn").asText()).isEqualTo("6100000001");
        assertThat(c.get("ogrn").asText()).isEqualTo("1196196012345");
        assertThat(c.get("kind").asText()).isEqualTo("ours");
        assertThat(c.get("revenueEst").isIntegralNumber()).isTrue();
        assertThat(c.get("registeredAt").asText()).isEqualTo("2019-07-10");
        assertThat(c.has("website")).isTrue();
        assertThat(c.get("website").isNull()).isTrue();
    }

    @Test
    void emptyResultIsEmptyArray() throws Exception {
        assertThat(stream("/internal/companies?q=%D0%BD%D0%B5%D1%82%D1%82%D0%B0%D0%BA%D0%BE%D0%B9")).isEqualTo("[]");
    }

    @Test
    void ignoresForeignParams() throws Exception {
        // C# пробрасывает исходную строку, убрав только format — лишнее не мешает
        assertThat(streamJson("/internal/companies?client=ours&page=3&sort=name&zoom=7").size())
                .isEqualTo((int) companiesTotal("client=ours"));
    }

    @Test
    void limitBoundary() throws Exception {
        long total = companiesTotal("client=ours");
        assertThat(streamJson("/internal/companies?client=ours&limit=" + total).size()).isEqualTo((int) total);

        mvc.perform(get("/internal/companies?client=ours&limit=" + (total - 1)))
                .andExpect(request().asyncNotStarted())
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.error.code").value("TOO_LARGE"))
                .andExpect(jsonPath("$.error.message").value(
                        "Компаний по фильтру: " + total + ", лимит выгрузки: " + (total - 1) + " — сузьте фильтр"))
                .andExpect(jsonPath("$.error.details.total").value(total))
                .andExpect(jsonPath("$.error.details.limit").value(total - 1))
                .andExpect(jsonPath("$[0]").doesNotExist());
    }

    @Test
    void defaultLimitIs100000() throws Exception {
        // 3008 строк ≤ 100 000 по умолчанию
        assertThat(streamJson("/internal/companies?status=all").size()).isEqualTo(3008);
    }

    @ParameterizedTest(name = "{0} → 400 field={1}")
    @CsvSource(delimiter = '|', value = {
            "limit=0       | limit",
            "limit=100001  | limit",
            "limit=abc     | limit",
            "client=false  | client",
            "minLat=47     | maxLat",
    })
    void invalidParams(String query, String field) throws Exception {
        mvc.perform(get("/internal/companies?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value(field))
                .andExpect(jsonPath("$.error.details.total").doesNotExist());
    }

    @Test
    void swaggerDescribesEndpoint() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/internal/companies'].get.parameters[*].name",
                        org.hamcrest.Matchers.hasItems("limit", "client", "status", "industry", "q")))
                .andExpect(jsonPath("$.paths['/internal/companies'].get.responses['413']").exists());
    }
}
