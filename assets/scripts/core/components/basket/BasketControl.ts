import { _decorator, Component, EventMouse, Input, input, Vec3 } from 'cc';
import { Field } from '../Field';
import { Basket } from './Basket';

const { ccclass, property } = _decorator;

/**
 * Ввод: где курсор — туда и целится корзина.
 *
 * Здесь только перевод координат и одно присваивание. Ни скорости, ни границ,
 * ни правил: обработчик события не должен решать, как быстро едет корзина —
 * иначе игра пошла бы по-разному на разных мышах.
 *
 * Подписка живёт в `onEnable` / `onDisable`, а не в `onLoad` / `onDestroy`:
 * выключенное управление не должно слышать мышь — например, на паузе.
 */
@ccclass('BasketControl')
export class BasketControl extends Component {
    @property(Basket)
    basket: Basket = null!;

    @property(Field)
    field: Field = null!;

    private readonly worldPoint = new Vec3();
    private readonly localPoint = new Vec3();

    onEnable(): void {
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    onDisable(): void {
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    private onMouseMove(event: EventMouse): void {
        const location = event.getUILocation();
        this.worldPoint.set(location.x, location.y, 0);
        this.field.toLocal(this.worldPoint, this.localPoint);
        this.basket.aimAt(this.localPoint.x);
    }
}
