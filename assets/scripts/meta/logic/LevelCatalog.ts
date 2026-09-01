import { LevelConfig, readLevel } from '../../core/logic/config/LevelConfig';
import { Difficulty } from './Difficulty';

/**
 * Сырые документы уровней — по одному на сложность.
 *
 * Ключи заданы типом, а не строками: забыть один при связывании не даст
 * компилятор, и до рантайма такая ошибка не доедет.
 */
export type LevelDocuments = { readonly [D in Difficulty]: unknown };

/** Разобранные уровни. Обращение по сложности всегда что-то находит. */
export type LevelCatalog = { readonly [D in Difficulty]: LevelConfig };

/**
 * Разбирает все три уровня разом, а не тот, который выбрали.
 *
 * Опечатка в тяжёлом иначе нашлась бы через минуту игры на лёгком — уже после
 * того, как игрок выбрал уровень и настроился играть.
 */
export function readLevels(documents: LevelDocuments): LevelCatalog {
    return {
        easy: readLevel(documents.easy, 'level-easy.json'),
        normal: readLevel(documents.normal, 'level-normal.json'),
        hard: readLevel(documents.hard, 'level-hard.json'),
    };
}
