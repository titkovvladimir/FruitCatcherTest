import { SchemaError } from '../../utils/schema/Schema';

/**
 * Сложность уровня.
 *
 * Кода, который знал бы, чем лёгкий раунд отличается от тяжёлого, в игре нет:
 * сложность — это имя, по которому берётся свой конфиг уровня. Отсюда и место
 * в `meta`: раунд получает готовые настройки и про выбор не знает вовсе.
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

/** Все сложности по возрастанию — в этом же порядке они встанут на экране. */
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

function isDifficulty(value: unknown): value is Difficulty {
    return typeof value === 'string' && (DIFFICULTIES as readonly string[]).indexOf(value) !== -1;
}

/**
 * Строка — в сложность. Нужно там, где имя приходит снаружи: из сцены, из
 * сохранения, из ссылки.
 *
 * Незнакомое имя — громкая ошибка, а не молчаливая подстановка `normal`:
 * подставленная сложность увела бы игрока не на тот уровень и записала бы
 * рекорд не в ту строку.
 */
export function readDifficulty(value: unknown, source: string): Difficulty {
    if (!isDifficulty(value)) {
        throw SchemaError.expected(source, `одну из сложностей: ${DIFFICULTIES.join(', ')}`, value);
    }
    return value;
}
