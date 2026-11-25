# Dependency Radar · GitHub dry run

Выложите содержимое автономной тестовой папки в корень отдельного репозитория GitHub, включая скрытый каталог `.github`. В основной ветке должен появиться файл `.github/workflows/dependency-radar-dry-run.yml`. В **Actions → Dependency Radar dry run → Run workflow** укажите GitHub-аккаунт и список npm-имён через запятую.

Workflow читает только публичные репозитории указанного владельца, включая форки. Архивные проекты пропускаются. Временные bare-копии используют дерево одного коммита ветки по умолчанию. Git скачивает содержимое выбранных манифестов по требованию. Скрипты из проверяемых репозиториев не запускаются. Токен для сканирования не нужен.

В **Artifacts → dependency-radar-github** лежат `summary.md` и `projects.md`. В каждой таблице сводки знаменатель равен количеству публичных активных репозиториев. В подробном отчёте ссылки ведут на конкретные коммиты. При частичной проверке workflow сохраняет отчёт и отмечает запуск как неуспешный.

## Локальный запуск

Из корня проекта на macOS или Linux, с Node.js 20+ и Git:

```sh
npm ci
npm run build
npm test
./node_modules/.bin/tsc -p testing/github
GITHUB_OWNER=ErmachenkoBoris DEPENDENCIES='@angular/core,typescript,react' node testing/github/.build/testing/github/run.js
```

Результат появится в `testing/github/report/`. Сканер, обработка диапазонов, подсчёт проектов и Markdown общие с GitLab. Для GitHub заменены только получение списка репозиториев, чтение дерева и файлов, построение ссылок и сохранение результата.
