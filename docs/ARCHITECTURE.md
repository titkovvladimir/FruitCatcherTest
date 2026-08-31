# Архитектура: слои и события

Итог разбора. Это принятые решения, а не предложения: расходится код — правим
код. Каждый пункт должен уехать в README своими словами — раздел «почему» там
весит больше числа фич.

## 1. Всё — события. Отдельной сущности «намерение» нет

Один механизм на оба направления. Клик по кнопке — такой же факт, как изменение
счёта: он уже произошёл, просто владелец у него UI, а не сессия. Кто хочет —
подписан и реагирует.

Отсюда **имена в прошедшем времени, и у кнопок тоже**: `scoreChanged`,
`lifeLost`, `levelStarted`, `pauseClicked`, `restartClicked`. Не
`pauseRequested`: кнопка сообщает о себе, а не приказывает.

Отдельный тип для «команд» с проверкой на единственного обработчика **не
заводим**. Защита от двойного перезапуска берётся дешевле: все провода сходятся
в одном месте (`roots/`, п. 4), так что второй обработчик можно подписать только
руками и увидев это глазами; а методы, где это естественно, делаются
идемпотентными — `pause()` на уже поставленной паузе не делает ничего.

## 2. Один примитив `Signal<T>` в `utils/`, свой, не из движка

Cocos-овский `EventTarget` не берём: ключи строковые, нагрузка `any`, при
`strict: true` толку от типов ноль. Пишем сами, пятнадцать строк:

```ts
export interface Subscribable<T = void> {
    on(handler: (value: T) => void): () => void;
}

export class Signal<T = void> implements Subscribable<T> {
    /** Порог сторожа. 0 — выключен; включает GameRoot в отладочной сборке. */
    static warnAfter = 0;

    private handlers: ((value: T) => void)[] = [];

    constructor(private readonly name = 'signal') {}

    on(handler: (value: T) => void): () => void {
        this.handlers.push(handler);
        if (Signal.warnAfter > 0 && this.handlers.length > Signal.warnAfter) {
            console.warn(`${this.name}: подписчиков ${this.handlers.length} — похоже на утечку`);
        }
        return () => { this.handlers = this.handlers.filter(h => h !== handler); };
    }

    emit(value: T): void {
        for (const handler of [...this.handlers]) handler(value);
    }
}
```

**`on` возвращает функцию отписки** — обязательная часть, не украшение: иначе
после перезапуска сцены обработчики висят на уничтоженных узлах. Руками её,
впрочем, никто не хранит — для этого есть сумка подписок ниже.

**Сторож включается кодом, а не импортом.** `Signal` живёт в `utils` и движка не
знает: `console.warn` есть и в браузере, и в тесте, а `cc/env` потянул бы
зависимость в слой, который обязан заводиться без сцены. Поэтому порог —
статическое поле, и выставляет его `GameRoot`: `Signal.warnAfter = DEBUG ? 8 : 0`.
Имя сигнала передаётся в конструктор: предупреждение без имени бесполезно.

**Наружу сигнал отдаётся только как `Subscribable`** — тогда `emit` снаружи не
виден, и поднять событие может лишь его владелец. Это ровно то, что в C# даёт
слово `event`, а в TypeScript такого слова нет, поэтому граница держится
разделением типов. Форма — приватное поле плюс геттер, то же самое, что в C#
приватное поле плюс свойство:

```ts
private readonly _scoreChanged = new Signal<number>();
get scoreChanged(): Subscribable<number> { return this._scoreChanged; }
```

Целиком, со всеми слоями сразу — п. 6.

**Публичного поля типа `Signal` в коде быть не должно** — ни у сессии, ни у
кнопки: `readonly clicked = new Signal()` открывает `emit` всем желающим. У
кнопки та же пара: `private readonly _clicked`, наружу `get clicked():
Subscribable`.

**Пара «подписался — отписался» зависит от того, умирает ли узел.** Уточнено
30 августа. `onLoad` / `onDestroy` верны только для того, кто живёт вместе со
сценой. Объект из пула не уничтожается, а выключается: `onDestroy` у него не
наступит никогда, а `onLoad` случится один раз на всю жизнь пула — значит
подписка из `onLoad` переживёт возврат в пул и удвоится при следующей выдаче.
Для пулуемых компонентов подписка живёт в `onEnable`, отписка — в `onDisable`.
**Отписка в `onDisable` не отменяет отписку в `onDestroy`**: узел может быть
уничтожен и активным, например при смене сцены. У пулуемых есть обе, и обе
идемпотентны — повторный вызов ничего не ломает.

**Подписка руками не пишется — есть сумка.** Решено 30 августа: дисциплина,
которая держится на внимательности, рано или поздно протекает, а объект из пула
делает протечку невидимой. Поэтому подписываются только через сумку, и тогда
забыть отписку нельзя — её никто и не пишет:

```ts
// utils/SubscriptionBag.ts
import { Subscribable } from './Signal';

export class SubscriptionBag {
    private offs: (() => void)[] = [];

    add<T>(signal: Subscribable<T>, handler: (value: T) => void): void {
        this.offs.push(signal.on(handler));
    }

    clear(): void {
        for (const off of this.offs) off();
        this.offs.length = 0;
    }
}
```

`clear()` идемпотентен, поэтому у пулуемого компонента он стоит и в `onDisable`,
и в `onDestroy`, а лишний вызов ничего не стоит:

```ts
private readonly subs = new SubscriptionBag();

onEnable(): void  { this.subs.add(session.scoreChanged, s => this.render(s)); }
onDisable(): void { this.subs.clear(); }
onDestroy(): void { this.subs.clear(); }
```

Сумка закрывает ошибку по построению, сторож в `Signal` ловит то, чего она не
видит: подписку в обход сумки. Третий уровень — правило линтера «результат
`on()` нельзя выбрасывать» — остался в бэклоге как необязательный.

## 3. Сигнал принадлежит объекту, глобальной шины нет

Факты живут полем у владельца состояния:

```ts
levelSession.scoreChanged.on(score => { this.label.string = `${score}`; });
```

Видно, чьё это событие, компилятор проверяет имя и тип. **Общая шина, куда все
кричат и все слушают, запрещена**: связанность от неё не исчезает, а становится
невидимой — чтобы понять, кто на что реагирует, придётся грепать строки.
Событий от UI это касается ровно так же: сигнал `clicked` живёт у своей кнопки,
а связывается с сессией в `roots/`.

**Файлов-сборников событий в проекте нет** — ни `UiEvents`, ни `LevelEvents`, ни
`GameEvents`. Решено и подтверждено: сигнал объявляется полем у владельца
состояния. Типы полезной нагрузки — отдельные файлы рядом с тем, кто их
поднимает (`LevelOutcome` уже так и лежит).

## 4. Слои

Разрезов два, а не один.

**По вертикали — кто про что:** `core` про раунд, `meta` про всё вокруг раунда
(история результатов, рекорд, сохранения), `ui` про показ.

**По горизонтали, внутри `core` и внутри `meta` одинаково, — знает ли код
движок:**

* `logic` — правила. `cc` не импортирует вовсе, заводится в обычном тесте без
  сцены. Состояние, вычисления, события — всё здесь.
* `components` — тонкая обвязка. Живёт на узлах сцены: читает ввод, двигает
  узлы, зовёт свою логику и переизлучает её события. **Правил игры внутри нет.**
  Проверка на месте: появился `if` про правило игры — файл выбран неправильно.

Разрез уже проведён верно в паре `logic/spawn/FallingItemSpawnPlanner` (решает,
что и когда появится) и `components/fallingItem/FallingItemSpawner` (достаёт
узел из пула и кладёт на поле). Планировщик проверяется без сцены, спавнер без
планировщика ничего не решает. По этому образцу и делить остальное.

```
utils            не знает никого
platform         utils
core/logic       platform, utils                                НЕ: cc, ui, meta
core/components  core/logic, platform, utils, cc                НЕ: ui, meta
meta/logic       контракт core/logic, platform, utils           НЕ: cc, ui
meta/components  meta/logic, контракт core, platform, utils, cc НЕ: ui
ui               cc, события core и meta                        НЕ: их внутренности
roots            знает всех; его не знает никто
```

Таблица кодирует три правила:

1. **`core` не знает про `meta` ничего.** Раунд не подозревает, что есть история
   и рекорд: он поднимает `finished` со своим итогом, и на этом его роль
   кончается. Здесь такие архитектуры протекают первым делом — через «ну тут
   раунду надо записать рекорд».
2. **`ui` не знает никто, кроме `roots`.** Иначе кольцо: `ui` подписан на
   `core`, а `core` импортирует `ui`.
3. **`meta/logic` знает контракт `core/logic`, а не его устройство** — тип итога
   раунда и его события, но не спавн, не траектории, не разбор ловли.

**Сборщики живут в `roots/`, а не в `components`.** Сейчас `LevelRoot` лежит в
`core/components`, а `GameRoot` в `meta/components`, и оба обязаны знать HUD и
панели — то есть тянут `ui` в свои слои и ломают правило 2. Имена остаются, меняется
место:

```
roots/
  GameRoot.ts     собирает игру: мету, её панели, запуск уровня
  LevelRoot.ts    собирает уровень: сессию, поле, корзину, HUD, панель итога
```

После переноса `core/components` остаётся тем, чем должен быть — `Field`,
`FallingItem`, `FallingItemSpawner`, `Basket`, `BasketControl`, — и ни одного
импорта из `ui` в нём нет.

**Корень связывает, но не правит.** Создаёт объекты, соединяет сигналы с
вызовами, отписывается на `onDestroy` — и всё. Правила игры живут в
`core/logic`. Проверка та же, что для компонентов: появился `if` про правило
игры — уехало не туда. Имя `Root` выбрано именно за это: оно говорит «корень
сборки» и не обещает владения, в отличие от `Manager`, за которым ответственность
приползает сама.

**Дерево сцены живёт по своей оси и папкам не подчиняется.** Сцена делится на
`Canvas` и `Logics`, а внутри каждой половины — на `Core` и `Meta`: это удобство
навигации в редакторе. Папки делятся по слоям: кто что знает. Оси разные, и
совпадать они не обязаны — `LevelRoot.ts` лежит в `roots/`, а его узел стоит в
`Logics/Core`, потому что собирает он уровень, а уровень принадлежит кору.
Приводить одно к другому не нужно ни в ту, ни в другую сторону.

**Куда класть новый файл — три вопроса подряд:**

1. нужен ли ему `cc`? Нет — значит `logic`. Да — дальше;
2. связывает ли он разные слои проводами? Да — значит `roots`;
3. чей он: раунда, меты или показа? — `core`, `meta` или `ui`.

## 5. UI командует только событиями, но читать ему можно

Правило «ui не вызывает ни одного метода» смягчается до «**ui не командует**».
Панель, открытая посреди раунда, обязана узнать текущий счёт и время, а событий
до подписки она не слышала. Буквальный запрет гонит либо в проигрывание истории
событий, либо в кэш на всякий случай.

Граница: **менять состояние — только через своё событие, читать — прямым
вызовом** доступного только на чтение снимка. Чтение связанности не создаёт: оно не меняет
правил и не требует, чтобы core знал о читателе.

## 6. Пример: всё вместе

Владелец состояния. Чистая логика, `cc` не импортирует:

```ts
// core/logic/LevelSession.ts
import { Signal, Subscribable } from '../../utils/Signal';

export class LevelSession {
    private _score = 0;
    private _paused = false;

    private readonly _scoreChanged = new Signal<number>();
    private readonly _finished = new Signal<number>();

    get scoreChanged(): Subscribable<number> { return this._scoreChanged; }
    get finished(): Subscribable<number> { return this._finished; }

    get score(): number { return this._score; }        // чтение — обычный геттер

    addScore(points: number): void {
        this._score += points;
        this._scoreChanged.emit(this._score);
    }

    pause(): void {
        if (this._paused) return;                      // идемпотентно
        this._paused = true;
    }
}
```

Подписчик. Читает снимок при подписке, дальше живёт событиями:

```ts
// ui/ScoreLabel.ts
import { _decorator, Component, Label } from 'cc';
import { LevelSession } from '../core/logic/LevelSession';
import { SubscriptionBag } from '../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

@ccclass('ScoreLabel')
export class ScoreLabel extends Component {
    @property(Label) label: Label = null!;

    private readonly subs = new SubscriptionBag();

    bind(session: LevelSession): void {
        this.render(session.score);                                  // снимок
        this.subs.add(session.scoreChanged, s => this.render(s));
    }

    onDestroy(): void {
        this.subs.clear();
    }

    private render(score: number): void {
        this.label.string = `${score}`;
    }
}
```

Первая строка `bind` — то самое «читать можно» из п. 5. Без неё панель, открытая
посреди раунда, показывала бы ноль до первого начисления.

UI поднимает свой факт. Движковое событие входит, наше выходит:

```ts
// ui/PauseButton.ts
import { _decorator, Component, Button } from 'cc';
import { Signal, Subscribable } from '../utils/Signal';

const { ccclass } = _decorator;

@ccclass('PauseButton')
export class PauseButton extends Component {
    private readonly _clicked = new Signal();
    get clicked(): Subscribable { return this._clicked; }

    onLoad(): void {
        this.node.on(Button.EventType.CLICK, this.onClick, this);
    }

    onDestroy(): void {
        this.node.off(Button.EventType.CLICK, this.onClick, this);
    }

    private onClick(): void {
        this._clicked.emit();
    }
}
```

Сборка — единственное место, где слои встречаются:

```ts
// roots/LevelRoot.ts
import { _decorator, Component } from 'cc';
import { LevelSession } from '../core/logic/LevelSession';
import { ScoreLabel } from '../ui/ScoreLabel';
import { PauseButton } from '../ui/PauseButton';
import { SubscriptionBag } from '../utils/SubscriptionBag';

const { ccclass, property } = _decorator;

@ccclass('LevelRoot')
export class LevelRoot extends Component {
    @property(ScoreLabel) scoreLabel: ScoreLabel = null!;
    @property(PauseButton) pauseButton: PauseButton = null!;

    private session!: LevelSession;
    private readonly subs = new SubscriptionBag();

    onLoad(): void {
        this.session = new LevelSession();

        this.scoreLabel.bind(this.session);

        this.subs.add(this.pauseButton.clicked, () => this.session.pause());
    }

    onDestroy(): void {
        this.subs.clear();
    }
}
```

Путь клика целиком:

```
Button (движок) → PauseButton._clicked.emit()
                → LevelRoot (подписан) → session.pause()
                → session поднимает свой факт → панель показывает себя
```

Что из этого кода видно и что надо уметь произнести на защите:

* **`LevelSession` не знает ни про `cc`, ни про UI** — заводится в обычном тесте
  без сцены и движка;
* **никто не поднимает чужое событие** — `emit` есть только у владельца, снаружи
  виден `Subscribable`, где его нет. Ошибка компиляции, а не находка на отладке;
* **у каждой подписки есть отписка** — и не потому, что о ней помнили: подписка
  идёт через сумку, а сумка чистится в `onDisable` и `onDestroy`. При
  перезапуске сцены и при возврате в пул висящих обработчиков не остаётся.

Мелочь по TypeScript: `Signal` без параметра — это `Signal<void>`, и `emit()` у
него вызывается без аргумента; параметр типа `void` разрешено опускать.

## 7. Объём меты: три сложности вместо истории результатов

Пересмотрено 30 августа после разбора критиком. Экран истории результатов
**отменён**. Он держался на том, что без него `meta` — пустой слой; то есть фича
обосновывалась архитектурой, а не игроком. В задании такого экрана нет, и на
защите вопрос «вы завели экран, чтобы папка не пустовала?» остался бы без
ответа.

Вместо него мета получает **три кнопки запуска уровня разной сложности** и
**рекорд по каждой сложности**, который показывает панель итога. Мета
становится настоящей по обеим осям сразу: архитектурно — у неё своё сохраняемое
состояние и свой выбор, переживающий раунд; по геймдизайну — она меняет
наполнение между уровнями, а не пересказывает прошлые.

Побочная выгода: три конфига уровня показывают, что баланс живёт в данных, а не
в коде, — ровно то же, что демонстрировал бы удалённый конфиг в LiveOps.

## 8. Что поменять в нынешней раскладке

Решённое сверх того, что уже есть в дереве файлов:

Отмечено 30 августа: кода к этому моменту не было ни строки, поэтому пункты
применены к раскладке (п. 10), а не к существующим файлам.

* [x] **удалить `ui/UiEvents.ts`, `core/logic/LevelEvents.ts`,
      `meta/logic/GameEvents.ts`** — сигналы объявляются полями у владельцев
      (п. 3). Типы полезной нагрузки, если они там были, вынести отдельными
      файлами рядом с тем, кто их поднимает;
* [x] **`utils/Emitter.ts` → `utils/Signal.ts`**, внутри `Signal<T>` и
      `Subscribable<T>` из п. 2. Имя `Emitter` нигде не остаётся;
* [x] **завести `roots/`**, перенести туда сборщики как есть, без переименования:
      `core/components/LevelRoot.ts` → `roots/LevelRoot.ts`,
      `meta/components/GameRoot.ts` → `roots/GameRoot.ts`;
* [x] **проверить, что после переноса из `core` и `meta` не импортируется `ui`**
      — ради этого перенос и делается;
* [x] **события переименовать в прошедшее время** (п. 1): `*Requested` не
      остаётся ни одного.

## 9. Следствия, подтверждённые сверх разбора

Три вопроса, которых документ прямо не закрывал. Подтверждены 30 августа и
действуют наравне с остальным.

* **Класса `LevelHud` нет.** Корень держит ссылки на отдельные виджеты и
  связывает каждый: `scoreLabel.bind(session)`. Компонент-посредник, который сам
  раздаёт сессию своим детям, — это провода, а провода живут в `roots` (п. 4).
  На сцене `LevelHud` остаётся нодой-контейнером без скрипта.
* **Панель переизлучает клики своих кнопок.** `LevelResultPanel` подписан на
  свою `RestartButton` и поднимает собственный `restartClicked`. Иначе корню
  пришлось бы держать `@property` на каждую кнопку внутри каждой панели. Панель
  распоряжается собой — это её право по п. 5.
* **Тик живёт в `LevelRoot`.** Он провод: дёргает сессию, планировщик, предметы
  и разбор ловли в фиксированном порядке. Правил в нём не заводится — проверка
  та же, что в п. 4: появился `if` про игру, значит файл выбран неправильно.

## 10. Раскладка

```
assets/scripts/
  utils/
    Signal.ts                          Signal<T> + Subscribable<T> + сторож
    SubscriptionBag.ts                 подписки скопом, чистятся одной строкой
    NodePool.ts
    random/RandomSource.ts
    random/MathRandomSource.ts
  platform/
    storage/IStorage.ts
    storage/LocalStorage.ts
    config/IConfigSource.ts
    config/JsonConfigSource.ts
  core/
    logic/
      LevelSession.ts                  состояние раунда и его сигналы
      LevelOutcome.ts                  очки, поймано, промахов
      LevelState.ts                    Idle | Running | Paused | Finished
      spawn/FallingItemSpawnPlanner.ts
      fall/FallBehaviour.ts
      fall/UniformFallBehaviour.ts
      fall/ZigzagFallBehaviour.ts
      fall/AcceleratedFallBehaviour.ts
      fall/FallBehaviourFactory.ts
      catch/CatchResolver.ts
      config/FallingItemConfig.ts
      config/LevelConfig.ts
      config/BasketConfig.ts
      config/checks.ts
    components/
      Field.ts
      fallingItem/FallingItem.ts
      fallingItem/FallingItemSpawner.ts
      basket/Basket.ts
      basket/BasketControl.ts
  meta/
    logic/Difficulty.ts                easy | normal | hard
    logic/BestScores.ts                рекорд по каждой сложности, через IStorage
  ui/
    core/ScoreLabel.ts
    core/TimerLabel.ts
    core/LivesView.ts
    core/ScorePopup.ts                 всплывающее «+500» над пойманным
    core/PauseButton.ts
    core/panels/LevelResultPanel.ts
    meta/DifficultyButton.ts           три штуки на сцене, у каждой свой уровень
  roots/
    GameRoot.ts
    LevelRoot.ts
```

`meta/components` и `ui/meta/panels` не заводятся: сборщик уехал в `roots`, а
панелей у меты после п. 7 не осталось. Понадобятся — появятся.

**Интерфейсы в инспектор не кладутся.** `@property(IStorage)` не существует:
редактор сериализует конкретный класс, а не контракт. Реализации из `platform`
раздаёт кодом `GameRoot`, мышью привязываются только узлы и ассеты.

Дерево сцены живёт по своей оси (п. 4) и с папками не сверяется:

```
Game
├─ Canvas                              1280x720, Fit Height
│  ├─ Core
│  │  ├─ Background
│  │  ├─ Field                         UITransform = игровая область
│  │  │  ├─ FallingItems
│  │  │  └─ Basket
│  │  │     ├─ BucketBack
│  │  │     ├─ Mouth                   UITransform = линия и ширина проёма
│  │  │     └─ BucketFront             последний → рисуется поверх
│  │  ├─ LevelHud                      контейнер без скрипта
│  │  │  ├─ Score / Timer              Label в каждом
│  │  │  ├─ Lives                      Layout, наполняется Heart.prefab
│  │  │  └─ PauseButton
│  │  └─ Panels/LevelResultPanel       Dimmer, итог, рекорд сложности,
│  │                                   RestartButton, MenuButton
│  └─ Meta
│     └─ Buttons                       EasyButton, NormalButton, HardButton
└─ Logics
   ├─ Core                             LevelRoot, FallingItemSpawner
   └─ Meta                             GameRoot
```

Префабы: `FallingItem.prefab`, `Heart.prefab`, `ScorePopup.prefab`.
Конфиги: `falling-items.json`, `basket.json`, `level-easy.json`,
`level-normal.json`, `level-hard.json`.

Владельцы сигналов — по п. 3 объявлены полями у владельца состояния:

| владелец | сигнал | нагрузка |
|---|---|---|
| `LevelSession` | `scoreChanged` | очки |
| | `lifeLost` | осталось жизней |
| | `timeChanged` | секунд осталось |
| | `stateChanged` | `LevelState` |
| | `finished` | `LevelOutcome` |
| `BestScores` | `changed` | сложность и новый рекорд |
| `PauseButton`, `DifficultyButton` | `clicked` | у кнопки сложности — какая |
| `LevelResultPanel` | `restartClicked`, `menuClicked` | — |

Рекорд приходит в панель итога числом при связывании: `core` про `meta` не
знает, связывает их `GameRoot`.
