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
  
  // --- 模式 1：詞彙檢索狀態 ---
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // --- 模式 2：AI 擴寫狀態 ---
  const [baseText, setBaseText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- UI 狀態 ---
  const [activeTab, setActiveTab] = useState<'search' | 'ai'>('search'); // 控制目前在哪個頁籤
  const [isOpen, setIsOpen] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const draggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const savedFavs = localStorage.getItem('moonlight_favorites');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
  }, []);

  // 執行進階搜尋
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

  // 🌟 執行 AI 擴寫
  const handleAIExpand = async () => {
    if (!baseText.trim()) return alert("請先輸入一句基礎句子！");
    
    setIsGenerating(true);
    setAiResult('');
    try {
      const response = await fetch('https://moonlight-backend-chdj.onrender.com/api/expand_inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_text: baseText, style, emotion, scenario })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setAiResult(data.data);
      } else {
        setAiResult('❌ 生成失敗：' + data.message);
      }
    } catch (error) {
      setAiResult('❌ 連線失敗，請確認後端伺服器是否開啟。');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleFavorite = (word: string) => {
    const newFavs = favorites.includes(word) 
      ? favorites.filter(f => f !== word) 
      : [...favorites, word];
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
      <div style={{ backgroundColor: '#f2f4ec', border: '1px solid #ccc', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '20px', width: '350px' }}>
        <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #ddd', touchAction: 'none' }}>
          <h3 style={{ margin: 0, fontSize: '16px', userSelect: 'none' }}>🌙 靈感輔助</h3>
          <div>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowBackpack(!showBackpack)} style={{ border: 'none', background: 'none', cursor: 'pointer', marginRight: '5px', fontSize: '16px' }}>🎒</button>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setIsOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>❌</button>
          </div>
        </div>

        {/* 頁籤切換 */}
        <div style={{ display: 'flex', marginBottom: '15px', borderBottom: '2px solid #ddd' }}>
          <button onClick={() => setActiveTab('search')} style={{ flex: 1, padding: '8px', border: 'none', background: 'none', borderBottom: activeTab === 'search' ? '2px solid #75a862' : 'none', color: activeTab === 'search' ? '#75a862' : '#666', fontWeight: activeTab === 'search' ? 'bold' : 'normal', cursor: 'pointer' }}>
            📖 詞彙檢索
          </button>
          <button onClick={() => setActiveTab('ai')} style={{ flex: 1, padding: '8px', border: 'none', background: 'none', borderBottom: activeTab === 'ai' ? '2px solid #75a862' : 'none', color: activeTab === 'ai' ? '#75a862' : '#666', fontWeight: activeTab === 'ai' ? 'bold' : 'normal', cursor: 'pointer' }}>
            ✨ AI 擴寫
          </button>
        </div>

        {/* 共用標籤區 */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="風格 (例: 古風)" style={{ width: '33%', padding: '6px', boxSizing: 'border-box' }} />
          <input type="text" value={emotion} onChange={(e) => setEmotion(e.target.value)} placeholder="情緒 (例: 悲傷)" style={{ width: '33%', padding: '6px', boxSizing: 'border-box' }} />
          <input type="text" value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="情境 (例: 景物)" style={{ width: '33%', padding: '6px', boxSizing: 'border-box' }} />
        </div>

        {/* 模式 1：詞彙檢索介面 */}
        {activeTab === 'search' && (
          <>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="關鍵字 (例：秋天)" style={{ width: '100%', marginBottom: '8px', padding: '6px', boxSizing: 'border-box' }} />
            <button onClick={handleSearch} style={{ width: '100%', padding: '8px', backgroundColor: '#75a862', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>搜尋靈感</button>
            <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto', fontSize: '14px' }}>
              {results.length === 0 ? <p style={{ color: '#666' }}>尚無結果，試試其他條件吧！</p> : results.map((res, idx) => (
                <div key={idx} style={{ padding: '8px', borderBottom: '1px solid #eee', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '16px', color: '#333' }}>{res.suggestion}</strong>
                    <button onClick={() => toggleFavorite(res.suggestion)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>
                      {favorites.includes(res.suggestion) ? '❤️' : '🤍'}
                    </button>
                  </div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>標籤: {res.style || '無'} / {res.emotion || '無'}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 模式 2：AI 擴寫介面 */}
        {activeTab === 'ai' && (
          <>
            <textarea value={baseText} onChange={(e) => setBaseText(e.target.value)} placeholder="輸入一句枯燥的基礎句子（例如：他走進雨中。）" style={{ width: '100%', height: '60px', marginBottom: '8px', padding: '6px', boxSizing: 'border-box', resize: 'none' }} />
            <button onClick={handleAIExpand} disabled={isGenerating} style={{ width: '100%', padding: '8px', backgroundColor: isGenerating ? '#aaa' : '#8e44ad', color: 'white', border: 'none', borderRadius: '4px', cursor: isGenerating ? 'not-allowed' : 'pointer' }}>
              {isGenerating ? '✨ AI 運算中...' : '✨ 沉浸式擴寫'}
            </button>
            <div style={{ marginTop: '15px', maxHeight: '250px', overflowY: 'auto', fontSize: '14px', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #eee', whiteSpace: 'pre-wrap' }}>
              {aiResult ? aiResult : <p style={{ color: '#999', margin: 0 }}>輸入句子並設定標籤，AI 會幫你生成三種不同角度的優美描寫。</p>}
            </div>
          </>
        )}
      </div>

      {/* 背包側邊欄 (維持不變) */}
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