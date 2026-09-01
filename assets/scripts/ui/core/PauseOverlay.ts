import { _decorator, Component } from 'cc';
import { LevelSession } from '../../core/logic/LevelSession';
import { SubscriptionBag } from '../../utils/SubscriptionBag';

const { ccclass } = _decorator;

/**
 * Надпись «Пауза» поверх замершего поля.
 *
 * Без неё пауза выглядит как зависание: поле стоит, и единственный признак —
 * маленький знак в углу. Особенно это про паузу, которую игрок не ставил: она
 * включается сама, когда вкладку свернули, и вернувшийся игрок видит
 * неподвижную картинку без всякого объяснения.
 *
 * Ввод не перехватывает намеренно: кнопка паузы должна остаться нажимаемой, а
 * она рисуется поверх этой надписи.
 */
@ccclass('PauseOverlay')
export class PauseOverlay extends Component {
    private readonly subs = new SubscriptionBag();

    bind(session: LevelSession): void {
        this.render(session.state === 'paused');
        this.subs.add(session.stateChanged, state => this.render(state === 'paused'));
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private render(paused: boolean): void {
        this.node.active = paused;
    }
}
