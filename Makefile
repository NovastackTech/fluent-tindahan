.PHONY: test test-frontend test-backend build lint

test:
	dotnet test FluentTindahan.sln
	npm --prefix frontend test -- --run

test-frontend:
	npm --prefix frontend test -- --run

test-backend:
	dotnet test FluentTindahan.sln

build:
	dotnet build FluentTindahan.sln
	npm --prefix frontend run build

lint:
	npm --prefix frontend run lint
