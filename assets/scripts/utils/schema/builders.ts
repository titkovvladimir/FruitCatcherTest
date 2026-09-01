import { Infer, Schema, SchemaError } from './Schema';

/**
 * Из чего собирается описание формы данных.
 *
 * Читается описание как сам документ: `object({ speed: number({ min: 1 }) })`
 * стоит рядом с `{ "speed": 1800 }` и повторяет его строение. Проверка и тип
 * получаются из него оба — см. `Schema`.
 */

/** Границы числа, обе включительно. */
export interface NumberRange {
    readonly min?: number;
    readonly max?: number;
}

/** Поля объекта: имя поля — схема его значения. */
export type Fields = { readonly [name: string]: Schema<unknown> };

/** Разновидности размеченного объединения: значение метки — поля этой ветки. */
export type Variants = { readonly [name: string]: Fields };

type ObjectOf<F extends Fields> = { readonly [K in keyof F]: Infer<F[K]> };

/**
 * Собирает пересечение в один плоский объект.
 *
 * Без него тип ветки объединения показывался бы как `{ kind } & { amplitude,
 * period }` — читается хуже, а в подсказках редактора разъезжается на две
 * половины.
 */
type Flat<T> = { readonly [K in keyof T]: T[K] };

type VariantOf<K extends string, V extends Variants> = {
    [Name in Extract<keyof V, string>]: Flat<{ readonly [P in K]: Name } & ObjectOf<V[Name]>>;
}[Extract<keyof V, string>];

/** Непустая строка: пустой ключ типа или пустое имя картинки — всегда ошибка. */
export function string(): Schema<string> {
    return {
        parse(value: unknown, path: string): string {
            if (typeof value !== 'string' || value.length === 0) {
                throw SchemaError.expected(path, 'непустую строку', value);
            }
            return value;
        },
    };
}

export function number(range: NumberRange = {}): Schema<number> {
    return {
        parse(value: unknown, path: string): number {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw SchemaError.expected(path, 'число', value);
            }
            if (range.min !== undefined && value < range.min) {
                throw SchemaError.expected(path, `число не меньше ${range.min}`, value);
            }
            if (range.max !== undefined && value > range.max) {
                throw SchemaError.expected(path, `число не больше ${range.max}`, value);
            }
            return value;
        },
    };
}

/** Целое число: запас жизней дробным не бывает. */
export function integer(range: NumberRange = {}): Schema<number> {
    const inner = number(range);
    return {
        parse(value: unknown, path: string): number {
            const parsed = inner.parse(value, path);
            if (!Number.isInteger(parsed)) {
                throw SchemaError.expected(path, 'целое число', parsed);
            }
            return parsed;
        },
    };
}

/** Объект с известным набором полей. Лишние поля — ошибка, см. `unknownField`. */
export function object<F extends Fields>(fields: F): Schema<{ readonly [K in keyof F]: Infer<F[K]> }> {
    return {
        parse(value: unknown, path: string): ObjectOf<F> {
            return readFields(fields, asObject(value, path), path, []) as ObjectOf<F>;
        },
    };
}

export interface ArrayOptions<T> {
    /** Короче этого — ошибка: таблица типов из нуля строк означает пустую игру. */
    readonly min?: number;
    /** Поле, по которому элементы обязаны различаться. */
    readonly uniqueBy?: keyof T & string;
}

export function array<T>(item: Schema<T>, options: ArrayOptions<T> = {}): Schema<readonly T[]> {
    const min = options.min === undefined ? 0 : options.min;
    return {
        parse(value: unknown, path: string): readonly T[] {
            if (!Array.isArray(value)) {
                throw SchemaError.expected(path, 'массив', value);
            }
            if (value.length < min) {
                throw SchemaError.expected(path, `массив хотя бы из ${min}`, value);
            }
            const items = value.map((entry, index) => item.parse(entry, `${path}[${index}]`));
            if (options.uniqueBy !== undefined) {
                requireUnique(items, options.uniqueBy, path);
            }
            return items;
        },
    };
}

/**
 * Размеченное объединение: значение поля-метки решает, какие поля читать
 * дальше.
 *
 * Так описан способ падения: `{ "kind": "zigzag", "amplitude": 70 }`. В типе
 * получается такое же объединение, и `switch` по метке компилятор разбирает
 * сам — фабрике поведений не нужно ни одного приведения типа.
 */
export function variant<K extends string, V extends Variants>(tag: K, variants: V): Schema<VariantOf<K, V>> {
    const names = Object.keys(variants);
    return {
        parse(value: unknown, path: string): VariantOf<K, V> {
            const raw = asObject(value, path);
            const name = raw[tag];
            if (typeof name !== 'string' || names.indexOf(name) === -1) {
                throw SchemaError.expected(`${path}.${tag}`, `одно из: ${names.join(', ')}`, name);
            }
            // Метка кладётся первой: разобранная ветка читается в логе так же,
            // как записана в документе.
            const parsed: Record<string, unknown> = {};
            parsed[tag] = name;
            return readFields(variants[name], raw, path, [tag], parsed) as VariantOf<K, V>;
        },
    };
}

/**
 * Правило поверх схемы: то, что видно только на собранном значении.
 *
 * Каждое поле проверяется своей схемой, а «верхняя граница не ниже нижней» —
 * только когда прочитаны обе. Путь до поля знает правило, поэтому ошибку оно
 * бросает само.
 */
export function refine<T>(schema: Schema<T>, rule: (value: T, path: string) => void): Schema<T> {
    return {
        parse(value: unknown, path: string): T {
            const parsed = schema.parse(value, path);
            rule(parsed, path);
            return parsed;
        },
    };
}

function asObject(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw SchemaError.expected(path, 'объект', value);
    }
    return value as Record<string, unknown>;
}

/**
 * Читает описанные поля и ругается на неописанные.
 *
 * `extra` — имена, которые в документе законны, но схемой полей не заданы: для
 * ветки объединения это её метка.
 */
function readFields(
    fields: Fields,
    raw: Record<string, unknown>,
    path: string,
    extra: readonly string[],
    parsed: Record<string, unknown> = {},
): Record<string, unknown> {
    const names = Object.keys(fields);
    for (const name of names) {
        parsed[name] = fields[name].parse(raw[name], `${path}.${name}`);
    }
    for (const name of Object.keys(raw)) {
        if (names.indexOf(name) === -1 && extra.indexOf(name) === -1) {
            throw SchemaError.unknownField(`${path}.${name}`, names.concat(extra));
        }
    }
    return parsed;
}

/** Ловит опечатку в дубле: две строки таблицы с одним `id` — молчаливый баг. */
function requireUnique<T>(items: readonly T[], key: keyof T & string, path: string): void {
    const seen = new Set<unknown>();
    for (let i = 0; i < items.length; i += 1) {
        const value = items[i][key];
        if (seen.has(value)) {
            throw SchemaError.expected(`${path}[${i}].${key}`, 'значение, которого нет выше', value);
        }
        seen.add(value);
    }
}
