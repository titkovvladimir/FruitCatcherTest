import { _decorator, Color, Component, Label, Node, NodePool, UITransform } from 'cc';
import { FallingItemConfig } from '../../core/logic/config/FallingItemConfig';

const { ccclass, property } = _decorator;

/** Сколько живёт одна надпись, секунд. */
const LIFE = 0.7;
/** На сколько точек она успевает подняться за свою жизнь. */
const RISE = 90;

const GOOD = new Color(255, 255, 255, 255);
const BAD = new Color(235, 90, 80, 255);

/** Надпись в полёте: узел, её возраст, цвет и с чего начиналась высота. */
interface Popup {
    readonly node: Node;
    readonly label: Label;
    readonly color: Color;
    readonly startY: number;
    age: number;
}

/** Что показать над пойманным; `null` — показывать нечего. */
interface Shown {
    readonly text: string;
    readonly color: Color;
}

/**
 * Всплывающие числа очков над пойманным.
 *
 * Без них множитель серии виден только по счётчику, который прибавляется рывком
 * и ничего не объясняет: «+240» над вишней говорит игроку, что серия работает,
 * ровно в тот момент, когда он на неё смотрит. Число всплывает уже с
 * множителем — базовая цена предмета игроку ни о чём не говорит.
 *
 * Показывает и плохое. Пустое сердце над мухомором и красные очки над кислым:
 * до этого игра громко хвалила и молча наказывала, а «+15» над лимоном белым
 * цветом выглядело наградой за то, что стоило серии.
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

    /**
     * Показать над точкой в координатах поля, чем обернулась поимка.
     *
     * `amount` — уже начисленное, вместе с множителем: считает его раунд, а
     * показывает эта надпись, и второго места, где очки умножаются, в игре нет.
     */
    show(x: number, y: number, amount: number, item: FallingItemConfig): void {
        const shown = describe(amount, item);
        if (shown === null) {
            return;
        }
        const node = this.take();
        node.parent = this.node;
        node.setPosition(x, y);
        const label = node.getComponent(Label)!;
        label.string = shown.text;
        label.color = shown.color;
        this.living.push({ node, label, color: shown.color, startY: y, age: 0 });
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
            const color = popup.color;
            popup.label.color = new Color(color.r, color.g, color.b, Math.round(255 * (1 - fade)));
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

/**
 * Что игрок увидит над предметом.
 *
 * Читается из данных предмета, а не из его имени: отнял жизнь — пустое сердце,
 * сбил серию — красные очки, добыча — белые. Появится второй опасный тип, и
 * показывать его будет нечему учить.
 */
function describe(amount: number, item: FallingItemConfig): Shown | null {
    if (item.lifeChange < 0) {
        return { text: '♡', color: BAD };
    }
    if (amount <= 0) {
        return null;
    }
    return { text: `+${amount}`, color: item.combo === 'grow' ? GOOD : BAD };
}
