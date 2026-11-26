# Kolo — демо-доступ

Живий сайт: **https://kolo-survey-platform.onrender.com**
Вхід: `/login`

Це демонстраційні облікові записи. Паролі згенеровані `crypto.randomBytes` і збережені
лише для перевірки роботи застосунку. Вони дійсні для поточного деплою; після повторного
сіду бази паролі зміняться — нові будуть у логах `npm run db:seed`.

| Роль | Ім’я | Логін | Пароль |
| --- | --- | --- | --- |
| Адміністратор | Соломія Гаврилюк | solomiia@kolo.ua | `8tiw4SBKFbW3f_3VlDWWMCTb` |
| Дослідник | Дарина Захаревич | daryna@kolo.ua | `ZHgMx4SBx5mPy84x1EGXHLvb` |
| Дослідник | Всеволод Островерхий | vsevolod@kolo.ua | `zpDL3wiOBki2IXXk4pINCJes` |
| Дослідник | Катерина Чорновіл | kateryna@kolo.ua | `jQTGctWzBEta2oT3T45vdf9X` |
| Учасник | Остап Кушнірук | ostap.kushniruk@gmail.com | `kEgImE7l1_wEfomiRK0u3kmT` |
| Учасник | Мирослава Грицевич | myroslava.h@ukr.net | `S3QhPejKjEIKioFuD-KYwxj9` |
| Учасник | Святослав Мацюк | s.matsyuk@proton.me | `NxiKjATEZJqtFzJf_3EVvKnP` |
| Учасник | Ярина Волинська | yaryna.volynska@meta.ua | `r95bxYBeccSqq54QBL2QQi5m` |
| Учасник | Лук’ян Годованець | lukian.hodovanets@gmail.com | `qiIPyNL7II30CyoMBa5MQpn5` |
| Учасник | Роксолана Підгірна | roksolana.p@i.ua | `e7jc1dktt0vhA_UBcfGpEYkV` |
| Учасник | Богдан Стельмах | bohdan.stelmakh@gmail.com | `vryHCfRscIY-ErWli9BpW2Hy` |
| Учасник | Ірина Дзюба | iryna.dziuba@ukr.net | `Ha5QkDv18e8gFuiFdauXqHkG` |
| Учасник | Назар Бурик | buryk.nazar@dspu.edu.ua | `kH1gtRx-lxG5PEEgJJJ8nUkU` |

Адміністратор бачить усі опитування, категорії та людей. Дослідник створює власні
опитування й бачить відповіді лише за ними. Учасник проходить анкети та бачить свої
відповіді. Гість може проходити активні опитування без входу.
