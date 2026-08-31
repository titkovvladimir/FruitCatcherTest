/**
 * Проверка содержимого конфигов.
 *
 * Ни импорт ассета, ни `strict` не проверяют в конфиге ни одного поля: первый
 * смотрит только синтаксис JSON, второго в рантайме не существует вовсе. Число
 * 999 в поле, ждущем от 1 до 10, доедет до игры целым, если его не встретить
 * здесь.
 *
 * Конфиг — наш собственный файл, и ошибка в нём это ошибка разработчика:
 * падаем громко и с путём до поля, игра не стартует. Это противоположность
 * политике для сохранений, где мусор в чужом браузере — обычная жизнь.
 *
 * Проверки написаны руками по тем полям, что реально есть. Генератор из
 * описания схемы придёт позже: пока схема меняется каждый час, он переписывался
 * бы вместе с ней.
 */

/** Ошибка конфига: в сообщении всегда есть путь до поля. */
export class ConfigError extends Error {
    constructor(path: string, expected: string, actual: unknown) {
        super(`${path}: ждали ${expected}, получили ${describe(actual)}`);
        this.name = 'ConfigError';
    }
}

function describe(value: unknown): string {
    if (value === undefined) return 'ничего — поля нет';
    if (value === null) return 'null';
    if (Array.isArray(value)) return `массив из ${value.length}`;
    if (typeof value === 'string') return `строку «${value}»`;
    if (typeof value === 'object') return 'объект';
    return `${typeof value} ${String(value)}`;
}

export function asObject(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ConfigError(path, 'объект', value);
    }
    return value as Record<string, unknown>;
}

export function asArray(value: unknown, path: string, minLength = 0): unknown[] {
    if (!Array.isArray(value)) {
        throw new ConfigError(path, 'массив', value);
    }
    if (value.length < minLength) {
        throw new ConfigError(path, `массив хотя бы из ${minLength}`, value);
    }
    return value;
}

export function asString(value: unknown, path: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new ConfigError(path, 'непустую строку', value);
    }
    return value;
}

export interface NumberRange {
    /** Нижняя граница включительно. */
    readonly min?: number;
    /** Верхняя граница включительно. */
    readonly max?: number;
}

export function asNumber(value: unknown, path: string, range: NumberRange = {}): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ConfigError(path, 'число', value);
    }
    if (range.min !== undefined && value < range.min) {
        throw new ConfigError(path, `число не меньше ${range.min}`, value);
    }
    if (range.max !== undefined && value > range.max) {
        throw new ConfigError(path, `число не больше ${range.max}`, value);
    }
    return value;
}

/** Целое число: число жизней или размер запаса дробным не бывает. */
export function asInteger(value: unknown, path: string, range: NumberRange = {}): number {
    const number = asNumber(value, path, range);
    if (!Number.isInteger(number)) {
        throw new ConfigError(path, 'целое число', number);
    }
    return number;
}

export function asOneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
    // indexOf, а не includes: проект компилируется под ES2015, includes оттуда не виден.
    if (typeof value !== 'string' || allowed.indexOf(value as T) === -1) {
        throw new ConfigError(path, `одно из: ${allowed.join(', ')}`, value);
    }
    return value as T;
}

/** Ловит опечатку в дубле: два типа предметов с одним `id` — это молчаливый баг. */
export function requireUnique(values: readonly string[], path: string): void {
    const seen = new Set<string>();
    for (const value of values) {
        if (seen.has(value)) {
            throw new ConfigError(path, 'неповторяющиеся значения', value);
        }
        seen.add(value);
    }
}
