import { _decorator, Button, Component, Node } from 'cc';
import { LevelSession } from '../../../core/logic/LevelSession';
import { Signal, Subscribable } from '../../../utils/Signal';
import { SubscriptionBag } from '../../../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Пауза с выбором: продолжить или выйти к сложностям.
 *
 * Двух кнопок на поле не осталось нарочно. Выход — редкое и необратимое
 * действие, и стоять ему рядом с паузой, куда игрок целится посреди раунда,
 * незачем: промах по соседней кнопке стоил бы раунда. Теперь до выхода два
 * шага, и второй сделан на остановленной игре.
 *
 * Панель показывает себя сама по состоянию раунда: снаружи её никто не
 * открывает, а пауза может прийти и без игрока — со свёрнутой вкладки.
 *
 * Ввод панель перехватывает: под ней остановленное поле, и клики ему не нужны.
 */
@ccclass('PausePanel')
export class PausePanel extends Component {
    /** Узлы кнопок: панель слушает нажатия и переизлучает своими событиями. */
    @property(Node)
    resumeButton: Node = null!;

    @property(Node)
    exitButton: Node = null!;

    private readonly _resumeClicked = new Signal('resumeClicked');
    private readonly _exitClicked = new Signal('exitClicked');
    private readonly subs = new SubscriptionBag();

    get resumeClicked(): Subscribable<void> {
        return this._resumeClicked;
    }

    get exitClicked(): Subscribable<void> {
        return this._exitClicked;
    }

    bind(session: LevelSession): void {
        this.render(session.state === 'paused');
        this.subs.add(session.stateChanged, state => this.render(state === 'paused'));
    }

    onEnable(): void {
        this.resumeButton.on(Button.EventType.CLICK, this.onResume, this);
        this.exitButton.on(Button.EventType.CLICK, this.onExit, this);
    }

    onDisable(): void {
        this.resumeButton.off(Button.EventType.CLICK, this.onResume, this);
        this.exitButton.off(Button.EventType.CLICK, this.onExit, this);
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private onResume(): void {
        this._resumeClicked.emit();
    }

    private onExit(): void {
        this._exitClicked.emit();
    }

    private render(paused: boolean): void {
        this.node.active = paused;
    }
}
