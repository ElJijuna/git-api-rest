.PHONY: help install dev build start lint typecheck docker-build docker-run docker-up docker-down docker-logs clean

help:
	@echo "git-api-rest — Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install       Install dependencies"
	@echo "  make dev           Run API in watch mode (tsx)"
	@echo "  make build         Compile TypeScript + build UI"
	@echo "  make start         Run compiled output"
	@echo "  make lint          Run ESLint"
	@echo "  make typecheck     Type-check without emitting"
	@echo "  make ui-dev        Start UI dev server (proxies to API)"
	@echo "  make ui-mock       Start UI dev server with mock data"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build  Build Docker image"
	@echo "  make docker-run    Build and run locally"
	@echo "  make docker-up     Start with docker-compose"
	@echo "  make docker-down   Stop docker-compose"
	@echo "  make docker-logs   Follow docker-compose logs"
	@echo ""
	@echo "  make clean         Remove build artifacts"

install:
	npm install

dev:
	npm run dev

build:
	npm run build && npm run ui:build

start:
	npm run start

lint:
	npm run lint

typecheck:
	npm run typecheck

ui-dev:
	npm run ui:dev

ui-mock:
	npm run ui:dev:mock

docker-build:
	docker build -t git-api-rest:latest .

docker-run: docker-build
	docker run -p 3000:3000 \
		-v $(PWD)/repos.example.yml:/config/repos.yml:ro \
		-e REPOS_CONFIG_PATH=/config/repos.yml \
		-e NODE_ENV=production \
		git-api-rest:latest

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f git-api

clean:
	rm -rf dist ui/dist node_modules coverage

.DEFAULT_GOAL := help
