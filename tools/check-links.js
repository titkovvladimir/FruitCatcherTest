#!/usr/bin/env node
'use strict';

/**
 * Проверяет, что ссылки между документами ведут в существующие файлы.
 *
 * Зачем. Документы здесь — часть сдаваемого: план ссылается на решения, решения
 * на бэклог, README на всё сразу. Файл переехал — ссылка молчит, и находит её
 * читатель, а не автор.
 *
 * Код из проверки исключается. Примеры формата записываются в обратных кавычках
 * и в блоках кода, и выглядят они ровно как ссылки — но ведут в никуда нарочно.
 * Проверяльщик, который этого не понимает, ругается на здоровые документы; так
 * уже было.
 *
 * Запуск: npm run check-links
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'library', 'temp', 'build', 'profiles', '.idea', '.vscode']);

function markdownFiles(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) markdownFiles(full, found);
        else if (entry.name.endsWith('.md')) found.push(full);
    }
    return found;
}

/** Вырезает блоки кода и код-спаны, сохраняя разбивку на строки. */
function withoutCode(text) {
    const blanked = text
        .replace(/```[\s\S]*?```/g, block => block.replace(/[^\n]/g, ' '))
        .replace(/`[^`\n]*`/g, span => ' '.repeat(span.length));
    return blanked;
}

function lineOf(text, index) {
    return text.slice(0, index).split('\n').length;
}

const broken = [];
let checked = 0;

for (const file of markdownFiles(ROOT)) {
    const text = withoutCode(fs.readFileSync(file, 'utf8'));
    const dir = path.dirname(file);
    for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
        const target = match[1];
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        checked += 1;
        const resolved = path.resolve(dir, target.split('#')[0]);
        if (!fs.existsSync(resolved)) {
            broken.push({
                file: path.relative(ROOT, file).split(path.sep).join('/'),
                line: lineOf(text, match.index),
                target,
            });
        }
    }
}

if (broken.length > 0) {
    for (const link of broken) {
        console.error(`${link.file}:${link.line}: ссылка «${link.target}» ведёт в несуществующий файл`);
    }
    console.error(`\nБитых ссылок: ${broken.length}.`);
    process.exit(1);
}

console.log(`Ссылок между документами проверено: ${checked}. Все ведут в существующие файлы.`);
