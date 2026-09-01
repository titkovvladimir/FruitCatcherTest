import { _decorator, Component, JsonAsset, Node } from 'cc';
import { Difficulty } from '../meta/logic/Difficulty';
import { LEVEL_DOCUMENTS, LevelCatalog, readLevels } from '../meta/logic/LevelCatalog';
import { JsonConfigSource } from '../platform/config/JsonConfigSource';
import { LevelResultPanel } from '../ui/core/panels/LevelResultPanel';
import { DifficultyButton } from '../ui/meta/DifficultyButton';
import { SubscriptionBag } from '../utils/SubscriptionBag';
import { LevelRoot } from './LevelRoot';

const { ccclass, property } = _decorator;

/**
 * Сборка игры: всё, что вокруг раунда. Выбор сложности, покой до первого
 * запуска и то, куда ведут кнопки панели итога.
 *
 * Граница со сборкой уровня простая: раунд не знает, что сложностей три, а мета
 * не знает, как раунд устроен внутри. Между ними ходит `LevelConfig` — уже
 * разобранные настройки, — и итог раунда обратно.
 *
 * Раунд отсюда не запускается на старте: игра открывается меню, а не игрой.
 * Поэтому порядок `start` у сборщиков ничего не решает — до первого нажатия
 * `LevelRoot` никто не трогает.
 */
@ccclass('GameRoot')
export class GameRoot extends Component {
    @property(LevelRoot)
    level: LevelRoot = null!;

    /** Меню выбора сложности: показано в покое, спрятано на время раунда. */
    @property(Node)
    menu: Node = null!;

    /**
     * Кнопки сложности. Списком, а не тремя полями: каждая знает свою
     * сложность сама и приносит её в событии, поэтому порядок здесь ничего не
     * значит.
     */
    @property([DifficultyButton])
    difficultyButtons: DifficultyButton[] = [];

    @property(LevelResultPanel)
    resultPanel: LevelResultPanel = null!;

    /** Настройки уровней: длина раунда, жизни, темп падения, густота спавна. */
    @property(JsonAsset)
    easyLevelConfig: JsonAsset = null!;

    @property(JsonAsset)
    normalLevelConfig: JsonAsset = null!;

    @property(JsonAsset)
    hardLevelConfig: JsonAsset = null!;

    private readonly subs = new SubscriptionBag();
    private levels: LevelCatalog | null = null;
    private current: Difficulty | null = null;

    start(): void {
        // Разбираются все три уровня, играется один: опечатка в тяжёлом должна
        // найтись сейчас, а не после того, как игрок его выберет.
        this.levels = readLevels(
            new JsonConfigSource([
                [LEVEL_DOCUMENTS.easy, this.easyLevelConfig.json],
                [LEVEL_DOCUMENTS.normal, this.normalLevelConfig.json],
                [LEVEL_DOCUMENTS.hard, this.hardLevelConfig.json],
            ]),
        );

        for (const button of this.difficultyButtons) {
            this.subs.add(button.clicked, difficulty => this.play(difficulty));
        }
        this.subs.add(this.level.finished, outcome => this.resultPanel.show(outcome));
        this.subs.add(this.resultPanel.restartClicked, () => this.replay());
        this.subs.add(this.resultPanel.menuClicked, () => this.showMenu());
        this.showMenu();
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private play(difficulty: Difficulty): void {
        const levels = this.levels;
        if (levels === null) {
            return;
        }
        this.current = difficulty;
        this.menu.active = false;
        this.resultPanel.hide();
        this.level.play(levels[difficulty]);
    }

    /** «Сыграть ещё» — тот же уровень, что и был. */
    private replay(): void {
        if (this.current !== null) {
            this.play(this.current);
        }
    }

    private showMenu(): void {
        this.resultPanel.hide();
        this.level.stop();
        this.menu.active = true;
    }
}
