import { integer, number, object, refine } from '../../../utils/schema/builders';
import { Infer, Schema, SchemaError } from '../../../utils/schema/Schema';
import { SpawnPlan } from '../spawn/SpawnPlan';

/**
 * Густота спавна. Тип у неё свой и общий с планировщиком (`SpawnPlan`), поэтому
 * схема не выводит его, а обязуется отдать: разъедутся — не соберётся.
 *
 * Порядок границ проверяется правилом поверх схемы: по отдельности оба числа
 * законны, беда видна только на паре.
 */
const SPAWN: Schema<SpawnPlan> = refine(
    object({
        minInterval: number({ min: 0.01 }),
        maxInterval: number({ min: 0.01 }),
    }),
    (spawn, path) => {
        if (spawn.maxInterval < spawn.minInterval) {
            throw SchemaError.expected(
                `${path}.maxInterval`,
                `число не меньше minInterval (${spawn.minInterval})`,
                spawn.maxInterval,
            );
        }
    },
);

/**
 * Настройки одного уровня. Отличие лёгкого от тяжёлого целиком здесь: кода,
 * который знал бы про сложность, в игре нет.
 */
const LEVEL = object({
    /** Длина раунда в секундах. */
    duration: number({ min: 1 }),
    /** Запас жизней на раунд. */
    lives: integer({ min: 1 }),
    /**
     * Потолок шага времени, секунд.
     *
     * Вкладку свернули, ноутбук уснул, кадр залип — между кадрами набежит
     * сколько угодно. Без потолка предметы за один кадр перепрыгнули бы поле
     * целиком, а таймер отсчитал бы полраунда.
     */
    maxStep: number({ min: 0.01, max: 1 }),
    spawn: SPAWN,
});

export type LevelConfig = Infer<typeof LEVEL>;

export function readLevel(raw: unknown, source = 'level'): LevelConfig {
    return LEVEL.parse(raw, source);
}
