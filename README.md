# Dependency Radar для GitHub

[Открыть пример отчёта в Wiki](https://github.com/ErmachenkoBoris/dependency-radar-test/wiki/Radar-ermachenkoboris-7a39c29dee07)

В **Actions → Dependency Radar → Run workflow** укажите владельца публичных репозиториев и npm-пакеты через запятую. Сканер проверяет манифесты на зафиксированных коммитах и публикует в Wiki по одной таблице мажоров для каждого пакета. Ссылка «Проекты и манифесты» ведёт на артефакт этого запуска. Срок хранения артефакта — 14 дней.

Повторный запуск для того же аккаунта и набора пакетов обновляет ту же страницу. Во время сканирования job имеет только права чтения. Отдельный job с правом записи публикует сводку после успешного сканирования. При ошибках подробный отчёт доступен в артефактах запуска.

Для запуска в другом репозитории включите Wiki и один раз сохраните её первую страницу через GitHub. Workflow обновляет Markdown-файлы через Git. Публичные форки входят в выборку, архивные репозитории пропускаются.

## Локальная проверка

Из корня проекта на macOS или Linux, с Node.js 20+ и Git:

```sh
npm ci
npm run build
npm test
./node_modules/.bin/tsc -p testing/github
GITHUB_OWNER=ErmachenkoBoris DEPENDENCIES='@angular/core,typescript,react' node testing/github/.build/testing/github/run.js
```

Локальная команда сохраняет оба отчёта в `testing/github/report/`. Публикацию выполняет GitHub Actions.
