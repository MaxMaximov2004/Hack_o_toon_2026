# notifier — сборка Maven -> рантайм только JRE. Порт 8083.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Сначала только pom: зависимости кэшируются отдельным слоем
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /src/target/notifier.jar app.jar
USER app
EXPOSE 8083
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
