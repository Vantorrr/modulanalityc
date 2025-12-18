"""
AI Parser Service for structuring medical analysis data.
Uses OpenAI GPT to extract and normalize biomarker values from OCR text.
"""

import json
import logging
import re
from typing import Dict, List, Optional, Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.models.analysis import LabProvider

logger = logging.getLogger(__name__)


# System prompt for GPT
EXTRACTION_SYSTEM_PROMPT = """Ты — медицинский AI-ассистент, специализирующийся на анализе лабораторных результатов.

Твоя задача — извлечь из текста результатов анализов структурированные данные о биомаркерах.

Правила:
1. Извлекай ТОЛЬКО реальные значения из текста, не придумывай данные
2. Приводи названия показателей к стандартным кодам (HGB, RBC, WBC, FE, B12, D3, TSH и т.д.)
3. Сохраняй оригинальное название показателя в поле raw_name
4. ⚠️ ОБЯЗАТЕЛЬНО извлекай референсные значения (ref_min, ref_max) для КАЖДОГО показателя! Они обычно идут после единицы измерения через пробел или дефис. Примеры: "13.6 % 12.0-13.6", "154 г/л 135-169"
5. Определяй единицы измерения
6. Если значение невозможно извлечь корректно, пропускай его

Стандартные коды биомаркеров:

ГЕМАТОЛОГИЯ:
- HGB (Гемоглобин)
- RBC (Эритроциты)
- WBC (Лейкоциты)
- PLT (Тромбоциты)
- HCT (Гематокрит)
- MCV (Средний объем эритроцита)
- MCH (Среднее содержание гемоглобина)
- MCHC (Средняя концентрация гемоглобина)
- RDW (Ширина распределения эритроцитов)
- MPV (Средний объем тромбоцитов)
- PCT (Тромбокрит)
- ESR (СОЭ)
- NEUT (Нейтрофилы)
- LYMPH (Лимфоциты)
- MONO (Моноциты)
- EOS (Эозинофилы)
- BASO (Базофилы)

БИОХИМИЯ:
- GLU (Глюкоза)
- TP (Общий белок)
- ALB (Альбумин)
- LDH (ЛДГ, лактатдегидрогеназа)
- CK (КФК, креатинкиназа)
- AMY (Амилаза)
- LIPA (Липаза)

ПЕЧЕНЬ:
- ALT (АЛТ)
- AST (АСТ)
- GGT (ГГТП, гамма-глутамилтрансфераза)
- ALP (Щелочная фосфатаза)
- BILI (Билирубин общий)
- DBILI (Билирубин прямой)

ПОЧКИ:
- CREA (Креатинин)
- UREA (Мочевина)
- UA (Мочевая кислота)
- GFR (СКФ)

ЛИПИДЫ:
- CHOL (Холестерин общий)
- HDL (ЛПВП)
- LDL (ЛПНП)
- TG (Триглицериды)

МИНЕРАЛЫ:
- FE (Железо)
- FERR (Ферритин)
- CA (Кальций)
- MG (Магний)
- K (Калий)
- NA (Натрий)
- P (Фосфор)
- ZN (Цинк)

ВИТАМИНЫ:
- B12 (Витамин B12)
- FOLATE (Фолиевая кислота)
- D3 (Витамин D)

ГОРМОНЫ / ЩИТОВИДКА:
- TSH (ТТГ)
- T3 (Т3 свободный)
- T4 (Т4 свободный)
- FT3 (Т3 свободный)
- FT4 (Т4 свободный)

ГЕМАТОЛОГИЯ (ОБЩИЙ АНАЛИЗ КРОВИ):
- RBC (Эритроциты, эритр, RBC, красные кровяные тельца)
- HGB (Гемоглобин, Hb, Hemoglobin)
- HCT (Гематокрит, Hematocrit)
- MCV (Средний объем эритроцитов, средний объём эритроцита)
- MCH (Среднее содержание гемоглобина в эритроците)
- MCHC (Средняя концентрация Hb в эритроцитах)
- RDW (Ширина распределения эритроцитов, отн.ширина распред.)
- PLT (Тромбоциты, тромб, Platelets)
- MPV (Средний объем тромбоцитов, средний объём тромбоцита)
- PCT (Тромбокрит, Plateletcrit)
- PDW (Относит.ширина распред.тромбоцитов, отн.ширина распред.тромбоцитов)
- WBC (Лейкоциты, лейк, White Blood Cells)

⚠️ ВАЖНО: Для лейкоцитов (NEU, LYM, MONO, EOS, BASO) ВСЕГДА извлекай ОБА значения если они есть:
  1) АБСОЛЮТНОЕ значение (единица: 10*9/л или 10^9/л)
  2) ПРОЦЕНТНОЕ значение (единица: %)
  
Это ОТДЕЛЬНЫЕ биомаркеры! Например:
- NEU с unit="10*9/л" и value=2.61
- NEU с unit="%" и value=51.4

- NEU (Нейтрофилы абс + %)
- LYM (Лимфоциты абс + %)
- MONO (Моноциты абс + %)
- EOS (Эозинофилы абс + %)
- BASO (Базофилы абс + %)
- ESR (СОЭ, скорость оседания эритроцитов)

ПОЛОВЫЕ ГОРМОНЫ И ДР.:
- TEST (Тестостерон общий/свободный)
- SHBG (ГСПГ, секс-связывающий глобулин)
- PROL (Пролактин)
- FAI (Индекс свободного тестостерона, ИСТ)
- E2 (Эстрадиол)
- PROG (Прогестерон)
- LH (ЛГ)
- FSH (ФСГ)
- CORT (Кортизол)
- INS (Инсулин)

ВОСПАЛЕНИЕ:
- CRP (С-реактивный белок)

Отвечай ТОЛЬКО валидным JSON без markdown-разметки."""

EXTRACTION_USER_PROMPT = """Извлеки биомаркеры из следующего текста результатов анализов:

```
{ocr_text}
```

Верни JSON в формате:
{{
    "lab_name": "название лаборатории если есть",
    "analysis_date": "дата анализа в формате YYYY-MM-DD если есть",
    "biomarkers": [
        {{
            "code": "стандартный код (HGB, FE, TSH и т.д.)",
            "raw_name": "оригинальное название из текста",
            "value": числовое_значение,
            "unit": "единица измерения",
            "ref_min": минимум_нормы_или_null,
            "ref_max": максимум_нормы_или_null
        }}
    ]
}}

⚠️ ВАЖНО: Референсные значения (ref_min, ref_max) КРИТИЧЕСКИ ВАЖНЫ для определения отклонений! 
Примеры извлечения:
- "RDW 13.6 % 12.0-13.6" → ref_min=12.0, ref_max=13.6
- "Гемоглобин 154 г/л 135-169" → ref_min=135, ref_max=169
- "PDW 16.3 % 10.1-16.1" → ref_min=10.1, ref_max=16.1"""


SUMMARY_SYSTEM_PROMPT = """Ты — опытный врач-терапевт, специализирующийся на интерпретации анализов.

Твоя задача — дать ПЕРСОНАЛИЗИРОВАННУЮ интерпретацию результатов анализов с учётом профиля пациента.

Правила:
1. ОБЯЗАТЕЛЬНО учитывай данные профиля пациента (рост, вес, возраст, пол, аллергии, хронические заболевания)
2. Пиши простым языком, избегай сложных медицинских терминов
3. Сначала укажи показатели вне нормы
4. Объясни, что могут означать отклонения ИМЕННО ДЛЯ ЭТОГО ПАЦИЕНТА
5. Учитывай взаимосвязь показателей с хроническими заболеваниями пациента
6. Если есть аллергии — учитывай их при рекомендациях
7. Дай персональные рекомендации по образу жизни
8. Напомни, что окончательную интерпретацию должен давать врач

Формат ответа:
- Используй эмодзи для наглядности (✅ норма, ⚠️ внимание, ❌ отклонение)
- Начни с краткого профиля пациента
- Структурируй по разделам
- Будь лаконичен но информативен"""


class AIParserService:
    """
    Service for AI-powered analysis of medical documents.
    Extracts structured biomarker data and generates interpretations.
    """
    
    def __init__(self):
        """Initialize the AI parser service."""
        # OpenRouter requires extra headers
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            default_headers={
                "HTTP-Referer": "https://healthtracker.app",
                "X-Title": "Health Tracker Medical Analysis",
            }
        )
        self.model = settings.openai_model
        # Vision model - same as main model (gpt-4o-mini supports vision)
        self.vision_model = settings.openai_model
    
    async def extract_biomarkers_from_image(
        self,
        image_base64: str,
        content_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """
        Extract biomarkers directly from image using GPT-4 Vision.
        Better for handwritten or low-quality scans.
        
        Args:
            image_base64: Base64 encoded image
            content_type: MIME type of the image
            
        Returns:
            Dictionary with extracted biomarkers
        """
        if not settings.openai_api_key:
            logger.warning("OpenAI API key not configured")
            return {"lab_name": None, "analysis_date": None, "biomarkers": []}
        
        try:
            logger.info("Using Vision API to extract biomarkers from image")
            
            response = await self.client.chat.completions.create(
                model=self.vision_model,
                messages=[
                    {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """Извлеки ВСЕ биомаркеры из этого изображения анализа крови.
                                
ВАЖНО: Внимательно прочитай ВСЕ значения, включая рукописные!

Верни JSON:
{
    "lab_name": "название лаборатории если есть",
    "analysis_date": "дата в формате YYYY-MM-DD если есть",
    "biomarkers": [
        {"code": "HGB", "raw_name": "Гемоглобин", "value": 132, "unit": "г/л", "ref_min": 80, "ref_max": 150}
    ]
}"""
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{content_type};base64,{image_base64}",
                                    "detail": "high"
                                }
                            }
                        ]
                    },
                ],
                temperature=0.1,
                max_tokens=4000,
                response_format={"type": "json_object"},
            )
            
            result_text = response.choices[0].message.content
            
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = json.loads(result_text)
            
            result = self._validate_extraction(result)
            
            logger.info(f"Vision extraction completed: {len(result.get('biomarkers', []))} biomarkers found")
            
            return result
            
        except Exception as e:
            logger.error(f"Vision extraction failed: {e}")
            return {"lab_name": None, "analysis_date": None, "biomarkers": []}
    
    async def extract_biomarkers(
        self,
        ocr_text: str,
        lab_provider: Optional[LabProvider] = None,
    ) -> Dict[str, Any]:
        """
        Extract biomarkers from OCR text using GPT.
        
        Args:
            ocr_text: Raw text from OCR
            lab_provider: Known lab provider for better parsing
            
        Returns:
            Dictionary with extracted data:
            {
                "lab_name": str,
                "analysis_date": str,
                "biomarkers": List[Dict]
            }
        """
        if not settings.openai_api_key:
            logger.warning("OpenAI API key not configured, using fallback parser")
            return self._fallback_parse(ocr_text)
        
        try:
            # Add lab context if known
            context = ""
            if lab_provider:
                context = f"\n\nИзвестно, что это анализ из лаборатории: {lab_provider.value}"
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": EXTRACTION_USER_PROMPT.format(
                            ocr_text=ocr_text[:8000]  # Limit text length
                        ) + context
                    },
                ],
                temperature=0.1,  # Low temperature for consistent extraction
                max_tokens=4000,
                response_format={"type": "json_object"},
            )
            
            result_text = response.choices[0].message.content
            result = json.loads(result_text)
            
            # Validate and clean results
            result = self._validate_extraction(result)
            
            # Safety net: try to find missing critical biomarkers via regex
            result = self._enrich_with_regex(result, ocr_text)
            
            logger.info(
                f"AI extraction completed: {len(result.get('biomarkers', []))} biomarkers found"
            )
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            return self._fallback_parse(ocr_text)
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            return self._fallback_parse(ocr_text)
    
    async def generate_summary(
        self,
        biomarkers: List[Dict[str, Any]],
        user_gender: Optional[str] = None,
        user_age: Optional[int] = None,
        patient_profile: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Generate a human-readable summary of analysis results.
        
        Args:
            biomarkers: List of biomarker data with status
            user_gender: User's gender for context
            user_age: User's age for context
            patient_profile: Full patient profile data
            
        Returns:
            Human-readable summary text
        """
        if not settings.openai_api_key:
            return self._generate_simple_summary(biomarkers)
        
        try:
            # Prepare biomarker data for prompt
            biomarker_text = self._format_biomarkers_for_prompt(biomarkers)
            
            # Build comprehensive patient context
            context = "\n\n👤 **ПРОФИЛЬ ПАЦИЕНТА:**"
            
            if user_gender:
                context += f"\n- Пол: {'мужчина' if user_gender == 'male' else 'женщина'}"
            if user_age:
                context += f"\n- Возраст: {user_age} лет"
            
            if patient_profile:
                # Body parameters (height, weight, waist)
                body = patient_profile.get("body_parameters", {})
                if body:
                    if body.get("height"):
                        context += f"\n- Рост: {body['height']} см"
                    if body.get("weight"):
                        context += f"\n- Вес: {body['weight']} кг"
                    if body.get("waist"):
                        context += f"\n- Обхват талии: {body['waist']} см"
                    # Calculate BMI if possible
                    if body.get("height") and body.get("weight"):
                        height_m = float(body["height"]) / 100
                        bmi = float(body["weight"]) / (height_m * height_m)
                        context += f"\n- ИМТ: {bmi:.1f}"
                
                # Allergies
                allergies = patient_profile.get("allergies", [])
                if allergies:
                    context += f"\n- ⚠️ Аллергии: {', '.join(allergies)}"
                
                # Chronic diseases
                chronic = patient_profile.get("chronic_diseases", [])
                if chronic:
                    context += f"\n- 🏥 Хронические заболевания: {', '.join(chronic)}"
                
                # Hereditary diseases
                hereditary = patient_profile.get("hereditary_diseases", [])
                if hereditary:
                    context += f"\n- 🧬 Наследственные заболевания: {', '.join(hereditary)}"
                
                # Lifestyle
                lifestyle = patient_profile.get("lifestyle", {})
                if lifestyle:
                    context += f"\n- Образ жизни: {json.dumps(lifestyle, ensure_ascii=False)}"
            
            prompt = f"""Проанализируй результаты анализов с учётом профиля пациента.
{context}

📊 **РЕЗУЛЬТАТЫ АНАЛИЗОВ:**
{biomarker_text}

Дай ПЕРСОНАЛИЗИРОВАННУЮ расшифровку, учитывая все особенности пациента."""
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=2000,
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return self._generate_simple_summary(biomarkers)
    
    async def generate_search_keywords(
        self,
        biomarkers: List[Dict[str, Any]],
        patient_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, List[str]]:
        """
        Generate search keywords for finding products based on analysis.
        
        Returns:
            Dict where key is biomarker code (or 'general') and value is list of keywords.
        """
        if not settings.openai_api_key:
            return {}
        
        try:
            # Filter problem biomarkers
            problem_biomarkers = [
                b for b in biomarkers
                if b.get("status") in ("low", "high", "critical_low", "critical_high")
            ]
            
            if not problem_biomarkers:
                return {}
            
            biomarker_text = self._format_biomarkers_for_prompt(problem_biomarkers)
            
            profile_text = ""
            if patient_profile:
                profile_text = f"\nПрофиль пациента: {json.dumps(patient_profile, ensure_ascii=False)}"
            
            prompt = f"""Проанализируй отклонения в анализах и предложи ключевые слова для поиска БАДов и товаров в интернет-магазине.
            
Отклонения:
{biomarker_text}
{profile_text}

Верни JSON:
{{
    "biomarker_keywords": {{
        "CODE": ["keyword1", "keyword2"]
    }},
    "general_keywords": ["keyword3", "keyword4"]
}}
"""
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system", 
                        "content": "Ты — помощник по поиску БАДов. Генерируй точные поисковые запросы на русском языке (например: 'Железо хелат', 'Витамин D3', 'Омега-3')."
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            logger.error(f"Keyword generation failed: {e}")
            return {}

    async def generate_recommendations(
        self,
        biomarkers: List[Dict[str, Any]],
        available_products: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Generate product recommendations based on biomarker deficiencies.
        
        Args:
            biomarkers: List of biomarkers with status
            available_products: List of products from catalog
            
        Returns:
            List of recommendations with reasons
        """
        if not settings.openai_api_key or not available_products:
            return self._fallback_recommendations(biomarkers, available_products)
        
        try:
            # Filter biomarkers that need attention
            problem_biomarkers = [
                b for b in biomarkers
                if b.get("status") in ("low", "high", "critical_low", "critical_high")
            ]
            
            if not problem_biomarkers:
                return []
            
            # Prepare data for prompt
            biomarker_text = self._format_biomarkers_for_prompt(problem_biomarkers)
            products_text = self._format_products_for_prompt(available_products[:50])
            
            prompt = f"""На основе отклонений в анализах подбери подходящие добавки из каталога.

Отклонения в анализах:
{biomarker_text}

Доступные товары:
{products_text}

Верни JSON:
{{
    "recommendations": [
        {{
            "product_id": id_товара,
            "biomarker_code": "код_биомаркера",
            "reason": "почему этот товар поможет",
            "priority": 1-5,
            "confidence": 0.0-1.0
        }}
    ]
}}"""
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Ты — консультант по подбору БАДов. Рекомендуй только те товары, которые реально могут помочь с конкретными дефицитами. Отвечай только валидным JSON."
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get("recommendations", [])
            
        except Exception as e:
            logger.error(f"Recommendation generation failed: {e}")
            return self._fallback_recommendations(biomarkers, available_products)
    
    def _validate_extraction(self, result: Dict) -> Dict:
        """Validate and clean extracted data."""
        validated = {
            "lab_name": result.get("lab_name"),
            "analysis_date": result.get("analysis_date"),
            "biomarkers": [],
        }
        
        # Track (code, unit) pairs to allow both absolute and percentage values
        seen_combinations = set()
        
        for bio in result.get("biomarkers", []):
            # Skip invalid entries
            if not bio.get("code") or bio.get("value") is None:
                continue
            
            try:
                value = float(bio["value"])
            except (ValueError, TypeError):
                continue
            
            # Normalize code from AI output to ensure standard codes
            raw_code = bio.get("code", "")
            code = self._normalize_biomarker_code(raw_code)
            
            # Fallback для unit если AI не нашёл
            unit = bio.get("unit") or "ед."
            if not unit.strip():
                unit = "ед."
            
            # Skip duplicates (same code AND same unit)
            combination = (code, unit)
            if combination in seen_combinations:
                logger.info(f"Duplicate biomarker skipped: {code} ({unit})")
                continue
            seen_combinations.add(combination)
            
            # Get reference ranges
            ref_min = self._safe_float(bio.get("ref_min"))
            ref_max = self._safe_float(bio.get("ref_max"))
            
            # Fix decimal point if needed (e.g., 922 -> 92.2 for MCV)
            value = self._fix_decimal_point(code, value, ref_min, ref_max)
            
            ref_text = f", ref=[{ref_min}-{ref_max}]" if ref_min and ref_max else ", ref=None"
            logger.info(f"Biomarker processing: raw='{raw_code}', normalized='{code}', value={value}, unit='{unit}'{ref_text}")
            
            validated["biomarkers"].append({
                "code": code,
                "raw_name": bio.get("raw_name", ""),
                "value": value,
                "unit": unit,
                "ref_min": ref_min,
                "ref_max": ref_max,
            })
        
        return validated
    
    def _safe_float(self, value: Any) -> Optional[float]:
        """Safely convert value to float."""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _fix_decimal_point(self, code: str, value: float, ref_min: Optional[float], ref_max: Optional[float]) -> float:
        """Fix missing decimal point based on reference ranges."""
        # Известные диапазоны для общих биомаркеров
        known_ranges = {
            "MCV": (80, 100),      # Средний объем эритроцитов (фл)
            "MCH": (27, 35),       # Среднее содержание Hb в эритроците (пг)
            "MCHC": (32, 36),      # Средняя концентрация Hb (г/дл)
            "MPV": (7, 12),        # Средний объем тромбоцитов (фл)
            "HGB": (120, 180),     # Гемоглобин (г/л)
            "RBC": (4.0, 5.5),     # Эритроциты (10^12/л)
            "WBC": (4.0, 9.0),     # Лейкоциты (10^9/л)
            "PLT": (150, 400),     # Тромбоциты (10^9/л)
            "HCT": (36, 50),       # Гематокрит (%)
            "RDW": (11, 15),       # Ширина распределения эритроцитов (%)
            "PCT": (0.15, 0.40),   # Тромбокрит (%)
            "PDW": (10, 18),       # Ширина распределения тромбоцитов (%)
            "NEU": (2.0, 7.0),     # Нейтрофилы абс (10^9/л)
            "LYM": (1.0, 4.0),     # Лимфоциты абс (10^9/л)
            "MONO": (0.2, 0.8),    # Моноциты абс (10^9/л)
            "EOS": (0.02, 0.5),    # Эозинофилы абс (10^9/л)
            "BASO": (0.0, 0.1),    # Базофилы абс (10^9/л)
            "ESR": (0, 20),        # СОЭ (мм/час)
        }
        
        # Используем референсные значения если есть
        if ref_min is not None and ref_max is not None:
            expected_min = ref_min
            expected_max = ref_max
        elif code in known_ranges:
            expected_min, expected_max = known_ranges[code]
        else:
            # Не знаем диапазон, возвращаем как есть
            return value
        
        # Если значение слишком большое (в 10+ раз больше макс)
        if value > expected_max * 10:
            # Пробуем вставить точку перед последней цифрой
            # Например: 922 -> 92.2, 1540 -> 154.0
            value_str = str(int(value))
            if len(value_str) >= 2:
                fixed_str = value_str[:-1] + "." + value_str[-1]
                fixed_value = float(fixed_str)
                
                # Проверяем что исправленное значение в диапазоне
                if expected_min <= fixed_value <= expected_max * 1.5:
                    logger.info(f"[Decimal Fix] {code}: {value} -> {fixed_value} (ref: {expected_min}-{expected_max})")
                    return fixed_value
        
        return value
    
    def _enrich_with_regex(self, result: Dict, ocr_text: str) -> Dict:
        """Find missing critical biomarkers using regex."""
        logger.info(f"[Regex Rescue] Starting with {len(result.get('biomarkers', []))} biomarkers")
        logger.info(f"[Regex Rescue] OCR text preview (first 300 chars): {ocr_text[:300]}")
        logger.info(f"[Regex Rescue] FULL OCR text for debugging:\n{ocr_text}")
        
        existing_codes = {b["code"] for b in result.get("biomarkers", [])}
        logger.info(f"[Regex Rescue] Existing codes: {existing_codes}")
        
        # Regex patterns for critical hormones that AI might miss
        critical_patterns = {
            "TSH": [
                r"(?:ТТГ|TSH|Тиреотропный)[^:\d]*[:\s]*([\d.,]+)",
            ],
            "FT4": [
                r"(?:Т4\s*своб|FT4|T4\s*free)[^:\d]*[:\s]*([\d.,]+)",
            ],
            "TEST": [
                r"(?:Тестостерон|Testosterone)[^:\d]*[:\s]*([\d.,]+)",
            ],
            "SHBG": [
                r"(?:ГСПГ|SHBG|Sex\s*hormone)[^:\d]*[:\s]*([\d.,]+)",
            ],
            "PROL": [
                r"(?:Пролактин|Prolactin)[^:\d]*[:\s]*([\d.,]+)",
            ],
            "FAI": [
                r"(?:ИСТ|FAI|Index of Free Testosterone|Индекс своб\. тестостерона)[^:\d]*[:\s]*([\d.,]+)",
            ],
            "RDW": [
                r"(?:RDW|Ширина распредел|Отн.*ширина.*эритроц)[^:\d]*[:\s]*([\d.,]+)",
            ],
            "PDW": [
                r"(?:PDW|Относит.*ширина.*тромбоцит|отн.*ширина.*тромб)[^:\d]*[:\s]*([\d.,]+)",
            ]
        }
        
        for code, patterns in critical_patterns.items():
            if code in existing_codes:
                logger.info(f"[Regex Rescue] Skipping {code} (already exists)")
                continue
            
            logger.info(f"[Regex Rescue] Searching for missing {code}...")
            for pattern in patterns:
                match = re.search(pattern, ocr_text, re.IGNORECASE)
                if match:
                    try:
                        value_str = match.group(1).replace(",", ".")
                        # Clean value string from possible artifacts like trailing dots
                        value_str = value_str.rstrip(".")
                        value = float(value_str)
                        
                        logger.info(f"[Regex Rescue] ✅ Found missing {code} = {value}")
                        
                        result["biomarkers"].append({
                            "code": code,
                            "raw_name": "Rescued by Regex",
                            "value": value,
                            "unit": "ед.",  # Fallback unit for regex rescue
                            "ref_min": None,
                            "ref_max": None
                        })
                        existing_codes.add(code)
                        break
                    except ValueError as e:
                        logger.info(f"[Regex Rescue] ValueError for {code}: {e}")
                        continue
                else:
                    logger.info(f"[Regex Rescue] ❌ Pattern didn't match for {code}")
        
        # Специальная обработка для RDW-SD (стандартное отклонение с отметкой +)
        # Нужен приоритет над RDW-CV (коэфф. вариации)
        logger.info("[Regex Rescue] Checking for RDW-SD (standard deviation)...")
        
        # Паттерн с учётом возможных переносов строк и пробелов
        rdw_sd_pattern = r"(?:Отн[.\s]*ширина[.\s]*распред[.\s]*эритр[.\s]*по[.\s]*объем[^\d]*ст[.\s]*откл|RDW[.\s]*SD)[^\d]*([\d.,]+)\s*\+?\s*(?:фл|fl)\s*([\d.,]+)-([\d.,]+)"
        logger.info(f"[Regex Rescue] RDW-SD pattern: {rdw_sd_pattern}")
        rdw_sd_match = re.search(rdw_sd_pattern, ocr_text, re.IGNORECASE | re.DOTALL)
        
        if rdw_sd_match:
            try:
                value_str = rdw_sd_match.group(1).replace(",", ".").rstrip(".")
                ref_min_str = rdw_sd_match.group(2).replace(",", ".").rstrip(".")
                ref_max_str = rdw_sd_match.group(3).replace(",", ".").rstrip(".")
                value = float(value_str)
                ref_min = float(ref_min_str)
                ref_max = float(ref_max_str)
                
                logger.info(f"[Regex Rescue] ✅ Found RDW-SD = {value} фл, ref=[{ref_min}-{ref_max}]")
                
                # Заменяем существующий RDW если он есть и это CV (%)
                replaced = False
                for i, bm in enumerate(result.get("biomarkers", [])):
                    if bm.get("code") == "RDW" and bm.get("unit") == "%":
                        # Это RDW-CV, заменяем на RDW-SD
                        result["biomarkers"][i] = {
                            "code": "RDW",
                            "raw_name": "RDW-SD (ст.откл.)",
                            "value": value,
                            "unit": "фл",
                            "ref_min": ref_min,
                            "ref_max": ref_max
                        }
                        replaced = True
                        logger.info(f"[Regex Rescue] ✅ Replaced RDW-CV with RDW-SD")
                        break
                
                if not replaced and "RDW" not in existing_codes:
                    result["biomarkers"].append({
                        "code": "RDW",
                        "raw_name": "RDW-SD (ст.откл.)",
                        "value": value,
                        "unit": "фл",
                        "ref_min": ref_min,
                        "ref_max": ref_max
                    })
                    existing_codes.add("RDW")
                    logger.info(f"[Regex Rescue] ✅ Added RDW-SD")
            except (ValueError, IndexError) as e:
                logger.info(f"[Regex Rescue] Error parsing RDW-SD: {e}")
        
        # Добавляем процентные значения лейкоцитов (если их нет)
        logger.info("[Regex Rescue] Searching for percentage values of WBC...")
        
        leukocyte_percentage_patterns = {
            "NEU": [
                r"(?:Нейтрофил|Neutrophil|NEUT)[^\d]*(\d+[.,]\d+)\s*%\s*([\d.,]+)-([\d.,]+)",
                r"(?:Нейтрофил|Neutrophil|NEUT)[^\d]*(\d+[.,]\d+)\s*%",
            ],
            "LYM": [
                r"(?:Лимфоцит|Lymphocyte|LYMPH|LYM)[^\d]*(\d+[.,]\d+)\s*%\s*([\d.,]+)-([\d.,]+)",
                r"(?:Лимфоцит|Lymphocyte|LYMPH|LYM)[^\d]*(\d+[.,]\d+)\s*%",
            ],
            "MONO": [
                r"(?:Моноцит|Monocyte|MONO)[^\d]*(\d+[.,]\d+)\s*%\s*([\d.,]+)-([\d.,]+)",
                r"(?:Моноцит|Monocyte|MONO)[^\d]*(\d+[.,]\d+)\s*%",
            ],
            "EOS": [
                r"(?:Эозинофил|Eosinophil|EOS)[^\d]*(\d+[.,]\d+)\s*%\s*([\d.,]+)-([\d.,]+)",
                r"(?:Эозинофил|Eosinophil|EOS)[^\d]*(\d+[.,]\d+)\s*%",
            ],
            "BASO": [
                r"(?:Базофил|Basophil|BASO)[^\d]*(\d+[.,]\d+)\s*%\s*([\d.,]+)-([\d.,]+)",
                r"(?:Базофил|Basophil|BASO)[^\d]*(\d+[.,]\d+)\s*%",
            ],
        }
        
        # Проверяем какие из процентных значений уже есть
        existing_percentage_codes = set()
        existing_percentage_without_refs = []  # (index, code) для биомаркеров без референсов
        
        for i, bm in enumerate(result.get("biomarkers", [])):
            if bm.get("unit") == "%" and bm.get("code") in leukocyte_percentage_patterns:
                existing_percentage_codes.add(bm["code"])
                if not bm.get("ref_min") or not bm.get("ref_max"):
                    existing_percentage_without_refs.append((i, bm["code"]))
        
        for code, patterns in leukocyte_percentage_patterns.items():
            # Проверяем нужно ли обновить референсы для существующего биомаркера
            needs_update_index = None
            for idx, existing_code in existing_percentage_without_refs:
                if existing_code == code:
                    needs_update_index = idx
                    break
            
            if code in existing_percentage_codes and needs_update_index is None:
                logger.info(f"[Regex Rescue] {code}% already exists with refs")
                continue
            
            for idx, pattern in enumerate(patterns):
                logger.info(f"[Regex Rescue] Trying {code}% pattern #{idx+1}: {pattern[:50]}...")
                matches = re.findall(pattern, ocr_text, re.IGNORECASE)
                logger.info(f"[Regex Rescue] {code}% pattern #{idx+1} found {len(matches)} matches")
                if matches:
                    try:
                        # Берём последнее найденное значение (обычно процент идёт после абс)
                        match = matches[-1]
                        
                        # Если match tuple с (value, ref_min, ref_max)
                        if isinstance(match, tuple) and len(match) >= 3:
                            value_str = match[0].replace(",", ".").rstrip(".")
                            ref_min_str = match[1].replace(",", ".").rstrip(".")
                            ref_max_str = match[2].replace(",", ".").rstrip(".")
                            value = float(value_str)
                            ref_min = float(ref_min_str)
                            ref_max = float(ref_max_str)
                        elif isinstance(match, tuple):
                            value_str = match[0].replace(",", ".").rstrip(".")
                            value = float(value_str)
                            ref_min = None
                            ref_max = None
                        else:
                            value_str = match.replace(",", ".").rstrip(".")
                            value = float(value_str)
                            ref_min = None
                            ref_max = None
                        
                        # Проверка что это похоже на процент (0-100)
                        if 0 <= value <= 100:
                            logger.info(f"[Regex Rescue] ✅ Found {code}% = {value}, ref=[{ref_min}-{ref_max}]" if ref_min else f"[Regex Rescue] ✅ Found {code}% = {value}")
                            
                            # Если биомаркер существует но без референсов - обновляем
                            if needs_update_index is not None:
                                result["biomarkers"][needs_update_index]["ref_min"] = ref_min
                                result["biomarkers"][needs_update_index]["ref_max"] = ref_max
                                logger.info(f"[Regex Rescue] ✅ Updated {code}% references")
                            else:
                                # Добавляем новый
                                result["biomarkers"].append({
                                    "code": code,
                                    "raw_name": f"Rescued {code} %",
                                    "value": value,
                                    "unit": "%",
                                    "ref_min": ref_min,
                                    "ref_max": ref_max
                                })
                                existing_percentage_codes.add(code)
                            break
                    except (ValueError, IndexError) as e:
                        logger.info(f"[Regex Rescue] Error parsing {code}%: {e}")
                        continue
        
        logger.info(f"[Regex Rescue] Final count: {len(result.get('biomarkers', []))} biomarkers")
        return result

    def _fallback_parse(self, ocr_text: str) -> Dict:
        """
        Fallback regex-based parser when AI is unavailable.
        Handles common formats from Russian labs.
        """
        biomarkers = []
        
        # Common patterns for lab results
        patterns = [
            # "Гемоглобин: 140 г/л (120-160)"
            r"([А-Яа-яA-Za-z\s]+):\s*([\d.,]+)\s*([а-яА-Яa-zA-Z/³²]+)?\s*(?:\(?([\d.,]+)\s*[-–]\s*([\d.,]+)\)?)?",
            # "HGB 140 g/L"
            r"([A-Z]{2,5})\s+([\d.,]+)\s*([а-яА-Яa-zA-Z/³²]+)?",
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, ocr_text)
            for match in matches:
                if len(match) >= 2:
                    name = match[0].strip()
                    try:
                        value = float(match[1].replace(",", "."))
                    except ValueError:
                        continue
                    
                    unit = match[2] if len(match) > 2 else ""
                    ref_min = self._safe_float(match[3]) if len(match) > 3 else None
                    ref_max = self._safe_float(match[4]) if len(match) > 4 else None
                    
                    # Try to normalize code
                    code = self._normalize_biomarker_code(name)
                    
                    biomarkers.append({
                        "code": code,
                        "raw_name": name,
                        "value": value,
                        "unit": unit,
                        "ref_min": ref_min,
                        "ref_max": ref_max,
                    })
        
        return {
            "lab_name": None,
            "analysis_date": None,
            "biomarkers": biomarkers,
        }
    
    def _normalize_biomarker_code(self, name: str) -> str:
        """Normalize biomarker name to standard code."""
        name_lower = name.lower().strip()
        
        # Exact matches for short codes (to avoid substring conflicts)
        exact_matches = {
            "mchc": "MCHC",
            "mch": "MCH",
            "mcv": "MCV",
            "mpv": "MPV",
            "rdw": "RDW",
            "pdw": "PDW",
            "pct": "PCT",
            "hct": "HCT",
            "wbc": "WBC",
            "rbc": "RBC",
            "plt": "PLT",
            "hgb": "HGB",
            "hb": "HGB",
            "neu": "NEU",
            "lym": "LYM",
            "mono": "MONO",
            "eos": "EOS",
            "baso": "BASO",
            "esr": "ESR",
        }
        
        # Check exact match first
        if name_lower in exact_matches:
            return exact_matches[name_lower]
        
        mappings = {
            # ГОРМОНЫ (важно проверять первыми из-за пересечений имен)
            "гспг": "SHBG",
            "shbg": "SHBG",
            "sex hormone": "SHBG",
            "индекс своб": "FAI",
            "ист": "FAI",
            "fai": "FAI",
            "free androgen": "FAI",
            "тестостерон": "TEST",
            "testosterone": "TEST",
            "пролактин": "PROL",
            "prolactin": "PROL",
            "ттг": "TSH",
            "tsh": "TSH",
            "thyrotropin": "TSH",
            "тиреотропный": "TSH",
            "т4": "FT4",
            "ft4": "FT4",
            "free t4": "FT4",
            "свободный т4": "FT4",
            "т3": "FT3",
            "ft3": "FT3",
            "free t3": "FT3",

            # ГЕМАТОЛОГИЯ (ОБЩИЙ АНАЛИЗ КРОВИ)
            "гемоглобин": "HGB",
            "hemoglobin": "HGB",
            "hgb": "HGB",
            "hb": "HGB",
            "эритроциты": "RBC",
            "эритр": "RBC",
            "rbc": "RBC",
            "лейкоциты": "WBC",
            "лейк": "WBC",
            "wbc": "WBC",
            "тромбоциты": "PLT",
            "тромб": "PLT",
            "platelets": "PLT",
            "plt": "PLT",
            "гематокрит": "HCT",
            "hematocrit": "HCT",
            "hct": "HCT",
            "средний объем эритроцит": "MCV",
            "средний объём эритроцит": "MCV",
            "mcv": "MCV",
            # ВАЖНО: MCHC должна быть РАНЬШЕ MCH (проверка подстрок)
            "средняя концентрация hb": "MCHC",
            "средняя концентрация гемоглобина": "MCHC",
            "средняя конц": "MCHC",
            "mchc": "MCHC",
            "среднее содержание гемоглобина в эритроците": "MCH",
            "среднее содержание hb": "MCH",
            "среднее содержание hemoglobin": "MCH",
            "mch": "MCH",
            "ширина распределения эритроцит": "RDW",
            "отн.ширина распред.эритр": "RDW",
            "rdw": "RDW",
            "средний объем тромбоцит": "MPV",
            "средний объём тромбоцит": "MPV",
            "mpv": "MPV",
            "тромбокрит": "PCT",
            "pct": "PCT",
            "относит.ширина распред.тромбоцит": "PDW",
            "отн.ширина распред.тромб": "PDW",
            "pdw": "PDW",
            "нейтрофилы": "NEU",
            "neutrophils": "NEU",
            "neu": "NEU",
            "лимфоциты": "LYM",
            "lymphocytes": "LYM",
            "lym": "LYM",
            "моноциты": "MONO",
            "monocytes": "MONO",
            "mono": "MONO",
            "эозинофилы": "EOS",
            "eosinophils": "EOS",
            "eos": "EOS",
            "базофилы": "BASO",
            "basophils": "BASO",
            "baso": "BASO",
            "соэ": "ESR",
            "esr": "ESR",
            "глюкоза": "GLU",
            "glucose": "GLU",
            "холестерин": "CHOL",
            "cholesterol": "CHOL",
            "алт": "ALT",
            "alt": "ALT",
            "аст": "AST",
            "ast": "AST",
            "билирубин": "BILI",
            "bilirubin": "BILI",
            "креатинин": "CREA",
            "creatinine": "CREA",
            "мочевина": "UREA",
            "urea": "UREA",
            "железо": "FE",
            "iron": "FE",
            "fe": "FE",
            "ферритин": "FERR",
            "ferritin": "FERR",
            "витамин b12": "B12",
            "b12": "B12",
            "витамин d": "D3",
            "d3": "D3",
            "кальций": "CA",
            "calcium": "CA",
            "магний": "MG",
            "magnesium": "MG",
        }
        
        for key, code in mappings.items():
            if key in name_lower:
                return code
        
        # Return original if no mapping found
        return name.upper()[:10]
    
    def _format_biomarkers_for_prompt(self, biomarkers: List[Dict]) -> str:
        """Format biomarkers for AI prompt."""
        lines = []
        for b in biomarkers:
            status = b.get("status", "unknown")
            status_emoji = {
                "normal": "✅",
                "low": "⬇️",
                "high": "⬆️",
                "critical_low": "❌⬇️",
                "critical_high": "❌⬆️",
            }.get(status, "❓")
            
            ref_text = ""
            if b.get("ref_min") and b.get("ref_max"):
                ref_text = f" (норма: {b['ref_min']}-{b['ref_max']})"
            
            lines.append(
                f"{status_emoji} {b.get('code', 'N/A')}: "
                f"{b.get('value', 'N/A')} {b.get('unit', '')}{ref_text}"
            )
        
        return "\n".join(lines)
    
    def _format_products_for_prompt(self, products: List[Dict]) -> str:
        """Format products for AI prompt."""
        lines = []
        for p in products:
            ingredients = p.get("active_ingredients", "")
            benefits = p.get("health_benefits", "")
            
            lines.append(
                f"ID:{p['id']} | {p['name']} | "
                f"Состав: {ingredients} | Польза: {benefits}"
            )
        
        return "\n".join(lines)
    
    def _generate_simple_summary(self, biomarkers: List[Dict]) -> str:
        """Generate simple summary without AI."""
        normal = [b for b in biomarkers if b.get("status") == "normal"]
        low = [b for b in biomarkers if b.get("status") == "low"]
        high = [b for b in biomarkers if b.get("status") == "high"]
        critical = [b for b in biomarkers if b.get("status") in ("critical_low", "critical_high")]
        
        summary = "📊 **Результаты анализа**\n\n"
        
        if critical:
            summary += "❌ **Критические отклонения:**\n"
            for b in critical:
                summary += f"- {b.get('code')}: {b.get('value')} {b.get('unit')}\n"
            summary += "\n"
        
        if low:
            summary += "⬇️ **Ниже нормы:**\n"
            for b in low:
                summary += f"- {b.get('code')}: {b.get('value')} {b.get('unit')}\n"
            summary += "\n"
        
        if high:
            summary += "⬆️ **Выше нормы:**\n"
            for b in high:
                summary += f"- {b.get('code')}: {b.get('value')} {b.get('unit')}\n"
            summary += "\n"
        
        summary += f"✅ **В норме:** {len(normal)} показателей\n\n"
        summary += "⚠️ Рекомендуем проконсультироваться с врачом для интерпретации результатов."
        
        return summary
    
    def _fallback_recommendations(
        self,
        biomarkers: List[Dict],
        products: List[Dict],
    ) -> List[Dict]:
        """Simple rule-based recommendations without AI."""
        recommendations = []
        
        # Simple mapping of biomarker deficiencies to product keywords
        deficiency_keywords = {
            "FE": ["железо", "iron", "fe"],
            "FERR": ["ферритин", "железо", "iron"],
            "B12": ["b12", "б12", "кобаламин"],
            "D3": ["витамин d", "d3", "холекальциферол"],
            "MG": ["магний", "magnesium"],
            "ZN": ["цинк", "zinc"],
            "CA": ["кальций", "calcium"],
        }
        
        for bio in biomarkers:
            if bio.get("status") not in ("low", "critical_low"):
                continue
            
            code = bio.get("code", "").upper()
            keywords = deficiency_keywords.get(code, [])
            
            if not keywords:
                continue
            
            for product in products:
                product_text = (
                    f"{product.get('name', '')} "
                    f"{product.get('active_ingredients', '')} "
                    f"{product.get('health_benefits', '')}"
                ).lower()
                
                if any(kw in product_text for kw in keywords):
                    recommendations.append({
                        "product_id": product["id"],
                        "biomarker_code": code,
                        "reason": f"Содержит компоненты для восполнения дефицита {code}",
                        "priority": 1 if bio.get("status") == "critical_low" else 2,
                        "confidence": 0.6,
                    })
        
        return recommendations

