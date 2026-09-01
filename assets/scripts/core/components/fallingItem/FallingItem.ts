import { _decorator, Component, Sprite, SpriteFrame, UITransform } from 'cc';
import { ItemMotion } from '../../logic/catch/CatchResolver';
import { FallingItemConfig } from '../../logic/config/FallingItemConfig';
import { FallBehaviour } from '../../logic/fall/FallBehaviour';

const { ccclass } = _decorator;

/**
 * Падающий предмет на сцене.
 *
 * Правил не знает: куда лететь, решает траектория, что даёт поимка — таблица
 * типов. Здесь только узел, спрайт и время жизни.
 *
 * Узел переиспользуется через пул, поэтому всё состояние выставляется в
 * `launch`, а не в конструкторе или `onLoad`: предмет из пула получает новый
 * тип, новую точку появления и обнулённый возраст.
 */
@ccclass('FallingItem')
export class FallingItem extends Component {
    private transform: UITransform = null!;
    private sprite: Sprite = null!;

    private itemConfig: FallingItemConfig | null = null;
    private behaviour: FallBehaviour | null = null;
    private originX = 0;
    private originY = 0;
    private age = 0;
    private previousY = 0;

    onLoad(): void {
        this.transform = this.getComponent(UITransform) ?? this.addComponent(UITransform)!;
        this.sprite = this.getComponent(Sprite) ?? this.addComponent(Sprite)!;
        this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }

    /** Тип предмета. Спрашивать до выдачи из пула нечего — там ещё пусто. */
    get config(): FallingItemConfig {
        if (this.itemConfig === null) {
            throw new Error('FallingItem: предмет ещё не выдан из пула, типа у него нет');
        }
        return this.itemConfig;
    }

    /** Где предмет был и где стал — то, что нужно разбору ловли. */
    get motion(): ItemMotion {
        const position = this.node.position;
        return {
            x: position.x,
            y: position.y,
            previousY: this.previousY,
            radius: this.config.radius,
        };
    }

    /** Выдача из пула: предмет становится собой и встаёт в точку появления. */
    launch(config: FallingItemConfig, behaviour: FallBehaviour, frame: SpriteFrame, x: number, y: number): void {
        this.itemConfig = config;
        this.behaviour = behaviour;
        this.originX = x;
        this.originY = y;
        this.age = 0;
        this.previousY = y;

        this.transform.setContentSize(config.radius * 2, config.radius * 2);
        this.sprite.spriteFrame = frame;
        this.node.setPosition(x, y);
    }

    /**
     * Позиция считается от точки появления по возрасту, а не прибавляется к
     * прошлой: путь получается один и тот же на любой частоте кадров.
     */
    tick(dt: number): void {
        if (this.behaviour === null) {
            return;
        }
        this.age += dt;
        this.previousY = this.node.position.y;
        const offset = this.behaviour.offsetAt(this.age);
        this.node.setPosition(this.originX + offset.x, this.originY + offset.y);
    }
}
