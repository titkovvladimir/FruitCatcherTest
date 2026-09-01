import { asArray, asNumber, asObject, asOneOf, asString, requireUnique } from './checks';

/**
 * Как предмет летит. Траектория привязана к типу: банан всегда виляет, арбуз
 * всегда разгоняется — игрок узнаёт поведение по картинке, а не гадает.
 */
export type FallConfig =
    | { readonly kind: 'uniform' }
    | { readonly kind: 'zigzag'; readonly amplitude: number; readonly period: number }
    | { readonly kind: 'accelerated'; readonly acceleration: number };

/** Один тип падающего предмета: и фрукт, и мухомор описываются одной строкой. */
export interface FallingItemConfig {
    /** Ключ типа; он же имя в логах и в ошибках конфига. */
    readonly id: string;
    /** Имя картинки: по нему предмет находит свой спрайт. */
    readonly texture: string;
    /**
     * Половина ширины предмета. Одно число задаёт и размер на экране, и форму
     * для разбора ловли — двум числам разъехаться тогда негде.
     */
    readonly radius: number;
    /** Очки за поимку. */
    readonly score: number;
    /**
     * Что поимка делает с запасом жизней: у фруктов ноль, у мухомора минус
     * один. Только вниз: жизнь, которую фрукт дарит, — отдельная механика, а не
     * знак числа, и пока её нет.
     */
    readonly lifeChange: number;
    /** Вес в случайном выборе типа: чем больше, тем чаще появляется. */
    readonly weight: number;
    /** Скорость снижения, точек в секунду. */
    readonly speed: number;
    readonly fall: FallConfig;
}

/**
 * Насколько далеко предмет уходит вбок от точки появления.
 *
 * Нужно тому, кто выбирает эту точку: у зигзага размах прибавляется к
 * половине ширины, иначе банан уезжал бы за край поля. Знание это про правила
 * падения, а не про сцену, поэтому живёт здесь, а не в спавнере.
 */
export function horizontalReach(config: FallingItemConfig): number {
    return config.fall.kind === 'zigzag' ? config.radius + config.fall.amplitude : config.radius;
}

/**
 * Разбирает таблицу типов. Первый аргумент — то, что вернул источник конфигов,
 * то есть `unknown`: доверять ему нельзя, пока не проверено каждое поле.
 */
export function readFallingItems(raw: unknown, source = 'falling-items'): FallingItemConfig[] {
    const entries = asArray(raw, source, 1);
    const items = entries.map((entry, index) => readItem(entry, `${source}[${index}]`));
    requireUnique(items.map(item => item.id), `${source}[].id`);
    return items;
}

function readItem(raw: unknown, path: string): FallingItemConfig {
    const entry = asObject(raw, path);
    return {
        id: asString(entry.id, `${path}.id`),
        texture: asString(entry.texture, `${path}.texture`),
        radius: asNumber(entry.radius, `${path}.radius`, { min: 1 }),
        score: asNumber(entry.score, `${path}.score`, { min: 0 }),
        lifeChange: asNumber(entry.lifeChange, `${path}.lifeChange`, { min: -3, max: 0 }),
        weight: asNumber(entry.weight, `${path}.weight`, { min: 0.001 }),
        speed: asNumber(entry.speed, `${path}.speed`, { min: 1 }),
        fall: readFall(entry.fall, `${path}.fall`),
    };
}

function readFall(raw: unknown, path: string): FallConfig {
    const fall = asObject(raw, path);
    const kind = asOneOf(fall.kind, `${path}.kind`, ['uniform', 'zigzag', 'accelerated'] as const);
    switch (kind) {
        case 'uniform':
            return { kind };
        case 'zigzag':
            return {
                kind,
                amplitude: asNumber(fall.amplitude, `${path}.amplitude`, { min: 1 }),
                period: asNumber(fall.period, `${path}.period`, { min: 0.1 }),
            };
        case 'accelerated':
            return {
                kind,
                acceleration: asNumber(fall.acceleration, `${path}.acceleration`, { min: 1 }),
            };
    }
}
