package ru.rt.radar.clients;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * POST /api/clients/import на стандартном наборе TestDb: клиенты — 1, 6 (действующие) и 4 (исключён из реестра).
 * Роль admin проверяет SecurityTest; здесь фильтры безопасности выключены (DbWebTest).
 */
class ClientImportApiTest extends DbWebTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @BeforeEach
    void data() {
        TestDb.resetStandardData();
        TestDb.jdbc().queryForObject("SELECT refresh_municipality_stats()", Integer.class);
    }

    private ResultActions upload(String csv, String mode) throws Exception {
        var request = multipart("/api/clients/import")
                .file(new MockMultipartFile("file", "clients.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)));
        if (mode != null) {
            request.param("mode", mode);
        }
        return mvc.perform(request);
    }

    private static List<String> clients() {
        return TestDb.jdbc().queryForList("SELECT inn FROM company WHERE is_client ORDER BY inn", String.class);
    }

    @Test
    void appendMarksFoundAndReportsNotFound() throws Exception {
        upload("inn\n6100000002\n6100000004\n123\n9999999999\n", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows").value(4))
                .andExpect(jsonPath("$.matched").value(2))
                .andExpect(jsonPath("$.notFound", contains("9999999999", "123")))
                .andExpect(jsonPath("$.mode").value("append"));
        // прежние клиенты остались, добавился 2; 4 уже был клиентом
        assertThat(clients()).containsExactly("6100000001", "6100000002", "6100000004", "610000000601");
    }

    @Test
    void replaceKeepsOnlyFileAndNeverTouchesStatus() throws Exception {
        upload("6100000002\n6100000004\n", "replace")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows").value(2))
                .andExpect(jsonPath("$.matched").value(2))
                .andExpect(jsonPath("$.mode").value("replace"));
        assertThat(clients()).containsExactly("6100000002", "6100000004");
        // статус определяет реестр: исключённый остаётся исключённым, действующий — действующим
        assertThat(TestDb.jdbc().queryForList("SELECT inn || ':' || status FROM company ORDER BY inn", String.class))
                .contains("6100000004:excluded", "6100000002:active", "6100000007:excluded");
    }

    @Test
    void leadingZeroRestored() throws Exception {
        TestDb.jdbc().update("""
                INSERT INTO company (inn, name, subject_type, industry, municipality_id, lat, lon, size_category)
                VALUES ('0100000009', 'ООО "НОЛЬ"', 'legal', 'it', 1, 47.2, 39.7, 'micro')""");
        upload("ИНН\n100000009\n", null)
                .andExpect(jsonPath("$.matched").value(1))
                .andExpect(jsonPath("$.notFound.length()").value(0));
        assertThat(clients()).contains("0100000009");
    }

    /** Пересчёт той же функцией, что ETL: районы сходятся со списком компаний, whiteSpots — из функции. */
    @Test
    void statsRecalculatedAndConsistent() throws Exception {
        String body = upload("inn\n6100000002\n6100000005\n6100000008\n", null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int whiteSpots = JSON.readTree(body).get("whiteSpots").asInt();
        Integer inDb = TestDb.jdbc().queryForObject(
                "SELECT count(*)::int FROM municipality_stats WHERE industry = 'all' AND is_white_spot", Integer.class);
        assertThat(whiteSpots).isEqualTo(inDb);

        JsonNode stats = JSON.readTree(mvc.perform(get("/api/municipalities/stats"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        assertThat(stats.size()).isPositive();
        for (JsonNode s : stats) {
            int m = s.get("municipalityId").asInt();
            long listed = JSON.readTree(mvc.perform(get("/api/companies?size=1&client=ours&municipalityId=" + m))
                    .andReturn().getResponse().getContentAsString()).get("total").asLong();
            assertThat(s.get("clients").asLong()).as("клиенты района %d", m).isEqualTo(listed);
        }
        // район 1: были клиентами 1; стали 1, 2, 8 → 3 действующих клиента
        assertThat(TestDb.jdbc().queryForObject(
                "SELECT clients FROM municipality_stats WHERE municipality_id = 1 AND industry = 'all'", Integer.class))
                .isEqualTo(3);
    }

    @Test
    void notFoundCappedAt100() throws Exception {
        String csv = "inn\n" + IntStream.range(0, 150).mapToObj(i -> String.valueOf(7000000000L + i))
                .collect(Collectors.joining("\n"));
        upload(csv, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows").value(150))
                .andExpect(jsonPath("$.matched").value(0))
                .andExpect(jsonPath("$.notFound.length()").value(100));
    }

    @Test
    void emptyOrNoValidInnIs400AndNothingChanges() throws Exception {
        List<String> before = clients();
        for (String csv : List.of("", "inn\n", "inn\nабв\n12\n")) {
            upload(csv, "replace")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.error.details.field").value("file"));
        }
        assertThat(clients()).isEqualTo(before);   // replace с плохим файлом не снял клиентов
    }

    @Test
    void badModeIs400() throws Exception {
        upload("6100000002\n", "merge")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details.field").value("mode"));
    }

    @Test
    void missingFilePartIs400() throws Exception {
        mvc.perform(multipart("/api/clients/import").param("mode", "append"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details.field").value("file"));
    }

    @Test
    void notMultipartIs415NotServerError() throws Exception {
        mvc.perform(post("/api/clients/import").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void swagger() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/clients/import'].post").exists());
    }
}
