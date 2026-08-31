import { FallingItemConfig } from '../config/FallingItemConfig';
import { AcceleratedFallBehaviour } from './AcceleratedFallBehaviour';
import { FallBehaviour } from './FallBehaviour';
import { UniformFallBehaviour } from './UniformFallBehaviour';
import { ZigzagFallBehaviour } from './ZigzagFallBehaviour';

/**
 * Единственное место, где имя траектории из конфига превращается в поведение.
 *
 * Поведения состояния не хранят, поэтому вызывать это на каждый появившийся
 * предмет незачем: экземпляр делается один раз на тип и живёт с ним.
 */
export function createFallBehaviour(config: FallingItemConfig): FallBehaviour {
    const fall = config.fall;
    switch (fall.kind) {
        case 'uniform':
            return new UniformFallBehaviour(config.speed);
        case 'zigzag':
            return new ZigzagFallBehaviour(config.speed, fall.amplitude, fall.period);
        case 'accelerated':
            return new AcceleratedFallBehaviour(config.speed, fall.acceleration);
    }
}

/** Готовые поведения по типам: по одному на тип, как и задумано. */
export function createFallBehaviours(configs: readonly FallingItemConfig[]): Map<string, FallBehaviour> {
    const behaviours = new Map<string, FallBehaviour>();
    for (const config of configs) {
        behaviours.set(config.id, createFallBehaviour(config));
    }
    return behaviours;
}
