import { RandomSource } from './RandomSource';

/** Обычная случайность игры. */
export class MathRandomSource implements RandomSource {
    next(): number {
        return Math.random();
    }
}
