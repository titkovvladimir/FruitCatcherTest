import { FallBehaviour, FallOffset } from './FallBehaviour';

/** Равномерное падение: строго вниз с постоянной скоростью. */
export class UniformFallBehaviour implements FallBehaviour {
    constructor(private readonly speed: number) {}

    offsetAt(age: number): FallOffset {
        return { x: 0, y: -this.speed * age };
    }
}
