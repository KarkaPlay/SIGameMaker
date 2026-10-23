# Аукционы: совместимость

Проверено по исходникам SI master 23.10.2026; настоящий сеанс SIGame Online не запускался.

В панели вопроса доступны обычный вопрос (`simple`) и вопрос-аукцион (`stake`). Отсутствующий тип у старого черновика означает обычный вопрос. Выбор типа использует общие историю отмены и IndexedDB, не меняя сценарий, медиа, ответ и номинал. Стоимость вопроса — номинал для торгов; итоговую ставку выбирают игроки в SIGame.

Экспорт использует встроенный тип `stake`, без собственного скрипта и выдуманных параметров ставки. В ScriptsLibrary.CreateStakeScript сначала определяется отвечающий через открытые торги за наибольшую ставку, затем показывается question, запрашивается прямой ответ (не гонка кнопок), показывается answer. answerDuration — общий параметр времени ответа. QuestionPlayHandler.OnSetAnswerer включает FlexiblePrice и вызывает SetAnswererByHighestVisibleStake; GameController запускает AskStake с номиналом вопроса. Клиент Viewer.OnAskStake получает диапазон и доступные действия, OnPersonStake отображает ставку/пас/ва-банк.

Торги происходят до показа содержимого. Предпросмотр редактора показывает сценарий победителя и явно сообщает, что торги проходят в SIGame; стоимость на его экране обозначена «Аукцион», без фиктивной итоговой ставки. Этап ответа подписан «Победитель аукциона отвечает». Для специальных вопросов в игре должны быть разрешены специальные типы: QuestionEngine использует обычный тип при выключенном PlaySpecials.

Импорт поддерживает SIQ 5 stake и SIQ 4 `<type name="auction"/>`, как официальный Question.Upgrade. Неизвестные типы, скрипты и дополнительные параметры отклоняются до замены черновика. Скрытые ставки stakeAll не считаются аукционом.

Проверки: `npm test` проверяет тип/номинал/таймер/раскрытие и XSD, совместимость старых черновиков и отказ экспорта неизвестных типов. `tests/browser-auction.html` проверяет обратный импорт смешанного пака, 6 бинарных файлов (изображение/аудио/видео до и после ответа), таймер, заметки, порядок, длительности, ожидание, SIQ 4 и отказ неподдерживаемой логики. В этой сессии тест импорта выполнен в Node с независимым XML-парсером xml-js и минимальным DOM-адаптером; это не браузерный DOMParser. Визуальная проверка интерфейса и реальный игровой сеанс остаются неподтверждёнными.

Первичные источники:

- [Типы вопросов](https://github.com/VladimirKhil/SI/wiki/Question-types)
- [ScriptsLibrary](https://github.com/VladimirKhil/SI/blob/master/src/Common/SIPackages/ScriptsLibrary.cs)
- [Question.Upgrade](https://github.com/VladimirKhil/SI/blob/master/src/Common/SIPackages/Question.cs)
- [QuestionEngine](https://github.com/VladimirKhil/SI/blob/master/src/Common/SIEngine.Core/QuestionEngine.cs)
- [QuestionPlayHandler](https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Game/QuestionPlayHandler.cs)
- [GameController](https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Game/GameController.cs)
- [Viewer](https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Viewer/Viewer.cs)
