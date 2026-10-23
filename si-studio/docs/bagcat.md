# Кот в мешке — проверка 23.10.2026

Внутренний тип редактора `bagcat` соответствует SIQ 5 `secret`. Существующая заглушка «С секретом» пока остаётся отдельным недоступным пунктом: её имя не используется в экспорте кота.

Официальные источники:

- [Типы вопросов и параметры](https://github.com/VladimirKhil/SI/wiki/Question-types).
- [ScriptsLibrary.cs](https://github.com/VladimirKhil/SI/blob/master/src/Common/SIPackages/ScriptsLibrary.cs): CreateSecretScript выполняет выбор отвечающего, раскрытие темы, объявление цены, выбор цены, показ вопроса, прямой ответ и раскрытие ответа.
- [QuestionPlayHandler.cs](https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Game/QuestionPlayHandler.cs): режим byCurrent передаёт в контроллер разрешение оставить вопрос себе только при selectionMode=any; режим select использует NumberSet.
- [GameController.cs](https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Game/GameController.cs): SetAnswererByActive выбирает одного игрока; OnSetTheme подставляет тему с поля при пустом theme; OnSelectPrice при maximum=0 использует минимум или максимум раунда, при равных границах назначает фиксированную цену, иначе предлагает диапазон с шагом.
- [Официальная XSD](https://github.com/VladimirKhil/SI/blob/master/assets/siq_5.xsd): price имеет тип numberSet, границы и шаг — атрибуты вложенного numberSet.

По умолчанию кот передаётся только другому игроку, использует тему с поля и минимум/максимум раунда. У вопроса остаётся один таймер и один правильный ответ с альтернативными формулировками. После ошибки получателя другие игроки не получают право отвечать. Предпросмотр не имитирует выбор игрока и цены.

Поддержан импорт SIQ 5 secret. Старые cat/bagcat и варианты secretPublicPrice/secretNoQuestion отклоняются до замены текущего пака: они требуют отдельного переноса правил, а не смены имени. Пользовательские скрипты и дополнительные параметры также не упрощаются.

Проверены Node-тесты модели/экспорта и XSD. Обратный импорт архива проверен отдельно в Node с установленным XML-парсером xml-js и адаптером минимальных DOM-операций, используемых импортом; это не проверка браузерного DOMParser. Сохранены браузерные фикстуры tests/browser-bagcat.html и tests/browser-auction.html для последующего запуска. Визуальная проверка и реальный сеанс SIGame не выполнялись; запуск тестового браузера не был разрешён.
