import { Signal, Subscribable } from '../../utils/Signal';
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
    private _lives: number;
    private _timeLeft: number;

    private readonly _scoreChanged = new Signal<number>('scoreChanged');
    private readonly _lifeLost = new Signal<number>('lifeLost');
    private readonly _timeChanged = new Signal<number>('timeChanged');
    private readonly _stateChanged = new Signal<LevelState>('stateChanged');
    private readonly _finished = new Signal<LevelOutcome>('finished');

    constructor(private readonly config: LevelConfig) {
        this._lives = config.lives;
        this._timeLeft = config.duration;
    }

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

    /** Секунд до конца, как их видит игрок: округление вверх. */
    get secondsLeft(): number {
        return Math.ceil(this._timeLeft);
    }

    /** Начало раунда — и первого, и любого следующего. */
    start(): void {
        this._score = 0;
        this._caught = 0;
        this._missed = 0;
        this._lives = this.config.lives;
        this._timeLeft = this.config.duration;
        this.setState('running');
        this._scoreChanged.emit(this._score);
        this._timeChanged.emit(this.secondsLeft);
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
     * Предмет пойман. Очки и изменение жизней приходят числами из его типа:
     * про яблоки и мухоморы раунд не знает, разница между ними — в данных.
     */
    applyCatch(score: number, lifeChange: number): void {
        if (this._state !== 'running') {
            return;
        }
        this._caught += 1;
        if (score !== 0) {
            this._score += score;
            this._scoreChanged.emit(this._score);
        }
        if (lifeChange !== 0) {
            this._lives = Math.max(0, this._lives + lifeChange);
            this._lifeLost.emit(this._lives);
            if (this._lives === 0) {
                this.finish('lives');
            }
        }
    }

    /** Предмет улетел мимо корзины. Ничего не стоит, но идёт в итог раунда. */
    applyMiss(): void {
        if (this._state !== 'running') {
            return;
        }
        this._missed += 1;
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
