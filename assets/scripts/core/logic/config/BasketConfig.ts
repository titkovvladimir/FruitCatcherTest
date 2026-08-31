import { asNumber, asObject } from './checks';

/**
 * Настройки корзины.
 *
 * Размеров здесь нет: и ширина корзины, и линия проёма — свойства узлов сцены,
 * которые читаются в рантайме. В конфиге живёт только то, что настраивают на
 * ощупь.
 */
export interface BasketConfig {
    /**
     * Наибольшая скорость корзины, точек в секунду.
     *
     * Корзина едет к цели в тике, а не прыгает в обработчике мыши: иначе
     * скорость движения зависела бы от частоты событий ввода, то есть от мыши
     * игрока, а не от игры.
     */
    readonly speed: number;
    /** Ближе этого расстояния корзина просто встаёт в цель, чтобы не дрожать. */
    readonly snapDistance: number;
}

export function readBasket(raw: unknown, source = 'basket'): BasketConfig {
    const basket = asObject(raw, source);
    return {
        speed: asNumber(basket.speed, `${source}.speed`, { min: 1 }),
        snapDistance: asNumber(basket.snapDistance, `${source}.snapDistance`, { min: 0, max: 50 }),
    };
}
