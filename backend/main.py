from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
import google.generativeai as genai

# 載入 .env 檔案裡的金鑰
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# 設定 Gemini AI
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # 使用 gemini-pro 模型，這是目前最強大的模型
    # 改成這樣：
    model = genai.GenerativeModel('gemini-3.8-flash')
else:
    print("⚠️ 警告：找不到 GEMINI_API_KEY，AI 功能將無法運作")

app = FastAPI()

# 設定 CORS，讓前端 (React) 能夠順利跟後端通訊
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 啟動時自動載入你剛剛放進來的 Excel 資料庫
try:
    # 🌟 修改點 1：指定讀取 '工作表1'，並把空值替換為空字串，避免後續文字比對出錯
    df_literary = pd.read_excel('文學詞彙替換庫.xlsx', sheet_name='工作表1')
    df_literary = df_literary.fillna("") 
    print("✅ 成功載入文學詞彙替換庫")
except Exception as e:
    df_literary = None
    print(f"❌ 找不到 Excel 檔案或讀取失敗：{e}")

# ==========================================
# 保留原本的舊版：精準搜尋 API (讓舊版前端維持運作)
# ==========================================
class QueryRequest(BaseModel):
    keyword: str

@app.post("/api/lookup")
def lookup_word(request: QueryRequest):
    target_word = request.keyword
    
    if df_literary is not None:
        # 在資料庫中尋找使用者輸入的關鍵字
        lit_row = df_literary[df_literary['關鍵字'] == target_word]
        if not lit_row.empty:
            replace_suggestion = str(lit_row.iloc[0].get('替換建議', ''))
            lit_tag = str(lit_row.iloc[0].get('風格標籤', ''))
            return {
                "status": "success",
                "suggestion": replace_suggestion,
                "tag": lit_tag
            }
            
    return {"status": "not_found", "message": "目前詞彙庫中找不到這個詞彙"}


# ==========================================
# 🌟 第一階段全新：多條件搜尋 API
# ==========================================
class AdvancedSearchRequest(BaseModel):
    keyword: Optional[str] = ""
    style: Optional[str] = ""
    emotion: Optional[str] = ""
    scenario: Optional[str] = ""

@app.post("/api/search_advanced")
def search_advanced(req: AdvancedSearchRequest):
    if df_literary is None:
        return {"status": "error", "message": "伺服器資料庫尚未準備好"}

    results = []
    for index, row in df_literary.iterrows():
        match = True 
        
        # 檢查關鍵字 (如果前端有填，且關鍵字不在原始詞或替換建議中，則淘汰)
        if req.keyword:
            if req.keyword not in str(row.get('關鍵字', '')) and req.keyword not in str(row.get('替換建議', '')):
                match = False
                
        # 檢查風格標籤
        if req.style and req.style not in str(row.get('風格標籤', '')):
            match = False
            
        # 檢查情緒標籤
        if req.emotion and req.emotion not in str(row.get('情緒標籤', '')):
            match = False
            
        # 檢查情境標籤
        if req.scenario and req.scenario not in str(row.get('情境標籤', '')):
            match = False
            
        # 如果過關斬將後 match 還是 True，就加入結果清單
        if match:
            results.append({
                "keyword": str(row.get('關鍵字', '')),
                "suggestion": str(row.get('替換建議', '')),
                "style": str(row.get('風格標籤', '')),
                "emotion": str(row.get('情緒標籤', '')),
                "scenario": str(row.get('情境標籤', ''))
            })
            
    # 回傳找到的所有結果 (最多回傳前 10 筆，避免前端畫面塞爆)
    return {"status": "success", "data": results[:10]}
# ==========================================
# 🌟 第二階段全新：AI 沉浸式擴寫與暖身引擎 API
# ==========================================
class ExpandRequest(BaseModel):
    base_text: str  # 使用者輸入的基礎枯燥句子，例如「他走進雨中」
    style: Optional[str] = ""
    emotion: Optional[str] = ""
    scenario: Optional[str] = ""

@app.post("/api/expand_inspiration")
def expand_inspiration(req: ExpandRequest):
    if not GEMINI_API_KEY:
        return {"status": "error", "message": "伺服器未設定 AI 金鑰，請聯絡管理員"}

    # 這就是你的 AI 員工守則 (Prompt)
    prompt = f"""
    你是一位精通中國文學與小說創作的寫作大師。
    請根據以下提供的基礎句子與情境標籤，進行一段「沉浸式擴寫」，幫助作家找回寫作手感。

    基礎句子：{req.base_text}
    風格設定：{req.style if req.style else '無特定風格'}
    情緒設定：{req.emotion if req.emotion else '無特定情緒'}
    情境設定：{req.scenario if req.scenario else '無特定情境'}

    請提供 3 種不同運鏡角度或修辭手法的擴寫版本（每個版本約 50-100 字即可），語氣要求優美典雅，排版清晰，並且務必使用繁體中文。
    """

    try:
        # 呼叫 Gemini 產生內容
        response = model.generate_content(prompt)
        return {"status": "success", "data": response.text}
    except Exception as e:
        return {"status": "error", "message": f"AI 生成失敗：{str(e)}"}
    
@app.route('/api/writing_coach', methods=['POST'])
def writing_coach():
    try:
        data = request.json
        draft_text = data.get('draft_text', '')

        if not draft_text.strip():
            return jsonify({'status': 'error', 'message': '請提供需要診斷的草稿內容。'})

        # 這裡就是 Prompt Engineering 的魔法所在
        prompt = f"""
        你現在是一位溫和且專業的小說編輯。請針對以下新人的文稿，給出三個具體的修改建議，並指出一個寫得好的地方給予溫暖的鼓勵。
        請用繁體中文回覆，排版要清晰易讀（請善用條列式與段落）。

        【新人文稿】：
        {draft_text}
        """

        # 呼叫 Gemini 產生建議 (請確認你的 model 變數名稱是否與原先一致)
        response = model.generate_content(prompt)
        
        return jsonify({
            'status': 'success', 
            'data': response.text
        })

    except Exception as e:
        print(f"寫作教練 API 發生錯誤: {e}")
        return jsonify({'status': 'error', 'message': '診斷過程中發生錯誤，請稍後再試。'})
    # 強制觸發 Render 更新盲點診斷 API
    