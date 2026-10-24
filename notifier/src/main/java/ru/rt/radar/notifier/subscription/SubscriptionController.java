package ru.rt.radar.notifier.subscription;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.notifier.common.exception.NotFoundException;

import java.util.List;

import static ru.rt.radar.notifier.common.util.LogPatterns.SUBSCRIPTION_NOT_FOUND;

@RestController
@Tag(name = "Подписки")
public class SubscriptionController {

    private final SubscriptionRepository subscriptions;

    public SubscriptionController(SubscriptionRepository subscriptions) {
        this.subscriptions = subscriptions;
    }

    @GetMapping("/api/subscriptions")
    @Operation(summary = "Мои подписки, новые сверху")
    public List<Subscription> list(@AuthenticationPrincipal Jwt jwt) {
        return subscriptions.findByUser(userId(jwt));
    }

    @PostMapping("/api/subscriptions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Подписаться на новые проекты",
            description = "Хотя бы одно из industry, municipalityId, need, stage; совпадать должны все заполненные. Иначе 400.")
    public Subscription create(@AuthenticationPrincipal Jwt jwt, @RequestBody SubscriptionRequest request) {
        request.validate();
        return subscriptions.insert(userId(jwt), request);
    }

    @DeleteMapping("/api/subscriptions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Отписаться", description = "Чужая или несуществующая подписка — 404.")
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        if (!subscriptions.delete(userId(jwt), id)) {
            throw new NotFoundException(String.format(SUBSCRIPTION_NOT_FOUND, id));
        }
    }

    /** Пользователь — sub из JWT auth-service (числовой id из auth.users). */
    public static long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
