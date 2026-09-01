import { _decorator, Button, Component, Label } from 'cc';
import { Difficulty, readDifficulty } from '../../meta/logic/Difficulty';
import { Signal, Subscribable } from '../../utils/Signal';

const { ccclass, property } = _decorator;

/**
 * Подпись кнопки по её сложности.
 *
 * В коде, а не в сцене, нарочно: подпись и запускаемый уровень — одно и то же
 * решение, и разъехаться им негде. Кнопка с надписью «Легко», запускающая
 * тяжёлый раунд, была бы тихой ошибкой сцены.
 */
const TITLES: { readonly [D in Difficulty]: string } = {
    easy: 'Легко',
    normal: 'Обычно',
    hard: 'Сложно',
};

/**
 * Кнопка запуска уровня. Их три, у каждой своя сложность.
 *
 * Командует событием, а не вызовом: кнопка знает, какую сложность она значит, и
 * не знает, что с этим сделают. Собственный запуск внутри кнопки означал бы
 * третий экземпляр знания «как начинается игра» — после сборщика и панели
 * итога.
 */
@ccclass('DifficultyButton')
export class DifficultyButton extends Component {
    /** Сложность строкой: `easy`, `normal` или `hard`. */
    @property
    difficulty: string = 'normal';

    @property(Label)
    label: Label = null!;

    /** Строка рекорда под названием сложности. */
    @property(Label)
    record: Label = null!;

    private readonly _clicked = new Signal<Difficulty>('difficultyClicked');
    private value: Difficulty = 'normal';

    get clicked(): Subscribable<Difficulty> {
        return this._clicked;
    }

    /** Сложность этой кнопки. Спрашивает мета, чтобы дать ей её рекорд. */
    get difficultyValue(): Difficulty {
        return this.value;
    }

    /**
     * Рекорд под названием. Ноль — рекорда ещё нет, и строка пустая: «рекорд 0»
     * на нетронутой сложности выглядел бы как ноль очков, а не как её отсутствие.
     */
    showRecord(score: number): void {
        this.record.string = score > 0 ? `рекорд ${score}` : '';
    }

    /**
     * Имя сложности разбирается на загрузке, а не по нажатию: опечатка в сцене
     * должна падать сразу, а не в тот момент, когда игрок уже нажал.
     */
    onLoad(): void {
        this.value = readDifficulty(this.difficulty, `DifficultyButton(${this.node.name}).difficulty`);
        this.label.string = TITLES[this.value];
    }

    onEnable(): void {
        this.node.on(Button.EventType.CLICK, this.onClick, this);
    }

    onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.onClick, this);
    }

    private onClick(): void {
        this._clicked.emit(this.value);
    }
}
