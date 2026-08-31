import { FallBehaviour, FallOffset } from './FallBehaviour';

/**
 * Падение зигзагом: вниз равномерно, поперёк — качание синусом.
 *
 * Качание начинается с нуля, поэтому предмет выходит ровно из той точки, где
 * его поставил спавнер, и только потом уходит вбок. Полный размах — два
 * `amplitude`; это учитывает полоса спавна, иначе предмет улетал бы за край
 * поля.
 */
export class ZigzagFallBehaviour implements FallBehaviour {
    private readonly rate: number;

    constructor(
        private readonly speed: number,
        private readonly amplitude: number,
        period: number,
    ) {
        this.rate = (2 * Math.PI) / period;
    }

    offsetAt(age: number): FallOffset {
        return {
            x: this.amplitude * Math.sin(this.rate * age),
            y: -this.speed * age,
        };
    }
}
