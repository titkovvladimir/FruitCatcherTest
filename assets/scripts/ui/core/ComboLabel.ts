import { _decorator, Component, Label } from 'cc';
import { ComboState } from '../../core/logic/ComboState';
import { LevelSession } from '../../core/logic/LevelSession';
import { SubscriptionBag } from '../../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Серия без ошибок — строкой под счётом.
 *
 * Показывается, только когда множитель что-то даёт. «×1» — это обычная цена,
 * и сообщать о ней нечего: строка на экране должна значить прибавку, иначе
 * игрок перестанет на неё смотреть.
 */
@ccclass('ComboLabel')
export class ComboLabel extends Component {
    @property(Label)
    label: Label = null!;

    private readonly subs = new SubscriptionBag();

    bind(session: LevelSession): void {
        this.render(session.combo);
        this.subs.add(session.comboChanged, combo => this.render(combo));
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private render(combo: ComboState): void {
        this.label.string = combo.multiplier > 1 ? `×${combo.multiplier}` : '';
    }
}
