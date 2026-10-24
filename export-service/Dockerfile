# export-service — сборка .NET SDK -> рантайм только ASP.NET. Порт 8082.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Сначала только проект: зависимости кэшируются отдельным слоем
COPY ExportService.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
USER app
EXPOSE 8082
ENTRYPOINT ["dotnet", "ExportService.dll"]
