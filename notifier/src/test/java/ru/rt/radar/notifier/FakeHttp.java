package ru.rt.radar.notifier;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;

/** Минимальный HTTP-сервер для тестов: вместо core-api и Telegram. Запоминает запросы. */
public final class FakeHttp {

    public record Request(String method, String path, String query, Map<String, List<String>> headers, String body) {
    }

    private final HttpServer server;
    private final Map<String, Function<Request, String>> routes = new ConcurrentHashMap<>();
    public final List<Request> requests = new CopyOnWriteArrayList<>();

    public FakeHttp() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Request r = new Request(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                    exchange.getRequestURI().getRawQuery(), exchange.getRequestHeaders(), body);
            requests.add(r);
            Function<Request, String> route = routes.get(r.path());
            byte[] out = (route == null ? "{}" : route.apply(r)).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(route == null ? 404 : 200, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();
    }

    public String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public FakeHttp on(String path, Function<Request, String> response) {
        routes.put(path, response);
        return this;
    }

    public List<Request> to(String path) {
        return requests.stream().filter(r -> r.path().equals(path)).toList();
    }
}
