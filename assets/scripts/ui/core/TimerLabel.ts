import { _decorator, Component, Label } from 'cc';
import { LevelSession } from '../../core/logic/LevelSession';
import { SubscriptionBag } from '../../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Сколько осталось до конца раунда.
 *
 * Секунды считает раунд и поднимает событие только когда цифра сменилась, —
 * виджету незачем знать ни про доли секунды, ни про то, что раунд вообще
 * тикает.
 */
@ccclass('TimerLabel')
export class TimerLabel extends Component {
    @property(Label)
    label: Label = null!;

    private readonly subs = new SubscriptionBag();

    bind(session: LevelSession): void {
        this.render(session.secondsLeft);
        this.subs.add(session.timeChanged, seconds => this.render(seconds));
    }

    onDestroy(): void {
        this.subs.clear();
    }

    /**
     * «1:05»: минуты без ведущего нуля, секунды всегда двумя цифрами. Голое
     * число секунд читается как счёт, а не как время, — а эти двое стоят в
     * одном ряду.
     */
    private render(seconds: number): void {
        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;
        this.label.string = `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
    }
}
