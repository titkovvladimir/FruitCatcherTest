import { _decorator, Button, Component, Label, Node } from 'cc';
import { LevelOutcome } from '../../../core/logic/LevelOutcome';
import { Signal, Subscribable } from '../../../utils/Signal';

const { ccclass, property } = _decorator;

/**
 * Итог раунда: чем он кончился, сколько набрано и два выхода — тот же уровень
 * ещё раз или назад к выбору сложности.
 *
 * Панель ничего не запускает сама — поднимает событие, а решает мета. Иначе
 * показ знал бы, как устроен запуск, и второму способу начать игру — кнопке
 * сложности — пришлось бы знать то же самое во второй раз.
 */
@ccclass('LevelResultPanel')
export class LevelResultPanel extends Component {
    @property(Label)
    title: Label = null!;

    @property(Label)
    summary: Label = null!;

    /** Строка рекорда: своя, чтобы её было видно отдельно от итога раунда. */
    @property(Label)
    record: Label = null!;

    /** Узел кнопки: панель слушает его нажатие и переизлучает своим событием. */
    @property(Node)
    restartButton: Node = null!;

    /** Тот же уровень ещё раз — или обратно к выбору сложности. */
    @property(Node)
    menuButton: Node = null!;

    private readonly _restartClicked = new Signal('restartClicked');
    private readonly _menuClicked = new Signal('menuClicked');

    get restartClicked(): Subscribable<void> {
        return this._restartClicked;
    }

    get menuClicked(): Subscribable<void> {
        return this._menuClicked;
    }

    onEnable(): void {
        this.restartButton.on(Button.EventType.CLICK, this.onRestart, this);
        this.menuButton.on(Button.EventType.CLICK, this.onMenu, this);
    }

    onDisable(): void {
        this.restartButton.off(Button.EventType.CLICK, this.onRestart, this);
        this.menuButton.off(Button.EventType.CLICK, this.onMenu, this);
    }

    /**
     * `best` — рекорд этой сложности, уже с учётом только что сыгранного
     * раунда; `beaten` — побил ли его игрок этим раундом. Оба приходят числом и
     * флагом: панель показывает, а считает мета.
     */
    show(outcome: LevelOutcome, best: number, beaten: boolean): void {
        this.title.string = outcome.ending === 'lives' ? 'Жизни кончились' : 'Время вышло';
        this.summary.string = `Очки: ${outcome.score}\nПоймано: ${outcome.caught}   мимо: ${outcome.missed}`;
        this.record.string = beaten ? 'Новый рекорд!' : `Рекорд: ${best}`;
        this.node.active = true;
    }

    hide(): void {
        this.node.active = false;
    }

    private onRestart(): void {
        this._restartClicked.emit();
    }

    private onMenu(): void {
        this._menuClicked.emit();
    }
}
