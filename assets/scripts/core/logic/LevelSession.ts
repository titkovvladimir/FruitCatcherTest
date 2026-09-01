import { Signal, Subscribable } from '../../utils/Signal';
import { ComboState } from './ComboState';
import { FallingItemConfig } from './config/FallingItemConfig';
import { LevelConfig } from './config/LevelConfig';
import { LevelEnding, LevelOutcome } from './LevelOutcome';
import { LevelState } from './LevelState';

/**
 * Состояние раунда и всё, что с ним происходит: очки, жизни, время, конец.
 *
 * Про движок, сцену и показ не знает ничего — заводится в обычном тесте одной
 * строкой. Про рекорды и сложность тоже: раунд поднимает свой итог и на этом
 * его роль кончается.
 */
export class LevelSession {
    private _state: LevelState = 'idle';
    private _score = 0;
    private _caught = 0;
    private _missed = 0;
    private _lives = 0;
    private _maxLives = 0;
    private _timeLeft = 0;
    private _streak = 0;

    private readonly _scoreChanged = new Signal<number>('scoreChanged');
    private readonly _lifeLost = new Signal<number>('lifeLost');
    private readonly _timeChanged = new Signal<number>('timeChanged');
    private readonly _comboChanged = new Signal<ComboState>('comboChanged');
    private readonly _stateChanged = new Signal<LevelState>('stateChanged');
    private readonly _finished = new Signal<LevelOutcome>('finished');

    /** Новый счёт. */
    get scoreChanged(): Subscribable<number> {
        return this._scoreChanged;
    }

    /** Сколько жизней осталось после потери. */
    get lifeLost(): Subscribable<number> {
        return this._lifeLost;
    }

    /** Целых секунд до конца раунда; поднимается только когда цифра сменилась. */
    get timeChanged(): Subscribable<number> {
        return this._timeChanged;
    }

    /** Серия сменилась: выросла, оборвалась или началась заново. */
    get comboChanged(): Subscribable<ComboState> {
        return this._comboChanged;
    }

    get stateChanged(): Subscribable<LevelState> {
        return this._stateChanged;
    }

    get finished(): Subscribable<LevelOutcome> {
        return this._finished;
    }

    get state(): LevelState {
        return this._state;
    }

    get running(): boolean {
        return this._state === 'running';
    }

    get score(): number {
        return this._score;
    }

    get lives(): number {
        return this._lives;
    }

    /**
     * Сколько жизней было в начале раунда. У сложностей запас разный, поэтому
     * число ячеек в индикаторе — свойство идущего раунда, а не игры вообще.
     */
    get maxLives(): number {
        return this._maxLives;
    }

    /** Серия и множитель сейчас. */
    get combo(): ComboState {
        return { streak: this._streak, multiplier: this.multiplier };
    }

    /** Секунд до конца, как их видит игрок: округление вверх. */
    get secondsLeft(): number {
        return Math.ceil(this._timeLeft);
    }

    /**
     * Начало раунда — и первого, и любого следующего.
     *
     * Настройки приходят вместе с началом, а не в конструктор: сложность
     * выбирают между раундами, и раунд, привязанный к уровню на всю жизнь,
     * пришлось бы заводить заново — вместе с ним и все подписки показа.
     */
    start(config: LevelConfig): void {
        this._score = 0;
        this._caught = 0;
        this._missed = 0;
        this._lives = config.lives;
        this._maxLives = config.lives;
        this._timeLeft = config.duration;
        this._streak = 0;
        this.setState('running');
        this._scoreChanged.emit(this._score);
        this._timeChanged.emit(this.secondsLeft);
        this._comboChanged.emit(this.combo);
    }

    /**
     * Вернуть раунд в покой: игрок ушёл к выбору сложности.
     *
     * Отдельно от `start`, потому что это не начало нового раунда, а отказ от
     * прошлого: пока сложность не выбрана заново, показывать нечего — ни счёта,
     * ни времени, ни жизней.
     */
    reset(): void {
        this._score = 0;
        this._caught = 0;
        this._missed = 0;
        this._lives = 0;
        this._maxLives = 0;
        this._timeLeft = 0;
        this._streak = 0;
        this.setState('idle');
    }

    /** Идемпотентна: пауза на паузе ничего не делает. */
    pause(): void {
        if (this._state === 'running') {
            this.setState('paused');
        }
    }

    resume(): void {
        if (this._state === 'paused') {
            this.setState('running');
        }
    }

    tick(dt: number): void {
        if (this._state !== 'running') {
            return;
        }
        const before = this.secondsLeft;
        this._timeLeft = Math.max(0, this._timeLeft - dt);
        if (this.secondsLeft !== before) {
            this._timeChanged.emit(this.secondsLeft);
        }
        if (this._timeLeft === 0) {
            this.finish('time');
        }
    }

    /**
     * Предмет пойман; отдаёт начисленные очки — их показывает всплывашка.
     *
     * Про яблоки и мухоморы раунд по-прежнему не знает: что предмет делает с
     * серией, написано у него в поле `combo`, а сколько он стоит — в числах.
     * Множитель идёт только на добычу: умножать им очки за то, что серию
     * укоротило, было бы издевательством.
     */
    applyCatch(item: FallingItemConfig): number {
        if (this._state !== 'running') {
            return 0;
        }
        this._caught += 1;
        // Серия меняется до начисления: пойманный фрукт множит очки уже своим
        // номером в серии, а не предыдущим. Иначе второй подряд шёл бы по
        // одинарной цене, и обещание «каждый фрукт прибавляет множитель»
        // выполнялось бы с опозданием на один.
        this.changeStreak(item.combo);
        const awarded = item.combo === 'grow' ? item.score * this.multiplier : item.score;
        if (awarded !== 0) {
            this._score += awarded;
            this._scoreChanged.emit(this._score);
        }
        if (item.lifeChange !== 0) {
            this._lives = Math.max(0, this._lives + item.lifeChange);
            this._lifeLost.emit(this._lives);
            if (this._lives === 0) {
                this.finish('lives');
            }
        }
        return awarded;
    }

    /**
     * Предмет улетел мимо корзины. Жизней не стоит, но упущенная добыча
     * обрывает серию: без этого промах не стоит ничего, а игра сводится к
     * «води корзину под всё подряд».
     *
     * Упущенное кислое и упущенный мухомор не стоят ничего — игрок поступил
     * правильно.
     */
    applyMiss(item: FallingItemConfig): void {
        if (this._state !== 'running') {
            return;
        }
        this._missed += 1;
        if (item.combo === 'grow') {
            this.setStreak(0);
        }
    }

    /**
     * Множитель равен длине серии: два подряд — вдвое, три — втрое, и так
     * далее. Потолка нет — длинная серия и должна платить непристойно много,
     * иначе держать её незачем; обрывается она сама, и тем чаще, чем гуще
     * поток.
     */
    private get multiplier(): number {
        return Math.max(1, this._streak);
    }

    private changeStreak(effect: FallingItemConfig['combo']): void {
        if (effect === 'grow') {
            this.setStreak(this._streak + 1);
        } else if (effect === 'drop') {
            this.setStreak(Math.max(0, this._streak - 1));
        } else {
            this.setStreak(0);
        }
    }

    private setStreak(value: number): void {
        if (this._streak === value) {
            return;
        }
        this._streak = value;
        this._comboChanged.emit(this.combo);
    }

    private finish(ending: LevelEnding): void {
        if (this._state === 'finished') {
            return;
        }
        this.setState('finished');
        this._finished.emit({
            score: this._score,
            caught: this._caught,
            missed: this._missed,
            livesLeft: this._lives,
            ending,
        });
    }

    private setState(state: LevelState): void {
        if (this._state === state) {
            return;
        }
        this._state = state;
        this._stateChanged.emit(state);
    }
}
