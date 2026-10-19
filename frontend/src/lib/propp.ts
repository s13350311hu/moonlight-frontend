import { L } from './i18n'

/**
 * 大塚英志《物語の体操》第三講「方程式でプロットがみるみる作れる」的三張表。
 * 原書是日文，所以 ja 欄位是書上的原詞；zh/jaDesc 是兩種語言的說明。
 */

export interface PropFunction {
  /** 普羅普原用的代號 */
  code: string
  /** 書上的原名 */
  ja: string
  /** 中文說明 */
  zh: string
  /** 日文說明 */
  jaDesc: string
  phase: 'prepare' | 'trouble' | 'quest' | 'trial' | 'return' | 'settle'
}

/** 三十一個機能。書上說「全部で三一あります」。 */
export const FUNCTIONS: PropFunction[] = [
  { code: 'α', ja: '不在', zh: '家裡有人離開（出遠門、死去、上班去）', jaDesc: '家族の一人が家を留守にする', phase: 'prepare' },
  { code: 'β', ja: '禁止', zh: '主角被交代不可以做某件事', jaDesc: '主人公に何かが禁じられる', phase: 'prepare' },
  { code: 'γ', ja: '侵犯', zh: '禁令被打破', jaDesc: '禁が破られる', phase: 'prepare' },
  { code: 'δ', ja: '探索', zh: '敵人開始打探', jaDesc: '敵が探りを入れる', phase: 'prepare' },
  { code: 'ε', ja: '情報漏洩', zh: '敵人取得受害者的情報', jaDesc: '敵が犠牲者の情報を得る', phase: 'prepare' },
  { code: 'ζ', ja: '謀計', zh: '敵人用欺騙的手段接近', jaDesc: '敵が欺いて近づく', phase: 'prepare' },
  { code: 'η', ja: '幇助', zh: '受害者上當，反而幫了敵人', jaDesc: '犠牲者が騙され、敵を助けてしまう', phase: 'prepare' },
  { code: 'A', ja: '加害', zh: '敵人造成傷害（或出現某種欠缺）', jaDesc: '敵が害を加える（あるいは欠如が生じる）', phase: 'trouble' },
  { code: 'B', ja: '仲介', zh: '不幸被傳達出去，主角接到請託或命令', jaDesc: '不幸が知らされ、主人公に依頼や命令が下る', phase: 'trouble' },
  { code: 'C', ja: '反擊的承諾', zh: '主角決定要對抗', jaDesc: '主人公が対抗を決意する', phase: 'trouble' },
  { code: '↑', ja: '出發', zh: '主角離家出發', jaDesc: '主人公が家を出発する', phase: 'quest' },
  { code: 'D', ja: '贈與者的第一個機能', zh: '主角遇上贈與者，受到試探', jaDesc: '贈与者が主人公を試す', phase: 'trial' },
  { code: 'E', ja: '主角的反應', zh: '主角對試探做出反應', jaDesc: '主人公が試練に反応する', phase: 'trial' },
  { code: 'F', ja: '取得關鍵手段', zh: '主角拿到關鍵的東西或能力', jaDesc: '主人公が魔法の手段を手に入れる', phase: 'trial' },
  { code: 'G', ja: '兩個王國之間的移動', zh: '主角被帶到目標所在之處', jaDesc: '主人公が目的の場所へ移される', phase: 'quest' },
  { code: 'H', ja: '鬥爭', zh: '主角與敵人正面衝突', jaDesc: '主人公と敵が直接戦う', phase: 'trial' },
  { code: 'I', ja: '標記', zh: '主角被留下記號（傷疤、印記）', jaDesc: '主人公に印がつけられる', phase: 'trial' },
  { code: 'J', ja: '勝利', zh: '敵人被擊敗', jaDesc: '敵が敗れる', phase: 'trial' },
  { code: 'K', ja: '回復', zh: '最初的傷害或欠缺被補回來', jaDesc: '最初の加害や欠如が回復される', phase: 'return' },
  { code: '↓', ja: '歸還', zh: '主角踏上歸途', jaDesc: '主人公が帰路につく', phase: 'return' },
  { code: 'Pr', ja: '追跡', zh: '主角被追捕', jaDesc: '主人公が追跡される', phase: 'return' },
  { code: 'Rs', ja: '救助', zh: '主角脫險', jaDesc: '主人公が救われる', phase: 'return' },
  { code: 'O', ja: '不動聲色地抵達', zh: '主角沒被認出來地回到原處', jaDesc: '主人公が気づかれずに帰り着く', phase: 'settle' },
  { code: 'L', ja: '不當的要求', zh: '假主角出面冒領功勞', jaDesc: 'にせの主人公が不当な要求をする', phase: 'settle' },
  { code: 'M', ja: '難題', zh: '主角被出了一道難題', jaDesc: '主人公に難題が課される', phase: 'settle' },
  { code: 'N', ja: '解決', zh: '難題被解開', jaDesc: '難題が解決される', phase: 'settle' },
  { code: 'Q', ja: '認知', zh: '主角的身分被認出來', jaDesc: '主人公が認知される', phase: 'settle' },
  { code: 'Ex', ja: '正體露見', zh: '假主角或敵人的真面目曝光', jaDesc: 'にせの主人公か敵の正体が露見する', phase: 'settle' },
  { code: 'T', ja: '變身', zh: '主角換上新的樣貌', jaDesc: '主人公に新しい姿が与えられる', phase: 'settle' },
  { code: 'U', ja: '處罰', zh: '假主角或敵人受到懲罰', jaDesc: 'にせの主人公か敵が罰せられる', phase: 'settle' },
  { code: 'W', ja: '結婚', zh: '主角成婚、即位，或得到他要的東西', jaDesc: '主人公が結婚し、王位につく', phase: 'settle' },
]

/** 機能在畫面上的名字：中文介面用中文說明，日文介面用書上的原名。 */
export function funcLabel(f: PropFunction): string {
  return L(f.ja, f.ja)
}
export function funcDesc(f: PropFunction): string {
  return L(f.zh, f.jaDesc)
}

export const PHASE_LABEL: Record<PropFunction['phase'], () => string> = {
  prepare: () => L('鋪陳', '準備'),
  trouble: () => L('事情發生', '事件が起きる'),
  quest: () => L('上路', '出発'),
  trial: () => L('試煉', '試練'),
  return: () => L('回程', '帰路'),
  settle: () => L('收尾', '結末'),
}

/** 普羅普的七種登場人物，以及各自的「行為の領域」。 */
export const ROLES = [
  { id: 'villain', ja: '敵', zh: '敵人', domain: '加害 A、與主角的鬥爭 H、追捕 Pr', jaDomain: '加害 A、主人公との闘争 H、追跡 Pr' },
  { id: 'donor', ja: '贈与者', zh: '贈與者', domain: '試探的準備 D、交付關鍵手段 F', jaDomain: '魔法の手段の譲渡の準備 D、譲渡 F' },
  { id: 'helper', ja: '援助者', zh: '援助者', domain: '空間移動 G、回復 K、救助 Rs、解難題 N、變身 T', jaDomain: '空間の移動 G、回復 K、救助 Rs、難題の解決 N、変身 T' },
  { id: 'princess', ja: '王女とその父', zh: '公主與其父（＝尋找的對象）', domain: '出難題 M、認出主角 Q、揭穿 Ex、成婚 W、處罰 U', jaDomain: '難題を出す M、主人公の認知 Q、正体露見 Ex、結婚 W、処罰 U' },
  { id: 'dispatcher', ja: '委任者', zh: '委任者（派遣的人）', domain: '把主角派出去 B', jaDomain: '主人公の派遣 B' },
  { id: 'hero', ja: '主人公', zh: '主角', domain: '出發 C、回應試探 E、成婚 W', jaDomain: '探索の出発 C、贈与者の試練への反応 E、結婚 W' },
  { id: 'false', ja: 'にせの主人公', zh: '假主角', domain: '出發 C、對試探做出否定的回應 E、冒領 L', jaDomain: '探索の出発 C、試練への否定的な反応 E、不当な要求 L' },
] as const

/** 格雷馬斯的行為者模型：六個行為項。書上的圖 7。 */
export const ACTANTS = [
  { id: 'subject', ja: '主体', zh: '主體', hint: '想要得到某樣東西的人。偵探小說裡是偵探。', jaHint: '何かを得ようとする人。探偵小説なら探偵。' },
  { id: 'object', ja: '対象', zh: '對象', hint: '他要的東西。偵探小說裡是事件的真相。', jaHint: 'その人が求めるもの。探偵小説なら事件の真相。' },
  { id: 'sender', ja: '送り手', zh: '送出者', hint: '把任務交給主體的人。委託人。', jaHint: '主体に務めを託す人。依頼人。' },
  { id: 'receiver', ja: '受け手', zh: '接收者', hint: '最後受益的人。常常和送出者是同一個。', jaHint: '最後に受け取る人。送り手と同じことが多い。' },
  { id: 'helper', ja: '援助者', zh: '援助者', hint: '幫主體的人。偵探的助手。', jaHint: '主体を助ける人。探偵の助手。' },
  { id: 'opponent', ja: '敵対者', zh: '敵對者', hint: '擋在路上的人。兇手。', jaHint: '行く手を阻む人。犯人。' },
] as const

export type ActantId = (typeof ACTANTS)[number]['id']

export function actantLabel(a: (typeof ACTANTS)[number]): string {
  return L(a.zh, a.ja)
}
export function actantHint(a: (typeof ACTANTS)[number]): string {
  return L(a.hint, a.jaHint)
}
export function roleLabel(r: (typeof ROLES)[number]): string {
  return L(r.zh, r.ja)
}
export function roleDomain(r: (typeof ROLES)[number]): string {
  return L(r.domain, r.jaDomain)
}

/** 《小説作法ABC》第六章「描写／速度／比喩」。 */
export const CRAFT = [
  {
    title: '三要素', jaTitle: '三つの要素',
    body: '小說由會話、描寫、說明構成。說明是最便宜的一種——能用會話或描寫處理的，就不要寫成說明。',
    jaBody: '小説は会話・描写・説明でできている。説明はいちばん安上がりな手。会話か描写で処理できるなら、説明にしない。',
  },
  {
    title: '描寫的細分化', jaTitle: '描写の細分化',
    body: '對一樣東西的關心愈深，語彙分得愈細。因紐特人分得出很多種雪。寫到角色真正在意的東西，語彙要跟著變細；寫到他不在意的，含糊反而是對的。',
    jaBody: '対象への関心が深いほど語彙は細かく分かれる。イヌイットは雪を多くの語で言い分ける。人物が本当に気にしているものは語彙も細かく、気にしていないものは曖昧でいい。',
  },
  {
    title: '描寫的速度', jaTitle: '描写とスピード',
    body: '視點人物移動得多快，決定他看得見多少。新幹線只留得下色塊，腳踏車看得到招牌，走路才看得到地上的裂縫，停下來才能盯著一樣東西看到它變形。密度跟速度對不上就是破綻。',
    jaBody: '視点人物の移動の速さが、見えるものの量を決める。新幹線なら色の塊、自転車なら看板、歩いて初めて地面のひび割れが見える。密度と速度が合わなければ破綻する。',
  },
  {
    title: '比喻', jaTitle: '比喩',
    body: '比喻是把只有你看得見的畫面傳給別人的技術。「像雪一樣白」等於沒寫。比喻要從這個角色的生活經驗裡長出來——拳手看東西會像拳手。',
    jaBody: '比喩は、自分にしか見えない像を他人に渡す技術。「雪のように白い」は書いていないのと同じ。その人物の生活から生えてくる比喩を探す。',
  },
] as const
