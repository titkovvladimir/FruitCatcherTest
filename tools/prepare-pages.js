#!/usr/bin/env node
'use strict';

/**
 * Готовит собранную игру к публикации на GitHub Pages.
 *
 * Дело в одном файле — `.nojekyll`. Без него Pages прогоняет содержимое через
 * Jekyll, а тот молча не отдаёт ничего, что начинается с подчёркивания. Движок
 * раздаётся из `cocos-js/_virtual_cc-*.js`, то есть игра не запускается вовсе:
 * страница остаётся серой, а в консоли — 404 на файл, которого «нет».
 *
 * Скрипт существует потому, что сборка стирает папку целиком. Поставленный
 * руками `.nojekyll` не переживает следующую сборку, и забыть его — вопрос
 * времени, а не внимательности.
 *
 * Запуск: npm run pages
 */

const fs = require('fs');
const path = require('path');

const OUTPUT = path.resolve(__dirname, '..', 'build', 'web-mobile');

if (!fs.existsSync(path.join(OUTPUT, 'index.html'))) {
    console.error(`Сборки нет: ${OUTPUT}/index.html не найден.`);
    console.error('Сначала собрать игру, потом готовить к публикации.');
    process.exit(1);
}

fs.writeFileSync(path.join(OUTPUT, '.nojekyll'), '');
console.log('build/web-mobile готова к публикации: .nojekyll на месте.');
console.log('Дальше — содержимое этой папки в корень ветки gh-pages.');
