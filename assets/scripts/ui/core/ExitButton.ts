import { _decorator, Button, Component } from 'cc';
import { Signal, Subscribable } from '../../utils/Signal';

const { ccclass } = _decorator;

/**
 * Выход из раунда к выбору сложности.
 *
 * Стоит рядом с паузой и по той же причине, по которой пауза стоит в углу: это
 * не игровое действие, и попасть по нему случайно, водя корзину, игрок не
 * должен.
 *
 * Как и пауза, командует событием: что значит выход — бросить раунд, вернуть
 * меню, обнулить показатели — знает мета, а не кнопка.
 */
@ccclass('ExitButton')
export class ExitButton extends Component {
    private readonly _clicked = new Signal('exitClicked');

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
