# Fluent Tindahan — Backend (.NET 8 Web API)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY backend/src/FluentTindahan.Domain/FluentTindahan.Domain.csproj FluentTindahan.Domain/
COPY backend/src/FluentTindahan.Application/FluentTindahan.Application.csproj FluentTindahan.Application/
COPY backend/src/FluentTindahan.Infrastructure/FluentTindahan.Infrastructure.csproj FluentTindahan.Infrastructure/
COPY backend/src/FluentTindahan.WebApi/FluentTindahan.WebApi.csproj FluentTindahan.WebApi/

RUN dotnet restore FluentTindahan.WebApi/FluentTindahan.WebApi.csproj

COPY backend/src/FluentTindahan.Domain/ FluentTindahan.Domain/
COPY backend/src/FluentTindahan.Application/ FluentTindahan.Application/
COPY backend/src/FluentTindahan.Infrastructure/ FluentTindahan.Infrastructure/
COPY backend/src/FluentTindahan.WebApi/ FluentTindahan.WebApi/

WORKDIR /src/FluentTindahan.WebApi
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0

COPY --from=build /app/publish .

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

USER app
ENTRYPOINT ["dotnet", "FluentTindahan.WebApi.dll"]
