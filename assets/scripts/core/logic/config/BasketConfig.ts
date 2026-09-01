import { number, object } from '../../../utils/schema/builders';
import { Infer } from '../../../utils/schema/Schema';

/**
 * Настройки корзины.
 *
 * Размеров здесь нет: и ширина корзины, и линия проёма — свойства узлов сцены,
 * которые читаются в рантайме. В конфиге живёт только то, что настраивают на
 * ощупь.
 */
const BASKET = object({
    /**
     * Наибольшая скорость корзины, точек в секунду.
     *
     * Корзина едет к цели в тике, а не прыгает в обработчике мыши: иначе
     * скорость движения зависела бы от частоты событий ввода, то есть от мыши
     * игрока, а не от игры.
     */
    speed: number({ min: 1 }),
    /** Ближе этого расстояния корзина просто встаёт в цель, чтобы не дрожать. */
    snapDistance: number({ min: 0, max: 50 }),
});

export type BasketConfig = Infer<typeof BASKET>;

export function readBasket(raw: unknown, source = 'basket'): BasketConfig {
    return BASKET.parse(raw, source);
}
