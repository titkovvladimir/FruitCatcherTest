import { _decorator, Component, Game, game, JsonAsset, Node } from 'cc';
import { Basket } from '../core/components/basket/Basket';
import { Field } from '../core/components/Field';
import { BasketControl } from '../core/components/basket/BasketControl';
import { FallingItemSpawner } from '../core/components/fallingItem/FallingItemSpawner';
import { resolveCatch } from '../core/logic/catch/CatchResolver';
import { FallingItemConfig, readFallingItems } from '../core/logic/config/FallingItemConfig';
import { LevelConfig } from '../core/logic/config/LevelConfig';
import { FallBehaviour } from '../core/logic/fall/FallBehaviour';
import { createFallBehaviours } from '../core/logic/fall/FallBehaviourFactory';
import { LevelOutcome } from '../core/logic/LevelOutcome';
import { LevelSession } from '../core/logic/LevelSession';
import { FallingItemSpawnPlanner } from '../core/logic/spawn/FallingItemSpawnPlanner';
import { IConfigSource } from '../platform/config/IConfigSource';
import { JsonConfigSource } from '../platform/config/JsonConfigSource';
import { ComboLabel } from '../ui/core/ComboLabel';
import { LivesView } from '../ui/core/LivesView';
import { PauseButton } from '../ui/core/PauseButton';
import { PausePanel } from '../ui/core/panels/PausePanel';
import { ScoreLabel } from '../ui/core/ScoreLabel';
import { ScorePopups } from '../ui/core/ScorePopups';
import { TimerLabel } from '../ui/core/TimerLabel';
import { MathRandomSource } from '../utils/random/MathRandomSource';
import { Subscribable } from '../utils/Signal';
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
 * Раунд сам собой не начинается: пока никто не позвал `play`, поле пусто и
 * раунд стоит в покое. Какой уровень играть, решает мета; сюда приходят готовые
 * настройки, и про сложность этот файл не знает.
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

    /** Всплывающие числа очков над пойманным. */
    @property(ScorePopups)
    popups: ScorePopups = null!;

    @property(Basket)
    basket: Basket = null!;

    @property(BasketControl)
    basketControl: BasketControl = null!;

    /** Таблица типов падающих предметов. */
    @property(JsonAsset)
    itemsConfig: JsonAsset = null!;

    /**
     * Контейнер показателей раунда: счёт, таймер, жизни, пауза.
     *
     * Нужен целиком, а не по виджету: до первого раунда показывать нечего, а
     * нули на счётчиках рядом с меню читались бы как игра, в которой ничего не
     * происходит.
     */
    @property(Node)
    hud: Node = null!;

    @property(ScoreLabel)
    scoreLabel: ScoreLabel = null!;

    @property(ComboLabel)
    comboLabel: ComboLabel = null!;

    @property(TimerLabel)
    timerLabel: TimerLabel = null!;

    @property(LivesView)
    livesView: LivesView = null!;

    @property(PauseButton)
    pauseButton: PauseButton = null!;

    @property(PausePanel)
    pausePanel: PausePanel = null!;

    /**
     * Раунд заводится вместе с компонентом, а не с первым `play`.
     *
     * Так подписаться на него можно раньше, чем игрок что-нибудь выбрал, и
     * порядок `start` у соседей по сцене перестаёт что-либо значить.
     */
    private readonly session = new LevelSession();
    private readonly random = new MathRandomSource();
    private readonly subs = new SubscriptionBag();
    private items: readonly FallingItemConfig[] = [];
    private planner: FallingItemSpawnPlanner | null = null;
    private behaviours = new Map<string, FallBehaviour>();

    /** Итог раунда для тех, кому он нужен снаружи: меты и панели итога. */
    get finished(): Subscribable<LevelOutcome> {
        return this.session.finished;
    }

    /**
     * Игрок бросил раунд из паузы. Что это значит — вернуть меню, обнулить
     * показатели — решает мета: раунд про меню не знает.
     */
    get exitClicked(): Subscribable<void> {
        return this.pausePanel.exitClicked;
    }

    /**
     * Связывание живёт в `start`, а не в `onLoad`: к этому моменту `onLoad`
     * у всех соседей уже отработал, и спрашивать их можно, ничего не угадывая.
     */
    start(): void {
        // Единственное место, где ассеты сцены превращаются в документы с
        // именами. Дальше правила просят конфиг по имени и не знают, лежит он
        // в сборке или пришёл откуда-то ещё.
        const configs = new JsonConfigSource([['falling-items.json', this.itemsConfig.json]]);
        this.items = parse(configs, 'falling-items.json', readFallingItems);

        const session = this.session;
        // Виджеты связываются до старта раунда: иначе первый счёт и первая
        // секунда прошли бы мимо них, а снимок они возьмут уже обнулённый.
        this.scoreLabel.bind(session);
        this.comboLabel.bind(session);
        this.timerLabel.bind(session);
        this.livesView.bind(session);
        this.pausePanel.bind(session);
        this.subs.add(this.pauseButton.clicked, () => session.pause());
        this.subs.add(this.pausePanel.resumeClicked, () => session.resume());
        this.subs.add(session.stateChanged, state => {
            // Показатели и корзина живут ровно столько, сколько идёт раунд:
            // в покое на экране меню, а корзине под кнопками делать нечего.
            const started = state !== 'idle';
            this.hud.active = started;
            this.basket.node.active = started;
            // Управление слушает мышь только пока раунд идёт. Иначе прицел
            // живёт и на паузе: корзина стоит, а цель уезжает за курсором — и
            // снятие паузы отправляет её туда, куда игрок не целился.
            this.basketControl.enabled = state === 'running';
        });
        this.subs.add(session.finished, () => {
            this.spawner.recycleAll();
            this.popups.recycleAll();
        });
        // Вкладку свернули — раунд встаёт сам. Движок в это время не тикает
        // вовсе, так что доиграться без игрока раунд не может; пауза нужна для
        // возвращения: иначе игра оживает в ту же секунду, когда игрок ещё
        // смотрит на вкладку, а не на поле.
        game.on(Game.EVENT_HIDE, this.pauseOnHide, this);

        // Покой до первого раунда: поле пустое, показателей нет, корзины тоже.
        this.hud.active = false;
        this.basket.node.active = false;
        this.basketControl.enabled = false;
    }

    onDestroy(): void {
        game.off(Game.EVENT_HIDE, this.pauseOnHide, this);
        this.subs.clear();
    }

    /**
     * Начать раунд по этим настройкам — первый или любой следующий.
     *
     * Поведения падения и планировщик заводятся здесь, а не в `start`: темп и
     * густота приходят с уровнем и меняются вместе с ним. Заодно это сбрасывает
     * отсчёт до первого предмета — иначе он появился бы по остатку от прошлого
     * раунда.
     */
    play(level: LevelConfig): void {
        this.spawner.recycleAll();
        this.popups.recycleAll();
        this.behaviours = createFallBehaviours(this.items, level.fallTempo);
        this.planner = new FallingItemSpawnPlanner(this.items, level.spawn, this.random, level.dangerProximity);
        this.session.start(level);
    }

    /**
     * Вернуть игру в покой: поле пустое, показателей нет, раунд закрыт.
     *
     * Нужно, когда игрок ушёл с панели итога обратно к выбору: без этого
     * показатели доигранного раунда остались бы висеть поверх меню.
     */
    stop(): void {
        this.spawner.recycleAll();
        this.planner = null;
        this.session.reset();
    }

    private pauseOnHide(): void {
        this.session.pause();
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
        if (planner === null) {
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
                const awarded = session.applyCatch(item.config);
                // Пойманным мог оказаться последний мухомор: раунд кончился
                // прямо здесь и убрал поле целиком. Возвращать в пул нечего,
                // следующий обход прочитал бы уже пустое место, а всплывашка
                // повисла бы над панелью итога — тикать её больше некому.
                if (!session.running) {
                    break;
                }
                this.popups.show(item.node.position.x, item.node.position.y, awarded);
                this.spawner.recycle(item);
            } else if (verdict === 'missed') {
                session.applyMiss(item.config);
                this.spawner.recycle(item);
            }
        }

        this.popups.tick(step);
        this.basket.tick();
    }
}
