export const SITUATIONS = [
 {id:'copy',label:'Переносим данные руками',hint:'Из писем, чатов и таблиц в другие системы',icon:'⇄',group:'Г3'},
 {id:'find',label:'Долго ищем информацию',hint:'Документы, ответы и знания коллег',icon:'⌕',group:'Г4'},
 {id:'questions',label:'Отвечаем на одни и те же вопросы',hint:'Клиентам или своей команде',icon:'◎',group:'Г2'},
 {id:'documents',label:'Собираем документы и отчёты',hint:'Заполняем, проверяем и сводим вручную',icon:'▤',group:'Г3'},
 {id:'lost',label:'Теряем заявки или забываем задачи',hint:'Что-то остаётся без ответа или контроля',icon:'↗',group:'Г1'},
 {id:'other',label:'У меня другая ситуация',hint:'Можно описать её своими словами',icon:'✳',group:'Г8'},
 {id:'unsure',label:'Пока сложно сформулировать',hint:'Ничего страшного — разберёмся вместе',icon:'…',group:'Г8'}
];
export const EFFECTS=['Отнимает время','Возникают ошибки','Клиенты долго ждут','Теряются деньги','Всё зависит от одного человека','Просто неудобно'];
export const FREQUENCIES=['Каждый день','Несколько раз в неделю','Иногда','Сложно оценить'];
export const DEPARTMENTS=['Продажи','Поддержка','Маркетинг','Финансы','Команда / HR','IT','Управление','Другое'];
export const SYSTEMS=['Почта','Мессенджеры','Таблицы','CRM','1С','Другое','Не знаю'];
export function normalizeTelegram(value){const m=String(value||'').trim().match(/^(?:https?:\/\/t\.me\/|@)?([A-Za-z][A-Za-z0-9_]{4,31})\/?$/);return m?m[1]:null;}
export function validateShort(d,step){
 if(step===0&&(!Array.isArray(d.situations)||!d.situations.length))return 'Выберите знакомую ситуацию. Если не знаете, с чего начать, есть кнопка «Пока сложно сформулировать».';
 if(step===3){if(!d.company?.trim())return 'Подскажите название компании — так мы не перепутаем вашу задачу с другой.';if(!normalizeTelegram(d.telegram))return 'Проверьте Telegram: нужно @имя из настроек, например @ivan_work.';}
 return '';
}
export function summaryShort(d){return d.situations.map(id=>SITUATIONS.find(s=>s.id===id)?.label).filter(Boolean).join(' · ');}
export function buildSubmission(d){
 const selected=SITUATIONS.filter(s=>d.situations.includes(s.id));
 if(!selected.length||selected.length>3)throw Error('Выберите от одной до трёх ситуаций.');
 const detail=d.detail||{},primary=d.situations[0];
 let groups=[...new Set(selected.map(s=>s.id==='questions'&&detail.audience==='Сотрудники'?'Г4':s.id==='lost'&&detail.kind==='Внутренние задачи'?'Г8':s.group))];
 const specifics=[];
 if(primary==='copy'){if(detail.from?.length)specifics.push('Откуда: '+detail.from.join(', '));if(detail.to?.length)specifics.push('Куда: '+detail.to.join(', '));}
 if(primary==='find'&&detail.find?.length)specifics.push('Что ищут: '+detail.find.join(', '));
 if(primary==='questions'&&detail.audience)specifics.push('Кто задаёт вопросы: '+detail.audience);
 if(primary==='documents'&&detail.documents?.length)specifics.push('Что собирают: '+detail.documents.join(', '));
 if(primary==='lost'&&detail.kind)specifics.push('Что теряется: '+detail.kind);
 const routine=[summaryShort(d),...specifics,d.example?.trim()].filter(Boolean).join('\n');
 const pains={};if(d.situations.includes('copy'))pains['Г3.2']='';
 if(primary==='documents'&&detail.documents?.includes('Отчёты'))pains['Г3.4']='';
 if(primary==='documents'&&detail.documents?.includes('Документы'))pains['Г3.1']='';
 const other=[d.effects?.length?'Что мешает: '+d.effects.join(', '):'',d.frequency?'Как часто: '+d.frequency:'',d.imported?'Ранее начатое описание:\n'+d.imported:''].filter(Boolean).join('\n');
 return {version:1,id:d.id,context:{company:d.company.trim(),department:d.department||'Не указан',role:'Не указана',routine,domain:'',size:'',surveyVersion:'short-v2'},groups,pains,impact:{other,result:'',systems:primary==='copy'?[...new Set([...(detail.from||[]),...(detail.to||[])])]:[],signals:[],restrictions:[],hours:'',people:'',manual:'',urgency:'',budget:'',decision:'',situations:d.situations,effects:d.effects||[],frequency:d.frequency||''},contact:{name:d.name?.trim()||'Не указано',telegram:normalizeTelegram(d.telegram),email:''},source:d.source||'Визитка / сайт'};
}
