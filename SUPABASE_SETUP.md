# Настройка Supabase для публичного просмотра документов

Для того чтобы документы были видны всем посетителям сайта, необходимо настроить права доступа в Supabase Storage.

## Шаг 1: Создание бакетов

В панели Supabase перейдите в раздел **Storage** и создайте два бакета:
- `documents` - для документов
- `certificates` - для сертификатов

## Шаг 2: Настройка публичного доступа

Для каждого бакета (`documents` и `certificates`):

1. Откройте бакет в Storage
2. Перейдите в настройки Policies
3. Нажмите "New Policy"
4. Выберите "Get started quickly"
5. Выберите шаблон "Public read access"
6. Убедитесь, что политика выглядит так:

**Для чтения (SELECT):**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'название_бакета' );
```

**Для вставки (INSERT) - только для авторизованных владельцев:**
```sql
CREATE POLICY "Owner insert access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'название_бакета' );
```

**Для удаления (DELETE) - только для авторизованных владельцев:**
```sql
CREATE POLICY "Owner delete access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'название_бакета' );
```

## Шаг 3: Проверка настроек

После настройки политик:

1. Загрузите тестовый файл через сайт (войдя как владелец)
2. Откройте сайт в режиме инкогнито (без входа)
3. Убедитесь, что файл виден и доступен для скачивания

## Текущие настройки

В файле `supabase-config.js` уже настроены:
- URL: `https://swvlwbrhuiwvkvekqfns.supabase.co`
- Ключ: `sb_publishable_cCI5GrYQt9Ilq8C7uiAB1w_0cpNpJwW`
- Email владельца: `konkony22@gmail.com`

## Дополнительные рекомендации

1. Ограничьте размер загружаемых файлов в настройках бакета (например, до 10MB)
2. Настройте RLS (Row Level Security) для таблиц, если используете базу данных
3. Регулярно проверяйте загруженные файлы и удаляйте устаревшие