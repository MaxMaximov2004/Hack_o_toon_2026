package ru.rt.radar.notifier;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

/**
 * Полный контекст на тестовом Postgres ({@link TestDb}) под notify_svc. Безопасность включена: пользователь задаётся
 * через {@link #user(long)} (JWT с sub). core-api — {@link #CORE}. Плановый воркер не мешает: интервал 1 час.
 */
@SpringBootTest(properties = {"radar.check-interval=1h", "radar.internal-token=test-internal-token"})
@AutoConfigureMockMvc
public abstract class DbWebTest {

    protected static final FakeHttp CORE = new FakeHttp();

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", TestDb::jdbcUrl);
        registry.add("spring.datasource.username", () -> TestDb.USER);
        registry.add("spring.datasource.password", () -> TestDb.PASSWORD);
        registry.add("radar.core-api-url", CORE::url);
    }

    @Autowired
    protected MockMvc mvc;

    @BeforeEach
    void cleanDb() {
        TestDb.reset();
        CORE.requests.clear();
    }

    protected static RequestPostProcessor user(long id) {
        return jwt().jwt(j -> j.subject(String.valueOf(id)));
    }
}
