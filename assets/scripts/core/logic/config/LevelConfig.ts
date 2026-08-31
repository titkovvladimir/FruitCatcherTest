import { SpawnPlan } from '../spawn/SpawnPlan';
import { asInteger, asNumber, asObject } from './checks';

/**
 * Настройки одного уровня. Отличие лёгкого от тяжёлого целиком здесь: кода,
 * который знал бы про сложность, в игре нет.
 */
export interface LevelConfig {
    /** Длина раунда в секундах. */
    readonly duration: number;
    /** Запас жизней на раунд. */
    readonly lives: number;
    /**
     * Потолок шага времени, секунд.
     *
     * Вкладку свернули, ноутбук уснул, кадр залип — между кадрами набежит
     * сколько угодно. Без потолка предметы за один кадр перепрыгнули бы поле
     * целиком, а таймер отсчитал бы полраунда.
     */
    readonly maxStep: number;
    readonly spawn: SpawnPlan;
}

export function readLevel(raw: unknown, source = 'level'): LevelConfig {
    const level = asObject(raw, source);
    const spawn = asObject(level.spawn, `${source}.spawn`);
    const minInterval = asNumber(spawn.minInterval, `${source}.spawn.minInterval`, { min: 0.01 });
    return {
        duration: asNumber(level.duration, `${source}.duration`, { min: 1 }),
        lives: asInteger(level.lives, `${source}.lives`, { min: 1 }),
        maxStep: asNumber(level.maxStep, `${source}.maxStep`, { min: 0.01, max: 1 }),
        spawn: {
            minInterval,
            maxInterval: asNumber(spawn.maxInterval, `${source}.spawn.maxInterval`, { min: minInterval }),
        },
    };
}
