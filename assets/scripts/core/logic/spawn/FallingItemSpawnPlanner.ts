import { RandomSource } from '../../../utils/random/RandomSource';
import { FallingItemConfig } from '../config/FallingItemConfig';
import { SpawnPlan } from './SpawnPlan';

/** Заказ на появление предмета: что появилось и где по ширине полосы. */
export interface SpawnOrder {
    readonly item: FallingItemConfig;
    /**
     * Место по ширине полосы спавна: 0 — левый край, 1 — правый.
     *
     * Доля, а не координата, нарочно. Ширина полосы — свойство узла сцены, а
     * этот слой про сцену не знает вовсе; превращает долю в координату тот, кто
     * кладёт предмет на поле.
     */
    readonly position: number;
}

/**
 * Решает, что и когда появится. Узлов, спрайтов и пула не касается — этим
 * занимается спавнер в слое компонентов.
 *
 * За тик отдаётся не больше одного заказа: шаг времени в игре зажат сверху, и
 * при разумных интервалах два предмета в один кадр — не густота, а лаг.
 */
export class FallingItemSpawnPlanner {
    private readonly totalWeight: number;
    private timeToNext = 0;
    private lastPrize: number | null = null;

    constructor(
        private readonly items: readonly FallingItemConfig[],
        private readonly plan: SpawnPlan,
        private readonly random: RandomSource,
        /** Насколько мухомор тянет к месту последней добычи; 0 — не тянет. */
        private readonly dangerProximity = 0,
    ) {
        if (items.length === 0) {
            throw new Error('FallingItemSpawnPlanner: таблица типов пуста, появляться нечему');
        }
        if (plan.minInterval <= 0 || plan.maxInterval < plan.minInterval) {
            throw new Error(`FallingItemSpawnPlanner: интервал ${plan.minInterval}..${plan.maxInterval} не годится`);
        }
        this.totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        this.reset();
    }

    /** Начало раунда: отсчёт до первого предмета начинается заново. */
    reset(): void {
        this.timeToNext = this.nextInterval();
        this.lastPrize = null;
    }

    tick(dt: number): SpawnOrder | null {
        this.timeToNext -= dt;
        if (this.timeToNext > 0) {
            return null;
        }
        this.timeToNext += this.nextInterval();
        const item = this.pickItem();
        return { item, position: this.positionFor(item) };
    }

    /**
     * Где предмет выйдет по ширине полосы.
     *
     * Добыча выходит где придётся и запоминает своё место. То, что обнуляет
     * серию, тянется к этому месту тем сильнее, чем выше близость уровня: на
     * лёгкой мухомор почти независим, на тяжёлой выходит почти оттуда же, где
     * только что вышел фрукт, — и взять фрукт, не задев мухомор, становится
     * отдельной задачей.
     */
    private positionFor(item: FallingItemConfig): number {
        const position = this.random.next();
        if (item.combo !== 'reset') {
            if (item.combo === 'grow') {
                this.lastPrize = position;
            }
            return position;
        }
        if (this.lastPrize === null || this.dangerProximity === 0) {
            return position;
        }
        return position + (this.lastPrize - position) * this.dangerProximity;
    }

    private nextInterval(): number {
        const { minInterval, maxInterval } = this.plan;
        return minInterval + this.random.next() * (maxInterval - minInterval);
    }

    /** Выбор по весам: чем больше вес типа, тем чаще он выпадает. */
    private pickItem(): FallingItemConfig {
        let roll = this.random.next() * this.totalWeight;
        for (const item of this.items) {
            roll -= item.weight;
            if (roll < 0) {
                return item;
            }
        }
        // Сюда приводит только накопленная ошибка сложения дробных весов.
        return this.items[this.items.length - 1];
    }
}
