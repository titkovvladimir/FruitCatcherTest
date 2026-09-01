import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';
import { BasketMouth } from '../../logic/catch/CatchResolver';
import { Field } from '../Field';

const { ccclass, property } = _decorator;

/**
 * Корзина: стоит там, куда целится игрок, и отдаёт разбору ловли свой проём.
 *
 * Собственной скорости у неё нет — корзина повторяет курсор без отставания.
 * Скорость руки игрока и есть здесь ограничение, и добавлять к ней вторую,
 * свою, значит спорить с ней: игрок уже привёл прицел куда хотел, а корзина
 * ещё едет.
 *
 * Целевую точку запоминает ввод, а встаёт корзина в тике. Так проём за кадр
 * меняется один раз и в известный момент — до разбора ловли, а не посреди него.
 */
@ccclass('Basket')
export class Basket extends Component {
    /** Область, за границы которой корзина не выезжает. */
    @property(Field)
    field: Field = null!;

    /** Узел проёма: его ширина и высота и есть линия, через которую ловят. */
    @property(Node)
    mouth: Node = null!;

    private transform: UITransform = null!;
    private targetX = 0;

    private readonly worldPoint = new Vec3();
    private readonly localPoint = new Vec3();

    onLoad(): void {
        this.transform = this.getComponent(UITransform) ?? this.addComponent(UITransform)!;
        this.targetX = this.node.position.x;
    }

    /** Проём в координатах области — ровно то, что нужно разбору ловли. */
    get mouthLine(): BasketMouth {
        this.mouth.getWorldPosition(this.worldPoint);
        this.field.toLocal(this.worldPoint, this.localPoint);
        const width = this.mouth.getComponent(UITransform)?.width ?? this.transform.width;
        return { y: this.localPoint.y, centerX: this.localPoint.x, halfWidth: width / 2 };
    }

    /** Ввод только запоминает, куда игрок целится. Двигаться — работа тика. */
    aimAt(x: number): void {
        this.targetX = x;
    }

    tick(): void {
        this.node.setPosition(this.clampToField(this.targetX), this.node.position.y);
    }

    /**
     * Кламп считается каждый раз заново: ширина области меняется вместе с
     * окном, и запомненные границы после первого же поворота телефона врали бы.
     */
    private clampToField(x: number): number {
        const half = this.transform.width / 2;
        const left = this.field.left + half;
        const right = this.field.right - half;
        if (left > right) {
            return (this.field.left + this.field.right) / 2;
        }
        return Math.min(Math.max(x, left), right);
    }
}
