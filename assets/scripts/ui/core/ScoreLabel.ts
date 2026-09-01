import { _decorator, Component, Label } from 'cc';
import { LevelSession } from '../../core/logic/LevelSession';
import { SubscriptionBag } from '../../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

/**
 * Счёт на экране.
 *
 * Раунду о нём знать нечего: подписку и провод делает сборщик уровня. Сам
 * виджет ничего не решает — берёт число и рисует его.
 */
@ccclass('ScoreLabel')
export class ScoreLabel extends Component {
    @property(Label)
    label: Label = null!;

    private readonly subs = new SubscriptionBag();

    /**
     * Сначала снимок, потом события. Без снимка виджет, связанный посреди
     * раунда, показывал бы ноль до первого начисления.
     */
    bind(session: LevelSession): void {
        this.render(session.score);
        this.subs.add(session.scoreChanged, score => this.render(score));
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private render(score: number): void {
        this.label.string = `${score}`;
    }
}
