#!/usr/bin/env node
'use strict';

/**
 * Проверяет, что все свои компоненты, на которые ссылаются сцены и префабы,
 * действительно существуют.
 *
 * Зачем. Сцена здесь пишется текстом, и ссылка на свой компонент записывается
 * не uuid ассета, а идентификатором класса. Ошибка в нём молчит: сборка
 * проходит с нулевым кодом возврата, компонент из собранной сцены просто
 * исчезает, а в логе редактора остаётся жалоба подсчёта статистики, на поломку
 * не похожая. Найти это глазами почти нельзя — поэтому проверка машинная.
 *
 * Как. Идентификатор класса выводится из uuid скрипта: первые пять
 * шестнадцатеричных символов как есть, остальные двадцать семь — по три в два
 * символа base64. Скрипты собираются из `assets/scripts`, ссылки — из всех
 * сцен и префабов, дальше сверка.
 *
 * Запуск: node tools/check-scene.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Идентификатор класса так, как его считает движок при регистрации скрипта. */
function classIdOf(uuid) {
    const hex = uuid.replace(/-/g, '');
    if (hex.length !== 32) return null;
    let id = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) {
        const value = parseInt(hex.slice(i, i + 3), 16);
        id += BASE64_KEYS[value >> 6] + BASE64_KEYS[value & 0x3f];
    }
    return id;
}

function walk(dir, match, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, match, found);
        else if (match(entry.name)) found.push(full);
    }
    return found;
}

function relative(file) {
    return path.relative(ROOT, file).split(path.sep).join('/');
}

/** Скрипты проекта: идентификатор класса → имя класса и файл. */
function collectScripts() {
    const known = new Map();
    const notImported = [];
    const scripts = path.join(ASSETS, 'scripts');
    if (!fs.existsSync(scripts)) return { known, notImported };

    for (const file of walk(scripts, name => name.endsWith('.ts'))) {
        const source = fs.readFileSync(file, 'utf8');
        const declared = /@ccclass\(['"]([^'"]+)['"]\)/.exec(source);
        if (declared === null) continue;

        const meta = `${file}.meta`;
        if (!fs.existsSync(meta)) {
            notImported.push({ name: declared[1], file: relative(file) });
            continue;
        }
        const id = classIdOf(JSON.parse(fs.readFileSync(meta, 'utf8')).uuid);
        if (id !== null) known.set(id, { name: declared[1], file: relative(file) });
    }
    return { known, notImported };
}

/** Ссылки на свои компоненты во всех сценах и префабах. */
function collectReferences() {
    const used = [];
    for (const file of walk(ASSETS, name => name.endsWith('.scene') || name.endsWith('.prefab'))) {
        const objects = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(objects)) continue;
        objects.forEach((object, index) => {
            const type = object && object.__type__;
            if (typeof type === 'string' && !type.startsWith('cc.')) {
                used.push({ id: type, file: relative(file), index });
            }
        });
    }
    return used;
}

const { known, notImported } = collectScripts();
const used = collectReferences();

const broken = used.filter(reference => !known.has(reference.id));

for (const script of notImported) {
    console.warn(`предупреждение: ${script.file} (${script.name}) ещё не импортирован — ссылаться на него нельзя`);
}

if (broken.length > 0) {
    for (const reference of broken) {
        console.error(`${reference.file}: объект ${reference.index} ссылается на «${reference.id}» — такого класса в проекте нет`);
    }
    console.error(`\nСломанных ссылок: ${broken.length}. Компоненты с ними из собранной сцены исчезнут молча.`);
    process.exit(1);
}

const names = [...new Set(used.map(reference => known.get(reference.id).name))].sort();
console.log(`Сцен и префабов проверено: ${new Set(used.map(r => r.file)).size}`);
console.log(`Ссылок на свои компоненты: ${used.length} — ${names.join(', ')}`);
console.log('Все ссылки разрешились.');
