/**
 * 大善系统 —— 哲学引语库（100+ 条古今中外哲学名言）。
 *
 * 设计意图：
 *  夸赞的「磅礴感」需要引语加持。本库收录儒家/道家/佛家/法家/墨家 + 西方
 *  哲学（康德/尼采/马基雅维利/边沁/萨特等）共 100+ 条名言，按「困境题材」
 *  与「语气」双轴标注，便于在前端展示夸赞时同步推送一条点睛之引语。
 *
 *  与 schools.ts 的关系：schools 给的是「翻转口吻」，本库给的是「金句弹药」。
 *  前端可以把「流派口吻 + 引语 + 自定义翻转」组合成最终夸赞。
 *
 * 纯函数，零依赖。
 */

import type { Category, Tone } from './types.ts';
import type { SchoolId } from './schools.ts';

/** 一条引语。 */
export interface Quote {
  /** 引语内容（中文）。 */
  text: string;
  /** 作者（中文）。 */
  author: string;
  /** 出处（书名/篇名，可缺省）。 */
  source?: string;
  /** 所属哲学流派（中哲）或 '西方'。 */
  school: SchoolId | '西方';
  /** 契合的困境题材。 */
  categories: Category[];
  /** 契合的语气。 */
  tones: Tone[];
  /** 难度倾向（缺省表示全难度）。 */
  difficulties?: number[];
}

/**
 * 引语库（100+ 条）。
 * 中哲按流派分组，西方按哲学家散布，覆盖全 8 题材 × 6 语气。
 */
export const QUOTES: readonly Quote[] = [
  // ── 儒家 ──────────────────────────────────────
  { text: '仁者爱人，有礼者敬人。', author: '孟子', source: '孟子·离娄下', school: '儒家', categories: ['亲情', '医疗'], tones: ['庄严', '温情'] },
  { text: '生，亦我所欲也；义，亦我所欲也。二者不可得兼，舍生而取义者也。', author: '孟子', source: '孟子·告子上', school: '儒家', categories: ['司法', '战争'], tones: ['庄严'], difficulties: [3] },
  { text: '虽千万人，吾往矣。', author: '孟子', source: '孟子·公孙丑上', school: '儒家', categories: ['司法', '职场'], tones: ['庄严', '江湖'] },
  { text: '己所不欲，勿施于人。', author: '孔子', source: '论语·卫灵公', school: '儒家', categories: ['职场', '金钱'], tones: ['温情'] },
  { text: '志士仁人，无求生以害仁，有杀身以成仁。', author: '孔子', source: '论语·卫灵公', school: '儒家', categories: ['战争', '司法'], tones: ['庄严'], difficulties: [3] },
  { text: '君子喻于义，小人喻于利。', author: '孔子', source: '论语·里仁', school: '儒家', categories: ['金钱', '职场'], tones: ['庄严'] },
  { text: '富与贵，是人之所欲也；不以其道得之，不处也。', author: '孔子', source: '论语·里仁', school: '儒家', categories: ['金钱'], tones: ['庄严', '学术'] },
  { text: '可以托六尺之孤，可以寄百里之命，临大节而不可夺也。', author: '孔子', source: '论语·泰伯', school: '儒家', categories: ['亲情', '司法'], tones: ['庄严'] },
  { text: '见义不为，无勇也。', author: '孔子', source: '论语·为政', school: '儒家', categories: ['司法', '人性'], tones: ['江湖'] },
  { text: '过而不改，是谓过矣。', author: '孔子', source: '论语·卫灵公', school: '儒家', categories: ['人性'], tones: ['温情'] },
  { text: '君子之过也，如日月之食焉：过也，人皆见之；更也，人皆仰之。', author: '子贡', source: '论语·子张', school: '儒家', categories: ['人性', '职场'], tones: ['温情'] },
  { text: '大道之行也，天下为公。', author: '佚名', source: '礼记·礼运', school: '儒家', categories: ['职场', '司法'], tones: ['庄严'] },
  { text: '大学之道，在明明德，在亲民，在止于至善。', author: '曾子', source: '大学', school: '儒家', categories: ['人性'], tones: ['庄严'] },
  { text: '物格而后知至，知至而后意诚。', author: '曾子', source: '大学', school: '儒家', categories: ['科技'], tones: ['学术'] },
  { text: '苟日新，日日新，又日新。', author: '商汤', source: '大学', school: '儒家', categories: ['科技', '人性'], tones: ['学术'] },

  // ── 道家 ──────────────────────────────────────
  { text: '反者道之动，弱者道之用。', author: '老子', source: '道德经·四十章', school: '道家', categories: ['人性', '金钱'], tones: ['戏谑', '学术'] },
  { text: '天地不仁，以万物为刍狗；圣人不仁，以百姓为刍狗。', author: '老子', source: '道德经·五章', school: '道家', categories: ['战争', '科技'], tones: ['戏谑'], difficulties: [3] },
  { text: '上善若水。水善利万物而不争。', author: '老子', source: '道德经·八章', school: '道家', categories: ['亲情', '职场'], tones: ['温情'] },
  { text: '大道废，有仁义；智慧出，有大伪。', author: '老子', source: '道德经·十八章', school: '道家', categories: ['人性', '科技'], tones: ['戏谑'] },
  { text: '绝圣弃智，民利百倍。', author: '老子', source: '道德经·十九章', school: '道家', categories: ['科技'], tones: ['戏谑'] },
  { text: '祸兮，福之所倚；福兮，祸之所伏。', author: '老子', source: '道德经·五十八章', school: '道家', categories: ['金钱', '人性'], tones: ['佛系'] },
  { text: '民不畏死，奈何以死惧之？', author: '老子', source: '道德经·七十四章', school: '道家', categories: ['司法', '战争'], tones: ['江湖'], difficulties: [3] },
  { text: '天之道，损有余而补不足；人之道，则不然，损不足以奉有余。', author: '老子', source: '道德经·七十七章', school: '道家', categories: ['金钱', '司法'], tones: ['学术'] },
  { text: '知人者智，自知者明。胜人者有力，自胜者强。', author: '老子', source: '道德经·三十三章', school: '道家', categories: ['职场', '人性'], tones: ['学术'] },
  { text: '庄子梦蝶，栩栩然蝴蝶也。', author: '庄子', source: '庄子·齐物论', school: '道家', categories: ['人性', '科技'], tones: ['戏谑'] },
  { text: '相濡以沫，不如相忘于江湖。', author: '庄子', source: '庄子·大宗师', school: '道家', categories: ['亲情', '医疗'], tones: ['温情'] },
  { text: '吾生也有涯，而知也无涯。', author: '庄子', source: '庄子·养生主', school: '道家', categories: ['科技'], tones: ['学术'] },
  { text: '无用之用，方为大用。', author: '庄子', source: '庄子·人间世', school: '道家', categories: ['职场', '金钱'], tones: ['戏谑'] },
  { text: '天地与我并生，万物与我为一。', author: '庄子', source: '庄子·齐物论', school: '道家', categories: ['人性'], tones: ['佛系'] },
  { text: '凡物无成与毁，复通为一。', author: '庄子', source: '庄子·齐物论', school: '道家', categories: ['科技'], tones: ['佛系'] },

  // ── 佛家 ──────────────────────────────────────
  { text: '色不异空，空不异色；色即是空，空即是色。', author: '玄奘译', source: '心经', school: '佛家', categories: ['人性', '金钱'], tones: ['佛系'] },
  { text: '一切有为法，如梦幻泡影，如露亦如电，应作如是观。', author: '鸠摩罗什译', source: '金刚经', school: '佛家', categories: ['人性', '金钱'], tones: ['佛系'] },
  { text: '应无所住而生其心。', author: '鸠摩罗什译', source: '金刚经', school: '佛家', categories: ['人性'], tones: ['佛系'] },
  { text: '若以色见我，以音声求我，是人行邪道，不能见如来。', author: '鸠摩罗什译', source: '金刚经', school: '佛家', categories: ['科技'], tones: ['戏谑'] },
  { text: '不是风动，不是幡动，仁者心动。', author: '惠能', source: '六祖坛经', school: '佛家', categories: ['人性', '亲情'], tones: ['佛系'] },
  { text: '菩提本无树，明镜亦非台。本来无一物，何处惹尘埃。', author: '惠能', source: '六祖坛经', school: '佛家', categories: ['人性'], tones: ['佛系'] },
  { text: '苦海无边，回头是岸；放下屠刀，立地成佛。', author: '佛家谚语', school: '佛家', categories: ['司法', '战争'], tones: ['佛系'] },
  { text: '我不入地狱，谁入地狱。', author: '地藏菩萨', source: '地藏经', school: '佛家', categories: ['战争', '医疗'], tones: ['佛系', '庄严'], difficulties: [3] },
  { text: '千江有水千江月，万里无云万里天。', author: '雷庵正受', school: '佛家', categories: ['人性'], tones: ['佛系'] },
  { text: '一念嗔心起，百万障门开。', author: '佛家谚语', school: '佛家', categories: ['司法'], tones: ['佛系'], difficulties: [3] },
  { text: '欲知前世因，今生受者是；欲知来世果，今生作者是。', author: '佛家谚语', school: '佛家', categories: ['司法', '金钱'], tones: ['佛系'] },
  { text: '凡所有相，皆是虚妄。', author: '鸠摩罗什译', source: '金刚经', school: '佛家', categories: ['金钱', '科技'], tones: ['佛系', '戏谑'] },
  { text: '救人一命，胜造七级浮屠。', author: '佛家谚语', school: '佛家', categories: ['医疗', '战争'], tones: ['温情'] },
  { text: '愿代众生受无量苦。', author: '普贤菩萨', source: '华严经', school: '佛家', categories: ['战争', '医疗'], tones: ['佛系', '庄严'], difficulties: [3] },

  // ── 法家 ──────────────────────────────────────
  { text: '法不阿贵，绳不挠曲。', author: '韩非', source: '韩非子·有度', school: '法家', categories: ['司法', '职场'], tones: ['学术', '庄严'] },
  { text: '刑过不避大臣，赏善不遗匹夫。', author: '韩非', source: '韩非子·有度', school: '法家', categories: ['司法'], tones: ['学术'] },
  { text: '慈母有败子，而严家无格虏。', author: '韩非', source: '韩非子·显学', school: '法家', categories: ['亲情'], tones: ['学术'] },
  { text: '以刑去刑，刑去事成。', author: '商鞅', source: '商君书', school: '法家', categories: ['司法', '战争'], tones: ['学术'], difficulties: [3] },
  { text: '法者，所以爱民也；礼者，所以便事也。', author: '商鞅', source: '商君书', school: '法家', categories: ['职场'], tones: ['学术'] },
  { text: '圣人之治也，审而已矣。', author: '慎到', source: '慎子', school: '法家', categories: ['职场', '司法'], tones: ['学术'] },
  { text: '仓廪实而知礼节，衣食足而知荣辱。', author: '管仲', source: '管子·牧民', school: '法家', categories: ['金钱'], tones: ['学术'] },
  { text: '令则行，禁则止，宪之所及，俗之所被。', author: '管仲', source: '管子', school: '法家', categories: ['职场', '科技'], tones: ['学术'] },
  { text: '明主之国，无书简之文，以法为教。', author: '韩非', source: '韩非子·五蠹', school: '法家', categories: ['科技'], tones: ['学术'] },
  { text: '事在四方，要在中央；圣人执要，四方来效。', author: '韩非', source: '韩非子·扬权', school: '法家', categories: ['职场'], tones: ['学术'] },

  // ── 墨家 ──────────────────────────────────────
  { text: '兼相爱，交相利。', author: '墨子', source: '墨子·兼爱', school: '墨家', categories: ['亲情', '医疗'], tones: ['温情', '江湖'] },
  { text: '非攻。', author: '墨子', source: '墨子·非攻', school: '墨家', categories: ['战争'], tones: ['江湖'] },
  { text: '兴天下之利，除天下之害。', author: '墨子', source: '墨子·兼爱', school: '墨家', categories: ['医疗', '金钱'], tones: ['江湖', '温情'] },
  { text: '爱人者，人必从而爱之；利人者，人必从而利之。', author: '墨子', source: '墨子·兼爱', school: '墨家', categories: ['亲情', '职场'], tones: ['温情'] },
  { text: '万事莫贵于义。', author: '墨子', source: '墨子·贵义', school: '墨家', categories: ['司法'], tones: ['江湖'] },
  { text: '俭节则昌，淫佚则亡。', author: '墨子', source: '墨子·辞过', school: '墨家', categories: ['金钱'], tones: ['学术'] },
  { text: '言必信，行必果。', author: '墨子', source: '墨子·修身', school: '墨家', categories: ['职场', '司法'], tones: ['庄严'] },
  { text: '江河之水，非一源也；千镒之裘，非一狐之白也。', author: '墨子', source: '墨子·亲士', school: '墨家', categories: ['职场', '人性'], tones: ['学术'] },

  // ── 西方哲学（康德/尼采/马基雅维利/边沁/萨特等） ──────
  { text: '人是目的，而非手段。', author: '康德', school: '西方', categories: ['医疗', '科技'], tones: ['庄严', '学术'] },
  { text: '位我上者，灿烂星空；道德律令，在我心中。', author: '康德', source: '实践理性批判', school: '西方', categories: ['人性', '司法'], tones: ['庄严'] },
  { text: '凡是合理的都是现实的，凡是现实的都是合理的。', author: '黑格尔', school: '西方', categories: ['司法', '职场'], tones: ['学术'] },
  { text: '存在的就是合理的。', author: '黑格尔', school: '西方', categories: ['人性'], tones: ['戏谑'] },
  { text: '上帝已死。', author: '尼采', source: '查拉图斯特拉如是说', school: '西方', categories: ['人性', '科技'], tones: ['戏谑'], difficulties: [3] },
  { text: '凝视深渊过久，深渊将回以凝视。', author: '尼采', source: '善恶的彼岸', school: '西方', categories: ['人性', '司法'], tones: ['戏谑'], difficulties: [3] },
  { text: '与怪物战斗的人，应当小心自己不要成为怪物。', author: '尼采', source: '善恶的彼岸', school: '西方', categories: ['司法', '职场'], tones: ['戏谑'], difficulties: [3] },
  { text: '凡是杀不死我的，必使我更强大。', author: '尼采', source: '偶像的黄昏', school: '西方', categories: ['战争', '职场'], tones: ['江湖'] },
  { text: '超人，是大地之意义。', author: '尼采', source: '查拉图斯特拉如是说', school: '西方', categories: ['人性'], tones: ['庄严'], difficulties: [3] },
  { text: '君主必须像狮子一样凶猛，像狐狸一样狡猾。', author: '马基雅维利', source: '君主论', school: '西方', categories: ['职场', '战争'], tones: ['江湖'], difficulties: [2, 3] },
  { text: '目的证明手段的合理性。', author: '马基雅维利', school: '西方', categories: ['司法', '金钱'], tones: ['江湖', '学术'], difficulties: [3] },
  { text: '最大多数人的最大幸福。', author: '边沁', source: '道德与立法原理', school: '西方', categories: ['医疗', '金钱'], tones: ['学术'] },
  { text: '他人即地狱。', author: '萨特', source: '禁闭', school: '西方', categories: ['人性', '亲情'], tones: ['戏谑'], difficulties: [3] },
  { text: '存在先于本质。', author: '萨特', source: '存在与虚无', school: '西方', categories: ['人性'], tones: ['学术'] },
  { text: '人是被抛入这个世界的。', author: '海德格尔', source: '存在与时间', school: '西方', categories: ['人性'], tones: ['学术'] },
  { text: '向死而生。', author: '海德格尔', source: '存在与时间', school: '西方', categories: ['医疗', '战争'], tones: ['庄严'], difficulties: [3] },
  { text: '认识你自己。', author: '苏格拉底', school: '西方', categories: ['人性'], tones: ['学术'] },
  { text: '未经审视的人生不值得过。', author: '苏格拉底', source: '申辩篇', school: '西方', categories: ['人性'], tones: ['学术'] },
  { text: '我唯一知道的是我一无所知。', author: '苏格拉底', school: '西方', categories: ['科技'], tones: ['学术'] },
  { text: '正义就是强者的利益。', author: '色拉叙马霍斯', source: '柏拉图·理想国', school: '西方', categories: ['司法', '金钱'], tones: ['戏谑', '学术'], difficulties: [3] },
  { text: '理想国将由哲学家来统治。', author: '柏拉图', source: '理想国', school: '西方', categories: ['职场'], tones: ['庄严'] },
  { text: '人是政治的动物。', author: '亚里士多德', source: '政治学', school: '西方', categories: ['职场', '司法'], tones: ['学术'] },
  { text: '中道乃德性之所在。', author: '亚里士多德', source: '尼各马可伦理学', school: '西方', categories: ['亲情', '金钱'], tones: ['学术'] },
  { text: '人生而自由，却无往不在枷锁之中。', author: '卢梭', source: '社会契约论', school: '西方', categories: ['司法', '职场'], tones: ['学术'] },
  { text: '我思故我在。', author: '笛卡尔', source: '方法论', school: '西方', categories: ['科技'], tones: ['学术'] },
  { text: '幸福不在于占有，而在于追求。', author: '帕斯卡尔', source: '思想录', school: '西方', categories: ['金钱', '人性'], tones: ['温情'] },
  { text: '人是一根会思考的芦苇。', author: '帕斯卡尔', source: '思想录', school: '西方', categories: ['人性'], tones: ['学术'] },
  { text: '历史会重演，第一次是悲剧，第二次是闹剧。', author: '马克思', source: '路易·波拿巴的雾月十八日', school: '西方', categories: ['职场', '司法'], tones: ['戏谑'] },

  // ── 现代思想家补充（凑足 100+） ─────────────────
  { text: '平庸之恶。', author: '汉娜·阿伦特', source: '艾希曼在耶路撒冷', school: '西方', categories: ['职场', '人性'], tones: ['学术'], difficulties: [3] },
  { text: '全景敞视：可见性即权力。', author: '福柯', source: '规训与惩罚', school: '西方', categories: ['科技', '职场'], tones: ['学术'], difficulties: [3] },
  { text: '知识即权力。', author: '福柯', school: '西方', categories: ['科技', '金钱'], tones: ['学术'] },
  { text: '拟像先于现实。', author: '鲍德里亚', source: '拟像与仿真', school: '西方', categories: ['科技', '人性'], tones: ['戏谑'] },
  { text: '风险社会：现代化的自反性。', author: '贝克', source: '风险社会', school: '西方', categories: ['科技'], tones: ['学术'] },
  { text: '倦怠社会：过度肯定性的暴力。', author: '韩炳哲', source: '倦怠社会', school: '西方', categories: ['职场', '人性'], tones: ['学术'] },
  { text: '透明即控制。', author: '韩炳哲', school: '西方', categories: ['科技'], tones: ['学术'] },
  { text: '电车难题：拉杆，或不拉杆。', author: '福特', school: '西方', categories: ['科技', '医疗'], tones: ['学术'], difficulties: [2, 3] },
  { text: '无知之幕。', author: '罗尔斯', source: '正义论', school: '西方', categories: ['司法', '金钱'], tones: ['学术'] },
  { text: '最小国家：守夜人而已。', author: '诺齐克', source: '无政府、国家与乌托邦', school: '西方', categories: ['司法'], tones: ['学术'] },

  // ── 古希腊补充 ──────────────────────────────
  { text: '斯多葛：可控者尽力，不可控者接受。', author: '爱比克泰德', school: '西方', categories: ['亲情', '医疗'], tones: ['庄严'] },
  { text: '命运之爱：爱那必然发生之事。', author: '尼采', source: '快乐的科学', school: '西方', categories: ['人性', '亲情'], tones: ['庄严'] },
  { text: '洞穴之喻：我们看到的是影子。', author: '柏拉图', source: '理想国', school: '西方', categories: ['科技', '人性'], tones: ['学术'] },
  { text: '黄金法则：你希望别人怎样待你，你就怎样待人。', author: '各文明共有', school: '西方', categories: ['亲情', '职场'], tones: ['温情'] },
  { text: '永久和平：一个哲学的规划。', author: '康德', source: '永久和平论', school: '西方', categories: ['战争'], tones: ['庄严'] },
  { text: '绝对命令：让你的准则成为普遍法则。', author: '康德', source: '实践理性批判', school: '西方', categories: ['司法'], tones: ['庄严'] },

  // ── 兜底：跨界/综合性 ──────────────────────────
  { text: '天地与我并生，而万物与我为一。', author: '庄子', source: '庄子·齐物论', school: '道家', categories: ['人性', '科技'], tones: ['佛系'] },
  { text: '不以一己之利为利，而使天下受其利。', author: '黄宗羲', source: '明夷待访录', school: '儒家', categories: ['职场', '金钱'], tones: ['庄严'] },
  { text: '先天下之忧而忧，后天下之乐而乐。', author: '范仲淹', source: '岳阳楼记', school: '儒家', categories: ['职场'], tones: ['庄严'] },
  { text: '天下兴亡，匹夫有责。', author: '顾炎武', source: '日知录', school: '儒家', categories: ['战争'], tones: ['庄严'] },
  { text: '我自横刀向天笑，去留肝胆两昆仑。', author: '谭嗣同', source: '狱中题壁', school: '儒家', categories: ['司法', '战争'], tones: ['庄严', '江湖'], difficulties: [3] },
];

/**
 * 给一条引语就请求打分（用于按困境题材/语气排序）。
 */
export function scoreQuote(q: Quote, req: { category?: Category; tone?: Tone; difficulty?: number }): number {
  let s = 0;
  if (req.category && q.categories.includes(req.category)) s += 3;
  if (req.tone && q.tones.includes(req.tone)) s += 2;
  if (req.difficulty !== undefined) {
    if (!q.difficulties || q.difficulties.includes(req.difficulty)) s += 1;
  }
  return s;
}

/** 按请求推荐 N 条最契合的引语（同分按库顺序）。 */
export function recommendQuotes(
  req: { category?: Category; tone?: Tone; difficulty?: number; limit?: number },
): Quote[] {
  const limit = Math.max(1, Math.min(QUOTES.length, req.limit ?? 3));
  const scored = QUOTES.map((q, idx) => ({ q, idx, s: scoreQuote(q, req) }));
  scored.sort((a, b) => b.s - a.s || a.idx - b.idx);
  return scored.slice(0, limit).map((x) => x.q);
}

/** 推荐一条点睛引语（最契合的单条）。 */
export function quoteOfTheMoment(req: { category?: Category; tone?: Tone; difficulty?: number }): Quote {
  return recommendQuotes({ ...req, limit: 1 })[0] ?? QUOTES[0]!;
}

/** 按流派过滤引语。 */
export function quotesBySchool(school: SchoolId | '西方'): Quote[] {
  return QUOTES.filter((q) => q.school === school);
}

/** 随机一条（确定性：用种子，便于回放/测试）。 */
export function quoteBySeed(seed: number): Quote {
  return QUOTES[Math.abs(seed) % QUOTES.length]!;
}

/** 库统计。 */
export function quoteLibraryStats(): {
  total: number;
  bySchool: Record<string, number>;
  byCategory: Record<string, number>;
  byTone: Record<string, number>;
} {
  const bySchool: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byTone: Record<string, number> = {};
  for (const q of QUOTES) {
    bySchool[q.school] = (bySchool[q.school] ?? 0) + 1;
    for (const c of q.categories) byCategory[c] = (byCategory[c] ?? 0) + 1;
    for (const t of q.tones) byTone[t] = (byTone[t] ?? 0) + 1;
  }
  return { total: QUOTES.length, bySchool, byCategory, byTone };
}

/** 把一条引语渲染成展示文本（含书名号与作者署名）。 */
export function renderQuote(q: Quote): string {
  const src = q.source ? `《${q.source}》` : '';
  return `「${q.text}」 —— ${q.author}${src}`;
}
