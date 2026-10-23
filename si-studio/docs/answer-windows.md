# Повторные окна ответа: проверка совместимости

Проверено по исходникам SI master 23 октября 2026 года. Реальный сеанс SIGame Online не запускался.

Требуемый сценарий: вопрос → первый таймер → при успехе раскрытие; при отсутствии верного ответа подсказка → второй таймер → раскрытие. Правильный ответ один.

SIQ допускает пользовательский скрипт с несколькими askAnswer и отдельным duration. Однако текущий движок не предоставляет полноценного условного окна подсказки:

1. После любого askAnswer QuestionEngine ставит AnswerPhase.Asking. На следующем PlayNext вызывает OnAnswerStart и ставит фазу Answer.
2. Следующий showContent (то есть предполагаемая подсказка) вызывает OnRightAnswer. QuestionPlayHandler переводит его в GameController.OnComplexAnswer, который отправляет Messages.RightAnswerStart с первым правильным ответом всем клиентам. Обычный Viewer принимает это сообщение и передаёт ответ контроллеру. Ответ уже передан до второго таймера.
3. При верном ответе MoveToAnswer действительно пропускает оставшиеся askAnswer и перемещается после последнего. Но это решает только ветку успеха.
4. WaitTry продолжает скрипт при истечении времени. Если все игроки исчерпали право отвечать, ContinueQuestion сразу вызывает MoveToAnswer; ещё одно окно не возвращает им право на попытку.

Поэтому повторные окна не добавлены в UI; экспорт и проверка отклоняют несколько маркеров, чтобы не потерять логику молча. Обычный таймер поддержан через answerDuration (секунды), импорт сохраняет его. 0 означает время из настроек SIGame. Механика с подсказкой требует поддержки в движке/правилах игры; изменения только редактора и XML недостаточны.

Источники:
- https://github.com/VladimirKhil/SI/blob/master/src/Common/SIEngine.Core/QuestionEngine.cs — PlayNext, AskAnswer, ShowContent, MoveToAnswer.
- https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Game/QuestionPlayHandler.cs — OnAskAnswer, OnAnswerStart, OnRightAnswer.
- https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Game/GameController.cs — OnComplexAnswer, WaitTry, ContinueQuestion.
- https://github.com/VladimirKhil/SI/blob/master/src/SICore/SICore/Clients/Viewer/Viewer.cs — обработка Messages.RightAnswerStart.
