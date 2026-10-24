package ru.rt.radar;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** Полный контекст Spring на тестовом Postgres ({@link TestDb}) под core_svc, как у сервиса. */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class DbWebTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", TestDb::coreJdbcUrl);
        registry.add("spring.datasource.username", () -> TestDb.CORE_USER);
        registry.add("spring.datasource.password", () -> TestDb.CORE_PASSWORD);
    }

    @Autowired
    protected MockMvc mvc;
}
