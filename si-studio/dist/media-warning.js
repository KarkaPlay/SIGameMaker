export const recommendedMediaSize=1_000_000;
export const oversizedMedia=size=>Number.isFinite(size)&&size>recommendedMediaSize;
export const mediaWarning='Файл больше 1 МБ. Для паков SIGame рекомендуется уменьшить размер: сжать изображение, аудио или видео. Это предупреждение не мешает экспорту.';
