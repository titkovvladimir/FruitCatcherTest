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
    private total = 0;

    bind(session: LevelSession): void {
        this.total = session.lives;
        this.render(session.lives);
        this.subs.add(session.lifeLost, lives => this.render(lives));
        // Новый раунд возвращает жизни молча: событие есть только на потерю.
        this.subs.add(session.stateChanged, state => {
            if (state === 'running') {
                this.render(session.lives);
            }
        });
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private render(lives: number): void {
        let hearts = '';
        for (let i = 0; i < this.total; i += 1) {
            hearts += i < lives ? '♥' : '♡';
        }
        this.label.string = hearts;
    }
}
