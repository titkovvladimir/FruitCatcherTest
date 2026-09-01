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
 * Серия без ошибок и её цена.
 *
 * `step` — сколько добычи подряд прибавляет к множителю единицу, `max` — куда
 * множитель упирается. Оба числа сложность меняет: на лёгкой серия растёт
 * быстрее и уходит выше, на тяжёлой шаг длиннее — там и оборвать её проще.
 */
const COMBO = object({
    step: integer({ min: 1 }),
    max: integer({ min: 1, max: 10 }),
});

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
     * Темп падения: во сколько раз быстрее предмет проходит поле. Единица —
     * скорости из таблицы типов как есть, полтора — те же траектории в
     * полтора раза быстрее.
     *
     * Скорость лежит в таблице типов и одна на всю игру: без этого множителя
     * сложность не могла бы её тронуть, не переписав таблицу целиком.
     */
    fallTempo: number({ min: 0.5, max: 2 }),
    combo: COMBO,
    spawn: SPAWN,
});

export type LevelConfig = Infer<typeof LEVEL>;

export function readLevel(raw: unknown, source = 'level'): LevelConfig {
    return LEVEL.parse(raw, source);
}
