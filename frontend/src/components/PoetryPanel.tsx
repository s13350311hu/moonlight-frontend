import { useState, useRef, useEffect } from 'react';

interface SearchResult {
  keyword: string;
  suggestion: string;
  style: string;
  emotion: string;
  scenario: string;
}

export function PoetryPanel() {
  // --- 共用條件狀態 ---
  const [style, setStyle] = useState('');
  const [emotion, setEmotion] = useState('');
  const [scenario, setScenario] = useState('');
  
  // --- 模式 1：詞彙檢索 ---
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // --- 模式 2：AI 擴寫 ---
  const [baseText, setBaseText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- 模式 3：AI 盲點診斷 ---
  const [draftText, setDraftText] = useState('');
  const [coachResult, setCoachResult] = useState('');
  const [isCoaching, setIsCoaching] = useState(false);

  // --- 🌟 模式 4：AI 伏筆與設定追蹤 (Story Bible) ---
  const [bibleText, setBibleText] = useState('');
  const [chapterDraft, setChapterDraft] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // --- UI 狀態 ---
  const [activeTab, setActiveTab] = useState<'search' | 'ai' | 'coach' | 'bible'>('ai'); 
  const [isOpen, setIsOpen] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const draggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem('moonlight_favorites');
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    } catch (e) {
      localStorage.removeItem('moonlight_favorites');
    }
    const savedBible = localStorage.getItem('moonlight_bible');
    if (savedBible) setBibleText(savedBible);
  }, []);

  const handleBibleChange = (text: string) => {
    setBibleText(text);
    localStorage.setItem('moonlight_bible', text);
  };

  // 執行進階搜尋 (連線至本機 FastAPI)
  const handleSearch = async () => {
    try {
      const response = await fetch('https://moonlight-backend-chdj.onrender.com/api/search_advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, style, emotion, scenario })
      });
      const data = await response.json();
      if (data.status === 'success') setResults(data.data);
      else setResults([]);
    } catch (error) {
      console.error('連線失敗');
    }
  };

  // 執行 AI 擴寫 (連線至本機 FastAPI)
  const handleAIExpand = async () => {
    if (!baseText.trim()) return alert("請先輸入一句基礎句子！");
    setIsGenerating(true);
    setAiResult('');
    try {
      const response = await fetch('https://moonlight-backend-chdj.onrender.com/api/search_advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_text: baseText, style, emotion, scenario })
      });
      const data = await response.json();
      setAiResult(data.status === 'success' ? (typeof data.data === 'string' ? data.data : JSON.stringify(data.data)) : '❌ 生成失敗：' + data.message);
    } catch (error) {
      setAiResult('❌ 連線失敗，請確認後端伺服器是否開啟。');
    } finally {
      setIsGenerating(false);
    }
  };

  // 執行 AI 盲點診斷 (連線至本機 FastAPI)
  const handleCoaching = async () => {
    if (!draftText.trim()) return alert("請先貼上你的草稿！");
    setIsCoaching(true);
    setCoachResult('');
    try {
      const response = await fetch('https://moonlight-backend-chdj.onrender.com/api/search_advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_text: draftText })
      });
      const data = await response.json();
      setCoachResult(data.status === 'success' ? data.data : '❌ 診斷失敗：' + data.message);
    } catch (error) {
      setCoachResult('❌ 連線失敗，請確認後端伺服器是否開啟。');
    } finally {
      setIsCoaching(false);
    }
  };

  // 🌟 執行 AI 邏輯掃描 (Story Bible) (連線至本機 FastAPI)
  const handleLogicScan = async () => {
    if (!bibleText.trim() || !chapterDraft.trim()) return alert("【專案設定集】與【本章草稿】都需要填寫喔！");
    setIsScanning(true);
    setScanResult('');
    try {
      const response = await fetch('https://moonlight-backend-chdj.onrender.com/api/expand_inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bible_text: bibleText, draft_text: chapterDraft })
      });
      const data = await response.json();
      setScanResult(data.status === 'success' ? data.data : '❌ 掃描失敗：' + data.message);
    } catch (error) {
      setScanResult('❌ 連線失敗，請確認後端伺服器是否開啟。');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleFavorite = (word: string) => {
    const newFavs = favorites.includes(word) ? favorites.filter(f => f !== word) : [...favorites, word];
    setFavorites(newFavs);
    localStorage.setItem('moonlight_favorites', JSON.stringify(newFavs));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    startPosRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) setPosition({ x: e.clientX - startPosRef.current.x, y: e.clientY - startPosRef.current.y });
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={{ position: 'fixed', bottom: '30px', right: '30px', padding: '12px 24px', backgroundColor: '#75a862', color: 'white', border: 'none', borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 9999, fontWeight: 'bold' }}>
        🌙 喚醒靈感
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', left: position.x, top: position.y, display: 'flex', gap: '10px', zIndex: 9999 }}>
      {/* 主要面板 */}
      <div style={{ backgroundColor: '#f2f4ec', border: '1px solid #ccc', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '20px', width: '380px' }}>
        <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #ddd', touchAction: 'none' }}>
          <h3 style={{ margin: 0, fontSize: '16px', userSelect: 'none' }}>🌙 靈感輔助</h3>
          <div>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowBackpack(!showBackpack)} style={{ border: 'none', background: 'none', cursor: 'pointer', marginRight: '5px', fontSize: '16px' }}>🎒</button>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setIsOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>❌</button>
          </div>
        </div>

        {/* 頁籤切換 */}
        <div style={{ display: 'flex', marginBottom: '15px', borderBottom: '2px solid #ddd', fontSize: '13px' }}>
          <button onClick={() => setActiveTab('search')} style={{ flex: 1, padding: '8px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'search' ? '2px solid #75a862' : 'none', color: activeTab === 'search' ? '#75a862' : '#666', fontWeight: activeTab === 'search' ? 'bold' : 'normal', cursor: 'pointer' }}>詞彙檢索</button>
          <button onClick={() => setActiveTab('ai')} style={{ flex: 1, padding: '8px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'ai' ? '2px solid #75a862' : 'none', color: activeTab === 'ai' ? '#75a862' : '#666', fontWeight: activeTab === 'ai' ? 'bold' : 'normal', cursor: 'pointer' }}>AI 擴寫</button>
          <button onClick={() => setActiveTab('coach')} style={{ flex: 1, padding: '8px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'coach' ? '2px solid #75a862' : 'none', color: activeTab === 'coach' ? '#75a862' : '#666', fontWeight: activeTab === 'coach' ? 'bold' : 'normal', cursor: 'pointer' }}>盲點診斷</button>
          <button onClick={() => setActiveTab('bible')} style={{ flex: 1, padding: '8px 2px', border: 'none', background: 'none', borderBottom: activeTab === 'bible' ? '2px solid #e74c3c' : 'none', color: activeTab === 'bible' ? '#e74c3c' : '#666', fontWeight: activeTab === 'bible' ? 'bold' : 'normal', cursor: 'pointer' }}>設定追蹤</button>
        </div>

        {/* 共用標籤區 (僅在詞彙檢索與 AI 擴寫時顯示) */}
        {(activeTab === 'search' || activeTab === 'ai') && (
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="風格 (例: 古風)" style={{ width: '33%', padding: '6px', boxSizing: 'border-box' }} />
            <input type="text" value={emotion} onChange={(e) => setEmotion(e.target.value)} placeholder="情緒 (例: 悲傷)" style={{ width: '33%', padding: '6px', boxSizing: 'border-box' }} />
            <input type="text" value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="情境 (例: 景物)" style={{ width: '33%', padding: '6px', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* 模式 1：詞彙檢索 */}
        {activeTab === 'search' && (
          <>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="關鍵字 (例：秋天)" style={{ width: '100%', marginBottom: '8px', padding: '6px', boxSizing: 'border-box' }} />
            <button onClick={handleSearch} style={{ width: '100%', padding: '8px', backgroundColor: '#75a862', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>搜尋靈感</button>
            <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto', fontSize: '14px' }}>
              {results.length === 0 ? <p style={{ color: '#666' }}>尚無結果，試試其他條件吧！</p> : results.map((res, idx) => (
                <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #eee', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '16px', color: '#333' }}>{res.suggestion}</strong>
                    <button onClick={() => toggleFavorite(res.suggestion)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>{favorites.includes(res.suggestion) ? '❤️' : '🤍'}</button>
                  </div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>標籤: {res.style || '無'} / {res.emotion || '無'}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 模式 2：AI 擴寫 */}
        {activeTab === 'ai' && (
          <>
            <textarea value={baseText} onChange={(e) => setBaseText(e.target.value)} placeholder="輸入一句枯燥的基礎句子（例如：他走進雨中。）" style={{ width: '100%', height: '60px', marginBottom: '8px', padding: '6px', boxSizing: 'border-box', resize: 'none' }} />
            <button onClick={handleAIExpand} disabled={isGenerating} style={{ width: '100%', padding: '8px', backgroundColor: isGenerating ? '#aaa' : '#8e44ad', color: 'white', border: 'none', borderRadius: '4px', cursor: isGenerating ? 'not-allowed' : 'pointer' }}>
              {isGenerating ? '✨ AI 運算中...' : '✨ 沉浸式擴寫'}
            </button>
            <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto', fontSize: '14px', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #eee', whiteSpace: 'pre-wrap' }}>
              {aiResult ? aiResult : <p style={{ color: '#999', margin: 0 }}>輸入句子並設定標籤，AI 會幫你生成三種不同角度的優美描寫。</p>}
            </div>
          </>
        )}

        {/* 模式 3：AI 盲點診斷 */}
        {activeTab === 'coach' && (
          <>
            <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="貼上約 100~500 字的草稿，讓 AI 編輯給你專業建議..." style={{ width: '100%', height: '100px', marginBottom: '8px', padding: '6px', boxSizing: 'border-box', resize: 'vertical' }} />
            <button onClick={handleCoaching} disabled={isCoaching} style={{ width: '100%', padding: '8px', backgroundColor: isCoaching ? '#aaa' : '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: isCoaching ? 'not-allowed' : 'pointer' }}>
              {isCoaching ? '🩺 編輯審稿中...' : '🩺 請 AI 教練給建議'}
            </button>
            <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto', fontSize: '14px', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #eee', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {coachResult ? coachResult : <p style={{ color: '#999', margin: 0 }}>將卡關的段落貼上來，幫你突破盲點。</p>}
            </div>
          </>
        )}

        {/* 🌟 模式 4：AI 伏筆與設定追蹤 (Story Bible) */}
        {activeTab === 'bible' && (
          <>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>📚 專案設定集</label>
              <textarea value={bibleText} onChange={(e) => handleBibleChange(e.target.value)} placeholder="例如：男主角左手有舊傷，對海鮮過敏..." style={{ width: '100%', height: '60px', marginTop: '4px', padding: '6px', boxSizing: 'border-box', resize: 'vertical', backgroundColor: '#fffdf5', border: '1px solid #e2d19f' }} />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>✍️ 本章草稿</label>
              <textarea value={chapterDraft} onChange={(e) => setChapterDraft(e.target.value)} placeholder="貼上寫好的章節內容..." style={{ width: '100%', height: '80px', marginTop: '4px', padding: '6px', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <button onClick={handleLogicScan} disabled={isScanning} style={{ width: '100%', padding: '8px', backgroundColor: isScanning ? '#aaa' : '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: isScanning ? 'not-allowed' : 'pointer' }}>
              {isScanning ? '🔍 邏輯掃描中...' : '🔍 AI 邏輯掃描'}
            </button>
            <div style={{ marginTop: '15px', maxHeight: '180px', overflowY: 'auto', fontSize: '14px', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #eee', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {scanResult ? scanResult : <p style={{ color: '#999', margin: 0 }}>寫完草稿後點擊掃描，防止「吃設定」與「狗尾續貂」。</p>}
            </div>
          </>
        )}
      </div>

      {/* 背包側邊欄 */}
      {showBackpack && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '15px', width: '200px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>🎒 我的靈感庫</h4>
          {favorites.length === 0 ? <p style={{ fontSize: '12px', color: '#999' }}>背包空空的...</p> : (
            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', overflowY: 'auto', flex: 1 }}>
              {favorites.map((fav, idx) => (
                <li key={idx} style={{ marginBottom: '8px', color: '#333' }}>{fav}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}