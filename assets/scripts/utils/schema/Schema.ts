/**
 * Описание формы данных: из одного описания получаются сразу и проверка в
 * рантайме, и тип для компилятора.
 *
 * Зачем проверять вообще. Ни импорт JSON-ассета, ни `strict` в содержимое файла
 * не смотрят: первый разбирает синтаксис, второго в рантайме не существует
 * вовсе. Число 999 в поле, ждущем от 1 до 10, доедет до игры целым, если его не
 * встретить здесь.
 *
 * Почему схемой, а не проверками руками. Ручная проверка живёт отдельно от
 * типа, и разъезжаются они молча: поле добавили в интерфейс, проверить забыли —
 * компилятор доволен, а в поле приезжает `undefined`. Из описания получаются оба
 * сразу, и рассинхрону взяться неоткуда.
 *
 * Слой не знает ни про игру, ни про движок: та же схема разберёт и конфиг, и
 * сохранение. Разной остаётся политика на ошибку — конфиг наш файл, на нём
 * падаем громко; сохранение чужая территория, там ошибка ловится и данные
 * сбрасываются.
 */
export interface Schema<T> {
    /**
     * Проверяет сырое значение и возвращает его же, но уже с типом. Не
     * прошло — `SchemaError` с путём до поля.
     *
     * `path` — место значения в документе: имя документа для корня и дальше
     * вглубь, `falling-items[3].fall.period`.
     */
    parse(value: unknown, path: string): T;
}

/**
 * Тип, который отдаёт схема. Ради него всё и затевалось:
 * `export type BasketConfig = Infer<typeof BASKET>` — второго описания полей,
 * которое можно забыть поправить, в проекте нет.
 */
export type Infer<S extends Schema<unknown>> = S extends Schema<infer T> ? T : never;

/** Ошибка разбора: в сообщении всегда есть путь до поля. */
export class SchemaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SchemaError';
    }

    /** Значение не то, которое ждали: не тот тип, не тот диапазон, не то имя. */
    static expected(path: string, expected: string, actual: unknown): SchemaError {
        return new SchemaError(`${path}: ждали ${expected}, получили ${describe(actual)}`);
    }

    /**
     * Поле есть в документе, но его нет в описании.
     *
     * Ловит самую тихую ошибку конфига — настройку, которой никто не читает.
     * Выставил в json `bonusScore: 5`, игра ведёт себя как раньше, и в чём
     * дело — непонятно: ни ошибки, ни следа. Строгость дешевле молчания.
     */
    static unknownField(path: string, known: readonly string[]): SchemaError {
        return new SchemaError(`${path}: поля нет в описании. Описаны: ${known.join(', ')}`);
    }
}

/** Что пришло вместо ожидаемого — коротко и по-человечески. */
function describe(value: unknown): string {
    if (value === undefined) return 'ничего — поля нет';
    if (value === null) return 'null';
    if (Array.isArray(value)) return `массив из ${value.length}`;
    if (typeof value === 'string') return `строку «${value}»`;
    if (typeof value === 'object') return 'объект';
    if (typeof value === 'number') return `число ${value}`;
    return String(value);
}
