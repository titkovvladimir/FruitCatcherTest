import { _decorator, Component, JsonAsset } from 'cc';
import { Basket } from '../core/components/basket/Basket';
import { Field } from '../core/components/Field';
import { FallingItemSpawner } from '../core/components/fallingItem/FallingItemSpawner';
import { readBasket } from '../core/logic/config/BasketConfig';
import { readFallingItems } from '../core/logic/config/FallingItemConfig';
import { LevelConfig, readLevel } from '../core/logic/config/LevelConfig';
import { FallBehaviour } from '../core/logic/fall/FallBehaviour';
import { createFallBehaviours } from '../core/logic/fall/FallBehaviourFactory';
import { FallingItemSpawnPlanner } from '../core/logic/spawn/FallingItemSpawnPlanner';
import { MathRandomSource } from '../utils/random/MathRandomSource';

const { ccclass, property } = _decorator;

/**
 * Сборка уровня: связывает правила раунда с тем, что видно на экране, и ведёт
 * один-единственный тик.
 *
 * Правил игры здесь нет и быть не должно. Проверка простая: появилось `if` про
 * игру — значит файл выбран неправильно, такому место в `core/logic`.
 */
@ccclass('LevelRoot')
export class LevelRoot extends Component {
    @property(Field)
    field: Field = null!;

    @property(FallingItemSpawner)
    spawner: FallingItemSpawner = null!;

    @property(Basket)
    basket: Basket = null!;

    /** Таблица типов падающих предметов. */
    @property(JsonAsset)
    itemsConfig: JsonAsset = null!;

    /** Настройки уровня: длина раунда, жизни, густота спавна. */
    @property(JsonAsset)
    levelConfig: JsonAsset = null!;

    /** Настройки корзины: скорость хода. */
    @property(JsonAsset)
    basketConfig: JsonAsset = null!;

    private level: LevelConfig | null = null;
    private planner: FallingItemSpawnPlanner | null = null;
    private behaviours = new Map<string, FallBehaviour>();

    /**
     * Связывание живёт в `start`, а не в `onLoad`: к этому моменту `onLoad`
     * у всех соседей уже отработал, и спрашивать их можно, ничего не угадывая.
     */
    start(): void {
        const items = readFallingItems(this.itemsConfig.json, 'falling-items.json');
        this.level = readLevel(this.levelConfig.json, 'level-normal.json');
        this.behaviours = createFallBehaviours(items);
        this.planner = new FallingItemSpawnPlanner(items, this.level.spawn, new MathRandomSource());
        this.basket.bind(readBasket(this.basketConfig.json, 'basket.json'));
    }

    /**
     * Порядок в тике задан явно: заказ на появление, движение предметов,
     * уборка улетевших, ход корзины.
     */
    update(dt: number): void {
        const level = this.level;
        const planner = this.planner;
        if (level === null || planner === null) {
            return;
        }

        const step = Math.min(dt, level.maxStep);

        const order = planner.tick(step);
        if (order !== null) {
            const behaviour = this.behaviours.get(order.item.id);
            if (behaviour !== undefined) {
                this.spawner.spawn(order.item, behaviour, order.position);
            }
        }

        const items = this.spawner.items;
        for (let i = items.length - 1; i >= 0; i -= 1) {
            const item = items[i];
            item.tick(step);
            if (item.node.position.y + item.config.radius < this.field.bottom) {
                this.spawner.recycle(item);
            }
        }

        this.basket.tick(step);
    }
}
