package ru.rt.radar.locations;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.ResultActions;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * locations/ на стандартном наборе TestDb. Компания 6 (ИП Зета, ИНН 610000000601) зарегистрирована в «Тестовый р-н».
 * Роли проверяет SecurityTest; здесь фильтры безопасности выключены, admin для удаления — через SecurityContextHolder.
 */
class LocationApiTest extends DbWebTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @BeforeEach
    void data() {
        TestDb.resetStandardData();
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private ResultActions add(int companyId, String json) throws Exception {
        return mvc.perform(post("/api/companies/" + companyId + "/locations")
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private long addId(int companyId, String json) throws Exception {
        String body = add(companyId, json).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JSON.readTree(body).get("id").asLong();
    }

    private ResultActions upload(String csv) throws Exception {
        return mvc.perform(multipart("/api/locations/import")
                .file(new MockMultipartFile("file", "crm.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8))));
    }

    private static int locationsCount() {
        return TestDb.jdbc().queryForObject("SELECT count(*)::int FROM company_location", Integer.class);
    }

    // ---- GET ----

    @Test
    void registeredOnlyAtStart() throws Exception {
        mvc.perform(get("/api/companies/6/locations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registered.municipalityName").value("Тестовый р-н"))
                .andExpect(jsonPath("$.registered.settlement").value(nullValue()))
                .andExpect(jsonPath("$.registered.lat").value(46.53))
                .andExpect(jsonPath("$.actual.length()").value(0))
                .andExpect(jsonPath("$.relocated").value(false));
    }

    @Test
    void matchesContractExample() throws Exception {
        addId(6, "{\"municipalityName\":\"г. Тестоград\",\"address\":\"ул. Ленина, 1\",\"note\":\"офис\"}");
        addId(6, "{\"regionName\":\"Краснодарский край\"}");
        ContractShape.assertMatches("locations.json",
                mvc.perform(get("/api/companies/6/locations")).andReturn().getResponse().getContentAsString());
    }

    // ---- POST: сценарий «Сальск → Азов» ----

    @Test
    void managerAddsOtherMunicipalityCompanyBecomesRelocated() throws Exception {
        add(6, "{\"municipalityName\":\"г. Тестоград\",\"address\":\"ул. Ленина, 1\",\"note\":\"офис и склад\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.municipalityName").value("г. Тестоград"))
                .andExpect(jsonPath("$.regionName").value(nullValue()))
                .andExpect(jsonPath("$.lat").value(47.2))                  // центр муниципалитета
                .andExpect(jsonPath("$.lon").value(39.7))
                .andExpect(jsonPath("$.source").value("manager"))
                .andExpect(jsonPath("$.confidence").value(0.8))
                .andExpect(jsonPath("$.note").value("офис и склад"));
        mvc.perform(get("/api/companies/6/locations"))
                .andExpect(jsonPath("$.relocated").value(true))
                .andExpect(jsonPath("$.actual[0].address").value("ул. Ленина, 1"));
        mvc.perform(get("/api/companies?relocated=true")).andExpect(jsonPath("$.items[*].id", contains(6)));
        mvc.perform(get("/api/companies/6")).andExpect(jsonPath("$.relocated").value(true));
    }

    @Test
    void sameMunicipalityIsNotRelocatedAndNameIsCaseInsensitive() throws Exception {
        add(6, "{\"municipalityName\":\"ТЕСТОВЫЙ Р-Н\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.municipalityName").value("Тестовый р-н"));   // как в справочнике
        mvc.perform(get("/api/companies/6/locations")).andExpect(jsonPath("$.relocated").value(false));
    }

    @Test
    void otherRegionWithoutCoordinates() throws Exception {
        add(6, "{\"regionName\":\"Краснодарский край\",\"address\":\"Краснодар, ул. Красная, 10\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.municipalityName").value(nullValue()))
                .andExpect(jsonPath("$.regionName").value("Краснодарский край"))
                .andExpect(jsonPath("$.lat").value(nullValue()));
        mvc.perform(get("/api/companies/6/locations")).andExpect(jsonPath("$.relocated").value(true));
    }

    @ParameterizedTest(name = "{0} → 400 field={1}")
    @CsvSource(delimiter = '|', value = {
            "{}                                                           | municipalityName",
            "{\"address\":\"ул. Мира\"}                                     | municipalityName",
            "{\"municipalityName\":\"г. Тестоград\",\"regionName\":\"Крым\"} | regionName",
            "{\"municipalityName\":\"Нет такого р-н\"}                      | municipalityName",
    })
    void invalidBody(String json, String field) throws Exception {
        add(6, json)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value(field));
        assertThat(locationsCount()).isZero();
    }

    @Test
    void tooLongAddressAndMissingBody() throws Exception {
        add(6, "{\"regionName\":\"Крым\",\"address\":\"" + "а".repeat(501) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details.field").value("address"));
        mvc.perform(post("/api/companies/6/locations").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownCompanyIs404() throws Exception {
        mvc.perform(get("/api/companies/999999/locations")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        add(999999, "{\"regionName\":\"Крым\"}").andExpect(status().isNotFound());
    }

    // ---- DELETE ----

    @Test
    void managerDeletesManualEntry() throws Exception {
        long id = addId(6, "{\"regionName\":\"Крым\"}");
        mvc.perform(delete("/api/companies/6/locations/" + id)).andExpect(status().isNoContent());
        assertThat(locationsCount()).isZero();
    }

    @Test
    void managerCannotDeleteCrmEntryAdminCan() throws Exception {
        upload("inn;municipality;region;address;source\n610000000601;г. Тестоград;;;crm\n").andExpect(status().isOk());
        long id = TestDb.jdbc().queryForObject("SELECT id FROM company_location", Long.class);

        mvc.perform(delete("/api/companies/6/locations/" + id))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.details").value(nullValue()));
        assertThat(locationsCount()).isEqualTo(1);

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        mvc.perform(delete("/api/companies/6/locations/" + id)).andExpect(status().isNoContent());
        assertThat(locationsCount()).isZero();
    }

    @Test
    void deleteOtherCompanysLocationIs404() throws Exception {
        long id = addId(6, "{\"regionName\":\"Крым\"}");
        mvc.perform(delete("/api/companies/1/locations/" + id)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/companies/6/locations/999999")).andExpect(status().isNotFound());
        assertThat(locationsCount()).isEqualTo(1);
    }

    // ---- импорт CSV ----

    @Test
    void importReportsMatchedNotFoundInvalid() throws Exception {
        String csv = """
                inn;municipality;region;address;source
                610000000601;г. Тестоград;;ул. Мира, 5;crm
                6100000002;;Краснодарский край;;EGRUL
                6100000099;г. Тестоград;;;
                6100000001;Нет такого;;;
                abc;г. Тестоград;;;
                6100000005;;;;
                """;
        upload(csv)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows").value(6))
                .andExpect(jsonPath("$.matched").value(2))
                .andExpect(jsonPath("$.notFound", contains("6100000099")))
                .andExpect(jsonPath("$.invalid", contains(
                        "строка 5: неизвестный район или город «Нет такого»",
                        "строка 6: ИНН «abc» — нужно 10 или 12 цифр",
                        "строка 7: не указан ни район области, ни регион")));
        assertThat(TestDb.jdbc().queryForList(
                "SELECT inn || ':' || source || ':' || confidence FROM company_location ORDER BY inn", String.class))
                .containsExactly("6100000002:egrul:0.70", "610000000601:crm:0.90");
        // повторная загрузка того же файла не плодит дубли
        upload(csv).andExpect(jsonPath("$.matched").value(2));
        assertThat(locationsCount()).isEqualTo(2);
        mvc.perform(get("/api/companies?relocated=true&status=all")).andExpect(jsonPath("$.items[*].id", contains(6, 2)));
    }

    @Test
    void importWithoutHeaderUsesColumnOrderAndCrmByDefault() throws Exception {
        upload("610000000601;г. Тестоград\n").andExpect(status().isOk())
                .andExpect(jsonPath("$.rows").value(1))
                .andExpect(jsonPath("$.matched").value(1));
        assertThat(TestDb.jdbc().queryForObject("SELECT source FROM company_location", String.class)).isEqualTo("crm");
    }

    @Test
    void importEmptyIs400AndNotMultipartIs415() throws Exception {
        upload("").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.details.field").value("file"));
        upload("inn;municipality\n").andExpect(status().isBadRequest());
        mvc.perform(post("/api/locations/import").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnsupportedMediaType());
    }

    // ---- переживает перезагрузку ETL ----

    @Test
    void survivesEtlReloadBecauseLinkedByInn() throws Exception {
        addId(6, "{\"municipalityName\":\"г. Тестоград\"}");
        // ETL пересоздаёт компанию: та же ИНН, новый id
        TestDb.jdbc().update("DELETE FROM company WHERE id = 6");
        TestDb.jdbc().update("""
                INSERT INTO company (inn, name, subject_type, industry, municipality_id, lat, lon, size_category, is_client)
                VALUES ('610000000601', 'ИП Зета', 'ip', 'agro', 2, 46.53, 41.53, 'micro', true)""");
        int newId = TestDb.jdbc().queryForObject("SELECT id FROM company WHERE inn = '610000000601'", Integer.class);
        assertThat(newId).isNotEqualTo(6);
        mvc.perform(get("/api/companies/" + newId + "/locations"))
                .andExpect(jsonPath("$.actual.length()").value(1))
                .andExpect(jsonPath("$.relocated").value(true));
    }

    @Test
    void swagger() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/companies/{id}/locations'].get").exists())
                .andExpect(jsonPath("$.paths['/api/companies/{id}/locations'].post").exists())
                .andExpect(jsonPath("$.paths['/api/companies/{id}/locations/{locationId}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/locations/import'].post").exists());
    }
}
