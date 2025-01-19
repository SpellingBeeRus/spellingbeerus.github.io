# BeeSpelling

Игра для тренировки правописания слов. Слушайте произношение слова и пишите его правильно!

## Особенности

- Воспроизведение аудио с произношением слов
- Таймер на основе длительности аудио
- Подсчет правильных ответов подряд (streak)
- Возможность остановки воспроизведения
- Адаптивный дизайн

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/your-username/beespelling.git
cd beespelling
```

2. Установите зависимости:
```bash
npm install
```

3. Добавьте аудио файлы:
Поместите аудио файлы в формате MP3 в папку `public/audio/`. Имена файлов должны соответствовать путям, указанным в `src/services/wordService.ts`.

4. Запустите приложение:
```bash
npm run dev
```

## Деплой

### GitHub Pages

1. Установите gh-pages:
```bash
npm install --save-dev gh-pages
```

2. Добавьте скрипты в package.json:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

3. Выполните деплой:
```bash
npm run deploy
```

### Railway.app

1. Создайте аккаунт на Railway.app
2. Установите Railway CLI:
```bash
npm i -g @railway/cli
```

3. Залогиньтесь:
```bash
railway login
```

4. Создайте новый проект:
```bash
railway init
```

5. Деплой:
```bash
railway up
```

## Технологии

- React
- TypeScript
- Material-UI
- Vite

## Структура проекта

```
beespelling/
├── public/
│   └── audio/          # Аудио файлы
├── src/
│   ├── services/       # Сервисы
│   ├── App.tsx         # Основной компонент
│   ├── App.css         # Стили
│   └── main.tsx        # Точка входа
└── README.md
```

## Лицензия

MIT
