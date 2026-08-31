/** Чем кончился раунд. */
export type LevelEnding = 'time' | 'lives';

/**
 * Итог раунда — всё, что о нём нужно знать снаружи.
 *
 * Раунд отдаёт его и на этом свою роль заканчивает: про рекорды и историю
 * он не знает ничего, этим занимается мета.
 */
export interface LevelOutcome {
    readonly score: number;
    /** Сколько предметов поймано — и фруктов, и мухоморов. */
    readonly caught: number;
    /** Сколько улетело мимо корзины. */
    readonly missed: number;
    readonly livesLeft: number;
    readonly ending: LevelEnding;
}
