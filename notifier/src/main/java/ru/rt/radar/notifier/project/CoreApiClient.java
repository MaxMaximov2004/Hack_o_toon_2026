package ru.rt.radar.notifier.project;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;
import ru.rt.radar.notifier.common.exception.UpstreamUnavailableException;

import java.net.URI;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

import static ru.rt.radar.notifier.common.security.InternalTokenFilter.HEADER;
import static ru.rt.radar.notifier.common.util.LogPatterns.CORE_API_UNAVAILABLE;

/** core-api по HTTP — в схему core notifier не ходит. Сосед не ответил за 5 с — исключение, воркер повторит позже. */
@Component
public class CoreApiClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final ParameterizedTypeReference<List<ProjectEvent>> PROJECTS = new ParameterizedTypeReference<>() {
    };

    private final RestClient http;

    public CoreApiClient(@Value("${radar.core-api-url}") String baseUrl,
                         @Value("${radar.internal-token:}") String internalToken,
                         RestClient.Builder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT);
        factory.setReadTimeout(TIMEOUT);
        this.http = builder.baseUrl(baseUrl).requestFactory(factory).defaultHeader(HEADER, internalToken).build();
    }

    /** Проекты, изменённые после since (null — все), по возрастанию updatedAt. */
    public List<ProjectEvent> projectsUpdatedSince(OffsetDateTime since) {
        try {
            List<ProjectEvent> result = http.get()
                    .uri(b -> uri(b, since))
                    .retrieve()
                    .body(PROJECTS);
            return result == null ? List.of() : result;
        } catch (RestClientException e) {
            throw new UpstreamUnavailableException(String.format(CORE_API_UNAVAILABLE, e.getMessage()), e);
        }
    }

    private static URI uri(UriBuilder b, OffsetDateTime since) {
        b.path("/internal/projects");
        if (since != null) {
            b.queryParam("updatedSince", since.toString());
        }
        return b.build();
    }
}
