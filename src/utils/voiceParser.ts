/**
 * 语音语义解析器
 * 从自然语言中提取食物名称、数量、单位、存放区域、保质期
 * 例: "5个苹果放冷藏保质期3天" → { name: '苹果', quantity: 5, unit: '个', areaId: 'area-fridge', shelfLifeDays: 3 }
 */

// 区域关键词映射
const areaKeywords: Record<string, string[]> = {
  'area-fridge': ['冷藏', '冰箱', '冷藏室', 'fridge', 'refrigerator', '冷柜'],
  'area-freezer': ['冷冻', '冷冻室', '冻柜', 'freezer', ' frozen'],
  'area-fresh': ['保鲜', '保鲜层', '果蔬', '果蔬盒', 'crisper', 'fresh'],
  'area-door': ['门架', '门上', '门柜', 'door'],
};

// 中文单位
const cnUnits = ['个', '袋', '盒', '瓶', '包', '块', '斤', '片', '根', '份', '条', '把', '颗', '只', '串', '罐', '杯', '碗', '盘', '箱', '打', '组'];
// 英文单位
const enUnits = ['pcs', 'pieces', 'bags', 'bag', 'boxes', 'box', 'bottles', 'bottle', 'packs', 'pack', 'cans', 'can', 'cups', 'cup'];

export interface ParsedVoiceResult {
  name: string;
  quantity: number;
  unit: string;
  areaId: string | null;
  shelfLifeDays: number | null;
  confidence: number; // 0-1
}

/**
 * 从语音文本中提取结构化信息
 */
export function parseVoiceText(
  text: string,
  isEnglish: boolean,
  allFoodNames: string[], // 所有已知食物名称列表
): ParsedVoiceResult {
  const result: ParsedVoiceResult = {
    name: '',
    quantity: 1,
    unit: isEnglish ? 'pcs' : '个',
    areaId: null,
    shelfLifeDays: null,
    confidence: 0,
  };

  if (!text.trim()) return result;

  let remaining = text.trim();
  let matchCount = 0;

  // 1. 提取区域
  for (const [areaId, keywords] of Object.entries(areaKeywords)) {
    for (const kw of keywords) {
      if (remaining.toLowerCase().includes(kw.toLowerCase())) {
        result.areaId = areaId;
        remaining = remaining.replace(new RegExp(kw, 'gi'), '').trim();
        matchCount++;
        break;
      }
    }
    if (result.areaId) break;
  }

  // 2. 提取保质期 (多种模式)
  // "保质期3天" / "保鲜3天" / "放3天" / "3天" / "3 days" / "for 3 days"
  const shelfLifePatterns = isEnglish
    ? [
        /(?:shelf\s*life|expires?\s*in|for|about)\s+(\d+)\s*(days?|weeks?|months?)/i,
        /(\d+)\s*(days?|weeks?|months?)/i,
      ]
    : [
        /保质期\s*(\d+)\s*[天日]/,
        /(?:可)?(?:放|存|保鲜|保存)\s*(\d+)\s*[天日]/,
        /(\d+)\s*[天日](?:的?保质期)?/,
        /(\d+)\s*周/,
        /(\d+)\s*个?月/,
      ];

  for (const pattern of shelfLifePatterns) {
    const m = remaining.match(pattern);
    if (m) {
      let days = parseInt(m[1]);
      if (m[2] && /week/i.test(m[2])) days *= 7;
      if (m[2] && /month/i.test(m[2])) days *= 30;
      if (/[周]/.test(m[0])) days *= 7;
      if (/[月]/.test(m[0])) days *= 30;
      result.shelfLifeDays = days;
      remaining = remaining.replace(m[0], '').trim();
      matchCount++;
      break;
    }
  }

  // 3. 提取数量和单位
  // "5个苹果" / "5 apples" / "3盒牛奶"
  const allUnits = isEnglish ? [...enUnits, ...cnUnits] : [...cnUnits, ...enUnits];
  const unitPattern = isEnglish
    ? /(\d+)\s*([\w]+)\s*/i
    : /(\d+)\s*([个袋盒瓶包块斤片根份条把颗只串罐杯碗盘箱打组])\s*/;

  const qtyMatch = remaining.match(unitPattern);
  if (qtyMatch) {
    const num = parseInt(qtyMatch[1]);
    const detectedUnit = qtyMatch[2];
    if (num > 0 && num < 10000) {
      result.quantity = num;
      if (allUnits.some(u => detectedUnit.toLowerCase() === u.toLowerCase())) {
        result.unit = detectedUnit;
      }
      remaining = remaining.replace(qtyMatch[0], '').trim();
      matchCount++;
    }
  }

  // 也尝试中文数字
  const cnNumMap: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '两': 2, '半': 0.5,
  };
  for (const [cn, num] of Object.entries(cnNumMap)) {
    const pattern = new RegExp(`${cn}([个袋盒瓶包块斤片根份条把颗只串罐杯碗盘箱打组])`);
    const m = remaining.match(pattern);
    if (m) {
      result.quantity = num;
      result.unit = m[1];
      remaining = remaining.replace(m[0], '').trim();
      matchCount++;
      break;
    }
  }

  // 4. 提取食物名称 - 从剩余文本中匹配已知食物名
  remaining = remaining.replace(/[,，。.!！?？、]/g, ' ').trim();
  remaining = remaining.replace(/放了|放在|放|存|存了/g, '').trim();

  // 尝试匹配已知食物名称（优先匹配最长的）
  const sortedNames = [...allFoodNames].sort((a, b) => b.length - a.length);
  for (const foodName of sortedNames) {
    if (remaining.toLowerCase().includes(foodName.toLowerCase())) {
      result.name = foodName;
      remaining = remaining.replace(new RegExp(foodName, 'gi'), '').trim();
      matchCount++;
      break;
    }
  }

  // 如果没有匹配到已知食物名，使用剩余文本作为名称
  if (!result.name && remaining.trim()) {
    // 清理常见无关词
    let cleaned = remaining
      .replace(/帮我|我?买了|新?买了?|记一下|记录|添加|加了|放入|放到/g, '')
      .replace(/一些|一点|若干/g, '')
      .trim();
    if (cleaned) {
      result.name = cleaned;
      matchCount++;
    }
  }

  // 计算置信度
  result.confidence = Math.min(matchCount / 3, 1);

  return result;
}

/**
 * 格式化语音解析结果为可读文本
 */
export function formatParsedResult(result: ParsedVoiceResult, isEnglish: boolean): string {
  const parts: string[] = [];
  if (result.name) parts.push(isEnglish ? `Food: ${result.name}` : `食物: ${result.name}`);
  if (result.quantity > 1 || result.unit) parts.push(`${result.quantity}${result.unit}`);
  if (result.areaId) {
    const areaNames: Record<string, string> = {
      'area-fridge': isEnglish ? 'Fridge' : '冷藏室',
      'area-freezer': isEnglish ? 'Freezer' : '冷冻室',
      'area-fresh': isEnglish ? 'Crisper' : '保鲜层',
      'area-door': isEnglish ? 'Door' : '门架',
    };
    parts.push(isEnglish ? `in ${areaNames[result.areaId]}` : `放${areaNames[result.areaId]}`);
  }
  if (result.shelfLifeDays !== null) {
    parts.push(isEnglish ? `${result.shelfLifeDays} days` : `保质期${result.shelfLifeDays}天`);
  }
  return parts.join(' · ');
}
