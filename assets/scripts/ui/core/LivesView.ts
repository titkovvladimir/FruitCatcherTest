import { _decorator, Component, Label } from 'cc';
import { LevelSession } from '../../core/logic/LevelSession';
import { SubscriptionBag } from '../../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Запас жизней.
 *
 * Рисуется символами, а не картинками: сердца среди выданных ассетов нет, а
 * лепить его из фруктов — значит спорить с языком, на котором игра уже говорит
 * («фрукт — добыча»). Потраченные жизни остаются пустыми контурами: сколько
 * было всего, видно и после потери.
 */
@ccclass('LivesView')
export class LivesView extends Component {
    @property(Label)
    label: Label = null!;

    private readonly subs = new SubscriptionBag();
    private session: LevelSession | null = null;

    /**
     * Число ячеек берётся у раунда на каждой перерисовке, а не запоминается
     * здесь: у сложностей запас разный, и запомненное однажды показывало бы
     * запас прошлого раунда.
     */
    bind(session: LevelSession): void {
        this.session = session;
        this.render();
        this.subs.add(session.lifeLost, () => this.render());
        // Новый раунд возвращает жизни молча: событие есть только на потерю.
        this.subs.add(session.stateChanged, () => this.render());
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private render(): void {
        const session = this.session;
        if (session === null) {
            return;
        }
        let hearts = '';
        for (let i = 0; i < session.maxLives; i += 1) {
            hearts += i < session.lives ? '♥' : '♡';
        }
        this.label.string = hearts;
    }
}
