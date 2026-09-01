import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';
import { BasketMouth } from '../../logic/catch/CatchResolver';
import { BasketConfig } from '../../logic/config/BasketConfig';
import { Field } from '../Field';

const { ccclass, property } = _decorator;

/**
 * Корзина: едет за целевой точкой и отдаёт разбору ловли свой проём.
 *
 * Целевую точку запоминает ввод, а едет корзина в тике. Иначе скорость
 * движения зависела бы от частоты событий мыши, то есть от мыши игрока, а не
 * от игры.
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
    private config: BasketConfig | null = null;
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

    bind(config: BasketConfig): void {
        this.config = config;
    }

    /** Ввод только запоминает, куда игрок целится. Двигаться — работа тика. */
    aimAt(x: number): void {
        this.targetX = x;
    }

    tick(dt: number): void {
        const config = this.config;
        if (config === null) {
            return;
        }
        const target = this.clampToField(this.targetX);
        const current = this.node.position.x;
        const distance = target - current;

        if (Math.abs(distance) <= config.snapDistance) {
            this.node.setPosition(target, this.node.position.y);
            return;
        }
        const step = Math.min(Math.abs(distance), config.speed * dt);
        this.node.setPosition(current + Math.sign(distance) * step, this.node.position.y);
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
