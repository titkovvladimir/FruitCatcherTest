import { _decorator, Component, Label } from 'cc';
import { ComboState } from '../../core/logic/ComboState';
import { LevelSession } from '../../core/logic/LevelSession';
import { SubscriptionBag } from '../../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Серия без ошибок — строкой под счётом.
 *
 * Пока серии нет, строка пустая: «серия 0» занимала бы место и сообщала бы
 * ровно ничего. Множитель показывается только когда он больше единицы — до
 * первой ступени игроку важна длина серии, а не то, что очки идут как обычно.
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
        if (combo.streak === 0) {
            this.label.string = '';
            return;
        }
        this.label.string = combo.multiplier > 1 ? `серия ${combo.streak} · ×${combo.multiplier}` : `серия ${combo.streak}`;
    }
}
