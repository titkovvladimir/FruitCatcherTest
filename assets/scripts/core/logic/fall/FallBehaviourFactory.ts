import { FallingItemConfig } from '../config/FallingItemConfig';
import { AcceleratedFallBehaviour } from './AcceleratedFallBehaviour';
import { FallBehaviour } from './FallBehaviour';
import { TempoFallBehaviour } from './TempoFallBehaviour';
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

/**
 * Готовые поведения по типам: по одному на тип, как и задумано.
 *
 * `tempo` приходит из настроек уровня и на единице не стоит ничего: обёртка
 * заводится, только когда уровень действительно меняет темп.
 */
export function createFallBehaviours(
    configs: readonly FallingItemConfig[],
    tempo: number,
): Map<string, FallBehaviour> {
    const behaviours = new Map<string, FallBehaviour>();
    for (const config of configs) {
        const behaviour = createFallBehaviour(config);
        behaviours.set(config.id, tempo === 1 ? behaviour : new TempoFallBehaviour(behaviour, tempo));
    }
    return behaviours;
}
