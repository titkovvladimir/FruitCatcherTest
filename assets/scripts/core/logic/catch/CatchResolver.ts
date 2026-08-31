/** Что стало с предметом за один шаг времени. */
export type CatchVerdict = 'flying' | 'caught' | 'missed';

/**
 * Проём корзины: горизонтальная линия, через которую предмет попадает внутрь.
 *
 * Все три числа — свойства узла в сцене, и приходят они снаружи. Правила игры
 * ни ширины корзины, ни её положения не выдумывают.
 */
export interface BasketMouth {
    /** Высота линии проёма. */
    readonly y: number;
    /** Середина проёма по горизонтали. */
    readonly centerX: number;
    /** Половина ширины проёма. */
    readonly halfWidth: number;
}

/** Где предмет был в прошлом шаге и где оказался в этом. */
export interface ItemMotion {
    readonly x: number;
    readonly y: number;
    readonly previousY: number;
    /** Половина высоты и ширины предмета — его форма целиком. */
    readonly radius: number;
}

/**
 * Пойман ли предмет.
 *
 * Проверяется не наложение прямоугольников, а пересечение отрезка движения
 * с линией проёма. Разница принципиальная: наложение пропускает быстрый
 * предмет, который за кадр перескочил корзину целиком, а пересечение отрезка
 * ловит его при любой скорости и любом шаге времени. Ровно ради этого обычно
 * и включают физику — здесь хватает одного сравнения.
 *
 * Через линию переходит не центр предмета, а его нижний край: предмет попадает
 * в корзину тогда, когда в неё вошло его дно.
 *
 * Попадание по горизонтали — центр предмета над проёмом. Случай, когда предмет
 * задел проём краем, сейчас считается пролётом; отскок от бортика — отдельная
 * работа, и появится он именно здесь.
 */
export function resolveCatch(item: ItemMotion, mouth: BasketMouth, floorY: number): CatchVerdict {
    const previousBottom = item.previousY - item.radius;
    const bottom = item.y - item.radius;
    const crossedMouth = previousBottom > mouth.y && bottom <= mouth.y;
    if (crossedMouth && Math.abs(item.x - mouth.centerX) <= mouth.halfWidth) {
        return 'caught';
    }
    return item.y + item.radius < floorY ? 'missed' : 'flying';
}
