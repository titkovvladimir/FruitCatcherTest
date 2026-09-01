import { _decorator, Component, UITransform, Vec3 } from 'cc';

const { ccclass } = _decorator;

/**
 * Игровая область: полоса, в которой появляются и падают предметы и внутри
 * которой ходит корзина.
 *
 * Границы читаются из `UITransform` своего узла, а не задаются числами в коде.
 * Размер узла в сцене меняется вместе с окном, поэтому границы считаются на
 * каждое обращение, а не запоминаются один раз при запуске.
 *
 * Координаты — собственные координаты области: в них лежат её дети, то есть
 * падающие предметы и корзина.
 */
@ccclass('Field')
export class Field extends Component {
    private transform: UITransform | null = null;

    /** Ширина области. */
    get width(): number {
        return this.uiTransform.contentSize.width;
    }

    /** Высота области. */
    get height(): number {
        return this.uiTransform.contentSize.height;
    }

    /** Левая граница. */
    get left(): number {
        return -this.width * this.uiTransform.anchorX;
    }

    /** Правая граница. */
    get right(): number {
        return this.width * (1 - this.uiTransform.anchorX);
    }

    /** Нижняя граница: ниже неё предмет считается упавшим мимо. */
    get bottom(): number {
        return -this.height * this.uiTransform.anchorY;
    }

    /** Верхняя граница: от неё предметы начинают падать. */
    get top(): number {
        return this.height * (1 - this.uiTransform.anchorY);
    }

    /**
     * Переводит точку из мировых координат в координаты области.
     *
     * Нужно всем, кто получает точку снаружи: курсор мыши, узел корзины,
     * проём. Живёт здесь, чтобы перевод был в одном месте, а не повторялся в
     * каждом, кому он понадобился.
     */
    toLocal(world: Vec3, out?: Vec3): Vec3 {
        return this.uiTransform.convertToNodeSpaceAR(world, out);
    }

    private get uiTransform(): UITransform {
        if (this.transform === null) {
            const transform = this.getComponent(UITransform);
            if (transform === null) {
                throw new Error(`Field: на узле «${this.node.name}» нет UITransform, границы области брать неоткуда`);
            }
            this.transform = transform;
        }
        return this.transform;
    }
}
