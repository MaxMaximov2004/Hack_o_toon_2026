package ru.rt.radar.radar.filter;

import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** Параметр контроллера типа {@link CompanyFilter} заполняется из query-строки через {@link CompanyFilterParser}. */
public class CompanyFilterArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return CompanyFilter.class.equals(parameter.getParameterType());
    }

    @Override
    public CompanyFilter resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                         NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        return CompanyFilterParser.parse(webRequest.getParameterMap());
    }
}
