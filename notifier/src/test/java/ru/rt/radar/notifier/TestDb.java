package ru.rt.radar.notifier;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.images.builder.Transferable;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

/** Один Postgres 16 на все тесты, со структурой из infra/db/init — как в docker compose (как TestDb в core-api). */
public final class TestDb {

    public static final String USER = "notify_svc";
    public static final String PASSWORD = "notify_dev";   // значение по умолчанию из 01_roles_and_schemas.sh

    private static final Path INIT = Path.of("..", "infra", "db", "init");
    private static final PostgreSQLContainer<?> PG = start();

    private TestDb() {
    }

    public static String jdbcUrl() {
        return PG.getJdbcUrl() + "&currentSchema=notify";
    }

    public static JdbcTemplate jdbc() {
        return new JdbcTemplate(new DriverManagerDataSource(jdbcUrl(), USER, PASSWORD));
    }

    public static void reset() {
        jdbc().execute("TRUNCATE notification, subscription, telegram_link, state RESTART IDENTITY CASCADE");
    }

    /** CRLF убираем: на Windows git может выдать .sh с CRLF, и bash его не запустит. */
    private static PostgreSQLContainer<?> start() {
        PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine")
                .withDatabaseName("radar").withUsername("postgres").withPassword("postgres_test");
        try (Stream<Path> files = Files.list(INIT)) {
            files.sorted().forEach(file -> {
                String name = file.getFileName().toString();
                try {
                    String text = Files.readString(file, StandardCharsets.UTF_8).replace("\r", "");
                    pg.withCopyToContainer(
                            Transferable.of(text.getBytes(StandardCharsets.UTF_8), name.endsWith(".sh") ? 0755 : 0644),
                            "/docker-entrypoint-initdb.d/" + name);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        } catch (IOException e) {
            throw new UncheckedIOException("Нет папки " + INIT.toAbsolutePath(), e);
        }
        pg.start();
        return pg;
    }
}
