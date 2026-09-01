import { _decorator, Component, Game, game, JsonAsset } from 'cc';
import { Basket } from '../core/components/basket/Basket';
import { Field } from '../core/components/Field';
import { BasketControl } from '../core/components/basket/BasketControl';
import { FallingItemSpawner } from '../core/components/fallingItem/FallingItemSpawner';
import { resolveCatch } from '../core/logic/catch/CatchResolver';
import { readBasket } from '../core/logic/config/BasketConfig';
import { readFallingItems } from '../core/logic/config/FallingItemConfig';
import { FallBehaviour } from '../core/logic/fall/FallBehaviour';
import { createFallBehaviours } from '../core/logic/fall/FallBehaviourFactory';
import { LevelSession } from '../core/logic/LevelSession';
import { FallingItemSpawnPlanner } from '../core/logic/spawn/FallingItemSpawnPlanner';
import { readDifficulty } from '../meta/logic/Difficulty';
import { LEVEL_DOCUMENTS, readLevels } from '../meta/logic/LevelCatalog';
import { IConfigSource } from '../platform/config/IConfigSource';
import { JsonConfigSource } from '../platform/config/JsonConfigSource';
import { LivesView } from '../ui/core/LivesView';
import { LevelResultPanel } from '../ui/core/panels/LevelResultPanel';
import { PauseButton } from '../ui/core/PauseButton';
import { PauseOverlay } from '../ui/core/PauseOverlay';
import { ScoreLabel } from '../ui/core/ScoreLabel';
import { TimerLabel } from '../ui/core/TimerLabel';
import { MathRandomSource } from '../utils/random/MathRandomSource';
import { SubscriptionBag } from '../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Потолок шага времени, секунд.
 *
 * Вкладку свернули, ноутбук уснул, кадр залип — между кадрами набежит сколько
 * угодно. Без потолка предметы за один кадр перепрыгнули бы поле целиком, а
 * таймер отсчитал бы полраунда.
 *
 * Константа, а не настройка уровня: это предохранитель тика, и разным на
 * разных сложностях он быть не может. В конфиге он был бы третьей копией
 * одного числа, которую кто-то однажды поправит не везде.
 */
const MAX_STEP = 0.1;

/**
 * Разбирает документ источника, называя его одним и тем же именем дважды: по
 * нему документ находится и по нему же читается путь в сообщении об ошибке.
 */
function parse<T>(configs: IConfigSource, name: string, read: (raw: unknown, source: string) => T): T {
    return read(configs.read(name), name);
}

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

    @property(BasketControl)
    basketControl: BasketControl = null!;

    /** Таблица типов падающих предметов. */
    @property(JsonAsset)
    itemsConfig: JsonAsset = null!;

    /**
     * Настройки уровня по сложностям: длина раунда, жизни, темп падения,
     * густота спавна. Три ассета, а не один список: так связывание проверяет
     * компилятор, а не порядок строк в сцене.
     */
    @property(JsonAsset)
    easyLevelConfig: JsonAsset = null!;

    @property(JsonAsset)
    normalLevelConfig: JsonAsset = null!;

    @property(JsonAsset)
    hardLevelConfig: JsonAsset = null!;

    /**
     * На какой сложности играется раунд.
     *
     * Пока стоит в сцене: выбор игрока приходит вместе с кнопками сложности и
     * состоянием покоя до запуска.
     */
    @property
    difficulty: string = 'normal';

    /** Настройки корзины: скорость хода. */
    @property(JsonAsset)
    basketConfig: JsonAsset = null!;

    @property(ScoreLabel)
    scoreLabel: ScoreLabel = null!;

    @property(TimerLabel)
    timerLabel: TimerLabel = null!;

    @property(LivesView)
    livesView: LivesView = null!;

    @property(PauseButton)
    pauseButton: PauseButton = null!;

    @property(PauseOverlay)
    pauseOverlay: PauseOverlay = null!;

    @property(LevelResultPanel)
    resultPanel: LevelResultPanel = null!;

    private session: LevelSession | null = null;
    private planner: FallingItemSpawnPlanner | null = null;
    private behaviours = new Map<string, FallBehaviour>();
    private readonly subs = new SubscriptionBag();

    /**
     * Связывание живёт в `start`, а не в `onLoad`: к этому моменту `onLoad`
     * у всех соседей уже отработал, и спрашивать их можно, ничего не угадывая.
     */
    start(): void {
        // Единственное место, где ассеты сцены превращаются в документы с
        // именами. Дальше правила просят конфиг по имени и не знают, лежит он
        // в сборке или пришёл откуда-то ещё.
        const configs = new JsonConfigSource([
            ['falling-items.json', this.itemsConfig.json],
            ['basket.json', this.basketConfig.json],
            [LEVEL_DOCUMENTS.easy, this.easyLevelConfig.json],
            [LEVEL_DOCUMENTS.normal, this.normalLevelConfig.json],
            [LEVEL_DOCUMENTS.hard, this.hardLevelConfig.json],
        ]);

        const items = parse(configs, 'falling-items.json', readFallingItems);
        // Разбираются все три уровня, играется один: опечатка в тяжёлом должна
        // найтись сейчас, а не после того, как игрок его выберет.
        const level = readLevels(configs)[readDifficulty(this.difficulty, 'LevelRoot.difficulty')];
        this.behaviours = createFallBehaviours(items, level.fallTempo);
        this.planner = new FallingItemSpawnPlanner(items, level.spawn, new MathRandomSource());
        this.basket.bind(parse(configs, 'basket.json', readBasket));

        const session = new LevelSession(level);
        this.session = session;
        // Виджеты связываются до старта раунда: иначе первый счёт и первая
        // секунда прошли бы мимо них, а снимок они возьмут уже обнулённый.
        this.scoreLabel.bind(session);
        this.timerLabel.bind(session);
        this.livesView.bind(session);
        this.pauseButton.bind(session);
        this.pauseOverlay.bind(session);
        this.subs.add(this.pauseButton.clicked, () => session.togglePause());
        // Управление слушает мышь только пока раунд идёт. Иначе прицел живёт и
        // на паузе: корзина стоит, а цель уезжает за курсором — и снятие паузы
        // отправляет её туда, куда игрок не целился.
        this.subs.add(session.stateChanged, state => {
            this.basketControl.enabled = state === 'running';
        });
        // Вкладку свернули — раунд встаёт сам. Движок в это время не тикает
        // вовсе, так что доиграться без игрока раунд не может; пауза нужна для
        // возвращения: иначе игра оживает в ту же секунду, когда игрок ещё
        // смотрит на вкладку, а не на поле.
        game.on(Game.EVENT_HIDE, this.pauseOnHide, this);
        this.subs.add(session.finished, outcome => {
            this.spawner.recycleAll();
            this.resultPanel.show(outcome);
        });
        this.subs.add(this.resultPanel.restartClicked, () => this.restart());
        session.start();
    }

    onDestroy(): void {
        game.off(Game.EVENT_HIDE, this.pauseOnHide, this);
        this.subs.clear();
    }

    /**
     * Новый раунд на том же уровне. Планировщик сбрасывается вместе с сессией:
     * иначе первый предмет появился бы по остатку отсчёта прошлого раунда.
     */
    private restart(): void {
        const session = this.session;
        const planner = this.planner;
        if (session === null || planner === null) {
            return;
        }
        this.resultPanel.hide();
        planner.reset();
        session.start();
    }

    private pauseOnHide(): void {
        if (this.session !== null) {
            this.session.pause();
        }
    }

    /**
     * Порядок в тике задан явно: время раунда, заказ на появление, движение
     * предметов и разбор ловли, ход корзины.
     *
     * Проём берётся до хода корзины: отрезок предмета за этот кадр сверяется с
     * той корзиной, которая стояла на месте, когда кадр начинался.
     */
    update(dt: number): void {
        const planner = this.planner;
        const session = this.session;
        if (planner === null || session === null) {
            return;
        }

        const step = Math.min(dt, MAX_STEP);
        session.tick(step);
        // Раунд не идёт — не идёт ничего: ни появление, ни падение, ни корзина.
        // Иначе пауза останавливала бы только таймер, а поле продолжало жить.
        if (!session.running) {
            return;
        }

        const order = planner.tick(step);
        if (order !== null) {
            const behaviour = this.behaviours.get(order.item.id);
            if (behaviour !== undefined) {
                this.spawner.spawn(order.item, behaviour, order.position);
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
                // Пойманным мог оказаться последний мухомор: раунд кончился
                // прямо здесь и убрал поле целиком. Возвращать в пул нечего, и
                // следующий обход прочитал бы уже пустое место.
                if (!session.running) {
                    break;
                }
                this.spawner.recycle(item);
            } else if (verdict === 'missed') {
                session.applyMiss();
                this.spawner.recycle(item);
            }
        }

        this.basket.tick(step);
    }
}
