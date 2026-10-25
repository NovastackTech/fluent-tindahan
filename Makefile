.PHONY: test test-frontend test-backend build lint

test:
	dotnet test FluentTindahan.slnx
	npm --prefix frontend test -- --run

test-frontend:
	npm --prefix frontend test -- --run

test-backend:
	dotnet test FluentTindahan.slnx

build:
	dotnet build FluentTindahan.slnx
	npm --prefix frontend run build

lint:
	npm --prefix frontend run lint
