"""
Seed script to populate biomarkers reference data.
Run with: python -m scripts.seed_biomarkers
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.biomarker import Biomarker, BiomarkerReference, BiomarkerCategory


# Standard biomarkers data
BIOMARKERS_DATA = [
    # Hematology
    {
        "code": "HGB",
        "name_ru": "Гемоглобин",
        "name_en": "Hemoglobin",
        "category": BiomarkerCategory.HEMATOLOGY,
        "default_unit": "г/л",
        "aliases": "HGB,Hb,Гемоглобин,Hemoglobin,гемоглобин",
        "description": "Белок эритроцитов, переносящий кислород",
        "low_recommendations": "Возможна железодефицитная анемия. Рекомендуется проверить уровень железа и ферритина.",
        "high_recommendations": "Может указывать на обезвоживание или заболевания крови.",
        "references": [
            {"gender": "male", "ref_min": 130, "ref_max": 170, "unit": "г/л"},
            {"gender": "female", "ref_min": 120, "ref_max": 150, "unit": "г/л"},
        ]
    },
    {
        "code": "RBC",
        "name_ru": "Эритроциты",
        "name_en": "Red Blood Cells",
        "category": BiomarkerCategory.HEMATOLOGY,
        "default_unit": "×10¹²/л",
        "aliases": "RBC,Эритроциты,Red Blood Cells,эритроциты",
        "description": "Красные кровяные тельца",
        "references": [
            {"gender": "male", "ref_min": 4.0, "ref_max": 5.5, "unit": "×10¹²/л"},
            {"gender": "female", "ref_min": 3.5, "ref_max": 5.0, "unit": "×10¹²/л"},
        ]
    },
    {
        "code": "WBC",
        "name_ru": "Лейкоциты",
        "name_en": "White Blood Cells",
        "category": BiomarkerCategory.HEMATOLOGY,
        "default_unit": "×10⁹/л",
        "aliases": "WBC,Лейкоциты,White Blood Cells,лейкоциты",
        "description": "Белые кровяные тельца, отвечают за иммунитет",
        "references": [
            {"ref_min": 4.0, "ref_max": 9.0, "unit": "×10⁹/л"},
        ]
    },
    {
        "code": "PLT",
        "name_ru": "Тромбоциты",
        "name_en": "Platelets",
        "category": BiomarkerCategory.HEMATOLOGY,
        "default_unit": "×10⁹/л",
        "aliases": "PLT,Тромбоциты,Platelets,тромбоциты",
        "description": "Клетки, отвечающие за свертывание крови",
        "references": [
            {"ref_min": 150, "ref_max": 400, "unit": "×10⁹/л"},
        ]
    },
    {
        "code": "ESR",
        "name_ru": "СОЭ",
        "name_en": "Erythrocyte Sedimentation Rate",
        "category": BiomarkerCategory.INFLAMMATION,
        "default_unit": "мм/ч",
        "aliases": "ESR,СОЭ,скорость оседания эритроцитов",
        "description": "Показатель воспаления в организме",
        "references": [
            {"gender": "male", "ref_min": 0, "ref_max": 10, "unit": "мм/ч"},
            {"gender": "female", "ref_min": 0, "ref_max": 15, "unit": "мм/ч"},
        ]
    },
    
    # Biochemistry
    {
        "code": "GLU",
        "name_ru": "Глюкоза",
        "name_en": "Glucose",
        "category": BiomarkerCategory.BIOCHEMISTRY,
        "default_unit": "ммоль/л",
        "aliases": "GLU,Глюкоза,Glucose,сахар,глюкоза",
        "description": "Уровень сахара в крови",
        "references": [
            {"ref_min": 3.9, "ref_max": 6.1, "unit": "ммоль/л"},
        ]
    },
    {
        "code": "CHOL",
        "name_ru": "Холестерин общий",
        "name_en": "Total Cholesterol",
        "category": BiomarkerCategory.LIPIDS,
        "default_unit": "ммоль/л",
        "aliases": "CHOL,Холестерин,Cholesterol,холестерин",
        "description": "Общий уровень холестерина",
        "high_recommendations": "Рекомендуется пересмотреть диету и увеличить физическую активность.",
        "references": [
            {"ref_min": 0, "ref_max": 5.2, "unit": "ммоль/л"},
        ]
    },
    {
        "code": "ALT",
        "name_ru": "АЛТ",
        "name_en": "Alanine Aminotransferase",
        "category": BiomarkerCategory.LIVER,
        "default_unit": "Ед/л",
        "aliases": "ALT,АЛТ,аланинаминотрансфераза",
        "description": "Фермент печени",
        "references": [
            {"gender": "male", "ref_min": 0, "ref_max": 41, "unit": "Ед/л"},
            {"gender": "female", "ref_min": 0, "ref_max": 33, "unit": "Ед/л"},
        ]
    },
    {
        "code": "AST",
        "name_ru": "АСТ",
        "name_en": "Aspartate Aminotransferase",
        "category": BiomarkerCategory.LIVER,
        "default_unit": "Ед/л",
        "aliases": "AST,АСТ,аспартатаминотрансфераза",
        "description": "Фермент печени и сердца",
        "references": [
            {"gender": "male", "ref_min": 0, "ref_max": 40, "unit": "Ед/л"},
            {"gender": "female", "ref_min": 0, "ref_max": 32, "unit": "Ед/л"},
        ]
    },
    {
        "code": "CREA",
        "name_ru": "Креатинин",
        "name_en": "Creatinine",
        "category": BiomarkerCategory.KIDNEY,
        "default_unit": "мкмоль/л",
        "aliases": "CREA,Креатинин,Creatinine,креатинин",
        "description": "Показатель функции почек",
        "references": [
            {"gender": "male", "ref_min": 62, "ref_max": 106, "unit": "мкмоль/л"},
            {"gender": "female", "ref_min": 44, "ref_max": 80, "unit": "мкмоль/л"},
        ]
    },
    
    # Vitamins and minerals
    {
        "code": "FE",
        "name_ru": "Железо",
        "name_en": "Iron",
        "category": BiomarkerCategory.MINERALS,
        "default_unit": "мкмоль/л",
        "aliases": "FE,Железо,Iron,железо,Fe",
        "description": "Уровень железа в сыворотке крови",
        "low_recommendations": "Рекомендуется увеличить потребление железосодержащих продуктов и добавок.",
        "references": [
            {"gender": "male", "ref_min": 11.6, "ref_max": 31.3, "unit": "мкмоль/л"},
            {"gender": "female", "ref_min": 9.0, "ref_max": 30.4, "unit": "мкмоль/л"},
        ]
    },
    {
        "code": "FERR",
        "name_ru": "Ферритин",
        "name_en": "Ferritin",
        "category": BiomarkerCategory.MINERALS,
        "default_unit": "мкг/л",
        "aliases": "FERR,Ферритин,Ferritin,ферритин",
        "description": "Запас железа в организме",
        "low_recommendations": "Низкий ферритин указывает на истощение запасов железа. Рекомендуются препараты железа.",
        "references": [
            {"gender": "male", "ref_min": 30, "ref_max": 400, "unit": "мкг/л"},
            {"gender": "female", "ref_min": 13, "ref_max": 150, "unit": "мкг/л"},
        ]
    },
    {
        "code": "B12",
        "name_ru": "Витамин B12",
        "name_en": "Vitamin B12",
        "category": BiomarkerCategory.VITAMINS,
        "default_unit": "пмоль/л",
        "aliases": "B12,Витамин B12,Vitamin B12,кобаламин,Б12",
        "description": "Витамин, необходимый для нервной системы и кроветворения",
        "low_recommendations": "Дефицит B12 может вызывать анемию и неврологические проблемы. Рекомендуются добавки B12.",
        "references": [
            {"ref_min": 187, "ref_max": 883, "unit": "пмоль/л"},
        ]
    },
    {
        "code": "D3",
        "name_ru": "Витамин D",
        "name_en": "Vitamin D",
        "category": BiomarkerCategory.VITAMINS,
        "default_unit": "нг/мл",
        "aliases": "D3,Витамин D,Vitamin D,25-OH,кальциферол",
        "description": "Витамин, важный для костей и иммунитета",
        "low_recommendations": "Дефицит витамина D очень распространен. Рекомендуется прием витамина D3.",
        "references": [
            {"ref_min": 30, "ref_max": 100, "unit": "нг/мл", "optimal_min": 40, "optimal_max": 60},
        ]
    },
    {
        "code": "MG",
        "name_ru": "Магний",
        "name_en": "Magnesium",
        "category": BiomarkerCategory.MINERALS,
        "default_unit": "ммоль/л",
        "aliases": "MG,Магний,Magnesium,магний,Mg",
        "description": "Минерал, важный для мышц и нервной системы",
        "low_recommendations": "Дефицит магния может вызывать мышечные судороги и усталость. Рекомендуются добавки магния.",
        "references": [
            {"ref_min": 0.66, "ref_max": 1.07, "unit": "ммоль/л"},
        ]
    },
    {
        "code": "ZN",
        "name_ru": "Цинк",
        "name_en": "Zinc",
        "category": BiomarkerCategory.MINERALS,
        "default_unit": "мкмоль/л",
        "aliases": "ZN,Цинк,Zinc,цинк,Zn",
        "description": "Минерал, важный для иммунитета и кожи",
        "low_recommendations": "Дефицит цинка может ослаблять иммунитет. Рекомендуются добавки цинка.",
        "references": [
            {"ref_min": 10.7, "ref_max": 18.4, "unit": "мкмоль/л"},
        ]
    },
    
    # Thyroid
    {
        "code": "TSH",
        "name_ru": "ТТГ",
        "name_en": "Thyroid Stimulating Hormone",
        "category": BiomarkerCategory.THYROID,
        "default_unit": "мкМЕ/мл",
        "aliases": "TSH,ТТГ,тиреотропный гормон",
        "description": "Гормон, регулирующий работу щитовидной железы",
        "references": [
            {"ref_min": 0.4, "ref_max": 4.0, "unit": "мкМЕ/мл"},
        ]
    },
    {
        "code": "T4",
        "name_ru": "Т4 свободный",
        "name_en": "Free T4",
        "category": BiomarkerCategory.THYROID,
        "default_unit": "пмоль/л",
        "aliases": "T4,Т4,тироксин свободный,FT4",
        "description": "Гормон щитовидной железы",
        "references": [
            {"ref_min": 12, "ref_max": 22, "unit": "пмоль/л"},
        ]
    },
    
    # Inflammation
    {
        "code": "CRP",
        "name_ru": "С-реактивный белок",
        "name_en": "C-Reactive Protein",
        "category": BiomarkerCategory.INFLAMMATION,
        "default_unit": "мг/л",
        "aliases": "CRP,СРБ,С-реактивный белок,C-Reactive Protein",
        "description": "Маркер воспаления в организме",
        "high_recommendations": "Повышенный CRP указывает на воспалительный процесс. Рекомендуется консультация врача.",
        "references": [
            {"ref_min": 0, "ref_max": 5, "unit": "мг/л"},
        ]
    },
]


async def seed_biomarkers():
    """Seed biomarkers into database."""
    async with async_session_maker() as db:
        print("Starting biomarker seeding...")
        
        for bio_data in BIOMARKERS_DATA:
            # Check if exists
            stmt = select(Biomarker).where(Biomarker.code == bio_data["code"])
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"  Skipping {bio_data['code']} (already exists)")
                continue
            
            # Create biomarker
            references_data = bio_data.pop("references", [])
            
            biomarker = Biomarker(**bio_data)
            db.add(biomarker)
            await db.flush()
            
            # Create references
            for ref_data in references_data:
                reference = BiomarkerReference(
                    biomarker_id=biomarker.id,
                    **ref_data
                )
                db.add(reference)
            
            print(f"  Created {bio_data['code']}")
        
        await db.commit()
        print("Biomarker seeding completed!")


if __name__ == "__main__":
    asyncio.run(seed_biomarkers())



