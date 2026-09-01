import { IStorage } from '../../platform/storage/IStorage';
import { integer, object } from '../../utils/schema/builders';
import { Infer, SchemaError } from '../../utils/schema/Schema';
import { Signal, Subscribable } from '../../utils/Signal';
import { Difficulty } from './Difficulty';

/**
 * Ключ в хранилище: у каждой сложности свой.
 *
 * Одной записью на все три было короче, но дороже: порченое число в тяжёлой
 * уносило бы с собой рекорды лёгкой и обычной, и то же самое делала бы смена
 * формата. Своя запись — своя потеря.
 */
const keyOf = (difficulty: Difficulty): string => `fruit-catcher.best.${difficulty}`;

/**
 * Версия формата записи.
 *
 * Не украшение: запись живёт в браузере игрока и переживает выкладку новой
 * сборки. Встретив чужую версию, игра не гадает, а начинает эту сложность с
 * чистого листа — это дешевле любой попытки угадать смысл старых полей.
 */
const VERSION = 1;

const SAVE = object({
    version: integer({ min: VERSION, max: VERSION }),
    score: integer({ min: 0 }),
});

type Save = Infer<typeof SAVE>;

/** Рекорд, который только что сменился. */
export interface BestScore {
    readonly difficulty: Difficulty;
    readonly score: number;
}

/**
 * Лучший счёт по каждой сложности.
 *
 * Политика битых данных здесь другая, чем у конфигов, и это осознанно (см.
 * `DECISIONS.md` п. 7). Конфиг — наш файл, ошибка в нём ошибка разработчика, и
 * разбор падает громко. Сохранение — чужая территория: старый формат, правка
 * в devtools, просто мусор. На непрошедшую проверку — предупреждение в консоль
 * и чистый лист, а игра продолжается.
 */
export class BestScores {
    private readonly scores: { [D in Difficulty]: number };
    private readonly _changed = new Signal<BestScore>('bestScoreChanged');

    constructor(private readonly storage: IStorage) {
        this.scores = this.load();
    }

    get changed(): Subscribable<BestScore> {
        return this._changed;
    }

    /** Лучший счёт на этой сложности; ноль означает «рекорда ещё нет». */
    best(difficulty: Difficulty): number {
        return this.scores[difficulty];
    }

    /**
     * Итог раунда в зачёт. Отдаёт `true`, если рекорд обновился.
     *
     * Равный счёт рекордом не считается: игрок повторил себя, а не превзошёл, и
     * «новый рекорд» на том же числе читался бы как насмешка.
     */
    submit(difficulty: Difficulty, score: number): boolean {
        if (score <= this.scores[difficulty]) {
            return false;
        }
        this.scores[difficulty] = score;
        const save: Save = { version: VERSION, score };
        this.storage.write(keyOf(difficulty), JSON.stringify(save));
        this._changed.emit({ difficulty, score });
        return true;
    }

    private load(): { [D in Difficulty]: number } {
        return {
            easy: this.loadOne('easy'),
            normal: this.loadOne('normal'),
            hard: this.loadOne('hard'),
        };
    }

    /** Рекорд одной сложности. Не прочитался — ноль, и только у неё одной. */
    private loadOne(difficulty: Difficulty): number {
        const key = keyOf(difficulty);
        try {
            const raw = this.storage.read(key);
            if (raw === null) {
                return 0;
            }
            const save: Save = SAVE.parse(JSON.parse(raw), key);
            return save.score;
        } catch (error) {
            const reason = error instanceof SchemaError || error instanceof Error ? error.message : String(error);
            console.warn(`Рекорд «${difficulty}» не прочитался и начинается заново. ${reason}`);
            return 0;
        }
    }
}
