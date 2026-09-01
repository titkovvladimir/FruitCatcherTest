import { _decorator, Component, JsonAsset } from 'cc';
import { Basket } from '../core/components/basket/Basket';
import { Field } from '../core/components/Field';
import { FallingItemSpawner } from '../core/components/fallingItem/FallingItemSpawner';
import { resolveCatch } from '../core/logic/catch/CatchResolver';
import { readBasket } from '../core/logic/config/BasketConfig';
import { readFallingItems } from '../core/logic/config/FallingItemConfig';
import { LevelConfig, readLevel } from '../core/logic/config/LevelConfig';
import { FallBehaviour } from '../core/logic/fall/FallBehaviour';
import { createFallBehaviours } from '../core/logic/fall/FallBehaviourFactory';
import { LevelSession } from '../core/logic/LevelSession';
import { FallingItemSpawnPlanner } from '../core/logic/spawn/FallingItemSpawnPlanner';
import { LivesView } from '../ui/core/LivesView';
import { ScoreLabel } from '../ui/core/ScoreLabel';
import { TimerLabel } from '../ui/core/TimerLabel';
import { MathRandomSource } from '../utils/random/MathRandomSource';
import { SubscriptionBag } from '../utils/SubscriptionBag';

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

    @property(ScoreLabel)
    scoreLabel: ScoreLabel = null!;

    @property(TimerLabel)
    timerLabel: TimerLabel = null!;

    @property(LivesView)
    livesView: LivesView = null!;

    private level: LevelConfig | null = null;
    private session: LevelSession | null = null;
    private planner: FallingItemSpawnPlanner | null = null;
    private behaviours = new Map<string, FallBehaviour>();
    private readonly subs = new SubscriptionBag();

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

        const session = new LevelSession(this.level);
        this.session = session;
        // Виджеты связываются до старта раунда: иначе первый счёт и первая
        // секунда прошли бы мимо них, а снимок они возьмут уже обнулённый.
        this.scoreLabel.bind(session);
        this.timerLabel.bind(session);
        this.livesView.bind(session);
        this.subs.add(session.finished, () => this.spawner.recycleAll());
        session.start();
    }

    onDestroy(): void {
        this.subs.clear();
    }

    /**
     * Порядок в тике задан явно: время раунда, заказ на появление, движение
     * предметов и разбор ловли, ход корзины.
     *
     * Проём берётся до хода корзины: отрезок предмета за этот кадр сверяется с
     * той корзиной, которая стояла на месте, когда кадр начинался.
     */
    update(dt: number): void {
        const level = this.level;
        const planner = this.planner;
        const session = this.session;
        if (level === null || planner === null || session === null) {
            return;
        }

        const step = Math.min(dt, level.maxStep);
        session.tick(step);

        if (session.running) {
            const order = planner.tick(step);
            if (order !== null) {
                const behaviour = this.behaviours.get(order.item.id);
                if (behaviour !== undefined) {
                    this.spawner.spawn(order.item, behaviour, order.position);
                }
            }
        }

        const mouth = this.basket.mouthLine;
        const floor = this.field.bottom;
        const items = this.spawner.items;
        for (let i = items.length - 1; i >= 0; i -= 1) {
            const item = items[i];
            item.tick(step);
            const verdict = resolveCatch(item.motion, mouth, floor);
            if (verdict === 'caught') {
                session.applyCatch(item.config.score, item.config.lifeChange);
                this.spawner.recycle(item);
            } else if (verdict === 'missed') {
                session.applyMiss();
                this.spawner.recycle(item);
            }
        }

        this.basket.tick(step);
    }
}
