import { FallBehaviour, FallOffset } from './FallBehaviour';

/**
 * Падение с ускорением: начальная скорость плюс постоянное ускорение.
 *
 * Формула равноускоренного движения целиком, а не приращение скорости за кадр:
 * от кадров путь здесь не зависит вовсе.
 */
export class AcceleratedFallBehaviour implements FallBehaviour {
    constructor(
        private readonly speed: number,
        private readonly acceleration: number,
    ) {}

    offsetAt(age: number): FallOffset {
        return { x: 0, y: -(this.speed * age + 0.5 * this.acceleration * age * age) };
    }
}
