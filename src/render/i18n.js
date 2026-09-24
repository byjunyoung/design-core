// The viewer's own words, in the language `conventions.meta.language` names. Screen content
// is the team's and is never translated; this is only the chrome around it — labels,
// buttons, hints — and the sample values that stand in for empty cells.

const EN = {
  screens: 'screens', overview: 'Overview', waiting: 'waiting', compare: 'compare states', paths: 'paths', variants: 'variants',
  flows: 'Flows', notes: 'Notes', comments: 'Comments', open: 'open', references: 'References', none: 'none',
  waitingForPerson: 'Waiting for a person', proposal: 'proposal', screen: 'screen', tier: 'tier', summary: 'summary', lintAfter: 'lint after',
  decided: 'Decided before this version', noDecisions: 'no decisions recorded — the agent proposed without the interview',
  whatChanges: 'What changes', where: 'where', asisTobe: 'AS-IS · TO-BE', asis: 'AS-IS', tobe: 'TO-BE', notInAsis: 'not in AS-IS', removedInTobe: 'removed in TO-BE',
  apply: 'Apply', reject: 'Reject', yourName: 'your name', toAccept: 'to accept', toDecline: 'to decline', noSummary: '(no summary)',
  item: 'item', decision: 'decision', why: 'why', blocking: 'blocking', warning: 'warning', clean: 'clean', states: 'states', openComments: 'open comments',
  comment: 'comment', commentsN: 'comments', tbd: '$tbd', components: 'components', on: 'on',
  flowMap: 'Flow map', deadFlows: 'Flows to nowhere', orphanScreens: 'Screens no flow reaches', proto: 'Prototype', hotspots: 'hotspots', back: 'back',
  library: 'Components', propsLabel: 'props', slotsLabel: 'slots', bindingsLabel: 'token bindings', compound: 'compound — drawn from its own elements', legacyKind: 'still in conventions.kinds', noneOfKind: 'no components yet — doan migrate kinds, or add components/<kind>.yaml', requiredMark: 'required',
  // drawer (sent to the page as JSON)
  clickToInspect: 'Click an element to inspect it.', component: 'component', bundled: 'bundled default', samplesNote: 'values shown in the picture are samples unless the file sets them',
  file: 'file', path: 'path', line: 'line', copy: 'copy path:line', copied: 'copied', noneOnElement: 'none on this element',
  sayWhat: 'say what should change', send: 'Comment', liveOnly: 'open the live viewer (doan serve) to comment', nameFirst: 'your name first', close: '×',
  // bundled kinds
  undesigned: 'undesigned', nothingHere: 'Nothing here', wentWrong: 'Something went wrong', loading: 'Loading…', image: 'image', select: 'Select', chooseFile: 'Choose file', menu: 'menu', perPage: '/page',
  // samples
  s_item: (n) => `Item ${n}`, s_sample: (n) => `Sample ${n}`, s_stores: ['Gangnam', 'Seongsu', 'Pangyo'], s_status: ['Paid', 'Pending', 'Refunded'], s_method: ['Card', 'Mobile', 'Cash'],
};

const KO = {
  ...EN,
  screens: '화면', overview: '개요', waiting: '대기', compare: '상태 비교', paths: '경로', variants: '변형',
  flows: '흐름', notes: '메모', comments: '코멘트', open: '열림', references: '참조', none: '없음',
  waitingForPerson: '사람의 결정을 기다리는 제안', proposal: '제안', screen: '화면', tier: '종류', summary: '요약', lintAfter: '적용 후 lint',
  decided: '이 판 전에 정한 것', noDecisions: '기록된 결정이 없음 — 인터뷰 없이 제안됨',
  whatChanges: '바뀌는 것', where: '어디', asisTobe: 'AS-IS · TO-BE', notInAsis: 'AS-IS 에 없음', removedInTobe: 'TO-BE 에서 빠짐',
  apply: '적용', reject: '반려', yourName: '이름', toAccept: '적용하려면', toDecline: '반려하려면', noSummary: '(요약 없음)',
  item: '항목', decision: '결정', why: '이유', blocking: '차단', warning: '경고', clean: '이상 없음', states: '상태', openComments: '열린 코멘트',
  comment: '코멘트', commentsN: '코멘트', components: '컴포넌트', on: '·',
  flowMap: '흐름도', deadFlows: '갈 곳 없는 흐름', orphanScreens: '흐름이 닿지 않는 화면', proto: '프로토타입', hotspots: '핫스팟', back: '뒤로',
  library: '컴포넌트', propsLabel: '속성', slotsLabel: '슬롯', bindingsLabel: '토큰 바인딩', compound: '복합 — 자기 elements로 그림', legacyKind: '아직 conventions.kinds에 있음', noneOfKind: '컴포넌트 없음 — doan migrate kinds 또는 components/<kind>.yaml 추가', requiredMark: '필수',
  clickToInspect: '요소를 누르면 여기에 나옵니다.', component: '컴포넌트', bundled: '기본 세트', samplesNote: '그림의 값은 파일에 없으면 샘플입니다',
  file: '파일', path: '경로', line: '줄', copy: '경로:줄 복사', copied: '복사됨', noneOnElement: '이 요소에는 없음',
  sayWhat: '무엇을 바꿀지 적어 주세요', send: '코멘트 남기기', liveOnly: '코멘트는 살아있는 뷰어(doan serve)에서', nameFirst: '이름부터 적어 주세요',
  undesigned: '미설계', nothingHere: '비어 있음', wentWrong: '문제가 생겼습니다', loading: '불러오는 중…', image: '이미지', select: '선택', chooseFile: '파일 선택', menu: '메뉴', perPage: '/쪽',
  s_item: (n) => `항목 ${n}`, s_sample: (n) => `샘플 ${n}`, s_stores: ['강남', '성수', '판교'], s_status: ['결제완료', '대기', '환불'], s_method: ['카드', '모바일', '현금'],
};

const LANGS = { en: EN, ko: KO };

export function dictionary(lang) {
  return LANGS[lang] ?? EN;
}

export function languageOf(project) {
  return project?.conventions?.meta?.language ?? 'en';
}

// The subset the page's own JavaScript needs, as plain strings.
export function pageStrings(lang) {
  const d = dictionary(lang);
  const keys = ['clickToInspect', 'component', 'bundled', 'samplesNote', 'file', 'path', 'line', 'copy', 'copied', 'noneOnElement', 'sayWhat', 'send', 'liveOnly', 'nameFirst', 'comments', 'yourName'];
  return Object.fromEntries(keys.map((k) => [k, d[k]]));
}
