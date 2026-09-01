import { LevelConfig, readLevel } from '../../core/logic/config/LevelConfig';
import { IConfigSource } from '../../platform/config/IConfigSource';
import { Difficulty } from './Difficulty';

/**
 * Имя документа для каждой сложности.
 *
 * Живёт здесь, а не в сборщике: тот, кто подключает документы к источнику, и
 * тот, кто их оттуда читает, обязаны называть их одинаково — значит имя должно
 * быть одно на двоих.
 */
export const LEVEL_DOCUMENTS: { readonly [D in Difficulty]: string } = {
    easy: 'level-easy.json',
    normal: 'level-normal.json',
    hard: 'level-hard.json',
};

/** Разобранные уровни. Обращение по сложности всегда что-то находит. */
export type LevelCatalog = { readonly [D in Difficulty]: LevelConfig };

/**
 * Разбирает все три уровня разом, а не тот, который выбрали.
 *
 * Опечатка в тяжёлом иначе нашлась бы через минуту игры на лёгком — уже после
 * того, как игрок выбрал уровень и настроился играть.
 *
 * Сложности перечислены руками, а не циклом по `DIFFICULTIES`: так тип каталога
 * получается полным, и забытую ветку показывает компилятор.
 */
export function readLevels(source: IConfigSource): LevelCatalog {
    return {
        easy: read(source, 'easy'),
        normal: read(source, 'normal'),
        hard: read(source, 'hard'),
    };
}

function read(source: IConfigSource, difficulty: Difficulty): LevelConfig {
    const name = LEVEL_DOCUMENTS[difficulty];
    return readLevel(source.read(name), name);
}
