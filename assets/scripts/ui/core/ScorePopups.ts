import { _decorator, Color, Component, Label, Node, NodePool, UITransform } from 'cc';

const { ccclass, property } = _decorator;

/** Сколько живёт одна надпись, секунд. */
const LIFE = 0.7;
/** На сколько точек она успевает подняться за свою жизнь. */
const RISE = 90;

/** Надпись в полёте: узел, её возраст и с чего начиналась высота. */
interface Popup {
    readonly node: Node;
    readonly label: Label;
    readonly startY: number;
    age: number;
}

/**
 * Всплывающие числа очков над пойманным.
 *
 * Без них множитель серии виден только по счётчику, который прибавляется рывком
 * и ничего не объясняет: «плюс сорок» над вишней говорит игроку, что серия
 * работает, ровно в тот момент, когда он на неё смотрит.
 *
 * Двигаются в общем тике, а не твином. Твин крутится собственным планировщиком
 * движка и на паузе продолжает лететь; здесь же надпись останавливается вместе
 * со всем полем, потому что шаг ей отмеряет тот же, кто ведёт раунд.
 *
 * Узлы собираются кодом и возвращаются в пул — как у падающих предметов и по
 * той же причине: настраивать в префабе нечего.
 */
@ccclass('ScorePopups')
export class ScorePopups extends Component {
    /** Размер надписи, точки. */
    @property
    fontSize = 40;

    private readonly pool = new NodePool();
    private readonly living: Popup[] = [];

    onDestroy(): void {
        this.pool.clear();
    }

    /** Показать прибавку над точкой в координатах поля. */
    show(x: number, y: number, amount: number): void {
        if (amount <= 0) {
            return;
        }
        const node = this.take();
        node.parent = this.node;
        node.setPosition(x, y);
        const label = node.getComponent(Label)!;
        label.string = `+${amount}`;
        label.color = new Color(255, 255, 255, 255);
        this.living.push({ node, label, startY: y, age: 0 });
    }

    /** Все надписи разом убираются вместе с полем — на конце раунда. */
    recycleAll(): void {
        for (let i = this.living.length - 1; i >= 0; i -= 1) {
            this.pool.put(this.living[i].node);
        }
        this.living.length = 0;
    }

    tick(dt: number): void {
        for (let i = this.living.length - 1; i >= 0; i -= 1) {
            const popup = this.living[i];
            popup.age += dt;
            if (popup.age >= LIFE) {
                this.living.splice(i, 1);
                this.pool.put(popup.node);
                continue;
            }
            const progress = popup.age / LIFE;
            popup.node.setPosition(popup.node.position.x, popup.startY + RISE * progress);
            // Гаснет во второй половине жизни: в первой надпись должна успеть
            // прочитаться, а не растаять на глазах.
            const fade = Math.max(0, (progress - 0.5) * 2);
            popup.label.color = new Color(255, 255, 255, Math.round(255 * (1 - fade)));
        }
    }

    private take(): Node {
        const pooled = this.pool.get();
        if (pooled !== null) {
            return pooled;
        }
        const node = new Node('ScorePopup');
        node.layer = this.node.layer;
        node.addComponent(UITransform).setContentSize(160, this.fontSize + 8);
        const label = node.addComponent(Label);
        label.fontSize = this.fontSize;
        label.lineHeight = this.fontSize + 8;
        label.isBold = true;
        label.enableOutline = true;
        label.outlineColor = new Color(30, 30, 30, 255);
        label.outlineWidth = 3;
        return node;
    }
}
