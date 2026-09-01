import { _decorator, Button, Component } from 'cc';
import { Signal, Subscribable } from '../../utils/Signal';

const { ccclass } = _decorator;

/**
 * Кнопка паузы.
 *
 * Командует событием, а не вызовом: что делает нажатие, решает раунд.
 *
 * Знак у кнопки один и не меняется. Снять паузу ею нельзя — для этого есть
 * «Продолжить» на панели, а сама кнопка в это время под панелью и не нажимается.
 */
@ccclass('PauseButton')
export class PauseButton extends Component {
    private readonly _clicked = new Signal('pauseClicked');

    get clicked(): Subscribable<void> {
        return this._clicked;
    }

    onEnable(): void {
        this.node.on(Button.EventType.CLICK, this.onClick, this);
    }

    onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.onClick, this);
    }

    private onClick(): void {
        this._clicked.emit();
    }
}
