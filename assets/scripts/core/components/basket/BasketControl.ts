import { _decorator, Component, EventMouse, EventTouch, Input, input, Vec2, Vec3 } from 'cc';
import { Field } from '../Field';
import { Basket } from './Basket';

const { ccclass, property } = _decorator;

/**
 * Ввод: куда показывает игрок — туда и целится корзина.
 *
 * Мышь и палец приводятся к одному действию: взять точку экрана и отдать её
 * корзине. Разного поведения у них нет намеренно — иначе игра игралась бы
 * по-разному на телефоне и на настольном браузере, и правила ловли пришлось бы
 * подбирать дважды.
 *
 * Палец наводит по абсолютной точке, а не сдвигом от места касания: корзина
 * встаёт под палец, а не «подруливается» им. Относительный сдвиг просит
 * чувствительность — число, которое нечем обосновать и которое пришлось бы
 * подбирать под каждый размер экрана.
 *
 * Здесь только перевод координат и одно присваивание. Ни скорости, ни границ,
 * ни правил: обработчик события не должен решать, как быстро едет корзина —
 * иначе игра пошла бы по-разному на разных мышах.
 *
 * Подписка живёт в `onEnable` / `onDisable`, а не в `onLoad` / `onDestroy`:
 * выключенное управление не должно слышать ввод — например, на паузе.
 */
@ccclass('BasketControl')
export class BasketControl extends Component {
    @property(Basket)
    basket: Basket = null!;

    @property(Field)
    field: Field = null!;

    private readonly worldPoint = new Vec3();
    private readonly localPoint = new Vec3();

    /**
     * Палец, который сейчас ведёт корзину.
     *
     * Экран слышит все касания сразу, а корзина одна. Без выбора ведущего
     * второй палец — положенный на экран большой палец второй руки — дёргал бы
     * корзину к себе. Ведущим становится первый коснувшийся; отпустил — место
     * свободно.
     */
    private leadingTouch: number | null = null;

    onEnable(): void {
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.TOUCH_START, this.onTouchDown, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchUp, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchUp, this);
    }

    onDisable(): void {
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.TOUCH_START, this.onTouchDown, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchUp, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchUp, this);
        this.leadingTouch = null;
    }

    private onMouseMove(event: EventMouse): void {
        this.aimAt(event.getUILocation());
    }

    private onTouchDown(event: EventTouch): void {
        const id = event.getID();
        if (id === null || this.leadingTouch !== null) {
            return;
        }
        this.leadingTouch = id;
        this.aimAt(event.getUILocation());
    }

    /**
     * Ведущего может не быть и во время движения: пауза снимает подписку, и
     * отпускание пальца до неё не доходит. Тогда ведущим становится первый, кто
     * шевельнулся, — иначе после снятия паузы игрок водил бы пальцем впустую,
     * пока не оторвёт его от экрана.
     */
    private onTouchMove(event: EventTouch): void {
        const id = event.getID();
        if (id === null) {
            return;
        }
        if (this.leadingTouch === null) {
            this.leadingTouch = id;
        } else if (this.leadingTouch !== id) {
            return;
        }
        this.aimAt(event.getUILocation());
    }

    private onTouchUp(event: EventTouch): void {
        if (this.leadingTouch === event.getID()) {
            this.leadingTouch = null;
        }
    }

    private aimAt(location: Vec2): void {
        this.worldPoint.set(location.x, location.y, 0);
        this.field.toLocal(this.worldPoint, this.localPoint);
        this.basket.aimAt(this.localPoint.x);
    }
}
