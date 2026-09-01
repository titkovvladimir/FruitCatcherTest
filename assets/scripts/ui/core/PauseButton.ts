import { _decorator, Button, Component, Label } from 'cc';
import { LevelSession } from '../../core/logic/LevelSession';
import { Signal, Subscribable } from '../../utils/Signal';
import { SubscriptionBag } from '../../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Кнопка паузы.
 *
 * Командует событием, а не вызовом: что делает нажатие, решает раунд. Читать
 * ему при этом можно — по состоянию кнопка выбирает свой знак, иначе игрок,
 * вернувшись к остановленной игре, не понял бы, идёт она или стоит.
 */
@ccclass('PauseButton')
export class PauseButton extends Component {
    @property(Label)
    label: Label = null!;

    private readonly _clicked = new Signal('pauseClicked');
    private readonly subs = new SubscriptionBag();

    get clicked(): Subscribable<void> {
        return this._clicked;
    }

    bind(session: LevelSession): void {
        this.render(session.state === 'paused');
        this.subs.add(session.stateChanged, state => this.render(state === 'paused'));
    }

    onEnable(): void {
        this.node.on(Button.EventType.CLICK, this.onClick, this);
    }

    onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.onClick, this);
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private onClick(): void {
        this._clicked.emit();
    }

    /** Знак показывает не текущее состояние, а то, что случится по нажатию. */
    private render(paused: boolean): void {
        this.label.string = paused ? '▶' : '❚❚';
    }
}
