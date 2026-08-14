import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { db, calcExpiryDate } from '@/db';
import type { ShelfLifePreset } from '@/types';
import { parseVoiceText, formatParsedResult, type ParsedVoiceResult } from '@/utils/voiceParser';
import { compressImage } from '@/utils/imageUtils';

type InputMode = 'single' | 'batch' | 'voice' | 'camera';

export default function FoodAddPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const categories = useStore(s => s.categories);
  const areas = useStore(s => s.areas);
  const settings = useStore(s => s.settings);
  const addFood = useStore(s => s.addFood);

  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [areaId, setAreaId] = useState(settings?.defaultArea || areas[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState(settings?.defaultUnit || '个');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [shelfLifeDays, setShelfLifeDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ShelfLifePreset[]>([]);
  const [batchText, setBatchText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedVoiceResult | null>(null);
  const [voiceTextInput, setVoiceTextInput] = useState('');
  const [allFoodNames, setAllFoodNames] = useState<string[]>([]);
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<any>(null);

  const isEn = i18n.language === 'en';

  // 常用食物快选
  const quickFoods = [
    { name: '牛奶', nameEn: 'Milk', icon: '🥛', catId: 'cat-dairy', days: 7 },
    { name: '鸡蛋', nameEn: 'Egg', icon: '🥚', catId: 'cat-egg', days: 21 },
    { name: '苹果', nameEn: 'Apple', icon: '🍎', catId: 'cat-fruit', days: 14 },
    { name: '面包', nameEn: 'Bread', icon: '🍞', catId: 'cat-bakery', days: 5 },
    { name: '猪肉', nameEn: 'Pork', icon: '🥩', catId: 'cat-meat', days: 3 },
    { name: '青菜', nameEn: 'Vegetables', icon: '🥬', catId: 'cat-vegetable', days: 5 },
    { name: '酸奶', nameEn: 'Yogurt', icon: '🥛', catId: 'cat-dairy', days: 14 },
    { name: '豆腐', nameEn: 'Tofu', icon: '🧈', catId: 'cat-other', days: 5 },
    { name: '鱼', nameEn: 'Fish', icon: '🐟', catId: 'cat-seafood', days: 2 },
    { name: '果汁', nameEn: 'Juice', icon: '🧃', catId: 'cat-drink', days: 7 },
    { name: '剩菜', nameEn: 'Leftovers', icon: '🍱', catId: 'cat-cooked', days: 3 },
    { name: '虾', nameEn: 'Shrimp', icon: '🦐', catId: 'cat-seafood', days: 2 },
  ];

  // 加载所有食物名称用于语义解析
  useEffect(() => {
    db.shelfLives.toArray().then(presets => {
      const names = presets.map(p => isEn ? p.foodNameEn : p.foodName).filter(Boolean);
      // 加入快选食物名
      const quickNames = quickFoods.map(f => isEn ? f.nameEn : f.name);
      setAllFoodNames([...new Set([...names, ...quickNames])]);
    });
  }, [isEn]);

  // 名称变化时搜索保质期预设
  useEffect(() => {
    if (name.length >= 1) {
      db.shelfLives
        .filter(sl => {
          const searchName = isEn ? sl.foodNameEn.toLowerCase() : sl.foodName;
          const q = name.toLowerCase();
          return searchName.includes(q) || sl.foodName.includes(q);
        })
        .limit(8)
        .toArray()
        .then(results => {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        });
    } else {
      setShowSuggestions(false);
    }
  }, [name, isEn]);

  // 选择预设建议
  const selectPreset = (preset: ShelfLifePreset) => {
    setName(isEn ? preset.foodNameEn : preset.foodName);
    setCategoryId(preset.categoryId);
    // 根据当前区域类型设置保质期
    const area = areas.find(a => a.id === areaId);
    if (area) {
      if (area.id === 'area-freezer') {
        setShelfLifeDays(preset.shelfLife.freezer);
      } else if (area.id === 'area-fresh') {
        setShelfLifeDays(preset.shelfLife.fresh);
      } else {
        setShelfLifeDays(preset.shelfLife.fridge);
      }
    } else {
      setShelfLifeDays(preset.shelfLife.fridge);
    }
    setShowSuggestions(false);
  };

  // 区域变化时更新保质期
  const handleAreaChange = (newAreaId: string) => {
    setAreaId(newAreaId);
    // 如果已经选了分类，更新保质期
    if (name && categoryId) {
      db.shelfLives
        .filter(sl => isEn ? sl.foodNameEn === name : sl.foodName === name)
        .first()
        .then(preset => {
          if (preset) {
            if (newAreaId === 'area-freezer') {
              setShelfLifeDays(preset.shelfLife.freezer);
            } else if (newAreaId === 'area-fresh') {
              setShelfLifeDays(preset.shelfLife.fresh);
            } else {
              setShelfLifeDays(preset.shelfLife.fridge);
            }
          }
        });
    }
  };

  // 语音识别
  const startVoice = useCallback(() => {
    setVoiceError('');
    setVoiceText('');
    setParsedResult(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(isEn ? 'Speech recognition not supported. Please type below.' : '浏览器不支持语音识别，请在下方手动输入');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = i18n.language === 'en' ? 'en-US' : 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('');
        setVoiceText(transcript);

        // 如果是最终结果，进行语义解析
        if (event.results[0].isFinal) {
          const parsed = parseVoiceText(transcript, isEn, allFoodNames);
          setParsedResult(parsed);
          // 自动填充表单
          if (parsed.name) setName(parsed.name);
          if (parsed.quantity > 0) setQuantity(parsed.quantity);
          if (parsed.unit) setUnit(parsed.unit);
          if (parsed.areaId) setAreaId(parsed.areaId);
          if (parsed.shelfLifeDays !== null) setShelfLifeDays(parsed.shelfLifeDays);
          // 自动匹配分类
          if (parsed.name) {
            db.shelfLives
              .filter(sl => sl.foodName === parsed.name || sl.foodNameEn.toLowerCase() === parsed.name.toLowerCase())
              .first()
              .then(preset => {
                if (preset) setCategoryId(preset.categoryId);
              });
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const errorMessages: Record<string, string> = {
          'no-speech': isEn ? 'No speech detected, please try again' : '未检测到语音，请重试',
          'audio-capture': isEn ? 'Microphone not found' : '未找到麦克风',
          'not-allowed': isEn ? 'Microphone permission denied' : '麦克风权限被拒绝',
          'network': isEn ? 'Network error' : '网络错误',
          'aborted': '',
          'service-not-available': isEn ? 'Speech service unavailable' : '语音服务不可用',
        };
        const msg = errorMessages[event?.error] || (isEn ? `Error: ${event?.error}` : `识别错误: ${event?.error}`);
        if (msg) setVoiceError(msg);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e: any) {
      setIsListening(false);
      setVoiceError(isEn ? 'Failed to start speech recognition' : '启动语音识别失败');
    }
  }, [i18n.language, isEn, allFoodNames]);

  const stopVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // 手动输入文本后解析
  const handleVoiceTextInput = () => {
    if (!voiceTextInput.trim()) return;
    setVoiceText(voiceTextInput);
    const parsed = parseVoiceText(voiceTextInput, isEn, allFoodNames);
    setParsedResult(parsed);
    if (parsed.name) setName(parsed.name);
    if (parsed.quantity > 0) setQuantity(parsed.quantity);
    if (parsed.unit) setUnit(parsed.unit);
    if (parsed.areaId) setAreaId(parsed.areaId);
    if (parsed.shelfLifeDays !== null) setShelfLifeDays(parsed.shelfLifeDays);
    if (parsed.name) {
      db.shelfLives
        .filter(sl => sl.foodName === parsed.name || sl.foodNameEn.toLowerCase() === parsed.name.toLowerCase())
        .first()
        .then(preset => {
          if (preset) setCategoryId(preset.categoryId);
        });
    }
  };

  // 处理图片选择
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setFoodImage(compressed);
    } catch (err) {
      console.error('Image compress failed:', err);
    }
    // 清空 input 以便再次选择同一文件
    e.target.value = '';
  };

  // 保存食物
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addFood({
        name: name.trim(),
        categoryId,
        areaId,
        quantity,
        unit,
        purchaseDate,
        shelfLifeDays,
        tags,
        image: foodImage || undefined,
        notes: notes || undefined,
      });
      navigate('/foods');
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  // 批量保存
  const handleBatchSave = async () => {
    const lines = batchText.split('\n').filter(l => l.trim());
    setSaving(true);
    for (const line of lines) {
      const parts = line.split(/[,，]/).map(p => p.trim());
      if (parts.length >= 1 && parts[0]) {
        const foodName = parts[0];
        const qty = parseInt(parts[1]) || 1;
        const u = parts[2] || unit;

        // 尝试匹配预设
        const preset = await db.shelfLives
          .filter(sl => sl.foodName === foodName || sl.foodNameEn.toLowerCase() === foodName.toLowerCase())
          .first();

        await addFood({
          name: foodName,
          categoryId: preset?.categoryId || categoryId,
          areaId,
          quantity: qty,
          unit: u,
          purchaseDate,
          shelfLifeDays: preset?.shelfLife.fridge || shelfLifeDays,
          tags: [],
        });
      }
    }
    setSaving(false);
    navigate('/foods');
  };

  const selectQuickFood = (food: typeof quickFoods[0]) => {
    setName(isEn ? food.nameEn : food.name);
    setCategoryId(food.catId);
    setShelfLifeDays(food.days);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const expiryDate = calcExpiryDate(purchaseDate, shelfLifeDays);

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title mb-0">{t('food.add')}</h1>
        <button onClick={() => navigate(-1)} className="text-gray-400 text-xl">✕</button>
      </div>

      {/* 录入模式切换 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'single' as InputMode, label: '📝 单个', labelEn: '📝 Single' },
          { key: 'batch' as InputMode, label: '📋 批量', labelEn: '📋 Batch' },
          { key: 'voice' as InputMode, label: '🎤 语音', labelEn: '🎤 Voice' },
        ].map(mode => (
          <button
            key={mode.key}
            onClick={() => setInputMode(mode.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              inputMode === mode.key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600'
            }`}
          >
            {isEn ? mode.labelEn : mode.label}
          </button>
        ))}
      </div>

      {/* 单个录入模式 */}
      {inputMode === 'single' && (
        <div className="space-y-4 animate-fade-in">
          {/* 常用食物快选 */}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
              ⚡ {t('food.quickSelect')}
            </label>
            <div className="flex flex-wrap gap-2">
              {quickFoods.map(food => (
                <button
                  key={food.name}
                  onClick={() => selectQuickFood(food)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    name === (isEn ? food.nameEn : food.name)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-primary-300'
                  }`}
                >
                  {food.icon} {isEn ? food.nameEn : food.name}
                </button>
              ))}
            </div>
          </div>

          {/* 食物名称 */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              {t('food.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('food.namePlaceholder')}
              className="input-field"
              autoFocus
            />
            {/* 自动补全建议 */}
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                {suggestions.map(sl => (
                  <button
                    key={sl.id}
                    onClick={() => selectPreset(sl)}
                    className="w-full text-left px-4 py-2 hover:bg-primary-50 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                  >
                    <span>{categories.find(c => c.id === sl.categoryId)?.icon}</span>
                    <span>{isEn ? sl.foodNameEn : sl.foodName}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {isEn ? (categories.find(c => c.id === sl.categoryId)?.nameEn || '') : (categories.find(c => c.id === sl.categoryId)?.name || '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 图片上传 */}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              📷 {isEn ? 'Photo' : '食物图片'}
            </label>
            <div className="flex items-center gap-3">
              {foodImage ? (
                <div className="relative">
                  <img src={foodImage} alt="food" className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-gray-600" />
                  <button
                    onClick={() => setFoodImage(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 text-white rounded-full text-xs flex items-center justify-center shadow"
                  >✕</button>
                </div>
              ) : null}
              <label className={`cursor-pointer px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-sm hover:border-primary-400 hover:text-primary-500 transition-all ${foodImage ? '' : ''}`}>
                <span>📷 {isEn ? 'Add Photo' : '拍照/相册'}</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
              </label>
            </div>
          </div>

          {/* 分类 */}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              {t('food.category')}
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryId === cat.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 存放区域 */}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              {t('food.area')}
            </label>
            <div className="flex flex-wrap gap-2">
              {areas.map(area => (
                <button
                  key={area.id}
                  onClick={() => handleAreaChange(area.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    areaId === area.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {area.icon} {area.name}
                  {area.temperature !== undefined && ` ${area.temperature}°C`}
                </button>
              ))}
            </div>
          </div>

          {/* 数量和单位 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                {t('food.quantity')}
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                className="input-field"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                {t('food.unit')}
              </label>
              <select value={unit} onChange={e => setUnit(e.target.value)} className="select-field">
                <option value="个">个</option>
                <option value="袋">袋</option>
                <option value="盒">盒</option>
                <option value="瓶">瓶</option>
                <option value="包">包</option>
                <option value="块">块</option>
                <option value="斤">斤</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="L">L</option>
                <option value="片">片</option>
                <option value="根">根</option>
                <option value="份">份</option>
              </select>
            </div>
          </div>

          {/* 日期和保质期 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                {t('food.purchaseDate')}
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                {t('food.shelfLife')}
              </label>
              <input
                type="number"
                min={0}
                value={shelfLifeDays}
                onChange={e => setShelfLifeDays(parseInt(e.target.value) || 0)}
                className="input-field"
              />
            </div>
          </div>

          {/* 到期日期预览 */}
          <div className="card bg-primary-50 dark:bg-gray-700/50 border-primary-200 dark:border-gray-600">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('food.expiryDate')}</span>
              <span className="font-medium text-primary-600 dark:text-primary-400">
                📅 {expiryDate}
              </span>
            </div>
          </div>

          {/* 标签 */}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              {t('food.tags')}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="输入标签后回车"
                className="input-field flex-1"
              />
              <button onClick={addTag} className="btn-secondary px-3">+</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    onClick={() => removeTag(tag)}
                    className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 cursor-pointer"
                  >
                    #{tag} ✕
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 备注 */}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              {t('food.notes')}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="可选备注..."
              className="input-field resize-none"
              rows={2}
            />
          </div>

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="btn-primary w-full py-3 text-lg disabled:opacity-50"
          >
            {saving ? '...' : `✅ ${t('food.save')}`}
          </button>
        </div>
      )}

      {/* 批量录入模式 */}
      {inputMode === 'batch' && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              {t('food.area')}
            </label>
            <div className="flex flex-wrap gap-2">
              {areas.map(area => (
                <button
                  key={area.id}
                  onClick={() => setAreaId(area.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    areaId === area.id ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {area.icon} {area.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
              {t('food.batchHint')}
            </label>
            <textarea
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
              placeholder="牛奶, 2, 盒&#10;鸡蛋, 10, 个&#10;苹果, 5, 个"
              className="input-field resize-none font-mono"
              rows={8}
            />
          </div>

          <button
            onClick={handleBatchSave}
            disabled={!batchText.trim() || saving}
            className="btn-primary w-full py-3 text-lg disabled:opacity-50"
          >
            {saving ? '...' : `✅ ${t('food.save')} (${batchText.split('\n').filter(l => l.trim()).length})`}
          </button>
        </div>
      )}

      {/* 语音录入模式 */}
      {inputMode === 'voice' && (
        <div className="flex flex-col min-h-[60vh] animate-fade-in">
          {/* 已识别结果展示 */}
          {parsedResult && parsedResult.name ? (
            <div className="flex-1 space-y-4">
              <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-green-600 text-lg">✅</span>
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {isEn ? 'Recognized' : '已识别'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">{isEn ? 'Food' : '食物'}</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{parsedResult.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">{isEn ? 'Quantity' : '数量'}</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{parsedResult.quantity} {parsedResult.unit}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">{isEn ? 'Area' : '区域'}</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      {parsedResult.areaId
                        ? (areas.find(a => a.id === parsedResult.areaId)?.name || parsedResult.areaId)
                        : (isEn ? 'Default' : '默认')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">{isEn ? 'Shelf Life' : '保质期'}</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      {parsedResult.shelfLifeDays !== null ? `${parsedResult.shelfLifeDays}${isEn ? ' days' : '天'}` : `${shelfLifeDays}${isEn ? ' days' : '天'}`}
                    </p>
                  </div>
                </div>
                {voiceText && (
                  <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                    🗣️ "{voiceText}"
                  </p>
                )}
              </div>

              {/* 可编辑字段 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">{isEn ? 'Quantity' : '数量'}</label>
                  <input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="input-field text-center" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">{isEn ? 'Unit' : '单位'}</label>
                  <select value={unit} onChange={e => setUnit(e.target.value)} className="select-field">
                    <option value="个">个</option><option value="袋">袋</option><option value="盒">盒</option>
                    <option value="瓶">瓶</option><option value="包">包</option><option value="块">块</option>
                    <option value="斤">斤</option><option value="根">根</option><option value="片">片</option>
                    <option value="份">份</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">{isEn ? 'Days' : '保质期(天)'}</label>
                  <input type="number" min={0} value={shelfLifeDays} onChange={e => setShelfLifeDays(parseInt(e.target.value) || 0)} className="input-field text-center" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">{isEn ? 'Area' : '存放区域'}</label>
                <div className="flex flex-wrap gap-2">
                  {areas.map(area => (
                    <button key={area.id} onClick={() => setAreaId(area.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        areaId === area.id ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>{area.icon} {area.name}</button>
                  ))}
                </div>
              </div>

              {/* 图片上传 */}
              <div className="flex items-center gap-3">
                {foodImage ? (
                  <div className="relative">
                    <img src={foodImage} alt="food" className="w-16 h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-600" />
                    <button onClick={() => setFoodImage(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-danger-500 text-white rounded-full text-xs flex items-center justify-center shadow">✕</button>
                  </div>
                ) : null}
                <label className="cursor-pointer px-3 py-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-xs hover:border-primary-400 transition-all">
                  📷 {isEn ? 'Photo' : '拍照'}
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
                </label>
              </div>

              <button onClick={handleSave} disabled={!name.trim() || saving}
                className="btn-primary w-full py-3 text-lg disabled:opacity-50">
                {saving ? '...' : `✅ ${t('food.save')}`}
              </button>

              <button onClick={() => { setParsedResult(null); setVoiceText(''); setVoiceTextInput(''); }}
                className="w-full text-center text-sm text-gray-400 py-2">
                {isEn ? '🔄 Record again' : '🔄 重新录入'}
              </button>
            </div>
          ) : (
            /* 录音界面 - 大按钮居中靠下 */
            <div className="flex-1 flex flex-col items-center justify-end pb-8">
              {/* 语音提示文本 */}
              <div className="text-center mb-8">
                {isListening ? (
                  <>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <span className="w-2 h-6 bg-primary-500 rounded-full animate-pulse"></span>
                      <span className="w-2 h-10 bg-primary-400 rounded-full animate-pulse" style={{animationDelay:'0.1s'}}></span>
                      <span className="w-2 h-8 bg-primary-500 rounded-full animate-pulse" style={{animationDelay:'0.2s'}}></span>
                      <span className="w-2 h-12 bg-primary-400 rounded-full animate-pulse" style={{animationDelay:'0.3s'}}></span>
                      <span className="w-2 h-6 bg-primary-500 rounded-full animate-pulse" style={{animationDelay:'0.4s'}}></span>
                    </div>
                    <p className="text-primary-600 dark:text-primary-400 font-medium text-lg">
                      {isEn ? 'Listening...' : '正在聆听...'}
                    </p>
                    {/* 实时识别文字 */}
                    {voiceText && (
                      <div className="mt-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-primary-200 dark:border-gray-600 max-w-xs mx-auto">
                        <p className="text-gray-700 dark:text-gray-200 text-base">
                          {voiceText}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-gray-500 dark:text-gray-400 text-base mb-1">
                      {isEn ? 'Say something like:' : '试试说：'}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      {isEn ? '"5 apples in fridge for 3 days"' : '"5个苹果放冷藏保质期3天"'}
                    </p>
                  </>
                )}
              </div>

              {/* 语音按钮 - 大且居中 */}
              <button
                onClick={isListening ? stopVoice : startVoice}
                className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl transition-all active:scale-95 ${
                  isListening
                    ? 'bg-danger-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                    : 'bg-primary-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]'
                }`}
              >
                {isListening ? '⏹' : '🎤'}
              </button>
              <p className="mt-4 text-sm text-gray-400">
                {isListening ? (isEn ? 'Tap to stop' : '点击停止') : (isEn ? 'Tap to speak' : '点击说话')}
              </p>

              {/* 错误提示 */}
              {voiceError && (
                <div className="mt-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400 text-center max-w-xs">
                  ⚠️ {voiceError}
                </div>
              )}

              {/* 手动输入区域 - 语音不可用时的备用方案 */}
              <div className="w-full mt-6 px-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voiceTextInput}
                    onChange={e => setVoiceTextInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVoiceTextInput()}
                    placeholder={isEn ? 'Or type here, e.g. 5 apples fridge 3 days' : '或手动输入，如：5个苹果 冷藏 3天'}
                    className="input-field flex-1 text-sm"
                  />
                  <button
                    onClick={handleVoiceTextInput}
                    disabled={!voiceTextInput.trim()}
                    className="btn-secondary px-4 text-sm disabled:opacity-40"
                  >
                    {isEn ? 'Parse' : '解析'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
