import { _decorator, Component, Node, NodePool, Sprite, SpriteFrame, UITransform } from 'cc';
import { FallingItemConfig, horizontalReach } from '../../logic/config/FallingItemConfig';
import { FallBehaviour } from '../../logic/fall/FallBehaviour';
import { Field } from '../Field';
import { FallingItem } from './FallingItem';

const { ccclass, property } = _decorator;

/**
 * Кладёт предметы на поле и забирает их обратно.
 *
 * Решать, что и когда появится, — работа планировщика из слоя правил. Здесь
 * только узлы: достать из пула, поставить в точку, вернуть в пул.
 *
 * Узел предмета собирается кодом, а не берётся из префаба. Настраивать в
 * префабе было бы нечего: размер и картинка приходят из таблицы типов, а
 * больше у предмета сейчас ничего нет. Появится у него украшение — хвост,
 * тень, вспышка при поимке — тогда появится и префаб.
 */
@ccclass('FallingItemSpawner')
export class FallingItemSpawner extends Component {
    /** Область, в которую кладутся предметы: из неё берётся полоса появления. */
    @property(Field)
    field: Field = null!;

    /** Узел-родитель для предметов. */
    @property(Node)
    container: Node = null!;

    /** Картинки предметов. Тип находит свою по имени из поля `texture`. */
    @property([SpriteFrame])
    sprites: SpriteFrame[] = [];

    private readonly pool = new NodePool();
    private readonly frames = new Map<string, SpriteFrame>();
    private readonly living: FallingItem[] = [];

    /** Предметы в полёте. Двигает и разбирает их тот, кто ведёт тик. */
    get items(): readonly FallingItem[] {
        return this.living;
    }

    onLoad(): void {
        for (const frame of this.sprites) {
            if (frame !== null) {
                this.frames.set(frame.name, frame);
            }
        }
    }

    onDestroy(): void {
        this.pool.clear();
    }

    /**
     * Кладёт новый предмет на поле.
     *
     * `position` — доля ширины полосы появления, как её отдаёт планировщик.
     * Полоса уже, чем поле: с краёв отступ на размах предмета, иначе банан
     * уехал бы за границу на первом же качании.
     */
    spawn(config: FallingItemConfig, behaviour: FallBehaviour, position: number): FallingItem {
        const reach = horizontalReach(config);
        const span = Math.max(0, this.field.width - reach * 2);
        const x = this.field.left + reach + position * span;
        const y = this.field.top + config.radius;

        const item = this.take();
        item.node.parent = this.container;
        item.launch(config, behaviour, this.frameFor(config), x, y);
        this.living.push(item);
        return item;
    }

    /** Предмет отыгран: узел уходит в пул и ждёт следующего. */
    recycle(item: FallingItem): void {
        const index = this.living.indexOf(item);
        if (index === -1) {
            return;
        }
        this.living.splice(index, 1);
        this.pool.put(item.node);
    }

    /** Конец раунда: поле очищается разом. */
    recycleAll(): void {
        for (let i = this.living.length - 1; i >= 0; i -= 1) {
            this.pool.put(this.living[i].node);
        }
        this.living.length = 0;
    }

    private take(): FallingItem {
        const pooled = this.pool.get();
        if (pooled !== null) {
            return pooled.getComponent(FallingItem)!;
        }
        const node = new Node('FallingItem');
        node.layer = this.container.layer;
        node.addComponent(UITransform);
        node.addComponent(Sprite);
        return node.addComponent(FallingItem);
    }

    private frameFor(config: FallingItemConfig): SpriteFrame {
        const frame = this.frames.get(config.texture);
        if (frame === undefined) {
            throw new Error(
                `FallingItemSpawner: для типа «${config.id}» нет картинки «${config.texture}». Подключены: ${[...this.frames.keys()].join(', ')}`,
            );
        }
        return frame;
    }
}
