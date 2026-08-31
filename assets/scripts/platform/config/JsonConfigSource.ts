import { IConfigSource } from './IConfigSource';

/**
 * Источник поверх готового набора разобранного JSON.
 *
 * Сам файл сюда не попадает: документы приносит тот, кто держит ссылки на
 * ассеты в сцене. Благодаря этому слой не знает про движок — а значит,
 * заводится и в обычном тесте.
 */
export class JsonConfigSource implements IConfigSource {
    private readonly documents: Map<string, unknown>;

    constructor(documents: Iterable<readonly [string, unknown]>) {
        this.documents = new Map(documents);
    }

    read(name: string): unknown {
        if (!this.documents.has(name)) {
            const known = [...this.documents.keys()].join(', ') || 'ни одного';
            throw new Error(`Конфиг «${name}» не подключён. Подключены: ${known}`);
        }
        return this.documents.get(name);
    }
}
