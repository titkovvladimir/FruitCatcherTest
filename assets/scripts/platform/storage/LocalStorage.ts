import { IStorage } from './IStorage';

/**
 * Хранилище поверх `localStorage` браузера.
 *
 * Каждый вызов обёрнут в `try`, и это не перестраховка: в приватном режиме
 * Safari обращение к `localStorage` бросает, а в браузере с запрещёнными куками
 * его может не быть вовсе. Игре от этого падать нечего — рекорд просто не
 * переживёт вкладку.
 */
export class LocalStorage implements IStorage {
    read(key: string): string | null {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    write(key: string, value: string): void {
        try {
            window.localStorage.setItem(key, value);
        } catch {
            // Некуда писать — не пишем. Причина в консоль не идёт: это не
            // поломка игры, а свойство браузера, и повторится она на каждом
            // раунде.
        }
    }
}
