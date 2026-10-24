package ru.rt.radar.invest;

import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** Параметр контроллера типа {@link ProjectFilter} заполняется из query-строки через {@link ProjectFilterParser}. */
public class ProjectFilterArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return ProjectFilter.class.equals(parameter.getParameterType());
    }

    @Override
    public ProjectFilter resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                         NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        return ProjectFilterParser.parse(webRequest.getParameterMap());
    }
}
