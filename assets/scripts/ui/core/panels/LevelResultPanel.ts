import { _decorator, Button, Component, Label, Node } from 'cc';
import { LevelOutcome } from '../../../core/logic/LevelOutcome';
import { Signal, Subscribable } from '../../../utils/Signal';

const { ccclass, property } = _decorator;

/**
 * Итог раунда: чем он кончился, сколько набрано и предложение сыграть ещё.
 *
 * Панель не перезапускает раунд сама — поднимает событие, а решает раунд.
 * Иначе показ знал бы, как устроен запуск, и второй способ начать игру (кнопка
 * сложности из меты) пришлось бы учить тому же самому.
 */
@ccclass('LevelResultPanel')
export class LevelResultPanel extends Component {
    @property(Label)
    title: Label = null!;

    @property(Label)
    summary: Label = null!;

    /** Узел кнопки: панель слушает его нажатие и переизлучает своим событием. */
    @property(Node)
    restartButton: Node = null!;

    private readonly _restartClicked = new Signal('restartClicked');

    get restartClicked(): Subscribable<void> {
        return this._restartClicked;
    }

    onEnable(): void {
        this.restartButton.on(Button.EventType.CLICK, this.onRestart, this);
    }

    onDisable(): void {
        this.restartButton.off(Button.EventType.CLICK, this.onRestart, this);
    }

    show(outcome: LevelOutcome): void {
        this.title.string = outcome.ending === 'lives' ? 'Жизни кончились' : 'Время вышло';
        this.summary.string = `Очки: ${outcome.score}\nПоймано: ${outcome.caught}   мимо: ${outcome.missed}`;
        this.node.active = true;
    }

    hide(): void {
        this.node.active = false;
    }

    private onRestart(): void {
        this._restartClicked.emit();
    }
}
