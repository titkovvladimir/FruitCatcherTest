/**
 * Событие с той стороны, где на него подписываются.
 *
 * Владелец состояния держит у себя `Signal`, а наружу отдаёт его как
 * `Subscribable`: поднять чужое событие тогда не даёт компилятор, потому что
 * `emit` здесь просто нет. Это то, что в C# делает слово `event`.
 */
export interface Subscribable<T = void> {
    /** Подписывает обработчик и возвращает функцию отписки. */
    on(handler: (value: T) => void): () => void;
}

/**
 * Событие: типизированная нагрузка, никаких строковых ключей.
 *
 * Движковый `EventTarget` не берём: у него ключи строковые, а нагрузка `any` —
 * при `strict: true` от типов не остаётся ничего.
 *
 * Своих подписчиков `Signal` не чистит и чистить не может: он не знает, жив ли
 * ещё их владелец. Отписка — забота подписчика, и пишется она не руками, а
 * через `SubscriptionBag`.
 */
export class Signal<T = void> implements Subscribable<T> {
    /**
     * Порог сторожа: столько подписчиков у одного события считается нормой.
     * Ноль — сторож выключен. Включает его сборка игры, а не сам `Signal`:
     * этот файл о движке ничего не знает и знать не должен.
     */
    static warnAfter = 0;

    private handlers: ((value: T) => void)[] = [];

    /** Имя нужно сторожу: предупреждение без имени бесполезно. */
    constructor(private readonly name = 'signal') {}

    on(handler: (value: T) => void): () => void {
        this.handlers.push(handler);
        if (Signal.warnAfter > 0 && this.handlers.length > Signal.warnAfter) {
            console.warn(`${this.name}: подписчиков ${this.handlers.length} — похоже на утечку`);
        }
        return () => {
            this.handlers = this.handlers.filter(existing => existing !== handler);
        };
    }

    /**
     * Копия списка обязательна: обработчик вправе отписаться прямо во время
     * рассылки, и без копии соседний обработчик молча пропустили бы.
     */
    emit(value: T): void {
        for (const handler of [...this.handlers]) {
            handler(value);
        }
    }
}
