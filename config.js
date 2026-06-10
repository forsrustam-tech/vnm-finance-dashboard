/*
  CONFIG.JS — тут лежат понятные настройки.

  Если нужно просто поменять стартовый шаблон: меняй DEFAULT_DATA.
  Если нужно подключить общую базу Supabase: впиши URL, ANON_KEY и поставь ENABLED: true.
*/

window.SUPABASE_CONFIG = {
  ENABLED: true,
  URL: 'https://gbpzdhedbydhwcvpkqfr.supabase.co',
  ANON_KEY: 'sb_publishable_NxcOl35E5EFBMc67_QU1Hg_vOv8ugWg'
};

window.MONTHS = [
  'Январь 2026','Февраль 2026','Март 2026','Апрель 2026','Май 2026','Июнь 2026',
  'Июль 2026','Август 2026','Сентябрь 2026','Октябрь 2026','Ноябрь 2026','Декабрь 2026'
];

window.DEFAULT_DATA = {
  month: 'Июнь 2026',
  open: { income: true, team: true, tools: true },
  nextId: 200,
  sections: [
    {
      id: 'income',
      title: 'Приходы',
      icon: 'ti-arrow-down-circle',
      type: 'income',
      rows: [
        { id: 1, name: 'Жасмин', plan: 150000, fact: 150000 },
        { id: 2, name: 'Биорайз', plan: 120000, fact: 120000 },
        { id: 3, name: 'Neo Clinic', plan: 100000, fact: 80000 },
        { id: 4, name: 'Hello Clinic', plan: 120000, fact: 0 },
        { id: 5, name: 'Moon Medical', plan: 150000, fact: 150000 }
      ]
    },
    {
      id: 'team',
      title: 'Команда',
      icon: 'ti-users',
      type: 'expense',
      rows: [
        { id: 6, name: 'Тимур — Meta Ads', plan: 80000, fact: 0 },
        { id: 7, name: 'Али — монтаж', plan: 60000, fact: 0 },
        { id: 8, name: 'Асем — PM', plan: 100000, fact: 0 },
        { id: 9, name: 'Сейлз (вакансия)', plan: 80000, fact: 0 },
        { id: 10, name: 'Владимир — дивиденды', plan: 0, fact: 0 }
      ]
    },
    {
      id: 'tools',
      title: 'Сервисы',
      icon: 'ti-tool',
      type: 'expense',
      rows: [
        { id: 11, name: 'Tilda', plan: 8000, fact: 0 },
        { id: 12, name: 'AmoCRM', plan: 15000, fact: 0 },
        { id: 13, name: 'ElevenLabs', plan: 5000, fact: 0 },
        { id: 14, name: 'Submagic / Higgsfield', plan: 8000, fact: 0 },
        { id: 15, name: 'Binance комиссии', plan: 3000, fact: 0 },
        { id: 16, name: 'Прочее', plan: 10000, fact: 0 }
      ]
    }
  ],
  payments: [
    { id: 101, date: '01.06.2026', to: 'Тимур', desc: 'Зарплата май 2026', amount: 80000, cat: 'Зарплата', status: 'paid' },
    { id: 102, date: '02.06.2026', to: 'Али', desc: 'Монтаж май 2026', amount: 60000, cat: 'Зарплата', status: 'paid' },
    { id: 103, date: '05.06.2026', to: 'Tilda', desc: 'Подписка июнь', amount: 8000, cat: 'Сервис', status: 'paid' },
    { id: 104, date: '08.06.2026', to: 'AmoCRM', desc: 'Подписка июнь', amount: 15000, cat: 'Сервис', status: 'wait' },
    { id: 105, date: '10.06.2026', to: 'Асем', desc: 'Зарплата май 2026', amount: 100000, cat: 'Зарплата', status: 'wait' }
  ]
};
